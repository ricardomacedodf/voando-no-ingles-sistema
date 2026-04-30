import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Volume2, VolumeX, ArrowRight, Check } from "lucide-react";
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
const STATUS_NOVA = "nova";
const STATUS_DOMINADA = "dominada";
const STATUS_DIFICIL = "dificil";

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
  if (source.length >= size) return shuffleArray(source).slice(0, size);

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

  let currentSize = clamp(
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

  if (isMobile && currentSize >= Math.round(maxFontSize * 0.82)) {
    const estimatedLineCount = getEstimatedLineCount();
    if (estimatedLineCount <= 1) {
      const reducedSingleLineSize = clamp(
        Math.round(currentSize * QUIZ_SINGLE_LINE_LARGE_REDUCTION_MOBILE),
        minFontSize,
        maxFontSize
      );
      if (reducedSingleLineSize < currentSize) {
        currentSize = reducedSingleLineSize;
        applySize(currentSize);
      }
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

export default function Quiz() {
  const { user } = useAuth();

  const [allVocab, setAllVocab] = useState([]);
  const [queue, setQueue] = useState([]);
  const [mode, setMode] = useState("en_pt");
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

  const startRound = (nextRoundNumber, sourceVocab = allVocab) => {
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

    async function load() {
      try {
        setLoading(true);

        const data = await fetchVocabulary();

        if (!isMounted) return;

        setAllVocab(data);
        setQueue(buildRoundQueue(data));
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
        updateDominatedCount(data);
      } catch (error) {
        console.error("Erro ao carregar vocabulario no Quiz:", error);
        if (!isMounted) return;
        setAllVocab([]);
        setQueue([]);
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
    if (loading || allVocab.length === 0) return;
    if (prevModeRef.current === mode) return;

    prevModeRef.current = mode;
    startRound(1, allVocab);
  }, [mode, allVocab, loading]);

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

  const playOptionSfx = (idx, triggerEvent) => {
    if (answered || !user?.id || !options[idx]) return;
    if (shouldSkipClickSfxAfterPointer(triggerEvent)) return;
    const correct = options[idx].correct;
    playSound(correct ? SFX_EVENTS.QUIZ_SUCCESS : SFX_EVENTS.QUIZ_ERROR);
  };

  const handleSelect = async (idx, event) => {
    if (answered || !user?.id || !options[idx]) return;

    playOptionSfx(idx, event);

    setSelected(idx);
    setAnswered(true);

    const correct = options[idx].correct;
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

    const updatedStats = {
      correct: newCorrect,
      incorrect: newIncorrect,
      total_reviews: newTotal,
      avg_response_time: Math.round(newAvg),
      last_reviewed: new Date().toISOString(),
      status: newStatus
    };

    try {
      const { error } = await supabase
        .from("vocabulary")
        .update({
          stats: updatedStats,
          updated_at: new Date().toISOString()
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
              updatedAt: new Date().toISOString()
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
                updatedAt: new Date().toISOString()
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
    playOptionSfx(idx);
  };

  const handleNext = () => {
    if (current < queue.length - 1 && current < QUESTIONS_PER_ROUND - 1) {
      setCurrent((c) => c + 1);
    } else {
      setRoundDone(true);
    }
  };

  const handleNextRound = async () => {
    if (roundNumber >= MAX_ROUNDS) {
      try {
        const data = await fetchVocabulary();
        setAllVocab(data);
        updateDominatedCount(data);
        startRound(1, data);
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
  const questionTextStyle = getAdaptiveQuizTextStyle(questionText);
  const questionTextPreferredSize = questionTextStyle.fontSize;
  const progressCurrent = Math.min(current + 1, QUESTIONS_PER_ROUND);
  const progressPct = QUESTIONS_PER_ROUND > 0 ? (progressCurrent / QUESTIONS_PER_ROUND) * 100 : 0;
  const letters = ["A", "B", "C", "D", "E"];

  useLayoutEffect(() => {
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

  if (roundDone) {
    return (
      <div className="flex min-h-[70vh] items-start justify-center px-4 pt-14 sm:items-center sm:pt-0">
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
            <span>Balanco da rodada: {roundBalanceText}</span>
          </div>

          <button
            onClick={handleNextRound}
            className="h-14 rounded-2xl bg-primary px-10 text-[1.6rem] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:h-auto sm:rounded-xl sm:px-6 sm:py-2.5 sm:text-sm"
          >
            {isLastRound ? "Recomecar" : "Proxima rodada"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 overflow-x-hidden sm:space-y-6">
      <div className="relative flex items-center justify-center sm:hidden">
        <div className="min-w-0">
          <ModeSelector mode={mode} setMode={setMode} variant="quiz" />
        </div>
        <button
          onClick={toggleSound}
          className="absolute right-0 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-transparent transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          title={soundEnabled ? "Desativar audio" : "Ativar audio"}
        >
          {soundEnabled ? (
            <Volume2 className="h-4 w-4 text-muted-foreground" />
          ) : (
            <VolumeX className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      <div className="hidden flex-wrap items-center justify-between gap-3 sm:flex">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">Quiz</h1>
          <button
            onClick={toggleSound}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

      <div className="hidden sm:block">
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

      <div className="mx-auto w-full max-w-[671.2px] rounded-xl border bg-white p-5 text-center shadow-sm sm:rounded-2xl sm:p-8">
        <div
          ref={questionTextSlotRef}
          className="mx-auto flex h-[148px] min-h-[148px] w-full items-center justify-center overflow-hidden px-2 md:h-[132px] md:min-h-[132px]"
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

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4">
        {options.map((opt, idx) => {
          let classes = "border-border text-foreground hover:border-[#93C5FD]";
          const isWrongSelection = answered && idx === selected && !opt.correct;

          if (answered) {
            if (opt.correct) classes = "border-primary bg-emerald-50 text-foreground";
            else if (idx === selected && !opt.correct)
              classes = "border-destructive bg-red-50 text-foreground";
            else classes = "border-border/60 text-muted-foreground opacity-60";
          }

          return (
            <button
              key={idx}
              onPointerDown={() => handleOptionPointerDown(idx)}
              onClick={(event) => handleSelect(idx, event)}
              disabled={answered}
              className={`flex h-[clamp(62px,8.8svh,76px)] w-full items-center gap-3 rounded-[13px] border bg-white px-4 py-3 text-left text-sm font-medium transition-all duration-200 md:h-[65px] md:max-w-[330px] md:justify-self-center md:rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed ${classes} ${
                isWrongSelection ? "shake-top" : ""
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-base font-bold text-muted-foreground md:h-8 md:w-8 md:text-sm">
                {letters[idx]}
              </span>
              <span className="break-words">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {answered && (
        <button
          onClick={handleNext}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {"Pr\u00f3ximo"} <ArrowRight className="h-4 w-4" />
        </button>
      )}

      {answered && card?.meanings?.length > 0 ? (
        <div className="space-y-0">
          <ExamplesToggleButton
            expanded={showExamples}
            onClick={() => setShowExamples((prev) => !prev)}
            variant="flashcard"
          />

          {showExamples ? (
            <div ref={examplesPanelRef}>
              <ExamplesPanel
                allMeanings={card?.meanings}
                activeMeaning={activeMeaning?.meaning}
                titleTerm={card?.term}
                variant="flashcard"
                panelScope="flashcards"
                onClose={() => setShowExamples(false)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
