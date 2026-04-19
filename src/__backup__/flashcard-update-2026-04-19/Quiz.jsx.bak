import { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, ArrowRight, Lightbulb, Check } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import ModeSelector from "../components/ModeSelector";
import ProgressBar from "../components/ProgressBar";
import ExamplesPanel from "../components/ExamplesPanel";
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

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionDone, setSessionDone] = useState(false);
  const [xpFeedback, setXpFeedback] = useState(null);
  const [activeMeaning, setActiveMeaning] = useState(null);
  const [cardDir, setCardDir] = useState("en_pt");
  const [soundEnabled, setSoundEnabled] = useState(() => getSoundState().enabled);
  const startTime = useRef(Date.now());

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

        if (!isMounted) return;

        setAllVocab(data);
        setQueue(shuffleArray(data));
        setCurrent(0);
        setAnswered(false);
        setSelected(null);
        setShowExamples(false);
        setSessionDone(false);
        setActiveMeaning(null);
        setOptions([]);
        updateDominatedCount(data);
      } catch (error) {
        console.error("Erro ao carregar vocabulário no Quiz:", error);
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
  }, [mode, user?.id]);

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
    setIsCorrect(false);
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
    setIsCorrect(correct);
    playSound(correct ? "correct" : "incorrect");

    addXP(correct ? 1 : -2);
    setXpFeedback(correct ? "+1 XP" : "-2 XP");
    setTimeout(() => setXpFeedback(null), 2000);

    if (correct) recordCorrect();
    else recordIncorrect();
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
      else if (rate < 0.5) newStatus = "difícil";
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
      alert("Não foi possível salvar seu progresso nesta pergunta.");
    }
  };

  const handleNext = () => {
    if (current < queue.length - 1) {
      setCurrent((c) => c + 1);
      playSound("advance");
    } else {
      setSessionDone(true);
      playSound("completion");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-7 h-7 border-3 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (allVocab.length < 4) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Cadastre pelo menos 4 palavras para usar o Quiz.</p>
      </div>
    );
  }

  if (sessionDone) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Quiz completo! 🎉</h2>
        <p className="text-muted-foreground mb-4">Você respondeu {queue.length} perguntas.</p>
        <button
          onClick={async () => {
            try {
              const data = await fetchVocabulary();
              setAllVocab(data);
              setCurrent(0);
              setSessionDone(false);
              setQueue(shuffleArray(data));
              setAnswered(false);
              setSelected(null);
              setShowExamples(false);
              updateDominatedCount(data);
            } catch (error) {
              console.error("Erro ao recarregar quiz:", error);
              alert("Não foi possível recarregar o quiz.");
            }
          }}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Recomeçar
        </button>
      </div>
    );
  }

  const card = queue[current];
  const questionText = cardDir === "en_pt" ? card?.term : activeMeaning?.meaning;
  const letters = ["A", "B", "C", "D"];

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground">Quiz</h1>
          <button
            onClick={toggleSound}
            className="p-1 rounded-lg hover:bg-muted transition-colors"
            title={soundEnabled ? "Desativar áudio" : "Ativar áudio"}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-primary" />
            ) : (
              <VolumeX className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
        <ModeSelector mode={mode} setMode={setMode} />
      </div>

      <ProgressBar current={current + 1} total={queue.length} />

      <div className="bg-card rounded-2xl border border-border/60 p-6 md:p-8 mt-5 text-center">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
          Qual o significado?
        </p>
        <p className="text-xl md:text-2xl font-bold text-foreground leading-relaxed break-words">
          {questionText}
        </p>
      </div>

      <div className="space-y-2 mt-4">
        {options.map((opt, idx) => {
          let classes = "bg-card border border-border/60 text-foreground hover:border-primary/50";

          if (answered) {
            if (opt.correct) classes = "bg-emerald-50 border-primary text-foreground";
            else if (idx === selected && !opt.correct) classes = "bg-red-50 border-destructive text-foreground";
            else classes = "bg-card border border-border/40 text-muted-foreground opacity-60";
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={answered}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 ${classes}`}
            >
              <span className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">
                {letters[idx]}
              </span>
              <span className="text-left break-words">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {answered && (
        <div
          className={`mt-4 p-4 rounded-xl text-sm font-medium ${
            isCorrect ? "bg-emerald-50 text-primary" : "bg-red-50 text-destructive"
          }`}
        >
          {isCorrect ? "Correto! 🎉" : "Errou! Tente novamente 💪"}{" "}
          <span className="font-bold">{xpFeedback}</span>
        </div>
      )}

      {answered && (
        <div className="flex gap-3 mt-3">
          {card?.meanings?.length > 0 && (
            <button
              onClick={() => setShowExamples(!showExamples)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                showExamples
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-card text-foreground border-border/60 hover:bg-orange-500 hover:text-white hover:border-orange-500"
              }`}
            >
              <Lightbulb className="w-4 h-4" /> Exemplos
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Próximo <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {showExamples && (
        <ExamplesPanel
          allMeanings={card?.meanings}
          activeMeaning={activeMeaning?.meaning}
          onClose={() => setShowExamples(false)}
        />
      )}
    </div>
  );
}