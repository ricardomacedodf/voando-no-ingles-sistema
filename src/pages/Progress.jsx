import { useEffect, useState } from "react";
import { Target, Clock3, TriangleAlert } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { resetStudyHistory } from "../lib/gameState";

const DEFAULT_WORD_STATS = Object.freeze({
  correct: 0,
  incorrect: 0,
  total_reviews: 0,
  avg_response_time: 0,
  status: "nova",
});

const EMPTY_PROGRESS = Object.freeze({
  totalCards: 0,
  studied: 0,
  dominated: 0,
  learning: 0,
  fresh: 0,
  totalCorrect: 0,
  totalIncorrect: 0,
  totalReviews: 0,
  accuracyRate: 0,
  averageResponseMs: 0,
  hardestWords: [],
  dominatedWords: [],
  newWords: [],
});

function toSafeWord(item, index) {
  return {
    id: item?.id ?? `item-${index}`,
    term: (item?.term || "").trim() || `Item ${index + 1}`,
    stats: { ...DEFAULT_WORD_STATS, ...(item?.stats || {}) },
  };
}

function formatCount(value, singular, plural) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatResponseTime(ms) {
  if (!ms || ms <= 0) return "0.0s";
  return `${(ms / 1000).toFixed(1)}s`;
}

function getDistributionPercent(part, total) {
  if (!total) return 0;
  return (part / total) * 100;
}

export default function Progress() {
  const { user } = useAuth();

  const [progress, setProgress] = useState(EMPTY_PROGRESS);
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  const loadProgress = async () => {
    try {
      setLoading(true);

      if (!user?.id) {
        setProgress(EMPTY_PROGRESS);
        return;
      }

      const { data, error } = await supabase
        .from("vocabulary")
        .select("id, term, stats")
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      const safeVocab = (Array.isArray(data) ? data : []).map(toSafeWord);

      const totalCards = safeVocab.length;
      const studied = safeVocab.filter((v) => (v.stats.total_reviews || 0) > 0).length;
      const dominatedWords = safeVocab.filter((v) => v.stats.status === "dominada");
      const dominated = dominatedWords.length;
      const learning = Math.max(studied - dominated, 0);
      const fresh = Math.max(totalCards - studied, 0);

      const totals = safeVocab.reduce(
        (acc, item) => {
          acc.correct += item.stats.correct || 0;
          acc.incorrect += item.stats.incorrect || 0;
          acc.reviews += item.stats.total_reviews || 0;
          acc.weightedTime += (item.stats.avg_response_time || 0) * (item.stats.total_reviews || 0);
          return acc;
        },
        { correct: 0, incorrect: 0, reviews: 0, weightedTime: 0 }
      );

      const totalAttempts = totals.correct + totals.incorrect;
      const accuracyRate = totalAttempts > 0 ? Math.round((totals.correct / totalAttempts) * 100) : 0;
      const averageResponseMs = totals.reviews > 0 ? totals.weightedTime / totals.reviews : 0;

      const hardestWords = safeVocab
        .filter((item) => (item.stats.incorrect || 0) > 0)
        .sort((a, b) => {
          const byErrors = (b.stats.incorrect || 0) - (a.stats.incorrect || 0);
          if (byErrors !== 0) return byErrors;
          const byReviews = (b.stats.total_reviews || 0) - (a.stats.total_reviews || 0);
          if (byReviews !== 0) return byReviews;
          return a.term.localeCompare(b.term);
        })
        .slice(0, 5);

      const rankedDominatedWords = [...dominatedWords]
        .sort((a, b) => {
          const byCorrect = (b.stats.correct || 0) - (a.stats.correct || 0);
          if (byCorrect !== 0) return byCorrect;
          const byReviews = (b.stats.total_reviews || 0) - (a.stats.total_reviews || 0);
          if (byReviews !== 0) return byReviews;
          return a.term.localeCompare(b.term);
        })
        .slice(0, 5);

      const newWords = safeVocab
        .filter((item) => item.stats.status === "nova")
        .sort((a, b) => {
          const byReviews = (b.stats.total_reviews || 0) - (a.stats.total_reviews || 0);
          if (byReviews !== 0) return byReviews;
          return a.term.localeCompare(b.term);
        })
        .slice(0, 5);

      setProgress({
        totalCards,
        studied,
        dominated,
        learning,
        fresh,
        totalCorrect: totals.correct,
        totalIncorrect: totals.incorrect,
        totalReviews: totals.reviews,
        accuracyRate,
        averageResponseMs,
        hardestWords,
        dominatedWords: rankedDominatedWords,
        newWords,
      });
    } catch (error) {
      console.error("Erro ao carregar progresso:", error);
      setProgress(EMPTY_PROGRESS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
    window.addEventListener("focus", loadProgress);

    return () => {
      window.removeEventListener("focus", loadProgress);
    };
  }, [user?.id]);

  const handleResetHistory = async () => {
    const confirmed = window.confirm(
      "Tem certeza que deseja resetar apenas o progresso de estudo?\n\nAs palavras cadastradas serao mantidas.\n\nSerao zerados XP, nivel, streak, medalhas e estatisticas de aprendizado."
    );

    if (!confirmed) return;

    if (!user?.id) {
      alert("Usuario nao identificado.");
      return;
    }

    try {
      setIsResetting(true);

      const { error } = await supabase
        .from("vocabulary")
        .update({
          stats: {
            correct: 0,
            incorrect: 0,
            total_reviews: 0,
            avg_response_time: 0,
            status: "nova",
          },
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      const result = resetStudyHistory();
      if (!result.success) {
        alert("Nao foi possivel resetar o progresso.");
        return;
      }

      await loadProgress();
      alert("Progresso resetado com sucesso. Suas palavras cadastradas foram mantidas.");
    } catch (error) {
      console.error("Erro ao resetar progresso:", error);
      alert("Ocorreu um erro ao resetar o progresso.");
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-3 border-border border-t-primary" />
      </div>
    );
  }

  const dominatedPct = getDistributionPercent(progress.dominated, progress.totalCards);
  const learningPct = getDistributionPercent(progress.learning, progress.totalCards);
  const freshPct = getDistributionPercent(progress.fresh, progress.totalCards);

  return (
    <div className="mx-auto w-full max-w-[1024px] space-y-8 px-4 py-4 animate-in fade-in duration-500 md:min-h-[1047px] md:px-8 md:py-8">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Progresso</h1>
        <p className="text-muted-foreground">
          Acompanhe sua evolucao, tempo de resposta e nivel de dominio das palavras e frases.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="flex flex-col items-center rounded-xl border border-border bg-white p-4 text-center shadow-sm">
          <div className="mb-2 text-xs text-muted-foreground">Total estudadas</div>
          <div className="text-3xl font-bold text-foreground">{progress.studied}</div>
          <div className="mt-1 text-xs text-muted-foreground">de {progress.totalCards}</div>
        </div>

        <div className="flex flex-col items-center rounded-xl border border-border bg-white p-4 text-center shadow-sm">
          <div className="mb-2 text-xs text-muted-foreground">Dominadas</div>
          <div className="text-3xl font-bold text-orange-500">{progress.dominated}</div>
          <div className="mt-1 text-xs text-muted-foreground">de {progress.totalCards}</div>
        </div>

        <div className="flex flex-col items-center rounded-xl border border-border bg-white p-4 text-center shadow-sm">
          <div className="mb-2 text-xs text-muted-foreground">Em aprendizado</div>
          <div className="text-3xl font-bold text-blue-500">{progress.learning}</div>
          <div className="mt-1 text-xs text-muted-foreground">de {progress.totalCards}</div>
        </div>

        <div className="flex flex-col items-center rounded-xl border border-border bg-white p-4 text-center shadow-sm">
          <div className="mb-2 text-xs text-muted-foreground">Novas</div>
          <div className="text-3xl font-bold text-purple-500">{progress.fresh}</div>
          <div className="mt-1 text-xs text-muted-foreground">de {progress.totalCards}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 font-medium text-muted-foreground">
            <Target className="h-5 w-5 text-primary" />
            Taxa de acerto
          </div>
          <div className="text-4xl font-bold">{progress.accuracyRate}%</div>
          <div className="mt-2 text-sm">
            <span className="font-medium text-primary">{formatCount(progress.totalCorrect, "acerto", "acertos")}</span>
            {" / "}
            <span className="font-medium text-destructive">{formatCount(progress.totalIncorrect, "erro", "erros")}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 font-medium text-muted-foreground">
            <Clock3 className="h-5 w-5 text-blue-500" />
            Tempo medio
          </div>
          <div className="text-4xl font-bold">{formatResponseTime(progress.averageResponseMs)}</div>
          <div className="mt-2 text-sm text-muted-foreground">Por resposta registrada</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-bold">Distribuicao do vocabulario</h3>

        <div className="mb-2 flex h-4 overflow-hidden rounded-full bg-muted">
          <div className="bg-orange-500" style={{ width: `${dominatedPct}%` }} />
          <div className="bg-blue-500" style={{ width: `${learningPct}%` }} />
          <div className="bg-muted-foreground/20" style={{ width: `${freshPct}%` }} />
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            Dominadas
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            Aprendendo
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
            Novas
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-bold">Mais dificeis</h3>

          {progress.hardestWords.length > 0 ? (
            <ul className="space-y-3">
              {progress.hardestWords.map((item) => (
                <li key={item.id} className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0">
                  <span className="truncate pr-2 font-medium text-foreground">{item.term}</span>
                  <span className="whitespace-nowrap font-bold text-destructive">
                    {formatCount(item.stats.incorrect || 0, "erro", "erros")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">Nenhuma palavra com erros ainda.</div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-bold">Dominadas</h3>

          {progress.dominatedWords.length > 0 ? (
            <ul className="space-y-3">
              {progress.dominatedWords.map((item) => (
                <li key={item.id} className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0">
                  <span className="truncate pr-2 font-medium text-foreground">{item.term}</span>
                  <span className="whitespace-nowrap font-bold text-orange-500">
                    {formatCount(item.stats.correct || 0, "acerto", "acertos")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">Nenhuma palavra dominada ainda.</div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-bold">Novas</h3>

          {progress.newWords.length > 0 ? (
            <ul className="space-y-3">
              {progress.newWords.map((item) => {
                let metric = formatCount(item.stats.total_reviews || 0, "revisao", "revisoes");
                if ((item.stats.incorrect || 0) > 0) {
                  metric = formatCount(item.stats.incorrect || 0, "erro", "erros");
                } else if ((item.stats.correct || 0) > 0) {
                  metric = formatCount(item.stats.correct || 0, "acerto", "acertos");
                }

                return (
                  <li key={item.id} className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0">
                    <span className="truncate pr-2 font-medium text-foreground">{item.term}</span>
                    <span className="whitespace-nowrap font-bold text-purple-500">{metric}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">Nenhuma palavra nova no momento.</div>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-8">
        <button
          type="button"
          onClick={handleResetHistory}
          disabled={isResetting}
          className="inline-flex items-center justify-center rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-white disabled:opacity-50"
        >
          <TriangleAlert className="mr-2 h-4 w-4" />
          {isResetting ? "Resetando..." : "Resetar progresso"}
        </button>
      </div>
    </div>
  );
}
