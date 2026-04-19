import { useState, useEffect, useRef } from "react";
import { ArrowRight, Check } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import ModeSelector from "../components/ModeSelector";
import { addXP, recordCorrect, recordIncorrect, playSound } from "../lib/gameState";

const PAIRS_PER_ROUND = 5;

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

  const difficultyMap = useRef({});

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
        console.error("Erro ao carregar vocabulário em Combinações:", error);
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

  const setupRound = () => {
    const dir = mode === "random" ? (Math.random() > 0.5 ? "en_pt" : "pt_en") : mode;
    const pairs = weightedSample(pool, difficultyMap.current, PAIRS_PER_ROUND);

    setRoundPairs(pairs);

    const left = shuffleArray(
      pairs.map((p, i) => ({
        id: i,
        text: dir === "en_pt" ? p.term : p.meaning,
        vocabId: p.vocabId,
        meaningIdx: p.meaningIdx,
      }))
    );

    const right = shuffleArray(
      pairs.map((p, i) => ({
        id: i,
        text: dir === "en_pt" ? p.meaning : p.term,
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
  };

  const checkMatch = (leftIdx, rightIdx) => {
    const left = leftItems[leftIdx];
    const right = rightItems[rightIdx];
    return left && right && left.vocabId === right.vocabId && left.meaningIdx === right.meaningIdx;
  };

  const handleLeftClick = (idx) => {
    if (matched.has(`l${idx}`) || roundComplete) return;

    playSound("selection");
    setSelectedLeft(idx);

    if (selectedRight !== null) {
      tryMatch(idx, selectedRight);
    }
  };

  const handleRightClick = (idx) => {
    if (matched.has(`r${idx}`) || roundComplete) return;

    playSound("selection");
    setSelectedRight(idx);

    if (selectedLeft !== null) {
      tryMatch(selectedLeft, idx);
    }
  };

  const tryMatch = (leftIdx, rightIdx) => {
    if (checkMatch(leftIdx, rightIdx)) {
      playSound("correct");
      recordCorrect();

      const newMatched = new Set(matched);
      newMatched.add(`l${leftIdx}`);
      newMatched.add(`r${rightIdx}`);
      setMatched(newMatched);
      setSelectedLeft(null);
      setSelectedRight(null);

      if (newMatched.size / 2 >= roundPairs.length) {
        const xpGained = Math.max(roundPairs.length - errors, 0);
        addXP(xpGained);
        setRoundComplete(true);
        playSound("completion");
      }
    } else {
      playSound("incorrect");
      recordIncorrect();
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
    playSound("advance");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-7 h-7 border-3 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (allVocab.length < 2) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">
          Cadastre pelo menos 2 palavras para usar Combinações.
        </p>
      </div>
    );
  }

  const totalPairs = roundPairs.length;
  const xpGained = Math.max(totalPairs - errors, 0);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Combinações</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rodada {round + 1} — contínuo
          </p>
        </div>
        <ModeSelector mode={mode} setMode={setMode} />
      </div>

      <p className="text-sm text-muted-foreground mb-5">
        Conecte cada palavra ao seu significado correto.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {leftItems.map((item, idx) => {
            const isMatched = matched.has(`l${idx}`);
            const isSelected = selectedLeft === idx;
            const isError = errorPair?.left === idx;

            let cls = "bg-card border border-border/60 text-foreground hover:border-primary/50";

            if (isMatched) cls = "bg-emerald-50 border-primary text-primary";
            else if (isError) cls = "bg-red-50 border-destructive text-destructive";
            else if (isSelected) cls = "bg-emerald-50/50 border-primary/60 text-foreground";

            return (
              <button
                key={idx}
                onClick={() => handleLeftClick(idx)}
                disabled={isMatched}
                className={`w-full px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left break-words ${cls}`}
              >
                {isMatched && <Check className="w-3 h-3 inline mr-1.5 text-primary" />}
                {item.text}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {rightItems.map((item, idx) => {
            const isMatched = matched.has(`r${idx}`);
            const isSelected = selectedRight === idx;
            const isError = errorPair?.right === idx;

            let cls = "bg-card border border-border/60 text-foreground hover:border-primary/50";

            if (isMatched) cls = "bg-emerald-50 border-primary text-primary";
            else if (isError) cls = "bg-red-50 border-destructive text-destructive";
            else if (isSelected) cls = "bg-emerald-50/50 border-primary/60 text-foreground";

            return (
              <button
                key={idx}
                onClick={() => handleRightClick(idx)}
                disabled={isMatched}
                className={`w-full px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left break-words ${cls}`}
              >
                {isMatched && <Check className="w-3 h-3 inline mr-1.5 text-primary" />}
                {item.text}
              </button>
            );
          })}
        </div>
      </div>

      {roundComplete && (
        <div className="mt-5 text-center">
          <div className="bg-emerald-50 rounded-xl p-4 mb-3">
            <p className="text-sm font-semibold text-primary mb-1">Rodada completa! 🎉</p>
            <p className="text-xs text-muted-foreground">
              +{xpGained} XP ganho{" "}
              {errors > 0
                ? `• ${errors} erro(s) — esses itens voltarão com prioridade`
                : "• Perfeito!"}
            </p>
          </div>

          <button
            onClick={nextRound}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Próxima Rodada
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}