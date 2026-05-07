import { useState, useEffect, useMemo, useRef } from "react";
import { Volume2, VolumeX, ArrowRight, Check } from "lucide-react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import ModeSelector from "../components/ModeSelector";
import ExamplesPanel from "../components/ExamplesPanel";
import ExamplesToggleButton from "../components/ExamplesToggleButton";
import { scheduleExamplesAutoScroll } from "../lib/examplesAutoScroll";
import { SFX_EVENTS } from "../lib/sfx";
import {
  addXP,
  recordCorrect,
  recordIncorrect,
  updateStreak,
  playSound,
  getSoundState,
  saveSoundState,
  getGameState,
  saveGameState
} from "../lib/gameState";
import {
  LEARNING_STATUS,
  REVIEW_FOCUS,
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

const QUESTIONS_PER_ROUND = 10;
const MAX_ROUNDS = 20;
const CORRECT_XP_DELTA = 1;
const INCORRECT_XP_DELTA = -2;
const CHECK_SYMBOL = "\u2713";
const CROSS_SYMBOL = "\u2715";
const QUIZ_POINTER_SFX_GUARD_MS = 700;
const QUIZ_MOBILE_BREAKPOINT = 767;
const QUIZ_TEXT_MIN_SIZE = 22;
const QUIZ_TEXT_MIN_SIZE_MOBILE = 18;
const QUIZ_TEXT_MAX_SIZE = 47;
const QUIZ_TEXT_MAX_SIZE_MOBILE = 40;
const QUIZ_TEXT_SCALE_DESKTOP = 0.9;
const QUIZ_TEXT_SCALE_MOBILE = 0.95;
const QUIZ_SINGLE_LINE_LARGE_REDUCTION_MOBILE = 0.9;
const QUIZ_MOBILE_SINGLE_LINE_FONT_SIZE = 32;
const QUIZ_MOBILE_MULTI_LINE_FONT_SIZE = 28;

function isMobileQuizViewport() {
  return (
    typeof window !== "undefined" &&
    window.innerWidth <= QUIZ_MOBILE_BREAKPOINT
  );
}

function clearMobileActiveFocus() {
  if (!isMobileQuizViewport() || typeof document === "undefined") return;

  const activeElement = document.activeElement;

  if (activeElement && typeof activeElement.blur === "function") {
    activeElement.blur();
  }
}

function scheduleMobileActiveFocusClear() {
  if (!isMobileQuizViewport()) return;

  clearMobileActiveFocus();

  if (typeof window === "undefined") return;

  window.requestAnimationFrame?.(clearMobileActiveFocus);
  window.setTimeout(clearMobileActiveFocus, 80);
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRoundQueue(vocab, size = QUESTIONS_PER_ROUND) {
  const source = Array.isArray(vocab)
    ? vocab.filter(
        (item) => item?.term && Array.isArray(item?.meanings) && item.meanings.length > 0
      )
    : [];

  if (source.length === 0) return [];
  if (source.length >= size) {
    const priorityWindowSize = Math.min(source.length, size * 2);
    return shuffleArray(source.slice(0, priorityWindowSize)).slice(0, size);
  }

  const queue = [...shuffleArray(source)];
  while (queue.length < size) {
    queue.push(source[Math.floor(Math.random() * source.length)]);
  }

  return shuffleArray(queue);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getQuizTextScale(isMobileViewport) {
  return isMobileViewport ? QUIZ_TEXT_SCALE_MOBILE : QUIZ_TEXT_SCALE_DESKTOP;
}

function getAdaptiveQuizTextStyle(content) {
  const text = typeof content === "string" ? content.trim() : "";
  const length = text.length;
  const words = text ? text.split(/\s+/).length : 1;
  const isMobileViewport =
    typeof window !== "undefined" &&
    window.innerWidth <= QUIZ_MOBILE_BREAKPOINT;
  const scale = getQuizTextScale(isMobileViewport);
  const baseMinFontSize = isMobileViewport
    ? QUIZ_TEXT_MIN_SIZE_MOBILE
    : QUIZ_TEXT_MIN_SIZE;
  const baseMaxFontSize = isMobileViewport
    ? QUIZ_TEXT_MAX_SIZE_MOBILE
    : QUIZ_TEXT_MAX_SIZE;
  const minFontSize = Math.round(baseMinFontSize * scale);
  const maxFontSize = Math.round(baseMaxFontSize * scale);
  const longestWord = text
    ? text.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0)
    : 0;

  if (isMobileViewport) {
    const fontSize = QUIZ_MOBILE_SINGLE_LINE_FONT_SIZE;

    return {
      fontSize,
      lineHeight: Math.round(fontSize * getAdaptiveQuizLineHeight(fontSize)),
      maxWidth: "92%",
      overflowWrap: longestWord >= 16 ? "anywhere" : "break-word",
      wordBreak: longestWord >= 16 ? "break-word" : "normal",
      hyphens: "auto",
    };
  }

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
  const lineHeightMultiplier = getAdaptiveQuizLineHeight(fontSize);

  let maxWidth = isMobileViewport ? "92%" : "95%";
  if (length > 35) maxWidth = isMobileViewport ? "89%" : "92%";
  if (length > 55) maxWidth = isMobileViewport ? "86%" : "90%";

  return {
    fontSize,
    lineHeight: Math.round(fontSize * lineHeightMultiplier),
    maxWidth,
    overflowWrap: longestWord >= 16 ? "anywhere" : "break-word",
    wordBreak: longestWord >= 16 ? "break-word" : "normal",
    hyphens: "auto",
  };
}

function getAdaptiveQuizLineHeight(fontSize) {
  if (fontSize >= 42) return 1.12;
  if (fontSize >= 34) return 1.16;
  if (fontSize >= 28) return 1.2;
  return 1.24;
}

function fitQuizPromptText(textElement, slotElement, preferredFontSize) {
  if (!textElement || !slotElement) return;

  const isMobile =
    typeof window !== "undefined" &&
    window.innerWidth <= QUIZ_MOBILE_BREAKPOINT;
  const scale = getQuizTextScale(isMobile);
  const baseMinFontSize = isMobile
    ? QUIZ_TEXT_MIN_SIZE_MOBILE
    : QUIZ_TEXT_MIN_SIZE;
  const baseMaxFontSize = isMobile
    ? QUIZ_TEXT_MAX_SIZE_MOBILE
    : QUIZ_TEXT_MAX_SIZE;
  const minFontSize = Math.round(baseMinFontSize * scale);
  const maxFontSize = Math.round(baseMaxFontSize * scale);

  const applySize = (size) => {
    textElement.style.fontSize = `${size}px`;
    textElement.style.lineHeight = `${Math.round(
      size * getAdaptiveQuizLineHeight(size)
    )}px`;
  };

  let currentSize = isMobile
    ? QUIZ_MOBILE_SINGLE_LINE_FONT_SIZE
    : clamp(
        Math.round(preferredFontSize),
        minFontSize,
        maxFontSize
      );
  applySize(currentSize);

  const getEstimatedLineCount = () => {
    if (typeof window === "undefined") return 1;
    const computedLineHeight = Number.parseFloat(
      window.getComputedStyle(textElement).lineHeight
    );
    if (!computedLineHeight) return 1;
    return Math.max(1, Math.round(textElement.scrollHeight / computedLineHeight));
  };

  if (isMobile) {
    const estimatedLineCount = getEstimatedLineCount();

    if (estimatedLineCount > 1) {
      currentSize = QUIZ_MOBILE_MULTI_LINE_FONT_SIZE;
      applySize(currentSize);
    }
  }

  let safetyCounter = 0;
  while (safetyCounter < 64 && currentSize > minFontSize) {
    const targetHeight = isMobile
      ? Math.floor(slotElement.clientHeight * 0.82)
      : slotElement.clientHeight;
    const targetWidth = isMobile
      ? Math.floor(slotElement.clientWidth * 0.9)
      : slotElement.clientWidth;
    const overflowHeight = textElement.scrollHeight > targetHeight;
    const overflowWidth = textElement.scrollWidth > targetWidth;

    if (!overflowHeight && !overflowWidth) break;

    currentSize -= 1;
    applySize(currentSize);
    safetyCounter += 1;
  }
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

function normalizeStatus(rawStatus) {
  return normalizeVocabularyItem(
    {
      stats: {
        status: rawStatus,
      },
    },
    loadReviewPreferences()
  ).stats.status;
}

function normalizeStats(rawStats) {
  const normalizedStats = normalizeVocabularyItem(
    {
      stats: rawStats,
    },
    loadReviewPreferences()
  ).stats;

  return {
    ...normalizedStats,
    status: normalizeStatus(normalizedStats.status),
  };
}

function mapVocabularyRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    term: row.term || "",
    pronunciation: row.pronunciation || "",
    meanings: Array.isArray(row.meanings) ? row.meanings : [],
    stats: normalizeStats(row.stats),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export default function Quiz() {
  const { user } = useAuth();
  const location = useLocation();

  const [allVocab, setAllVocab] = useState([]);
  const [queue, setQueue] = useState([]);
  const [mode, setMode] = useState(() => getPreferredStudyMode("en_pt"));
  const [current, setCurrent] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [roundDone, setRoundDone] = useState(false);
  const [roundCorrectCount, setRoundCorrectCount] = useState(0);
  const [roundIncorrectCount, setRoundIncorrectCount] = useState(0);
  const [roundXpBalance, setRoundXpBalance] = useState(0);
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [loading, setLoading] = useState(true);
  const [xpFeedback, setXpFeedback] = useState(null);
  const [activeMeaning, setActiveMeaning] = useState(null);
  const [cardDir, setCardDir] = useState("en_pt");
  const [soundEnabled, setSoundEnabled] = useState(() => getSoundState().enabled);
  const startTime = useRef(Date.now());
  const lastOptionPointerSfxAtRef = useRef(0);
  const prevModeRef = useRef(mode);
  const examplesPanelRef = useRef(null);
  const questionTextRef = useRef(null);
  const questionTextSlotRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const bodyClass = "quiz-mobile-stable-gutter";

    const syncBodyClass = () => {
      if (window.innerWidth <= QUIZ_MOBILE_BREAKPOINT) {
        document.body.classList.add(bodyClass);
        return;
      }

      document.body.classList.remove(bodyClass);
    };

    syncBodyClass();
    window.addEventListener("resize", syncBodyClass);

    return () => {
      window.removeEventListener("resize", syncBodyClass);
      document.body.classList.remove(bodyClass);
    };
  }, []);

  const buildVocabularyFromRows = (rows) => {
    const reviewPreferences = loadReviewPreferences();
    const focus = new URLSearchParams(location.search).get("focus");
    const normalizedItems = Array.isArray(rows)
      ? rows
          .map(mapVocabularyRow)
          .map((row) => normalizeVocabularyItem(row, reviewPreferences))
      : [];

    const prioritized = getStudyQueue(normalizedItems, reviewPreferences, focus).items;
    if (prioritized.length >= 4 || normalizedItems.length < 4) {
      return prioritized;
    }

    return getStudyQueue(normalizedItems, reviewPreferences, REVIEW_FOCUS.ALL).items;
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

  const startRound = (nextRoundNumber, sourceVocab = allVocab) => {
    scheduleMobileActiveFocusClear();
    setQueue(buildRoundQueue(sourceVocab));
    setRoundNumber(nextRoundNumber);
    setRoundDone(false);
    setCurrent(0);
    setAnswered(false);
    setSelected(null);
    setShowExamples(false);
    setXpFeedback(null);
    setActiveMeaning(null);
    setOptions([]);
    setRoundCorrectCount(0);
    setRoundIncorrectCount(0);
    setRoundXpBalance(0);
    startTime.current = Date.now();
  };

  useEffect(() => {
    let isMounted = true;

    const applyVocabulary = (items) => {
      if (!isMounted) return;

      setAllVocab(items);
      setQueue(buildRoundQueue(items));
      setCurrent(0);
      setRoundNumber(1);
      setRoundDone(false);
      setAnswered(false);
      setSelected(null);
      setShowExamples(false);
      setXpFeedback(null);
      setActiveMeaning(null);
      setOptions([]);
      setRoundCorrectCount(0);
      setRoundIncorrectCount(0);
      setRoundXpBalance(0);
      updateDominatedCount(items);
    };

    async function refreshVocabulary({
      showSpinner = true,
      applyToState = true,
    } = {}) {
      try {
        if (showSpinner) {
          setLoading(true);
        }

        const rows = await fetchVocabularyRows();
        setCachedVocabularyRows(user.id, rows);

        if (!applyToState || !isMounted) return;

        const items = buildVocabularyFromRows(rows);
        applyVocabulary(items);
      } catch (error) {
        console.error("Erro ao carregar vocabulario no Quiz:", error);
        if (!applyToState || !isMounted) return;
        setAllVocab([]);
        setQueue([]);
      } finally {
        if (isMounted && (showSpinner || applyToState)) {
          setLoading(false);
        }
      }
    }

    if (!user?.id) {
      setAllVocab([]);
      setQueue([]);
      setCurrent(0);
      setRoundNumber(1);
      setRoundDone(false);
      setAnswered(false);
      setSelected(null);
      setShowExamples(false);
      setXpFeedback(null);
      setActiveMeaning(null);
      setOptions([]);
      setRoundCorrectCount(0);
      setRoundIncorrectCount(0);
      setRoundXpBalance(0);
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const shouldForceRefresh = consumeVocabularyCacheRefreshFlag(user.id);
    const cachedRows = shouldForceRefresh ? null : getCachedVocabularyRows(user.id);
    if (Array.isArray(cachedRows)) {
      const cachedItems = buildVocabularyFromRows(cachedRows);
      applyVocabulary(cachedItems);
      setLoading(false);
      refreshVocabulary({
        showSpinner: false,
        applyToState: false,
      });
    } else {
      refreshVocabulary({
        showSpinner: true,
        applyToState: true,
      });
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id, location.search]);

  useEffect(() => {
    if (loading || allVocab.length === 0) return;
    if (prevModeRef.current === mode) return;

    prevModeRef.current = mode;
    startRound(1, allVocab);
  }, [mode, allVocab, loading]);

  useEffect(() => {
    setPreferredStudyMode(mode);
  }, [mode]);

  useEffect(() => {
    if (queue.length === 0 || !queue[current]) return;

    const card = queue[current];
    const meanings = card.meanings || [];
    const idx = meanings.length > 1 ? Math.floor(Math.random() * meanings.length) : 0;
    const meaning = meanings[idx] || null;

    setActiveMeaning(meaning);

    const dir = mode === "random" ? (Math.random() > 0.5 ? "en_pt" : "pt_en") : mode;
    setCardDir(dir);

    if (!meaning) {
      setOptions([]);
      return;
    }

    const correctAnswer = dir === "en_pt" ? meaning.meaning : card.term;

    const others = allVocab.filter((v) => v.id !== card.id && v.meanings?.length > 0);
    const wrongPool = shuffleArray(others).slice(0, 3);

    const wrongOptions = wrongPool.map((v) => {
      const m = v.meanings[Math.floor(Math.random() * v.meanings.length)];
      return dir === "en_pt" ? m.meaning : v.term;
    });

    let allOptions = shuffleArray([
      { text: correctAnswer, correct: true },
      ...wrongOptions.map((t) => ({ text: t, correct: false }))
    ]).slice(0, 4);

    if (!allOptions.find((o) => o.correct)) {
      allOptions[0] = { text: correctAnswer, correct: true };
    }

    setOptions(allOptions);
    setAnswered(false);
    setSelected(null);
    setShowExamples(false);
    startTime.current = Date.now();
  }, [current, mode, queue.length, allVocab.length]);

  useEffect(() => {
    if (!showExamples) return;
    return scheduleExamplesAutoScroll(() => examplesPanelRef.current);
  }, [showExamples]);

  const toggleSound = () => {
    const state = getSoundState();
    const newEnabled = !state.enabled;
    saveSoundState({ ...state, enabled: newEnabled });
    setSoundEnabled(newEnabled);
  };

  const shouldSkipClickSfxAfterPointer = (event) => {
    if (!event) return false;
    if (event.detail === 0) return false;
    return Date.now() - lastOptionPointerSfxAtRef.current < QUIZ_POINTER_SFX_GUARD_MS;
  };

  const playOptionSelectSfx = (triggerEvent) => {
    if (shouldSkipClickSfxAfterPointer(triggerEvent)) return;
    playSound(SFX_EVENTS.MATCH_SELECT);
  };

  const handleSelect = (idx, event) => {
    if (answered || !user?.id || !options[idx]) return;
    playOptionSelectSfx(event);

    setSelected(idx);
    setShowExamples(false);
  };

  const handleConfirm = async () => {
    if (answered || !user?.id || selected === null || !options[selected]) return;

    const selectedOption = options[selected];
    const correct = selectedOption.correct;
    setAnswered(true);

    playSound(correct ? SFX_EVENTS.QUIZ_SUCCESS : SFX_EVENTS.QUIZ_ERROR);
    const xpDelta = correct ? CORRECT_XP_DELTA : INCORRECT_XP_DELTA;

    addXP(xpDelta);
    setXpFeedback(xpDelta > 0 ? `+${xpDelta} XP` : `${xpDelta} XP`);
    setRoundXpBalance((prev) => prev + xpDelta);
    setTimeout(() => setXpFeedback(null), 1000);

    if (correct) {
      recordCorrect();
      setRoundCorrectCount((prev) => prev + 1);
    } else {
      recordIncorrect();
      setRoundIncorrectCount((prev) => prev + 1);
    }
    updateStreak();

    const card = queue[current];
    const responseTime = Date.now() - startTime.current;
    const now = new Date().toISOString();
    const reviewPreferences = loadReviewPreferences();
    const updatedStats = updateStatsAfterReview(card, correct, {
      responseTimeMs: responseTime,
      reviewedAt: now,
      mode: "quiz",
      preferences: reviewPreferences,
    });

    try {
      const { error } = await supabase
        .from("vocabulary")
        .update({
          stats: updatedStats,
          updated_at: now
        })
        .eq("id", card.id)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      const refreshedAllVocab = allVocab.map((item) =>
        item.id === card.id
          ? {
              ...item,
              stats: updatedStats,
              updatedAt: now
            }
          : item
      );

      setAllVocab(refreshedAllVocab);
      setQueue((prev) =>
        prev.map((item) =>
          item.id === card.id
            ? {
                ...item,
                stats: updatedStats,
                updatedAt: now
              }
            : item
        )
      );
      updateDominatedCount(refreshedAllVocab);
    } catch (error) {
      console.error("Erro ao atualizar stats do quiz no Supabase:", error);
      alert("Nao foi possivel salvar seu progresso nesta pergunta.");
    }
  };

  const handleOptionPointerDown = (idx) => {
    if (answered || !user?.id || !options[idx]) return;
    lastOptionPointerSfxAtRef.current = Date.now();
    playSound(SFX_EVENTS.MATCH_SELECT);
  };

  const handleNext = () => {
    if (current < queue.length - 1 && current < QUESTIONS_PER_ROUND - 1) {
      setCurrent((c) => c + 1);
    } else {
      setRoundDone(true);
    }
  };

  const handleNextRound = async () => {
    scheduleMobileActiveFocusClear();

    if (roundNumber >= MAX_ROUNDS) {
      try {
        const rows = await fetchVocabularyRows();
        setCachedVocabularyRows(user?.id, rows);
        const items = buildVocabularyFromRows(rows);
        setAllVocab(items);
        updateDominatedCount(items);
        startRound(1, items);
      } catch (error) {
        console.error("Erro ao recarregar quiz:", error);
        alert("Nao foi possivel recarregar o quiz.");
      }
      return;
    }

    startRound(roundNumber + 1, allVocab);
  };

  const card = queue[current];
  const questionText = cardDir === "en_pt" ? card?.term : activeMeaning?.meaning;
  const questionTextStyle = useMemo(
    () => getAdaptiveQuizTextStyle(questionText),
    [questionText]
  );
  const questionTextPreferredSize = questionTextStyle.fontSize;
  const progressCurrent = Math.min(current + 1, QUESTIONS_PER_ROUND);
  const progressPct = QUESTIONS_PER_ROUND > 0 ? (progressCurrent / QUESTIONS_PER_ROUND) * 100 : 0;
  const letters = ["A", "B", "C", "D", "E"];

  useEffect(() => {
    const fitPromptText = () => {
      fitQuizPromptText(
        questionTextRef.current,
        questionTextSlotRef.current,
        questionTextPreferredSize
      );
    };

    const animationFrame = requestAnimationFrame(fitPromptText);
    window.addEventListener("resize", fitPromptText);

    let observer = null;
    if (typeof ResizeObserver !== "undefined" && questionTextSlotRef.current) {
      observer = new ResizeObserver(fitPromptText);
      observer.observe(questionTextSlotRef.current);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", fitPromptText);
      if (observer) observer.disconnect();
    };
  }, [questionText, questionTextPreferredSize, cardDir]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-3 border-border border-t-primary" />
      </div>
    );
  }

  if (allVocab.length < 4) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Cadastre pelo menos 4 palavras para usar o Quiz.</p>
      </div>
    );
  }

  const isLastRound = roundNumber >= MAX_ROUNDS;
  const roundBalanceText = `${roundXpBalance > 0 ? "+" : ""}${roundXpBalance}XP`;

  const renderQuizActionButton = () => (
    <button
      type="button"
      onClick={answered ? handleNext : handleConfirm}
      disabled={!answered && selected === null}
      className={`flex h-[58px] w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold outline-none transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7CC8F8]/45 focus-visible:ring-offset-0 [-webkit-tap-highlight-color:transparent] ${
        answered
          ? "border-primary bg-primary text-primary-foreground shadow-[0_2px_0_rgba(37,177,95,0.26)] active:scale-[0.99]"
          : selected !== null
            ? "border-muted-foreground/50 bg-card text-muted-foreground shadow-[0_2px_0_rgba(107,114,128,0.20)] active:scale-[0.99] dark:border-slate-500/70 dark:bg-card dark:text-slate-300 dark:shadow-[0_2px_0_rgba(148,163,184,0.16)]"
            : "cursor-not-allowed border-border bg-card text-foreground opacity-[0.44] dark:border-border dark:bg-card dark:text-foreground dark:opacity-[0.29]"
      }`}
    >
      {answered ? (
        <>
          {"Pr\u00f3ximo"} <ArrowRight className="h-4 w-4" />
        </>
      ) : (
        "Confirmar"
      )}
    </button>
  );

  if (roundDone) {
    return (
      <div className="study-ui-controls flex min-h-[70vh] items-start justify-center px-4 pt-14 sm:items-center sm:pt-0">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 sm:h-16 sm:w-16">
            <Check className="h-10 w-10 text-primary sm:h-8 sm:w-8" />
          </div>

          <h2 className="mb-2 text-[2rem] font-bold leading-tight text-foreground sm:text-3xl">Rodada {roundNumber} concluida!🎯</h2>
          <p className="mb-5 text-lg text-muted-foreground sm:text-base">
            Voce respondeu {QUESTIONS_PER_ROUND} perguntas nesta rodada.
          </p>

          <div
            className={`mx-auto mb-6 flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-base font-semibold sm:rounded-xl sm:py-3 sm:text-sm ${
              roundXpBalance >= 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <span>{CHECK_SYMBOL}</span>
            <span className="ui-control-label">Balanco da rodada: {roundBalanceText}</span>
          </div>

          <button
            onClick={handleNextRound}
            className="h-14 rounded-2xl bg-primary px-10 text-[1.6rem] font-semibold text-primary-foreground outline-none transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7CC8F8]/45 focus-visible:ring-offset-0 md:hover:bg-primary/90 [-webkit-tap-highlight-color:transparent] sm:h-auto sm:rounded-xl sm:px-6 sm:py-2.5 sm:text-sm"
          >
            {isLastRound ? "Recomecar" : "Proxima rodada"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="study-ui-controls mx-auto w-full max-w-2xl space-y-5 overflow-x-hidden md:overflow-visible sm:space-y-6">
      <div className="relative flex items-center justify-center sm:hidden">
        <div className="min-w-0">
          <ModeSelector mode={mode} setMode={setMode} variant="quiz" />
        </div>
        <button
          onClick={toggleSound}
          className="absolute right-0 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-transparent outline-none transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7CC8F8]/45 focus-visible:ring-offset-0 md:hover:bg-muted [-webkit-tap-highlight-color:transparent]"
          title={soundEnabled ? "Desativar audio" : "Ativar audio"}
        >
          {soundEnabled ? (
            <Volume2 className="h-4 w-4 text-muted-foreground" />
          ) : (
            <VolumeX className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      <div className="hidden mx-auto w-full max-w-[760px] flex-wrap items-center justify-between gap-3 sm:flex">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">Quiz</h1>
          <button
            onClick={toggleSound}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent outline-none transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7CC8F8]/45 focus-visible:ring-offset-0 md:hover:bg-muted [-webkit-tap-highlight-color:transparent]"
            title={soundEnabled ? "Desativar audio" : "Ativar audio"}
          >
            {soundEnabled ? (
              <Volume2 className="h-5 w-5 text-muted-foreground" />
            ) : (
              <VolumeX className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        </div>
        <div className="min-w-0 shrink-0">
          <ModeSelector mode={mode} setMode={setMode} variant="quiz" />
        </div>
      </div>

      <div className="sm:hidden">
        <div className="flex items-center gap-2 text-[11px] font-medium">
          <span className="shrink-0 whitespace-nowrap text-muted-foreground">
            {progressCurrent} de {QUESTIONS_PER_ROUND}
          </span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="shrink-0 flex items-center gap-2 text-[11px] text-foreground">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="text-primary">{CHECK_SYMBOL}</span>
              <span>
                Acertei: <span className="font-semibold">{roundCorrectCount}</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="text-destructive">{CROSS_SYMBOL}</span>
              <span>
                Errei: <span className="font-semibold">{roundIncorrectCount}</span>
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="hidden mx-auto w-full max-w-[760px] sm:block">
        <div className="flex items-center gap-3 text-sm font-medium">
          <span className="shrink-0 whitespace-nowrap text-muted-foreground">
            {progressCurrent} de {QUESTIONS_PER_ROUND}
          </span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="shrink-0 flex items-center gap-3 text-xs text-foreground">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-primary">{CHECK_SYMBOL}</span>
              <span>
                Acertei: <span className="font-semibold">{roundCorrectCount}</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-destructive">{CROSS_SYMBOL}</span>
              <span>
                Errei: <span className="font-semibold">{roundIncorrectCount}</span>
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[760px] space-y-5 md:overflow-visible">
        <div className="mx-auto w-full max-w-[671.2px] md:max-w-[760px] !rounded-[12.5px] border border-border bg-card p-5 text-center shadow-[0_2px_0_rgba(148,163,184,0.24)] dark:shadow-[0_2px_0_rgba(2,6,23,0.45)] sm:!rounded-2xl sm:p-8">
        <div
          ref={questionTextSlotRef}
          className="mx-auto flex h-[136px] min-h-[136px] w-full items-center justify-center overflow-hidden px-2 md:h-[132px] md:min-h-[132px]"
        >
          <p
            ref={questionTextRef}
            className="m-0 mx-auto w-full break-words text-center font-bold leading-tight text-foreground [text-wrap:balance]"
            style={{
              fontSize: `${questionTextStyle.fontSize}px`,
              lineHeight: `${questionTextStyle.lineHeight}px`,
              maxWidth: questionTextStyle.maxWidth,
              marginInline: "auto",
              textWrap: "balance",
              overflowWrap: questionTextStyle.overflowWrap,
              wordBreak: questionTextStyle.wordBreak,
              hyphens: questionTextStyle.hyphens,
            }}
          >
            {questionText}
          </p>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[671.2px] grid-cols-1 gap-2 md:max-w-[760px] md:grid-cols-2 md:gap-4">
        {options.map((opt, idx) => {
          let classes =
            "bg-card border border-border text-[#4B5563] shadow-[0_2px_0_rgba(148,163,184,0.24)] md:hover:border-[#93c5fd] md:hover:bg-blue-50/30 dark:text-slate-300 dark:shadow-[0_2px_0_rgba(2,6,23,0.45)] dark:md:hover:border-sky-500/70 dark:md:hover:bg-sky-500/15";
          const isWrongSelection = answered && idx === selected && !opt.correct;
          const isSelectedUnconfirmed = !answered && idx === selected;
          let badgeClasses = "bg-muted text-muted-foreground";

          if (answered) {
            if (opt.correct) {
              classes =
                "bg-emerald-50 border border-primary text-primary shadow-[0_2px_0_rgba(37,177,95,0.26)] dark:bg-emerald-500/20 dark:border-emerald-400/70 dark:text-emerald-300 dark:shadow-[0_2px_0_rgba(6,78,59,0.5)]";
              badgeClasses = "bg-primary/15 text-primary";
            }
            else if (idx === selected && !opt.correct)
              classes =
                "bg-[#FDECEE] border border-[#F2A4AC] text-[#E54858] shadow-[0_2px_0_rgba(242,164,172,0.28)] dark:bg-red-500/20 dark:border-red-400/70 dark:text-red-300 dark:shadow-[0_2px_0_rgba(127,29,29,0.55)]";
            if (idx === selected && !opt.correct) {
              badgeClasses = "bg-destructive/15 text-destructive";
            }
          } else if (isSelectedUnconfirmed) {
            classes =
              "bg-[#DFF1FF] border border-[#7CC8F8] text-[#2D8FC2] shadow-[0_2px_0_rgba(124,200,248,0.38)] dark:bg-sky-500/20 dark:border-sky-400/70 dark:text-sky-300 dark:shadow-[0_2px_0_rgba(7,89,133,0.55)]";
            badgeClasses = "bg-[#7CC8F8]/25 text-[#2D8FC2] dark:bg-sky-500/30 dark:text-sky-300";
          }

          return (
            <button
              key={idx}
              onPointerDown={() => handleOptionPointerDown(idx)}
              onClick={(event) => handleSelect(idx, event)}
              disabled={answered}
              className={`flex h-[clamp(59px,8.36svh,72px)] w-full items-center gap-3 rounded-[13px] border bg-card px-4 py-3 text-left text-sm font-medium outline-none transition-all duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7CC8F8]/45 focus-visible:ring-offset-0 md:h-[65px] md:max-w-none md:justify-self-stretch md:rounded-[10px] disabled:cursor-not-allowed [-webkit-tap-highlight-color:transparent] ${classes} ${
                isWrongSelection ? "shake-top" : ""
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold md:h-8 md:w-8 md:text-sm ${badgeClasses}`}
              >
                {letters[idx]}
              </span>
              <span className="break-words">{opt.text}</span>
              {answered && opt.correct ? (
                <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />
              ) : null}
            </button>
          );
        })}
      </div>
      </div>

      <div className="mx-auto w-full md:max-w-[760px]">
        <div className="hide-on-mobile-video-expanded grid w-full grid-cols-2 items-start gap-x-3 gap-y-0 transition-[gap] duration-200">
          <div
            className={[
              "min-w-0",
              "[&>button]:!w-full [&_button]:!w-full",
              "[&>button]:!px-4 [&_button]:!px-4",
              showExamples
                ? [
                    "relative z-10 isolate",
                    "[&>button]:!h-[58px] [&_button]:!h-[58px]",
                    "[&>button]:!items-center [&_button]:!items-center",
                    "[&>button]:!justify-center [&_button]:!justify-center",
                    "[&>button]:!rounded-xl [&_button]:!rounded-xl",
                    "[&>button]:!text-center [&_button]:!text-center",
                  ].join(" ")
                : [
                    "[&>button]:!h-[58px] [&_button]:!h-[58px]",
                    "[&>button]:!items-center [&_button]:!items-center",
                    "[&>button]:!justify-center [&_button]:!justify-center",
                    "[&>button]:!text-center [&_button]:!text-center",
                  ].join(" "),
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <ExamplesToggleButton
              expanded={showExamples}
              onClick={() => setShowExamples((prev) => !prev)}
              disabled={!answered || !card?.meanings?.length}
            />
          </div>

          <div className="min-w-0 self-start">{renderQuizActionButton()}</div>
        </div>

        {answered && card?.meanings?.length > 0 && showExamples ? (
          <div
            ref={examplesPanelRef}
            className="study-example-panel-desktop-shell relative mx-auto mt-3 w-full overflow-visible"
          >
            <ExamplesPanel
              allMeanings={card?.meanings}
              activeMeaning={activeMeaning?.meaning}
              titleTerm={card?.term}
              variant="flashcard"
              panelScope="quiz"
              onClose={() => setShowExamples(false)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
