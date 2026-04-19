import { useState, useEffect } from "react";
import { Check, X, Lightbulb, Volume2, VolumeX } from "lucide-react";
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
  recordStudySession,
  playSound,
  getSoundState,
  saveSoundState,
  getGameState,
  saveGameState,
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

export default function Flashcards() {
  const { user } = useAuth();

  const [vocab, setVocab] = useState([]);
  const [mode, setMode] = useState("en_pt");
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionDone, setSessionDone] = useState(false);
  const [xpFeedback, setXpFeedback] = useState(null);
  const [activeMeaning, setActiveMeaning] = useState(null);
  const [cardDir, setCardDir] = useState("en_pt");
  const [soundEnabled, setSoundEnabled] = useState(() => getSoundState().enabled);

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

        setVocab(prepared);
        setCurrent(0);
        setFlipped(false);
        setShowExamples(false);
        setSessionDone(false);
      } catch (error) {
        console.error("Erro ao carregar vocabulário no Flashcards:", error);
        if (!isMounted) return;
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
  }, [mode, user?.id]);

  useEffect(() => {
    const card = vocab[current];
    if (!card) return;

    const meanings = card.meanings || [];
    const idx = meanings.length > 1 ? Math.floor(Math.random() * meanings.length) : 0;

    setActiveMeaning(meanings[idx] || null);

    const dir = mode === "random" ? (Math.random() > 0.5 ? "en_pt" : "pt_en") : mode;
    setCardDir(dir);
    setFlipped(false);
    setShowExamples(false);
  }, [current, vocab, mode]);

  const card = vocab[current];

  const front = cardDir === "en_pt" ? card?.term : activeMeaning?.meaning;
  const back = cardDir === "en_pt" ? activeMeaning?.meaning : card?.term;
  const frontLabel = cardDir === "en_pt" ? "English" : "Português";
  const backLabel = cardDir === "en_pt" ? "Português" : "English";

  const toggleSound = () => {
    const state = getSoundState();
    const newEnabled = !state.enabled;
    saveSoundState({ ...state, enabled: newEnabled });
    setSoundEnabled(newEnabled);
  };

  const handleFlip = () => {
    setFlipped((f) => !f);
    playSound("flip");
  };

  const handleResponse = async (correct) => {
    if (!card || !user?.id) return;

    const responseTime = card._startTime ? Date.now() - card._startTime : 0;

    playSound(correct ? "correct" : "incorrect");

    addXP(correct ? 1 : -2);
    setXpFeedback(correct ? "+1 XP" : "-2 XP");
    setTimeout(() => setXpFeedback(null), 1500);

    if (correct) recordCorrect();
    else recordIncorrect();

    const stats = card.stats || {
      correct: 0,
      incorrect: 0,
      total_reviews: 0,
      avg_response_time: 0,
      status: "nova",
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
      status: newStatus,
    };

    try {
      const { error } = await supabase
        .from("vocabulary")
        .update({
          stats: updatedStats,
          updated_at: new Date().toISOString(),
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
              updatedAt: new Date().toISOString(),
            }
          : item
      );

      setVocab(updatedVocab);
      updateDominatedCount(updatedVocab);
    } catch (error) {
      console.error("Erro ao atualizar estatísticas no Supabase:", error);
      alert("Não foi possível salvar seu progresso desta carta.");
      return;
    }

    if (current < vocab.length - 1) {
      setCurrent((c) => c + 1);
      playSound("advance");
    } else {
      setSessionDone(true);
      playSound("completion");
    }
  };

  useEffect(() => {
    if (!card) return;

    setVocab((prev) =>
      prev.map((item, index) =>
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
      <div className="text-center py-20">
        <p className="text-muted-foreground">Nenhuma palavra cadastrada ainda.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Acesse o Gerenciador para adicionar vocabulário.
        </p>
      </div>
    );
  }

  if (sessionDone) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Sessão completa! 🎉</h2>
        <p className="text-muted-foreground mb-4">Você revisou {vocab.length} cartões.</p>
        <button
          onClick={async () => {
            try {
              const data = await fetchVocabulary();
              const prepared = mode === "random" ? shuffleArray(data) : data;
              setVocab(prepared);
              setCurrent(0);
              setFlipped(false);
              setSessionDone(false);
              setShowExamples(false);
              updateDominatedCount(prepared);
            } catch (error) {
              console.error("Erro ao recarregar flashcards:", error);
              alert("Não foi possível recarregar os flashcards.");
            }
          }}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Recomeçar
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">Flashcards</h1>
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

      <ProgressBar current={current + 1} total={vocab.length} />

      <div className="flex items-center gap-4 mt-3 mb-5">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Check className="w-3.5 h-3.5 text-primary" />
          <span className="text-foreground">Acertei: {card?.stats?.correct || 0}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <X className="w-3.5 h-3.5 text-destructive" />
          <span className="text-foreground">Errei: {card?.stats?.incorrect || 0}</span>
        </div>
        {xpFeedback && (
          <span
            className={`text-xs font-bold animate-in fade-in slide-in-from-bottom-1 duration-200 ${
              xpFeedback.includes("+") ? "text-primary" : "text-destructive"
            }`}
          >
            {xpFeedback}
          </span>
        )}
      </div>

      <div className="flip-card w-full" style={{ minHeight: "240px" }}>
        <div
          className={`flip-card-inner relative w-full cursor-pointer ${flipped ? "flipped" : ""}`}
          style={{ minHeight: "240px" }}
          onClick={handleFlip}
        >
          <div className="flip-card-front absolute inset-0 bg-card rounded-2xl border border-border/60 flex flex-col items-center justify-center p-8">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
              {frontLabel}
            </span>
            <p className="text-xl md:text-2xl font-bold text-foreground text-center leading-relaxed">
              {front}
            </p>
            {card?.pronunciation && cardDir !== "pt_en" && (
              <p className="text-xs text-muted-foreground mt-2 italic">/{card.pronunciation}/</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-4">Toque para virar</p>
          </div>

          <div className="flip-card-back absolute inset-0 bg-card rounded-2xl border border-border/60 flex flex-col items-center justify-center p-8">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
              {backLabel}
            </span>
            <p className="text-xl md:text-2xl font-bold text-foreground text-center leading-relaxed">
              {back}
            </p>
            <p className="text-[10px] text-muted-foreground mt-4">
              Use os botões abaixo para avaliar
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-5">
        <button
          onClick={() => handleResponse(false)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-destructive/40 text-destructive bg-card hover:bg-destructive hover:text-white transition-all duration-200 text-sm font-semibold"
        >
          <X className="w-4 h-4" /> Ainda aprendendo
        </button>
        <button
          onClick={() => handleResponse(true)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 text-sm font-semibold shadow-sm"
        >
          <Check className="w-4 h-4" /> Já sei
        </button>
      </div>

      {card?.meanings?.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowExamples(!showExamples)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
              showExamples
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-card text-foreground border-border/60 hover:bg-orange-500 hover:text-white hover:border-orange-500"
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            {showExamples ? "Ocultar exemplos" : "Ver exemplos"}
          </button>

          {showExamples && (
            <ExamplesPanel
              allMeanings={card.meanings}
              activeMeaning={activeMeaning?.meaning}
              onClose={() => setShowExamples(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}