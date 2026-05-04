import { useState, useEffect, useRef } from "react";
import { Check, Volume2, VolumeX } from "lucide-react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import ExamplesPanel from "../components/ExamplesPanel";
import ExamplesToggleButton from "../components/ExamplesToggleButton";
import ModeSelector from "../components/ModeSelector";
import { scheduleExamplesAutoScroll } from "../lib/examplesAutoScroll";
import { SFX_EVENTS } from "../lib/sfx";
import {
  addXP,
  recordCorrect,
  recordIncorrect,
  playSound,
  getSoundState,
  saveSoundState,
} from "../lib/gameState";
import {
  REVIEW_FOCUS,
  getStudyQueue,
  loadReviewPreferences,
  normalizeVocabularyItem,
  updateStatsAfterReview,
} from "../lib/learningEngine";

const PAIRS_PER_ROUND = 5;
const CHECK_SYMBOL = "\u2713";
const CROSS_SYMBOL = "\u2715";
const CORRECT_XP_DELTA = 1;
const INCORRECT_XP_DELTA = -2;
const COMBINATIONS_POINTER_SFX_GUARD_MS = 700;
const COMBINATIONS_MATCH_RESULT_GUARD_MS = 250;
const COMBINATIONS_MOBILE_BREAKPOINT = 767;

function isMobileCombinationsViewport() {
  return (
    typeof window !== "undefined" &&
    window.innerWidth <= COMBINATIONS_MOBILE_BREAKPOINT
  );
}

function clearMobileActiveFocus() {
  if (!isMobileCombinationsViewport() || typeof document === "undefined") return;

  const activeElement = document.activeElement;

  if (activeElement && typeof activeElement.blur === "function") {
    activeElement.blur();
  }
}

function scheduleMobileActiveFocusClear() {
  if (!isMobileCombinationsViewport()) return;

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

function mapVocabularyRow(row, preferences) {
  return normalizeVocabularyItem(row, preferences);
}

function buildPool(vocab) {
  const pool = [];

  vocab.forEach((v) => {
    (v.meanings || []).forEach((m, mi) => {
      if (m?.meaning) {
        pool.push({
          vocabId: v.id,
          term: v.term,
          meaning: m.meaning,
          meaningIdx: mi,
        });
      }
    });
  });

  return pool;
}

function weightedSample(pool, difficultyMap, count) {
  if (pool.length === 0) return [];

  const byVocab = {};
  pool.forEach((item) => {
    if (!byVocab[item.vocabId]) byVocab[item.vocabId] = [];
    byVocab[item.vocabId].push({ item });
  });

  const candidates = Object.values(byVocab).map((entries) => {
    const best = entries.reduce((a, b) => {
      const wa = 1 + (difficultyMap[`${a.item.vocabId}_${a.item.meaningIdx}`] || 0) * 2;
      const wb = 1 + (difficultyMap[`${b.item.vocabId}_${b.item.meaningIdx}`] || 0) * 2;
      return wb > wa ? b : Math.random() > 0.5 ? b : a;
    });
    return best.item;
  });

  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function buildRoundDirections(mode, pairCount) {
  if (mode !== "random") {
    return Array(pairCount).fill(mode);
  }

  const directions = Array.from({ length: pairCount }, () =>
    Math.random() > 0.5 ? "en_pt" : "pt_en"
  );

  const allSameDirection = directions.every((dir) => dir === directions[0]);
  if (pairCount > 1 && allSameDirection) {
    const forcedIdx = Math.floor(Math.random() * pairCount);
    directions[forcedIdx] = directions[0] === "en_pt" ? "pt_en" : "en_pt";
  }

  return directions;
}

function getPairKey(item) {
  return `${item.vocabId}_${item.meaningIdx}`;
}

function buildDerangedOrder(keys) {
  if (keys.length <= 1) return [...keys];

  const maxAttempts = 24;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = shuffleArray(keys);
    const hasAlignedPair = candidate.some((key, idx) => key === keys[idx]);
    if (!hasAlignedPair) {
      return candidate;
    }
  }

  const shift = 1 + Math.floor(Math.random() * (keys.length - 1));
  return keys.map((_, idx) => keys[(idx + shift) % keys.length]);
}

function shuffleRightItemsAvoidingAlignedPairs(leftItems, rightCandidates) {
  if (leftItems.length <= 1 || leftItems.length !== rightCandidates.length) {
    return shuffleArray(rightCandidates);
  }

  const leftKeys = leftItems.map(getPairKey);
  const rightByKey = new Map(rightCandidates.map((item) => [getPairKey(item), item]));

  const hasUniqueKeys = rightByKey.size === rightCandidates.length;
  const hasAllLeftKeys = leftKeys.every((key) => rightByKey.has(key));
  if (!hasUniqueKeys || !hasAllLeftKeys) {
    return shuffleArray(rightCandidates);
  }

  const derangedKeys = buildDerangedOrder(leftKeys);
  return derangedKeys.map((key) => rightByKey.get(key));
}

export default function Combinations() {
  const { user } = useAuth();
  const location = useLocation();

  const [allVocab, setAllVocab] = useState([]);
  const [pool, setPool] = useState([]);
  const [mode, setMode] = useState("en_pt");
  const [round, setRound] = useState(0);
  const [roundPairs, setRoundPairs] = useState([]);
  const [leftItems, setLeftItems] = useState([]);
  const [rightItems, setRightItems] = useState([]);
  const [selectedLeft, setSelectedLeft] = useState(null);
  const [selectedRight, setSelectedRight] = useState(null);
  const [matched, setMatched] = useState(new Set());
  const [errorPair, setErrorPair] = useState(null);
  const [roundComplete, setRoundComplete] = useState(false);
  const [showRoundSummary, setShowRoundSummary] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= COMBINATIONS_MOBILE_BREAKPOINT
  );
  const [errors, setErrors] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showExamples, setShowExamples] = useState(false);
  const [focusedPair, setFocusedPair] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(() => getSoundState().enabled);
  const [xpFeedback, setXpFeedback] = useState(null);
  const [roundXpBalance, setRoundXpBalance] = useState(0);

  const difficultyMap = useRef({});
  const lastSelectPointerSfxAtRef = useRef(0);
  const lastMatchResultSfxRef = useRef({
    outcome: "",
    leftIdx: -1,
    rightIdx: -1,
    at: 0,
  });
  const examplesPanelRef = useRef(null);
  const latestVocabRef = useRef([]);
  const pendingReviewUpdatesRef = useRef(new Map());

  useEffect(() => {
    latestVocabRef.current = allVocab;
  }, [allVocab]);

  useEffect(() => {
    return () => {
      pendingReviewUpdatesRef.current.clear();
    };
  }, []);

  const fetchVocabulary = async () => {
    if (!user?.id) return [];
    const reviewPreferences = loadReviewPreferences();
    const focus = new URLSearchParams(location.search).get("focus");

    const { data, error } = await supabase
      .from("vocabulary")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    const normalizedItems = Array.isArray(data)
      ? data.map((row) => mapVocabularyRow(row, reviewPreferences))
      : [];

    const prioritized = getStudyQueue(normalizedItems, reviewPreferences, focus).items;
    if (prioritized.length >= 2 || normalizedItems.length < 2) {
      return prioritized;
    }

    return getStudyQueue(normalizedItems, reviewPreferences, REVIEW_FOCUS.ALL).items;
  };

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);

        const data = await fetchVocabulary();
        const valid = data.filter((v) => v.term && v.meanings?.some((m) => m?.meaning));

        if (!isMounted) return;

        setAllVocab(valid);
        setPool(buildPool(valid));
        setRound(0);
      } catch (error) {
        console.error("Erro ao carregar vocabulario em Combinacoes:", error);
        if (!isMounted) return;
        setAllVocab([]);
        setPool([]);
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
  }, [user?.id, location.search]);

  useEffect(() => {
    if (pool.length === 0) return;
    setupRound();
  }, [round, pool, mode]);

  useEffect(() => {
    if (!showExamples) return;
    return scheduleExamplesAutoScroll(() => examplesPanelRef.current);
  }, [showExamples]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncViewport = () => {
      setIsMobileViewport(window.innerWidth <= COMBINATIONS_MOBILE_BREAKPOINT);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  const setupRound = () => {
    const pairs = weightedSample(pool, difficultyMap.current, PAIRS_PER_ROUND);
    const directions = buildRoundDirections(mode, pairs.length);

    setRoundPairs(pairs);
    setFocusedPair(
      pairs[0]
        ? {
            vocabId: pairs[0].vocabId,
            meaningIdx: pairs[0].meaningIdx,
          }
        : null
    );

    const left = shuffleArray(
      pairs.map((p, i) => ({
        id: i,
        text: directions[i] === "en_pt" ? p.term : p.meaning,
        vocabId: p.vocabId,
        meaningIdx: p.meaningIdx,
      }))
    );

    const right = shuffleRightItemsAvoidingAlignedPairs(
      left,
      pairs.map((p, i) => ({
        id: i,
        text: directions[i] === "en_pt" ? p.meaning : p.term,
        vocabId: p.vocabId,
        meaningIdx: p.meaningIdx,
      }))
    );

    setLeftItems(left);
    setRightItems(right);
    setMatched(new Set());
    setSelectedLeft(null);
    setSelectedRight(null);
    setRoundComplete(false);
    setShowRoundSummary(false);
    setErrors(0);
    setErrorPair(null);
    setShowExamples(false);
    setXpFeedback(null);
    setRoundXpBalance(0);
    scheduleMobileActiveFocusClear();
  };

  const checkMatch = (leftIdx, rightIdx) => {
    const left = leftItems[leftIdx];
    const right = rightItems[rightIdx];
    return left && right && left.vocabId === right.vocabId && left.meaningIdx === right.meaningIdx;
  };

  const shouldSkipClickSfxAfterPointer = (event) => {
    if (!event) return false;
    if (event.detail === 0) return false;
    return (
      Date.now() - lastSelectPointerSfxAtRef.current <
      COMBINATIONS_POINTER_SFX_GUARD_MS
    );
  };

  const shouldSkipRepeatedMatchResultSfx = (outcome, leftIdx, rightIdx) => {
    const last = lastMatchResultSfxRef.current;
    const now = Date.now();
    const isDuplicate =
      last.outcome === outcome &&
      last.leftIdx === leftIdx &&
      last.rightIdx === rightIdx &&
      now - last.at < COMBINATIONS_MATCH_RESULT_GUARD_MS;

    if (isDuplicate) return true;

    lastMatchResultSfxRef.current = { outcome, leftIdx, rightIdx, at: now };
    return false;
  };

  const mergeUpdatedStatsLocally = (vocabId, updatedStats, now) => {
    if (!vocabId) return;

    setAllVocab((previous) => {
      const nextItems = previous.map((item) =>
        item.id === vocabId
          ? {
              ...item,
              stats: updatedStats,
              updatedAt: now,
            }
          : item
      );
      latestVocabRef.current = nextItems;
      return nextItems;
    });
  };

  const enqueueReviewUpdate = (vocabId, result) => {
    if (!vocabId || !user?.id) return;

    const runUpdate = async () => {
      const currentItem = latestVocabRef.current.find((item) => item.id === vocabId);
      if (!currentItem) return;

      const now = new Date().toISOString();
      const reviewPreferences = loadReviewPreferences();
      const updatedStats = updateStatsAfterReview(currentItem, result, {
        reviewedAt: now,
        mode: "combinations",
        preferences: reviewPreferences,
      });

      mergeUpdatedStatsLocally(vocabId, updatedStats, now);

      const { error } = await supabase
        .from("vocabulary")
        .update({
          stats: updatedStats,
          updated_at: now,
        })
        .eq("id", vocabId)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }
    };

    const pendingQueue = pendingReviewUpdatesRef.current;
    const previousTask = pendingQueue.get(vocabId) || Promise.resolve();
    const nextTask = previousTask
      .catch(() => {})
      .then(runUpdate)
      .catch((error) => {
        console.error("Erro ao salvar stats em Combinacoes:", error);
      })
      .finally(() => {
        if (pendingQueue.get(vocabId) === nextTask) {
          pendingQueue.delete(vocabId);
        }
      });

    pendingQueue.set(vocabId, nextTask);
  };

  const persistMatchReview = (leftItem, rightItem, isCorrect) => {
    if (!leftItem || !rightItem || !user?.id) return;

    const impactedVocabIds = isCorrect
      ? [leftItem.vocabId]
      : Array.from(
          new Set(
            [leftItem.vocabId, rightItem.vocabId].filter((value) => value != null)
          )
        );

    impactedVocabIds.forEach((vocabId) => {
      enqueueReviewUpdate(vocabId, isCorrect);
    });
  };

  const handleLeftClick = (idx, event) => {
    if (matched.has(`l${idx}`) || roundComplete) return;

    const isDeselectingSameItem = selectedLeft === idx && selectedRight === null;

    if (isDeselectingSameItem) {
      setSelectedLeft(null);
      scheduleMobileActiveFocusClear();
      return;
    }

    const isFirstSelection = selectedRight === null;
    if (isFirstSelection && !shouldSkipClickSfxAfterPointer(event)) {
      playSound(SFX_EVENTS.MATCH_SELECT);
    }
    const left = leftItems[idx];
    if (left) {
      setFocusedPair({
        vocabId: left.vocabId,
        meaningIdx: left.meaningIdx,
      });
    }
    setSelectedLeft(idx);

    if (selectedRight !== null) {
      tryMatch(idx, selectedRight);
    }
  };

  const handleLeftPointerDown = (idx) => {
    if (matched.has(`l${idx}`) || roundComplete) return;

    const isDeselectingSameItem = selectedLeft === idx && selectedRight === null;
    if (isDeselectingSameItem) return;

    const isFirstSelection = selectedRight === null;
    if (!isFirstSelection) return;
    lastSelectPointerSfxAtRef.current = Date.now();
    playSound(SFX_EVENTS.MATCH_SELECT);
  };

  const handleRightClick = (idx, event) => {
    if (matched.has(`r${idx}`) || roundComplete) return;

    const isDeselectingSameItem = selectedRight === idx && selectedLeft === null;

    if (isDeselectingSameItem) {
      setSelectedRight(null);
      scheduleMobileActiveFocusClear();
      return;
    }

    const isFirstSelection = selectedLeft === null;
    if (isFirstSelection && !shouldSkipClickSfxAfterPointer(event)) {
      playSound(SFX_EVENTS.MATCH_SELECT);
    }
    const right = rightItems[idx];
    if (right) {
      setFocusedPair({
        vocabId: right.vocabId,
        meaningIdx: right.meaningIdx,
      });
    }
    setSelectedRight(idx);

    if (selectedLeft !== null) {
      tryMatch(selectedLeft, idx);
    }
  };

  const handleRightPointerDown = (idx) => {
    if (matched.has(`r${idx}`) || roundComplete) return;

    const isDeselectingSameItem = selectedRight === idx && selectedLeft === null;
    if (isDeselectingSameItem) return;

    const isFirstSelection = selectedLeft === null;
    if (!isFirstSelection) return;
    lastSelectPointerSfxAtRef.current = Date.now();
    playSound(SFX_EVENTS.MATCH_SELECT);
  };

  const tryMatch = (leftIdx, rightIdx) => {
    const left = leftItems[leftIdx];
    const right = rightItems[rightIdx];

    if (checkMatch(leftIdx, rightIdx)) {
      if (!shouldSkipRepeatedMatchResultSfx("success", leftIdx, rightIdx)) {
        playSound(SFX_EVENTS.MATCH_SUCCESS);
      }
      recordCorrect();
      addXP(CORRECT_XP_DELTA);
      setRoundXpBalance((prev) => prev + CORRECT_XP_DELTA);
      setXpFeedback(`+${CORRECT_XP_DELTA} XP`);
      setTimeout(() => setXpFeedback(null), 1000);

      const newMatched = new Set(matched);
      newMatched.add(`l${leftIdx}`);
      newMatched.add(`r${rightIdx}`);
      setMatched(newMatched);
      setSelectedLeft(null);
      setSelectedRight(null);
      persistMatchReview(left, right, true);

      if (newMatched.size / 2 >= roundPairs.length) {
        setRoundComplete(true);
        if (!isMobileViewport) {
          setShowRoundSummary(true);
        }
      }
    } else {
      if (!shouldSkipRepeatedMatchResultSfx("error", leftIdx, rightIdx)) {
        playSound(SFX_EVENTS.MATCH_ERROR);
      }
      recordIncorrect();
      addXP(INCORRECT_XP_DELTA);
      setRoundXpBalance((prev) => prev + INCORRECT_XP_DELTA);
      setXpFeedback(`${INCORRECT_XP_DELTA} XP`);
      setTimeout(() => setXpFeedback(null), 1000);
      setErrors((e) => e + 1);
      setErrorPair({ left: leftIdx, right: rightIdx });
      persistMatchReview(left, right, false);

      if (left) {
        const keyL = `${left.vocabId}_${left.meaningIdx}`;
        difficultyMap.current[keyL] = (difficultyMap.current[keyL] || 0) + 1;
      }

      if (right) {
        const keyR = `${right.vocabId}_${right.meaningIdx}`;
        difficultyMap.current[keyR] = (difficultyMap.current[keyR] || 0) + 1;
      }

      setTimeout(() => {
        setErrorPair(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 600);
    }
  };

  const nextRound = () => {
    scheduleMobileActiveFocusClear();
    setRound((r) => r + 1);
  };

  const handleConcludeRound = () => {
    if (!roundComplete) return;
    setShowRoundSummary(true);
  };

  const toggleSound = () => {
    const state = getSoundState();
    const newEnabled = !state.enabled;
    saveSoundState({ ...state, enabled: newEnabled });
    setSoundEnabled(newEnabled);
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-3 border-border border-t-primary" />
      </div>
    );
  }

  if (allVocab.length < 2) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">
          Cadastre pelo menos 2 palavras para usar Combinações.
        </p>
      </div>
    );
  }

  const correctMatches = Math.floor(matched.size / 2);
  const progressCurrent = Math.min(correctMatches, PAIRS_PER_ROUND);
  const progressPct = PAIRS_PER_ROUND > 0 ? (progressCurrent / PAIRS_PER_ROUND) * 100 : 0;
  const roundBalanceText = `${roundXpBalance > 0 ? "+" : ""}${roundXpBalance}XP`;
  const shouldShowRoundSummary = roundComplete && (!isMobileViewport || showRoundSummary);
  const shouldShowMobileConcludeRound = roundComplete && isMobileViewport && !showRoundSummary;

  const focusedCard = allVocab.find((item) => item.id === focusedPair?.vocabId);
  const focusedMeaning = focusedCard?.meanings?.[focusedPair?.meaningIdx]?.meaning || null;
  const hasFocusedExamples =
    Array.isArray(focusedCard?.meanings) && focusedCard.meanings.length > 0;

  if (shouldShowRoundSummary) {
    return (
      <div className="flex min-h-[70vh] items-start justify-center px-4 pt-14 sm:items-center sm:pt-0">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 sm:h-16 sm:w-16">
            <Check className="h-10 w-10 text-primary sm:h-8 sm:w-8" />
          </div>

          <h2 className="mb-2 text-[2rem] font-bold leading-tight text-foreground sm:text-3xl">Rodada {round + 1} concluida</h2>
          <p className="mb-5 text-lg text-muted-foreground sm:text-base">Voce marcou {PAIRS_PER_ROUND} pares nesta rodada.</p>

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
            onClick={nextRound}
            className="h-14 rounded-2xl bg-primary px-10 text-[1.6rem] font-semibold text-primary-foreground transition-colors focus:outline-none md:hover:bg-primary/90 md:focus-visible:ring-2 md:focus-visible:ring-primary/25 sm:h-auto sm:rounded-xl sm:px-6 sm:py-2.5 sm:text-sm"
          >
            Proxima rodada
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
          className="absolute right-0 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-transparent transition-colors md:hover:bg-muted focus:outline-none md:focus-visible:outline-none md:focus-visible:ring-1 md:focus-visible:ring-ring"
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
          <h1 className="text-2xl font-bold text-foreground">Combinações</h1>
          <button
            onClick={toggleSound}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent transition-colors md:hover:bg-muted focus:outline-none md:focus-visible:outline-none md:focus-visible:ring-1 md:focus-visible:ring-ring"
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
            {progressCurrent} de {PAIRS_PER_ROUND}
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
                Acertei: <span className="font-semibold">{correctMatches}</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="text-destructive">{CROSS_SYMBOL}</span>
              <span>
                Errei: <span className="font-semibold">{errors}</span>
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="hidden sm:block">
        <div className="flex items-center gap-3 text-sm font-medium">
          <span className="shrink-0 whitespace-nowrap text-muted-foreground">
            {progressCurrent} de {PAIRS_PER_ROUND}
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
                Acertei: <span className="font-semibold">{correctMatches}</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-destructive">{CROSS_SYMBOL}</span>
              <span>
                Errei: <span className="font-semibold">{errors}</span>
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[11px] sm:gap-[11px]">
        <div className="space-y-[9px] sm:space-y-[10px]">
          {leftItems.map((item, idx) => {
            const isMatched = matched.has(`l${idx}`);
            const isSelected = selectedLeft === idx;
            const isError = errorPair?.left === idx;

            let cls =
              "bg-card border border-border text-[#4B5563] shadow-[0_2px_0_rgba(148,163,184,0.24)] md:hover:border-[#93c5fd] md:hover:bg-blue-50/30 dark:text-slate-300 dark:shadow-[0_2px_0_rgba(2,6,23,0.45)] dark:md:hover:border-sky-500/70 dark:md:hover:bg-sky-500/15";

            if (isMatched)
              cls =
                "bg-emerald-50 border border-primary text-primary shadow-[0_2px_0_rgba(37,177,95,0.26)] dark:bg-emerald-500/20 dark:border-emerald-400/70 dark:text-emerald-300 dark:shadow-[0_2px_0_rgba(6,78,59,0.5)]";
            else if (isError)
              cls =
                "bg-[#FDECEE] border border-[#F2A4AC] text-[#E54858] shadow-[0_2px_0_rgba(242,164,172,0.28)] dark:bg-red-500/20 dark:border-red-400/70 dark:text-red-300 dark:shadow-[0_2px_0_rgba(127,29,29,0.55)]";
            else if (isSelected)
              cls =
                "bg-[#DFF1FF] border border-[#7CC8F8] text-[#2D8FC2] shadow-[0_2px_0_rgba(124,200,248,0.38)] dark:bg-sky-500/20 dark:border-sky-400/70 dark:text-sky-300 dark:shadow-[0_2px_0_rgba(7,89,133,0.55)]";

            return (
              <button
                key={idx}
                onPointerDown={() => handleLeftPointerDown(idx)}
                onClick={(event) => handleLeftClick(idx, event)}
                disabled={isMatched}
                className={`relative flex h-[74px] w-full items-center justify-center gap-3 rounded-lg px-3 py-3 text-center text-sm font-medium transition-all duration-200 focus:outline-none md:h-[65px] md:rounded-[10px] md:focus-visible:ring-2 md:focus-visible:ring-primary/25 ${cls}`}
              >
                <span className="mx-auto max-w-[92%] break-words leading-snug">{item.text}</span>
                {isMatched ? <Check className="absolute right-3 h-4 w-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>

        <div className="space-y-[9px] sm:space-y-[10px]">
          {rightItems.map((item, idx) => {
            const isMatched = matched.has(`r${idx}`);
            const isSelected = selectedRight === idx;
            const isError = errorPair?.right === idx;

            let cls =
              "bg-card border border-border text-[#4B5563] shadow-[0_2px_0_rgba(148,163,184,0.24)] md:hover:border-[#93c5fd] md:hover:bg-blue-50/30 dark:text-slate-300 dark:shadow-[0_2px_0_rgba(2,6,23,0.45)] dark:md:hover:border-sky-500/70 dark:md:hover:bg-sky-500/15";

            if (isMatched)
              cls =
                "bg-emerald-50 border border-primary text-primary shadow-[0_2px_0_rgba(37,177,95,0.26)] dark:bg-emerald-500/20 dark:border-emerald-400/70 dark:text-emerald-300 dark:shadow-[0_2px_0_rgba(6,78,59,0.5)]";
            else if (isError)
              cls =
                "bg-[#FDECEE] border border-[#F2A4AC] text-[#E54858] shadow-[0_2px_0_rgba(242,164,172,0.28)] dark:bg-red-500/20 dark:border-red-400/70 dark:text-red-300 dark:shadow-[0_2px_0_rgba(127,29,29,0.55)]";
            else if (isSelected)
              cls =
                "bg-[#DFF1FF] border border-[#7CC8F8] text-[#2D8FC2] shadow-[0_2px_0_rgba(124,200,248,0.38)] dark:bg-sky-500/20 dark:border-sky-400/70 dark:text-sky-300 dark:shadow-[0_2px_0_rgba(7,89,133,0.55)]";

            return (
              <button
                key={idx}
                onPointerDown={() => handleRightPointerDown(idx)}
                onClick={(event) => handleRightClick(idx, event)}
                disabled={isMatched}
                className={`relative flex h-[74px] w-full items-center justify-center gap-3 rounded-lg px-3 py-3 text-center text-sm font-medium transition-all duration-200 focus:outline-none md:h-[65px] md:rounded-[10px] md:focus-visible:ring-2 md:focus-visible:ring-primary/25 ${cls}`}
              >
                <span className="mx-auto max-w-[92%] break-words leading-snug">{item.text}</span>
                {isMatched ? <Check className="absolute right-3 h-4 w-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      {shouldShowMobileConcludeRound ? (
        <button
          type="button"
          onClick={handleConcludeRound}
          className="sm:hidden flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors focus:outline-none md:hover:bg-primary/90 md:focus-visible:ring-2 md:focus-visible:ring-primary/25"
        >
          Concluir rodada
        </button>
      ) : null}

      {hasFocusedExamples ? (
        <div className="space-y-0">
          <ExamplesToggleButton
            expanded={showExamples}
            onClick={() => setShowExamples((prev) => !prev)}
            variant="flashcard"
          />

          {showExamples ? (
            <div ref={examplesPanelRef}>
              <ExamplesPanel
                allMeanings={focusedCard.meanings}
                activeMeaning={focusedMeaning}
                titleTerm={focusedCard.term}
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

