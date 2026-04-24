import { useState, useEffect, useRef } from "react";
import { Check, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import ExamplesPanel from "../components/ExamplesPanel";
import ExamplesToggleButton from "../components/ExamplesToggleButton";
import ModeSelector from "../components/ModeSelector";
import ProgressBar from "../components/ProgressBar";
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

const PAIRS_PER_ROUND = 5;
const CHECK_SYMBOL = "\u2713";
const CROSS_SYMBOL = "\u2715";
const CORRECT_XP_DELTA = 1;
const INCORRECT_XP_DELTA = -2;
const COMBINATIONS_POINTER_SFX_GUARD_MS = 700;
const COMBINATIONS_MATCH_RESULT_GUARD_MS = 250;

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mapVocabularyRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    term: row.term || "",
    pronunciation: row.pronunciation || "",
    meanings: Array.isArray(row.meanings) ? row.meanings : [],
    stats: row.stats || {
      correct: 0,
      incorrect: 0,
      total_reviews: 0,
      avg_response_time: 0,
      status: "nova",
    },
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
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
  }, [user?.id]);

  useEffect(() => {
    if (pool.length === 0) return;
    setupRound();
  }, [round, pool, mode]);

  useEffect(() => {
    if (!showExamples) return;
    return scheduleExamplesAutoScroll(() => examplesPanelRef.current);
  }, [showExamples]);

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
    setErrors(0);
    setErrorPair(null);
    setShowExamples(false);
    setXpFeedback(null);
    setRoundXpBalance(0);
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

  const handleLeftClick = (idx, event) => {
    if (matched.has(`l${idx}`) || roundComplete) return;

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
    const isFirstSelection = selectedRight === null;
    if (!isFirstSelection) return;
    lastSelectPointerSfxAtRef.current = Date.now();
    playSound(SFX_EVENTS.MATCH_SELECT);
  };

  const handleRightClick = (idx, event) => {
    if (matched.has(`r${idx}`) || roundComplete) return;

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
    const isFirstSelection = selectedLeft === null;
    if (!isFirstSelection) return;
    lastSelectPointerSfxAtRef.current = Date.now();
    playSound(SFX_EVENTS.MATCH_SELECT);
  };

  const tryMatch = (leftIdx, rightIdx) => {
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

      if (newMatched.size / 2 >= roundPairs.length) {
        setRoundComplete(true);
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

      const left = leftItems[leftIdx];
      const right = rightItems[rightIdx];

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
    setRound((r) => r + 1);
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
  const roundBalanceText = `${roundXpBalance > 0 ? "+" : ""}${roundXpBalance}XP`;

  const focusedCard = allVocab.find((item) => item.id === focusedPair?.vocabId);
  const focusedMeaning = focusedCard?.meanings?.[focusedPair?.meaningIdx]?.meaning || null;
  const hasFocusedExamples =
    Array.isArray(focusedCard?.meanings) && focusedCard.meanings.length > 0;

  if (roundComplete) {
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
            className="h-14 rounded-2xl bg-primary px-10 text-[1.6rem] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:h-auto sm:rounded-xl sm:px-6 sm:py-2.5 sm:text-sm"
          >
            Proxima rodada
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 overflow-x-hidden sm:space-y-6">
      <div className="flex items-start justify-between gap-2 sm:hidden">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">Comb.</h1>
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
        <div className="min-w-0 shrink-0 self-start">
          <ModeSelector mode={mode} setMode={setMode} variant="quiz" />
        </div>
      </div>

      <div className="hidden flex-wrap items-center justify-between gap-3 sm:flex">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">Combinações</h1>
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

      <div className="space-y-2">
        <ProgressBar current={progressCurrent} total={PAIRS_PER_ROUND} variant="quiz" />
        <div className="flex items-center gap-4 text-sm">
          <div className="flex flex-wrap items-center gap-4 text-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-primary">{CHECK_SYMBOL}</span>
              <span>
                Acertei: <span className="font-semibold">{correctMatches}</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-destructive">{CROSS_SYMBOL}</span>
              <span>
                Errei: <span className="font-semibold">{errors}</span>
                {xpFeedback ? (
                  <>
                    {"\u00A0\u00A0"}
                    <span
                      className={`font-bold transition-opacity duration-200 ${
                        xpFeedback?.startsWith("+") ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {xpFeedback}
                    </span>
                  </>
                ) : null}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <div className="space-y-2">
          {leftItems.map((item, idx) => {
            const isMatched = matched.has(`l${idx}`);
            const isSelected = selectedLeft === idx;
            const isError = errorPair?.left === idx;

            let cls = "bg-card border border-border/60 text-foreground hover:border-[#0000FF] hover:bg-blue-50/30";

            if (isMatched)
              cls = "bg-emerald-50 border border-primary text-primary ring-0 md:ring-1 md:ring-primary/50";
            else if (isError)
              cls =
                "bg-red-50 border border-destructive text-destructive ring-0 md:ring-1 md:ring-destructive/50";
            else if (isSelected)
              cls = "bg-blue-50 border border-[#0000FF] text-foreground";

            return (
              <button
                key={idx}
                onPointerDown={() => handleLeftPointerDown(idx)}
                onClick={(event) => handleLeftClick(idx, event)}
                disabled={isMatched}
                className={`relative flex h-[74px] w-full items-center justify-center gap-3 rounded-lg px-3 py-3 text-center text-sm font-medium transition-all duration-200 md:block md:h-[65px] md:max-w-[330px] md:rounded-[10px] md:text-center ${cls}`}
              >
                <span className="hidden break-words md:mx-auto md:block md:max-w-[90%]">{item.text}</span>

                <span className="mx-auto max-w-[92%] break-words leading-snug md:hidden">{item.text}</span>
                {isMatched ? <Check className="absolute right-3 h-4 w-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {rightItems.map((item, idx) => {
            const isMatched = matched.has(`r${idx}`);
            const isSelected = selectedRight === idx;
            const isError = errorPair?.right === idx;

            let cls = "bg-card border border-border/60 text-foreground hover:border-[#0000FF] hover:bg-blue-50/30";

            if (isMatched)
              cls = "bg-emerald-50 border border-primary text-primary ring-0 md:ring-1 md:ring-primary/50";
            else if (isError)
              cls =
                "bg-red-50 border border-destructive text-destructive ring-0 md:ring-1 md:ring-destructive/50";
            else if (isSelected)
              cls = "bg-blue-50 border border-[#0000FF] text-foreground";

            return (
              <button
                key={idx}
                onPointerDown={() => handleRightPointerDown(idx)}
                onClick={(event) => handleRightClick(idx, event)}
                disabled={isMatched}
                className={`relative flex h-[74px] w-full items-center justify-center gap-3 rounded-lg px-3 py-3 text-center text-sm font-medium transition-all duration-200 md:block md:h-[65px] md:max-w-[330px] md:rounded-[10px] md:text-center ${cls}`}
              >
                <span className="hidden break-words md:mx-auto md:block md:max-w-[90%]">{item.text}</span>

                <span className="mx-auto max-w-[92%] break-words leading-snug md:hidden">{item.text}</span>
                {isMatched ? <Check className="absolute right-3 h-4 w-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      </div>

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
                onClose={() => setShowExamples(false)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

