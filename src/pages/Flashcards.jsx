import { useState, useEffect, useMemo, useRef } from "react";
import { Check, X, Volume2, VolumeX } from "lucide-react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import FlashcardModeSelector from "../components/FlashcardModeSelector";
import ExamplesPanel from "../components/ExamplesPanel";
import ExamplesToggleButton from "../components/ExamplesToggleButton";
import { scheduleExamplesAutoScroll } from "../lib/examplesAutoScroll";
import { SFX_EVENTS } from "../lib/sfx";
import {
  addXP,
  recordCorrect,
  recordIncorrect,
  updateStreak,
  recordStudySession,
  playSound,
  getSoundState,
  saveSoundState,
  getGameState,
  saveGameState,
} from "../lib/gameState";
import {
  LEARNING_STATUS,
  getStudyQueue,
  loadReviewPreferences,
  normalizeVocabularyItem,
  updateStatsAfterReview,
} from "../lib/learningEngine";
import {
  getPreferredStudyMode,
  setPreferredStudyMode,
} from "../lib/studyModePreference";
import {
  consumeVocabularyCacheRefreshFlag,
  getCachedVocabularyRows,
  setCachedVocabularyRows,
} from "../lib/vocabularyCache";

const FLASHCARD_CARD_WIDTH = 671.2;
const FLASHCARD_CARD_HEIGHT = 335.3;
const FLASHCARD_MAIN_TEXT_MIN_SIZE = 22;
const FLASHCARD_MAIN_TEXT_MIN_SIZE_MOBILE = 12.672;
const FLASHCARD_MAIN_TEXT_MAX_SIZE = 47;
const FLASHCARD_MAIN_TEXT_MAX_SIZE_MOBILE = 28.16;
const FLASHCARD_MAIN_TEXT_FIXED_SIZE_MOBILE = 28;
const FLASHCARD_MAIN_TEXT_FIXED_LINE_HEIGHT_MOBILE = 35;
const FLASHCARD_MAIN_TEXT_WRAPPED_SIZE_MOBILE = 22;
const FLASHCARD_MAIN_TEXT_WRAPPED_LINE_HEIGHT_MOBILE = 34;
const FLASHCARD_MOBILE_BREAKPOINT = 767;
const FLASHCARD_REVEAL_HINT_NARROW_MOBILE_MAX_WIDTH = 390;
const FLASHCARD_REVEAL_HINT_NARROW_MOBILE_OFFSET_Y = -10;
const FLASHCARD_DISCARD_TRANSITION_MS = 940;
const FLASHCARD_DISCARD_CLEANUP_MS = 1040;
const FLASHCARD_DISCARD_TRANSLATE_X = 520;
const FLASHCARD_DISCARD_ROTATE_DEG = 20;
const FLASHCARD_DISCARD_SCALE = 0.9;
const FLASHCARD_DISCARD_EASING = "cubic-bezier(0.22, 0.61, 0.36, 1)";
const FLASHCARD_POINTER_SFX_GUARD_MS = 700;

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function updateDominatedCount(items) {
  const game = getGameState();
  const nextDominatedCount = items.filter(
    (item) => item?.stats?.status === LEARNING_STATUS.DOMINADA
  ).length;

  if (game.dominatedCount === nextDominatedCount) return;

  game.dominatedCount = nextDominatedCount;
  saveGameState(game);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getAdaptiveLineHeightMultiplier(fontSize) {
  if (fontSize >= 42) return 1.12;
  if (fontSize >= 34) return 1.16;
  if (fontSize >= 28) return 1.2;
  return 1.24;
}

function getRenderedTextLineCount(textElement) {
  if (!textElement || typeof document === "undefined") return 1;

  const text = textElement.textContent || "";
  if (!text.trim()) return 1;

  let range = null;

  try {
    range = document.createRange();
    range.selectNodeContents(textElement);

    const rects = Array.from(range.getClientRects()).filter(
      (rect) => rect.width > 0 && rect.height > 0
    );

    if (rects.length === 0) return 1;

    const lineTops = [];

    rects.forEach((rect) => {
      const top = Math.round(rect.top);
      const alreadyCounted = lineTops.some(
        (lineTop) => Math.abs(lineTop - top) <= 1
      );

      if (!alreadyCounted) {
        lineTops.push(top);
      }
    });

    return Math.max(1, lineTops.length);
  } catch {
    const computedStyle = window.getComputedStyle?.(textElement);
    const lineHeight = Number.parseFloat(computedStyle?.lineHeight || "0");

    if (!lineHeight) return 1;

    return Math.max(1, Math.round(textElement.scrollHeight / lineHeight));
  } finally {
    range?.detach?.();
  }
}

function getAdaptiveMainTextStyle(content) {
  const text = typeof content === "string" ? content.trim() : "";
  const length = text.length;
  const words = text ? text.split(/\s+/).length : 1;
  const isMobileViewport =
    typeof window !== "undefined" &&
    window.innerWidth <= FLASHCARD_MOBILE_BREAKPOINT;

  if (isMobileViewport) {
    return {
      fontSize: FLASHCARD_MAIN_TEXT_FIXED_SIZE_MOBILE,
      lineHeight: FLASHCARD_MAIN_TEXT_FIXED_LINE_HEIGHT_MOBILE,
      maxWidth: "98%",
      overflowWrap: "break-word",
      wordBreak: "normal",
      hyphens: "auto",
    };
  }

  const minFontSize = FLASHCARD_MAIN_TEXT_MIN_SIZE;
  const maxFontSize = FLASHCARD_MAIN_TEXT_MAX_SIZE;
  const longestWord = text
    ? text.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0)
    : 0;

  let size = maxFontSize;

  if (length > 10) size -= 2;
  if (length > 18) size -= 2;
  if (length > 28) size -= 4;
  if (length > 38) size -= 4;
  if (length > 52) size -= 4;
  if (length > 68) size -= 4;

  if (words >= 5) size -= 2;
  if (words >= 8) size -= 2;
  if (longestWord >= 14) size -= 2;
  if (longestWord >= 20) size -= 2;

  const fontSize = clamp(size, minFontSize, maxFontSize);
  const lineHeightMultiplier = getAdaptiveLineHeightMultiplier(fontSize);

  let maxWidth = "95%";
  if (length > 35) maxWidth = "92%";
  if (length > 55) maxWidth = "90%";

  return {
    fontSize,
    lineHeight: Math.round(fontSize * lineHeightMultiplier),
    maxWidth,
    overflowWrap: longestWord >= 16 ? "anywhere" : "break-word",
    wordBreak: longestWord >= 16 ? "break-word" : "normal",
    hyphens: "auto",
  };
}

function fitMainTextToSlot(textElement, slotElement, preferredFontSize) {
  if (!textElement || !slotElement) return;

  const isMobile =
    typeof window !== "undefined" &&
    window.innerWidth <= FLASHCARD_MOBILE_BREAKPOINT;

  if (isMobile) {
    const applyMobileSize = (fontSize, lineHeight) => {
      textElement.style.fontSize = `${fontSize}px`;
      textElement.style.lineHeight = `${lineHeight}px`;
      textElement.style.maxWidth = "98%";
      textElement.style.marginInline = "auto";
      textElement.style.overflowWrap = "break-word";
      textElement.style.wordBreak = "normal";
      textElement.style.hyphens = "auto";
    };

    applyMobileSize(
      FLASHCARD_MAIN_TEXT_FIXED_SIZE_MOBILE,
      FLASHCARD_MAIN_TEXT_FIXED_LINE_HEIGHT_MOBILE
    );

    // ForÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½a o navegador a recalcular o layout antes de medir as linhas reais.
    textElement.getBoundingClientRect();

    const renderedLineCount = getRenderedTextLineCount(textElement);

    if (renderedLineCount > 1) {
      applyMobileSize(
        FLASHCARD_MAIN_TEXT_WRAPPED_SIZE_MOBILE,
        FLASHCARD_MAIN_TEXT_WRAPPED_LINE_HEIGHT_MOBILE
      );
    }

    return;
  }

  const minFontSize = FLASHCARD_MAIN_TEXT_MIN_SIZE;
  const maxFontSize = FLASHCARD_MAIN_TEXT_MAX_SIZE;

  let currentSize = clamp(
    Math.round(preferredFontSize),
    minFontSize,
    maxFontSize
  );

  const applySize = (size) => {
    textElement.style.fontSize = `${size}px`;
    textElement.style.lineHeight = `${Math.round(
      size * getAdaptiveLineHeightMultiplier(size)
    )}px`;
  };

  applySize(currentSize);

  let safetyCounter = 0;
  while (safetyCounter < 64 && currentSize > minFontSize) {
    const targetHeight = slotElement.clientHeight;
    const targetWidth = slotElement.clientWidth;
    const overflowHeight = textElement.scrollHeight > targetHeight;
    const overflowWidth = textElement.scrollWidth > targetWidth;

    if (!overflowHeight && !overflowWidth) {
      break;
    }

    currentSize -= 1;
    applySize(currentSize);
    safetyCounter += 1;
  }
}

export default function Flashcards() {
  const { user } = useAuth();
  const location = useLocation();

  const [baseVocab, setBaseVocab] = useState([]);
  const [vocab, setVocab] = useState([]);
  const [mode, setMode] = useState(() => getPreferredStudyMode("en_pt"));
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [hasInteractedWithCard, setHasInteractedWithCard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionDone, setSessionDone] = useState(false);
  const [activeMeaning, setActiveMeaning] = useState(null);
  const [cardDir, setCardDir] = useState("en_pt");
  const [soundEnabled, setSoundEnabled] = useState(() => getSoundState().enabled);
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [activeResponseButton, setActiveResponseButton] = useState(null);
  const [suppressFlipResetTransition, setSuppressFlipResetTransition] = useState(false);
  const [isNarrowMobileFlashcardViewport, setIsNarrowMobileFlashcardViewport] =
    useState(false);
  const responseLockRef = useRef(false);
  const prevModeRef = useRef(mode);
  const frontTextRef = useRef(null);
  const backTextRef = useRef(null);
  const frontTextSlotRef = useRef(null);
  const backTextSlotRef = useRef(null);
  const flashcardStageRef = useRef(null);
  const flashcardRef = useRef(null);
  const discardTimersRef = useRef([]);
  const discardNodesRef = useRef([]);
  const examplesPanelRef = useRef(null);
  const lastFlipPointerSfxAtRef = useRef(0);
  const lastDiscardPointerSfxAtRef = useRef(0);
  const cardStartTimeRef = useRef(Date.now());

  const clearDiscardOverlays = () => {
    discardTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    discardTimersRef.current = [];
    discardNodesRef.current.forEach((node) => {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    });
    discardNodesRef.current = [];
  };

  const spawnDiscardOverlay = (direction) => {
    const stageElement = flashcardStageRef.current;
    const sourceElement = flashcardRef.current;
    if (!stageElement || !sourceElement) return;

    const stageRect = stageElement.getBoundingClientRect();
    const sourceRect = sourceElement.getBoundingClientRect();
    const discardNode = sourceElement.cloneNode(true);

    discardNode.removeAttribute("id");
    discardNode.style.position = "absolute";
    discardNode.style.top = `${sourceRect.top - stageRect.top}px`;
    discardNode.style.left = `${sourceRect.left - stageRect.left}px`;
    discardNode.style.width = `${sourceRect.width}px`;
    discardNode.style.height = `${sourceRect.height}px`;
    discardNode.style.maxWidth = "none";
    discardNode.style.aspectRatio = "auto";
    discardNode.style.margin = "0";
    discardNode.style.zIndex = "20";
    discardNode.style.pointerEvents = "none";
    discardNode.style.transform = "translateX(0) rotate(0deg) scale(1)";
    discardNode.style.opacity = "1";
    discardNode.style.willChange = "transform, opacity";
    discardNode.style.transition = "none";

    stageElement.appendChild(discardNode);
    discardNodesRef.current.push(discardNode);

    requestAnimationFrame(() => {
      discardNode.style.transition = `transform ${FLASHCARD_DISCARD_TRANSITION_MS}ms ${FLASHCARD_DISCARD_EASING}, opacity ${FLASHCARD_DISCARD_TRANSITION_MS}ms ${FLASHCARD_DISCARD_EASING}`;
      discardNode.style.transform = `translateX(${
        direction === "left"
          ? `-${FLASHCARD_DISCARD_TRANSLATE_X}px`
          : `${FLASHCARD_DISCARD_TRANSLATE_X}px`
      }) rotate(${
        direction === "left"
          ? `-${FLASHCARD_DISCARD_ROTATE_DEG}deg`
          : `${FLASHCARD_DISCARD_ROTATE_DEG}deg`
      }) scale(${FLASHCARD_DISCARD_SCALE})`;
      discardNode.style.opacity = "0";
    });

    const cleanupTimer = setTimeout(() => {
      if (discardNode.parentNode) discardNode.parentNode.removeChild(discardNode);
      discardNodesRef.current = discardNodesRef.current.filter(
        (node) => node !== discardNode
      );
      discardTimersRef.current = discardTimersRef.current.filter(
        (timerId) => timerId !== cleanupTimer
      );
    }, FLASHCARD_DISCARD_CLEANUP_MS);

    discardTimersRef.current.push(cleanupTimer);
  };

  useEffect(() => {
    return () => {
      clearDiscardOverlays();
    };
  }, []);

  useEffect(() => {
    const updateNarrowMobileViewport = () => {
      if (typeof window === "undefined") return;

      const viewportWidth = Math.round(
        window.visualViewport?.width ||
          window.innerWidth ||
          document.documentElement?.clientWidth ||
          0
      );

      setIsNarrowMobileFlashcardViewport(
        Boolean(
          viewportWidth > 0 &&
            viewportWidth <= FLASHCARD_REVEAL_HINT_NARROW_MOBILE_MAX_WIDTH
        )
      );
    };

    updateNarrowMobileViewport();
    window.addEventListener("resize", updateNarrowMobileViewport);
    window.addEventListener("orientationchange", updateNarrowMobileViewport);
    window.visualViewport?.addEventListener(
      "resize",
      updateNarrowMobileViewport
    );

    return () => {
      window.removeEventListener("resize", updateNarrowMobileViewport);
      window.removeEventListener("orientationchange", updateNarrowMobileViewport);
      window.visualViewport?.removeEventListener(
        "resize",
        updateNarrowMobileViewport
      );
    };
  }, []);

  const buildVocabularyFromRows = (rows) => {
    const reviewPreferences = loadReviewPreferences();
    const focus = new URLSearchParams(location.search).get("focus");
    const normalizedItems = Array.isArray(rows)
      ? rows.map((row) => normalizeVocabularyItem(row, reviewPreferences))
      : [];

    return getStudyQueue(normalizedItems, reviewPreferences, focus).items;
  };

  const fetchVocabularyRows = async () => {
    if (!user?.id) return [];

    const { data, error } = await supabase
      .from("vocabulary")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  };

  useEffect(() => {
    let isMounted = true;

    const applyVocabulary = (items, { trackSession = false } = {}) => {
      const prepared = mode === "random" ? shuffleArray(items) : items;

      if (trackSession) {
        recordStudySession();
        updateStreak();
      }

      updateDominatedCount(prepared);

      if (!isMounted) return;

      setBaseVocab(items);
      setVocab(prepared);
      setCurrent(0);
      setFlipped(false);
      setShowExamples(false);
      setHasInteractedWithCard(false);
      setSessionDone(false);
      setIsSubmittingResponse(false);
      setActiveResponseButton(null);
      setSuppressFlipResetTransition(false);
      clearDiscardOverlays();
      responseLockRef.current = false;
    };

    async function refreshVocabulary({
      showSpinner = true,
      applyToState = true,
      trackSession = false,
    } = {}) {
      try {
        if (showSpinner) {
          setLoading(true);
        }

        const rows = await fetchVocabularyRows();
        setCachedVocabularyRows(user.id, rows);

        if (!applyToState || !isMounted) return;

        const items = buildVocabularyFromRows(rows);
        applyVocabulary(items, { trackSession });
      } catch (error) {
        console.error("Erro ao carregar vocabulÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio no Flashcards:", error);
        if (!applyToState || !isMounted) return;
        setBaseVocab([]);
        setVocab([]);
      } finally {
        if (isMounted && (showSpinner || applyToState)) {
          setLoading(false);
        }
      }
    }

    if (!user?.id) {
      setBaseVocab([]);
      setVocab([]);
      setCurrent(0);
      setFlipped(false);
      setShowExamples(false);
      setHasInteractedWithCard(false);
      setSessionDone(false);
      setIsSubmittingResponse(false);
      setActiveResponseButton(null);
      setSuppressFlipResetTransition(false);
      clearDiscardOverlays();
      responseLockRef.current = false;
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const shouldForceRefresh = consumeVocabularyCacheRefreshFlag(user.id);
    const cachedRows = shouldForceRefresh ? null : getCachedVocabularyRows(user.id);
    if (Array.isArray(cachedRows)) {
      const cachedItems = buildVocabularyFromRows(cachedRows);
      applyVocabulary(cachedItems, { trackSession: true });
      setLoading(false);
      refreshVocabulary({
        showSpinner: false,
        applyToState: false,
        trackSession: false,
      });
    } else {
      refreshVocabulary({
        showSpinner: true,
        applyToState: true,
        trackSession: true,
      });
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id, location.search]);

  useEffect(() => {
    if (loading || baseVocab.length === 0) return;
    if (prevModeRef.current === mode) return;

    prevModeRef.current = mode;

    const prepared = mode === "random" ? shuffleArray(baseVocab) : [...baseVocab];
    setVocab(prepared);
    setCurrent(0);
    setFlipped(false);
    setShowExamples(false);
    setHasInteractedWithCard(false);
    setSessionDone(false);
    setIsSubmittingResponse(false);
    setActiveResponseButton(null);
    setSuppressFlipResetTransition(false);
    clearDiscardOverlays();
    responseLockRef.current = false;
    updateDominatedCount(prepared);
  }, [mode, baseVocab, loading]);

  useEffect(() => {
    setPreferredStudyMode(mode);
  }, [mode]);

  useEffect(() => {
    if (!suppressFlipResetTransition) return;

    const frameId = requestAnimationFrame(() => {
      setSuppressFlipResetTransition(false);
    });

    return () => cancelAnimationFrame(frameId);
  }, [suppressFlipResetTransition, current]);

  useEffect(() => {
    const card = vocab[current];
    if (!card) return;

    const meanings = card.meanings || [];
    const meaningIndex =
      meanings.length > 1 ? Math.floor(Math.random() * meanings.length) : 0;

    setActiveMeaning(meanings[meaningIndex] || null);

    const direction =
      mode === "random" ? (Math.random() > 0.5 ? "en_pt" : "pt_en") : mode;

    setCardDir(direction);
    setFlipped(false);
    setShowExamples(false);
    setHasInteractedWithCard(false);
    setIsSubmittingResponse(false);
    setActiveResponseButton(null);
    responseLockRef.current = false;
  }, [current, vocab, mode]);

  const card = vocab[current];
  const front = cardDir === "en_pt" ? card?.term : activeMeaning?.meaning;
  const back = cardDir === "en_pt" ? activeMeaning?.meaning : card?.term;
  const frontTextStyle = useMemo(() => getAdaptiveMainTextStyle(front), [front]);
  const backTextStyle = useMemo(() => getAdaptiveMainTextStyle(back), [back]);
  const progressPct = vocab.length > 0 ? ((current + 1) / vocab.length) * 100 : 0;
  const revealHintMobileStyle = isNarrowMobileFlashcardViewport
    ? {
        transform: `translateY(${FLASHCARD_REVEAL_HINT_NARROW_MOBILE_OFFSET_Y}px)`,
      }
    : undefined;

  useEffect(() => {
    const fitVisibleTexts = () => {
      fitMainTextToSlot(
        frontTextRef.current,
        frontTextSlotRef.current,
        frontTextStyle.fontSize
      );
      fitMainTextToSlot(
        backTextRef.current,
        backTextSlotRef.current,
        backTextStyle.fontSize
      );
    };

    const animationFrame = requestAnimationFrame(fitVisibleTexts);
    window.addEventListener("resize", fitVisibleTexts);

    let observer = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(fitVisibleTexts);

      if (frontTextSlotRef.current) observer.observe(frontTextSlotRef.current);
      if (backTextSlotRef.current) observer.observe(backTextSlotRef.current);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", fitVisibleTexts);
      if (observer) observer.disconnect();
    };
  }, [
    front,
    back,
    frontTextStyle.fontSize,
    backTextStyle.fontSize,
    cardDir,
  ]);

  useEffect(() => {
    if (!showExamples) return;
    return scheduleExamplesAutoScroll(() => examplesPanelRef.current);
  }, [showExamples]);

  useEffect(() => {
    if (!showExamples) return undefined;
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const isDesktopViewport = () =>
      window.matchMedia("(min-width: 768px)").matches;
    const isFullscreenActive = () =>
      Boolean(document.fullscreenElement || document.webkitFullscreenElement);

    const handleEscapeToCloseExamples = (event) => {
      if (event.key !== "Escape" && event.code !== "Escape") return;
      if (!isDesktopViewport()) return;
      if (isFullscreenActive()) return;

      event.preventDefault();
      setShowExamples(false);
    };

    document.addEventListener("keydown", handleEscapeToCloseExamples);

    return () => {
      document.removeEventListener("keydown", handleEscapeToCloseExamples);
    };
  }, [showExamples]);

  const toggleSound = () => {
    const state = getSoundState();
    const newEnabled = !state.enabled;
    saveSoundState({ ...state, enabled: newEnabled });
    setSoundEnabled(newEnabled);
  };

  const hasActiveSelectionInsideCard = () => {
    if (typeof window === "undefined") return false;

    const selection = window.getSelection();
    const cardNode = flashcardRef.current;
    if (!selection || !cardNode || selection.isCollapsed || selection.rangeCount === 0) {
      return false;
    }

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    if (!anchorNode || !focusNode) return false;

    const hasText = selection.toString().trim().length > 0;
    const isInsideCard = cardNode.contains(anchorNode) && cardNode.contains(focusNode);

    return hasText && isInsideCard;
  };

  const shouldSkipClickSfxAfterPointer = (lastPointerSfxAt, event) => {
    if (!event) return false;
    if (event.detail === 0) return false;
    return Date.now() - lastPointerSfxAt < FLASHCARD_POINTER_SFX_GUARD_MS;
  };

  const handleFlip = (event) => {
    if (responseLockRef.current || isSubmittingResponse) return;
    if (hasActiveSelectionInsideCard()) return;
    const shouldSkipFlipSfx = shouldSkipClickSfxAfterPointer(
      lastFlipPointerSfxAtRef.current,
      event
    );
    if (!shouldSkipFlipSfx) {
      playSound(SFX_EVENTS.FLASHCARD_FLIP);
    }
    setHasInteractedWithCard(true);
    setFlipped((value) => !value);
  };

  const handleFlipPointerDown = () => {
    if (responseLockRef.current || isSubmittingResponse) return;
    if (hasActiveSelectionInsideCard()) return;
    lastFlipPointerSfxAtRef.current = Date.now();
    playSound(SFX_EVENTS.FLASHCARD_FLIP);
  };

  const handleResponse = async (correct, triggerEvent) => {
    if (!card || !user?.id || responseLockRef.current) return;

    const shouldSkipDiscardSfx = shouldSkipClickSfxAfterPointer(
      lastDiscardPointerSfxAtRef.current,
      triggerEvent
    );
    if (!shouldSkipDiscardSfx) {
      playSound(SFX_EVENTS.FLASHCARD_DISCARD);
    }
    setActiveResponseButton(correct ? "correct" : "incorrect");
    responseLockRef.current = true;
    setIsSubmittingResponse(true);

    if (flipped) {
      setSuppressFlipResetTransition(true);
    }

    const discardDirectionValue = correct ? "right" : "left";
    spawnDiscardOverlay(discardDirectionValue);

    if (flipped) {
      setFlipped(false);
    }

    const responseTime = Math.max(0, Date.now() - cardStartTimeRef.current);
    const now = new Date().toISOString();
    const reviewPreferences = loadReviewPreferences();
    const updatedStats = updateStatsAfterReview(card, correct, {
      responseTimeMs: responseTime,
      reviewedAt: now,
      mode: "flashcards",
      preferences: reviewPreferences,
    });

    const xpDelta = correct ? 1 : -2;
    addXP(xpDelta);

    if (correct) recordCorrect();
    else recordIncorrect();
    updateStreak();

    try {
      const { error } = await supabase
        .from("vocabulary")
        .update({
          stats: updatedStats,
          updated_at: now,
        })
        .eq("id", card.id)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      const updatedVocab = vocab.map((item) =>
        item.id === card.id
          ? {
              ...item,
              stats: updatedStats,
              updatedAt: now,
            }
          : item
      );

      setVocab(updatedVocab);
      setBaseVocab((previous) =>
        previous.map((item) =>
          item.id === card.id
            ? {
                ...item,
                stats: updatedStats,
                updatedAt: now,
              }
            : item
        )
      );
      updateDominatedCount(updatedVocab);
    } catch (error) {
      console.error("Erro ao atualizar estatÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½sticas no Supabase:", error);
      alert("Nao foi possivel salvar seu progresso desta carta.");
    } finally {
      if (current < vocab.length - 1) {
        setCurrent((index) => index + 1);
      } else {
        setSessionDone(true);
      }

      responseLockRef.current = false;
      setIsSubmittingResponse(false);
      setActiveResponseButton(null);
    }
  };

  const handleResponsePointerDown = () => {
    if (!card || !user?.id || responseLockRef.current || isSubmittingResponse) return;
    lastDiscardPointerSfxAtRef.current = Date.now();
    playSound(SFX_EVENTS.FLASHCARD_DISCARD);
  };

  const getSelectionElement = (node) => {
    if (!node || typeof Node === "undefined") return null;

    return node.nodeType === Node.ELEMENT_NODE
      ? node
      : node.parentElement || null;
  };

  const isSelectionInsideAllowedCopyArea = () => {
    if (typeof window === "undefined") return true;

    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return true;
    }

    const anchorElement = getSelectionElement(selection.anchorNode);
    const focusElement = getSelectionElement(selection.focusNode);

    if (!anchorElement || !focusElement) return false;

    const isAllowedElement = (element) =>
      Boolean(
        element.closest?.(
          '[data-flashcard-main-text="true"], [data-study-copy-allowed="true"]'
        )
      );

    return isAllowedElement(anchorElement) && isAllowedElement(focusElement);
  };

  const handleStudyUiCopy = (event) => {
    if (isSelectionInsideAllowedCopyArea()) return;

    event.preventDefault();
    event.clipboardData?.setData("text/plain", "");
  };

  useEffect(() => {
    if (!card?.id) return;
    cardStartTimeRef.current = Date.now();
  }, [card?.id, current]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] select-none items-center justify-center">
        <div className="w-7 h-7 border-3 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (vocab.length === 0) {
    return (
      <div className="select-none py-20 text-center">
        <p className="text-muted-foreground">Nenhuma palavra cadastrada ainda.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Acesse o Gerenciador para adicionar vocabulÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio.
        </p>
      </div>
    );
  }

  if (sessionDone) {
    return (
      <div className="study-ui-controls select-none py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-foreground">{`Sess\u00E3o completa.`}</h2>
        <p className="mb-4 text-muted-foreground">
          {`Voc\u00EA revisou ${vocab.length} ${vocab.length === 1 ? "cart\u00E3o" : "cart\u00F5es"}.`}
        </p>
        <button
          onClick={() => {
            const nextBaseItems = Array.isArray(baseVocab) && baseVocab.length > 0
              ? [...baseVocab]
              : [...vocab];
            const prepared = mode === "random" ? shuffleArray(nextBaseItems) : nextBaseItems;

            setBaseVocab(nextBaseItems);
            setVocab(prepared);
            setCurrent(0);
            setFlipped(false);
            setSessionDone(false);
            setShowExamples(false);
            setHasInteractedWithCard(false);
            setIsSubmittingResponse(false);
            setActiveResponseButton(null);
            setSuppressFlipResetTransition(false);
            clearDiscardOverlays();
            responseLockRef.current = false;
            updateDominatedCount(prepared);
          }}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {"Recome\u00E7ar"}
        </button>
      </div>
    );
  }

  return (
    <div
      className="study-ui-controls mx-auto w-full max-w-2xl space-y-5 overflow-x-hidden md:overflow-x-visible sm:space-y-6"
      style={{ touchAction: "pan-y" }}
      onCopy={handleStudyUiCopy}
    >
      <div className="relative flex select-none items-center justify-center sm:hidden">
        <div className="min-w-0 select-none">
          <FlashcardModeSelector mode={mode} setMode={setMode} />
        </div>

        <button
          type="button"
          onClick={toggleSound}
          className="absolute right-0 top-1/2 inline-flex h-8 w-8 select-none -translate-y-1/2 items-center justify-center rounded-md text-sm font-medium outline-none transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7CC8F8]/45 focus-visible:ring-offset-0 hover:bg-muted [-webkit-tap-highlight-color:transparent]"
          title={soundEnabled ? "Desativar ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡udio" : "Ativar ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡udio"}
        >
          {soundEnabled ? (
            <Volume2 className="h-4 w-4 text-muted-foreground" />
          ) : (
            <VolumeX className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      <div className="hidden select-none items-center justify-between gap-4 sm:flex">
        <h1 className="flex min-w-0 select-none items-center gap-2 text-2xl font-bold text-foreground">
          Flashcards
          <button
            type="button"
            onClick={toggleSound}
            className="inline-flex h-9 w-9 select-none items-center justify-center rounded-md text-sm font-medium outline-none transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7CC8F8]/45 focus-visible:ring-offset-0 hover:bg-muted [-webkit-tap-highlight-color:transparent]"
            title={soundEnabled ? "Desativar ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡udio" : "Ativar ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡udio"}
          >
            {soundEnabled ? (
              <Volume2 className="h-5 w-5 text-muted-foreground" />
            ) : (
              <VolumeX className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        </h1>

        <div className="min-w-0 shrink-0 select-none">
          <FlashcardModeSelector mode={mode} setMode={setMode} />
        </div>
      </div>

      <div className="select-none sm:hidden">
        <div className="flex select-none items-center gap-2 text-[11px] font-medium">
          <span className="shrink-0 whitespace-nowrap text-muted-foreground">
            {current + 1} de {vocab.length}
          </span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-[#25B15F] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="shrink-0 flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[#25B15F]">
              <Check className="h-3 w-3" />
              Acertei: {card?.stats?.correct || 0}
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-red-500">
              <X className="h-3 w-3" />
              Errei: {card?.stats?.incorrect || 0}
            </span>
          </div>
        </div>
      </div>

      <div className="hidden select-none items-center gap-4 text-sm font-medium sm:flex">
        <span className="text-muted-foreground">{current + 1} de {vocab.length}</span>
        <div className="h-2 min-w-[160px] flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-[#25B15F] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-[#25B15F]">
            <Check className="h-3.5 w-3.5" />
            Acertei: {card?.stats?.correct || 0}
          </span>
          <span className="flex items-center gap-1 text-red-500">
            <X className="h-3.5 w-3.5" />
            Errei: {card?.stats?.incorrect || 0}
          </span>
        </div>
      </div>

      <div
        ref={flashcardStageRef}
        className="relative z-0 w-full overflow-hidden"
        style={{ isolation: "isolate" }}
      >
        <div
          id="meu-flashcard"
          ref={flashcardRef}
          className={`flip-card w-full select-none overflow-hidden ${
            isSubmittingResponse ? "cursor-default" : "cursor-pointer"
          }`}
          style={{
            maxWidth: `${FLASHCARD_CARD_WIDTH}px`,
            aspectRatio: `${FLASHCARD_CARD_WIDTH} / ${FLASHCARD_CARD_HEIGHT}`,
            touchAction: "pan-y",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
          onPointerDown={handleFlipPointerDown}
          onClick={handleFlip}
        >
          <div
            className={`flip-card-inner relative h-full w-full ${flipped ? "flipped" : ""} ${
              suppressFlipResetTransition ? "!transition-none" : ""
            }`}
          >
            <div className="flip-card-front flashcard-context-box absolute inset-0 select-none !rounded-[16.25px] border border-border bg-card text-center sm:!rounded-2xl">
              <div
                ref={frontTextSlotRef}
                className="flashcard-main-text-slot"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                }}
              >
                <p
                  ref={frontTextRef}
                  data-flashcard-main-text="true"
                  className="flashcard-main-text select-text text-center font-bold text-foreground"
                  style={{
                    fontSize: `${frontTextStyle.fontSize}px`,
                    lineHeight: `${frontTextStyle.lineHeight}px`,
                    maxWidth: frontTextStyle.maxWidth,
                    marginInline: "auto",
                    textWrap: "normal",
                    overflowWrap: frontTextStyle.overflowWrap,
                    wordBreak: frontTextStyle.wordBreak,
                    hyphens: frontTextStyle.hyphens,
                    userSelect: "text",
                    WebkitUserSelect: "text",
                  }}
                >
                  {front}
                </p>
              </div>
              <p
                className="flashcard-reveal-hint select-none text-xs text-muted-foreground"
                style={revealHintMobileStyle}
              >
                Clique para revelar
              </p>
            </div>

            <div className="flip-card-back flashcard-context-box absolute inset-0 select-none !rounded-[16.25px] border border-border bg-card text-center sm:!rounded-2xl">
              <div
                ref={backTextSlotRef}
                className="flashcard-main-text-slot"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                }}
              >
                <p
                  ref={backTextRef}
                  data-flashcard-main-text="true"
                  className="flashcard-main-text select-text text-center font-bold text-foreground"
                  style={{
                    fontSize: `${backTextStyle.fontSize}px`,
                    lineHeight: `${backTextStyle.lineHeight}px`,
                    maxWidth: backTextStyle.maxWidth,
                    marginInline: "auto",
                    textWrap: "normal",
                    overflowWrap: backTextStyle.overflowWrap,
                    wordBreak: backTextStyle.wordBreak,
                    hyphens: backTextStyle.hyphens,
                    userSelect: "text",
                    WebkitUserSelect: "text",
                  }}
                >
                  {back}
                </p>
              </div>
              <p
                aria-hidden="true"
                className="flashcard-reveal-hint flashcard-reveal-hint-placeholder select-none text-xs text-muted-foreground"
                style={revealHintMobileStyle}
              >
                Clique para revelar
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-1 grid select-none grid-cols-2 gap-3 sm:mt-0 sm:gap-4">
        <button
          type="button"
          onPointerDown={handleResponsePointerDown}
          onClick={(event) => handleResponse(false, event)}
          className={`flashcard-response-button inline-flex h-[58px] select-none items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white outline-none transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7CC8F8]/45 focus-visible:ring-offset-0 disabled:cursor-not-allowed [-webkit-tap-highlight-color:transparent] sm:h-14 sm:rounded-md sm:text-sm sm:font-medium ${
            isSubmittingResponse && activeResponseButton === "incorrect"
              ? "bg-[#EF4444]"
              : "bg-[#EF4444] hover:bg-[#DC2626] active:bg-[#B91C1C] dark:bg-[#B91C1C] dark:hover:bg-[#DC2626] dark:active:bg-[#EF4444]"
          }`}
        >
          <span className="flashcard-response-label">{"N\u00E3o lembro"}</span>
        </button>

        <button
          type="button"
          onPointerDown={handleResponsePointerDown}
          onClick={(event) => handleResponse(true, event)}
          className={`flashcard-response-button inline-flex h-[58px] select-none items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white outline-none transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7CC8F8]/45 focus-visible:ring-offset-0 disabled:cursor-not-allowed [-webkit-tap-highlight-color:transparent] sm:h-14 sm:rounded-md sm:text-sm sm:font-medium ${
            isSubmittingResponse && activeResponseButton === "correct"
              ? "bg-[#25B15F]"
              : "bg-[#25B15F] hover:bg-[#1E9A4F] active:bg-[#187A3D] dark:bg-[#1E9A4F] dark:hover:bg-[#25B15F] dark:active:bg-[#25B15F]"
          }`}
        >
          <Check className="mr-1 h-4 w-4" />
          <span className="flashcard-response-label">{"J\u00E1 sei"}</span>
        </button>
      </div>

      {card?.meanings?.length > 0 ? (
        <div className="relative z-10 space-y-0">
          <ExamplesToggleButton
            expanded={showExamples}
            onClick={() => setShowExamples((value) => !value)}
            variant="flashcard"
            disabled={!hasInteractedWithCard || isSubmittingResponse}
            examplesPanelRef={examplesPanelRef}
            className="hide-on-mobile-video-expanded"
          />

          {showExamples ? (
            <div
              ref={examplesPanelRef}
              data-study-copy-allowed="true"
              className="study-example-panel-desktop-shell"
            >
              <ExamplesPanel
                allMeanings={card.meanings}
                activeMeaning={activeMeaning?.meaning}
                titleTerm={card?.term}
                variant="flashcard"
                panelScope="flashcards"
                forceMobileVideoExperience
                onClose={() => setShowExamples(false)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
