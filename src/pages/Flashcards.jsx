import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Check, X, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import FlashcardModeSelector from "../components/FlashcardModeSelector";
import ExamplesPanel from "../components/ExamplesPanel";
import ExamplesToggleButton from "../components/ExamplesToggleButton";
import { scheduleExamplesAutoScroll } from "../lib/examplesAutoScroll";
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

const FLASHCARD_CARD_WIDTH = 671.2;
const FLASHCARD_CARD_HEIGHT = 335.3;
const FLASHCARD_MAIN_TEXT_MIN_SIZE = 22;
const FLASHCARD_MAIN_TEXT_MIN_SIZE_MOBILE = 18;
const FLASHCARD_MAIN_TEXT_MAX_SIZE = 47;
const FLASHCARD_MAIN_TEXT_MAX_SIZE_MOBILE = 40;
const FLASHCARD_MOBILE_BREAKPOINT = 767;
const FLASHCARD_DISCARD_TRANSITION_MS = 940;
const FLASHCARD_DISCARD_CLEANUP_MS = 1040;
const FLASHCARD_DISCARD_TRANSLATE_X = 520;
const FLASHCARD_DISCARD_ROTATE_DEG = 20;
const FLASHCARD_DISCARD_SCALE = 0.9;
const FLASHCARD_DISCARD_EASING = "cubic-bezier(0.22, 0.61, 0.36, 1)";
const STATUS_NOVA = "nova";
const STATUS_DOMINADA = "dominada";
const STATUS_DIFICIL = "dificil";

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
  game.dominatedCount = items.filter(
    (item) => item?.stats?.status === STATUS_DOMINADA
  ).length;
  saveGameState(game);
}

function normalizeStatus(rawStatus) {
  const status = String(rawStatus || "")
    .trim()
    .toLowerCase();

  if (status === STATUS_DOMINADA) return STATUS_DOMINADA;
  if (status === STATUS_DIFICIL || status === "difícil") return STATUS_DIFICIL;
  return STATUS_NOVA;
}

function normalizeStats(rawStats) {
  const merged = {
    correct: 0,
    incorrect: 0,
    total_reviews: 0,
    avg_response_time: 0,
    status: STATUS_NOVA,
    ...(rawStats || {}),
  };

  return {
    ...merged,
    correct: Number(merged.correct) || 0,
    incorrect: Number(merged.incorrect) || 0,
    total_reviews: Number(merged.total_reviews) || 0,
    avg_response_time: Number(merged.avg_response_time) || 0,
    status: normalizeStatus(merged.status),
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getAdaptiveLineHeightMultiplier(fontSize) {
  if (fontSize >= 42) return 1.12;
  if (fontSize >= 34) return 1.16;
  if (fontSize >= 28) return 1.2;
  return 1.24;
}

function getAdaptiveMainTextStyle(content) {
  const text = typeof content === "string" ? content.trim() : "";
  const length = text.length;
  const words = text ? text.split(/\s+/).length : 1;
  const isMobileViewport =
    typeof window !== "undefined" &&
    window.innerWidth <= FLASHCARD_MOBILE_BREAKPOINT;
  const minFontSize = isMobileViewport
    ? FLASHCARD_MAIN_TEXT_MIN_SIZE_MOBILE
    : FLASHCARD_MAIN_TEXT_MIN_SIZE;
  const maxFontSize = isMobileViewport
    ? FLASHCARD_MAIN_TEXT_MAX_SIZE_MOBILE
    : FLASHCARD_MAIN_TEXT_MAX_SIZE;
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

function fitMainTextToSlot(textElement, slotElement, preferredFontSize) {
  if (!textElement || !slotElement) return;

  const isMobile =
    typeof window !== "undefined" &&
    window.innerWidth <= FLASHCARD_MOBILE_BREAKPOINT;

  const minFontSize = isMobile
    ? FLASHCARD_MAIN_TEXT_MIN_SIZE_MOBILE
    : FLASHCARD_MAIN_TEXT_MIN_SIZE;
  const maxFontSize = isMobile
    ? FLASHCARD_MAIN_TEXT_MAX_SIZE_MOBILE
    : FLASHCARD_MAIN_TEXT_MAX_SIZE;

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
    const targetHeight = isMobile
      ? Math.floor(slotElement.clientHeight * 0.82)
      : slotElement.clientHeight;
    const targetWidth = isMobile
      ? Math.floor(slotElement.clientWidth * 0.9)
      : slotElement.clientWidth;
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

  const [baseVocab, setBaseVocab] = useState([]);
  const [vocab, setVocab] = useState([]);
  const [mode, setMode] = useState("en_pt");
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionDone, setSessionDone] = useState(false);
  const [activeMeaning, setActiveMeaning] = useState(null);
  const [cardDir, setCardDir] = useState("en_pt");
  const [soundEnabled, setSoundEnabled] = useState(() => getSoundState().enabled);
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [suppressFlipResetTransition, setSuppressFlipResetTransition] = useState(false);
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

  const fetchVocabulary = async () => {
    if (!user?.id) return [];

    const { data, error } = await supabase
      .from("vocabulary")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data.map(mapVocabularyRow) : [];
  };

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);

        const data = await fetchVocabulary();
        const prepared = mode === "random" ? shuffleArray(data) : data;

        recordStudySession();
        updateStreak();
        updateDominatedCount(prepared);

        if (!isMounted) return;

        setBaseVocab(data);
        setVocab(prepared);
        setCurrent(0);
        setFlipped(false);
        setShowExamples(false);
        setSessionDone(false);
        setIsSubmittingResponse(false);
        setSuppressFlipResetTransition(false);
        clearDiscardOverlays();
        responseLockRef.current = false;
      } catch (error) {
        console.error("Erro ao carregar vocabulÃ¡rio no Flashcards:", error);
        if (!isMounted) return;
        setBaseVocab([]);
        setVocab([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (loading || baseVocab.length === 0) return;
    if (prevModeRef.current === mode) return;

    prevModeRef.current = mode;

    const prepared = mode === "random" ? shuffleArray(baseVocab) : [...baseVocab];
    setVocab(prepared);
    setCurrent(0);
    setFlipped(false);
    setShowExamples(false);
    setSessionDone(false);
    setIsSubmittingResponse(false);
    setSuppressFlipResetTransition(false);
    clearDiscardOverlays();
    responseLockRef.current = false;
    updateDominatedCount(prepared);
  }, [mode, baseVocab, loading]);

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
    setIsSubmittingResponse(false);
    responseLockRef.current = false;
  }, [current, vocab, mode]);

  const card = vocab[current];
  const front = cardDir === "en_pt" ? card?.term : activeMeaning?.meaning;
  const back = cardDir === "en_pt" ? activeMeaning?.meaning : card?.term;
  const frontTextStyle = getAdaptiveMainTextStyle(front);
  const backTextStyle = getAdaptiveMainTextStyle(back);
  const progressPct = vocab.length > 0 ? ((current + 1) / vocab.length) * 100 : 0;

  useLayoutEffect(() => {
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

  const handleFlip = () => {
    if (responseLockRef.current || isSubmittingResponse) return;
    if (hasActiveSelectionInsideCard()) return;
    setFlipped((value) => !value);
    playSound("flip");
  };

  const handleResponse = async (correct) => {
    if (!card || !user?.id || responseLockRef.current) return;

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

    const responseTime = card._startTime ? Date.now() - card._startTime : 0;
    playSound(correct ? "correct" : "incorrect");

    const stats = normalizeStats(card.stats);

    const newCorrect = stats.correct + (correct ? 1 : 0);
    const newIncorrect = stats.incorrect + (correct ? 0 : 1);
    const newTotal = stats.total_reviews + 1;
    const newAvg =
      ((stats.avg_response_time || 0) * (stats.total_reviews || 0) + responseTime) /
      newTotal;

    let newStatus = STATUS_NOVA;
    if (newTotal >= 3) {
      const rate = newCorrect / newTotal;
      if (rate >= 0.8) newStatus = STATUS_DOMINADA;
      else if (rate < 0.5) newStatus = STATUS_DIFICIL;
    }

    const now = new Date().toISOString();
    const updatedStats = {
      correct: newCorrect,
      incorrect: newIncorrect,
      total_reviews: newTotal,
      avg_response_time: Math.round(newAvg),
      last_reviewed: now,
      status: newStatus,
    };

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
      console.error("Erro ao atualizar estatísticas no Supabase:", error);
      alert("Nao foi possivel salvar seu progresso desta carta.");
    } finally {
      if (current < vocab.length - 1) {
        setCurrent((index) => index + 1);
        playSound("advance");
      } else {
        setSessionDone(true);
        playSound("completion");
      }

      responseLockRef.current = false;
      setIsSubmittingResponse(false);
    }
  };

  useEffect(() => {
    if (!card) return;

    setVocab((previous) =>
      previous.map((item, index) =>
        index === current
          ? {
              ...item,
              _startTime: Date.now(),
            }
          : item
      )
    );
  }, [current]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-7 h-7 border-3 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (vocab.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Nenhuma palavra cadastrada ainda.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Acesse o Gerenciador para adicionar vocabulÃ¡rio.
        </p>
      </div>
    );
  }

  if (sessionDone) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-foreground">Sessão completa.</h2>
        <p className="mb-4 text-muted-foreground">
          {`Você revisou ${vocab.length} ${vocab.length === 1 ? "cartão" : "cartões"}.`}
        </p>
        <button
          onClick={async () => {
            try {
              const data = await fetchVocabulary();
              const prepared = mode === "random" ? shuffleArray(data) : data;
              setBaseVocab(data);
              setVocab(prepared);
              setCurrent(0);
              setFlipped(false);
              setSessionDone(false);
              setShowExamples(false);
              setIsSubmittingResponse(false);
              setSuppressFlipResetTransition(false);
              clearDiscardOverlays();
              responseLockRef.current = false;
              updateDominatedCount(prepared);
            } catch (error) {
              console.error("Erro ao recarregar flashcards:", error);
              alert("NÃ£o foi possÃ­vel recarregar os flashcards.");
            }
          }}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Recomeçar
        </button>
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-2xl space-y-5 overflow-x-hidden sm:space-y-6"
      style={{ touchAction: "pan-y" }}
    >
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <h1 className="flex min-w-0 items-center gap-1.5 text-[1.12rem] font-bold text-foreground sm:gap-2 sm:text-2xl">
          Flashcards
          <button
            type="button"
            onClick={toggleSound}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted sm:h-9 sm:w-9"
            title={soundEnabled ? "Desativar Ã¡udio" : "Ativar Ã¡udio"}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
            )}
          </button>
        </h1>

        <div className="min-w-0 shrink-0">
          <FlashcardModeSelector mode={mode} setMode={setMode} />
        </div>
      </div>

      <div className="space-y-2 sm:hidden">
        <div className="flex items-center gap-3 text-sm font-medium">
          <span className="text-muted-foreground">{current + 1} de {vocab.length}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-[#25B15F] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
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

      <div className="hidden items-center gap-4 text-sm font-medium sm:flex">
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
        className="relative w-full overflow-hidden"
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
          }}
          onClick={handleFlip}
        >
          <div
            className={`flip-card-inner relative h-full w-full ${flipped ? "flipped" : ""} ${
              suppressFlipResetTransition ? "!transition-none" : ""
            }`}
          >
            <div className="flip-card-front flashcard-context-box absolute inset-0 rounded-2xl border border-border bg-white text-center">
              <div ref={frontTextSlotRef} className="flashcard-main-text-slot">
                <p
                  ref={frontTextRef}
                  className="flashcard-main-text select-text text-center font-bold text-foreground"
                  style={{
                    fontSize: `${frontTextStyle.fontSize}px`,
                    lineHeight: `${frontTextStyle.lineHeight}px`,
                    maxWidth: frontTextStyle.maxWidth,
                    marginInline: "auto",
                    textWrap: "balance",
                    overflowWrap: frontTextStyle.overflowWrap,
                    wordBreak: frontTextStyle.wordBreak,
                    hyphens: frontTextStyle.hyphens,
                  }}
                >
                  {front}
                </p>
              </div>
              <p className="flashcard-reveal-hint text-xs text-muted-foreground">
                Clique para revelar
              </p>
            </div>

            <div className="flip-card-back flashcard-context-box absolute inset-0 rounded-2xl border border-border bg-white text-center">
              <div ref={backTextSlotRef} className="flashcard-main-text-slot">
                <p
                  ref={backTextRef}
                  className="flashcard-main-text select-text text-center font-bold text-foreground"
                  style={{
                    fontSize: `${backTextStyle.fontSize}px`,
                    lineHeight: `${backTextStyle.lineHeight}px`,
                    maxWidth: backTextStyle.maxWidth,
                    marginInline: "auto",
                    textWrap: "balance",
                    overflowWrap: backTextStyle.overflowWrap,
                    wordBreak: backTextStyle.wordBreak,
                    hyphens: backTextStyle.hyphens,
                  }}
                >
                  {back}
                </p>
              </div>
              {card?.pronunciation ? (
                <p className="flashcard-pronunciation select-text text-xs text-muted-foreground">
                  /{card.pronunciation}/
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => handleResponse(false)}
          disabled={isSubmittingResponse}
          className="inline-flex h-[58px] items-center justify-center gap-2 rounded-lg border border-red-500 px-4 py-2 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:rounded-md sm:text-sm sm:font-medium"
        >
          Não sei
        </button>

        <button
          type="button"
          onClick={() => handleResponse(true)}
          disabled={isSubmittingResponse}
          className="inline-flex h-[58px] items-center justify-center gap-2 rounded-lg bg-[#25B15F] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1E9A4F] disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:rounded-md sm:text-sm sm:font-medium"
        >
          <Check className="mr-1 h-4 w-4" />
          Já sei
        </button>
      </div>

      {card?.meanings?.length > 0 ? (
        <div className="space-y-0">
          <ExamplesToggleButton
            expanded={showExamples}
            onClick={() => setShowExamples((value) => !value)}
            variant="flashcard"
          />

          {showExamples ? (
            <div ref={examplesPanelRef}>
              <ExamplesPanel
                allMeanings={card.meanings}
                activeMeaning={activeMeaning?.meaning}
                titleTerm={card?.term}
                variant="flashcard"
                onClose={() => setShowExamples(false)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


