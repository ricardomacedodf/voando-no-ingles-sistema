import { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, ArrowRight, Check } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import ModeSelector from "../components/ModeSelector";
import ProgressBar from "../components/ProgressBar";
import ExamplesPanel from "../components/ExamplesPanel";
import ExamplesToggleButton from "../components/ExamplesToggleButton";
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

function updateDominatedCount(items) {
  const game = getGameState();
  game.dominatedCount = items.filter(
    (item) => item?.stats?.status === "dominada"
  ).length;
  saveGameState(game);
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
  const prevModeRef = useRef(mode);

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

  const toggleSound = () => {
    const state = getSoundState();
    const newEnabled = !state.enabled;
    saveSoundState({ ...state, enabled: newEnabled });
    setSoundEnabled(newEnabled);
  };

  const handleSelect = async (idx) => {
    if (answered || !user?.id || !options[idx]) return;

    setSelected(idx);
    setAnswered(true);

    const correct = options[idx].correct;
    const xpDelta = correct ? CORRECT_XP_DELTA : INCORRECT_XP_DELTA;

    playSound(correct ? "correct" : "incorrect");

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

    const stats = card.stats || {
      correct: 0,
      incorrect: 0,
      total_reviews: 0,
      avg_response_time: 0,
      status: "nova"
    };

    const newCorrect = stats.correct + (correct ? 1 : 0);
    const newIncorrect = stats.incorrect + (correct ? 0 : 1);
    const newTotal = stats.total_reviews + 1;
    const newAvg =
      ((stats.avg_response_time || 0) * (stats.total_reviews || 0) + responseTime) /
      newTotal;

    let newStatus = "nova";
    if (newTotal >= 3) {
      const rate = newCorrect / newTotal;
      if (rate >= 0.8) newStatus = "dominada";
      else if (rate < 0.5) newStatus = "dificil";
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

  const handleNext = () => {
    if (current < queue.length - 1 && current < QUESTIONS_PER_ROUND - 1) {
      setCurrent((c) => c + 1);
      playSound("advance");
    } else {
      setRoundDone(true);
      playSound("completion");
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

    playSound("advance");
    startRound(roundNumber + 1, allVocab);
  };

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
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-8 w-8 text-primary" />
          </div>

          <h2 className="mb-2 text-3xl font-bold text-foreground">Rodada {roundNumber} concluida!🎯</h2>
          <p className="mb-5 text-muted-foreground">
            Voce respondeu {QUESTIONS_PER_ROUND} perguntas nesta rodada.
          </p>

          <div
            className={`mx-auto mb-6 flex max-w-sm items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
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
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {isLastRound ? "Recomecar" : "Proxima rodada"}
          </button>
        </div>
      </div>
    );
  }

  const card = queue[current];
  const questionText = cardDir === "en_pt" ? card?.term : activeMeaning?.meaning;
  const letters = ["A", "B", "C", "D", "E"];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <ModeSelector mode={mode} setMode={setMode} variant="quiz" />
      </div>

      <div className="space-y-2">
        <ProgressBar
          current={Math.min(current + 1, QUESTIONS_PER_ROUND)}
          total={QUESTIONS_PER_ROUND}
          variant="quiz"
        />

        <div className="flex items-center gap-4 text-sm">
          <div className="flex flex-wrap items-center gap-4 text-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-primary">{CHECK_SYMBOL}</span>
              <span>
                Acertei: <span className="font-semibold">{roundCorrectCount}</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-destructive">{CROSS_SYMBOL}</span>
              <span>
                Errei: <span className="font-semibold">{roundIncorrectCount}</span>
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

      <div className="space-y-4 rounded-2xl border bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Qual o significado?
        </p>
        <p className="break-words text-3xl font-bold leading-tight text-foreground md:text-4xl">
          {questionText}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {options.map((opt, idx) => {
          let classes = "border-border text-foreground hover:border-primary";
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
              onClick={() => handleSelect(idx)}
              disabled={answered}
              className={`flex h-[65px] w-[330px] items-center gap-3 rounded-[10px] border bg-white p-4 text-left text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed ${classes} ${
                isWrongSelection ? "shake-top" : ""
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
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
          Proximo <ArrowRight className="h-4 w-4" />
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
            <ExamplesPanel
              allMeanings={card?.meanings}
              activeMeaning={activeMeaning?.meaning}
              titleTerm={card?.term}
              variant="flashcard"
              onClose={() => setShowExamples(false)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
