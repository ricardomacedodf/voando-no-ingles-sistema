import { useEffect, useState } from "react";
import { Target, Clock3, TriangleAlert } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { resetStudyHistory } from "../lib/gameState";

const STATUS_NOVA = "nova";
const STATUS_APRENDENDO = "aprendendo";
const STATUS_DOMINADA = "dominada";
const STATUS_DIFICIL = "dificil";

const DEFAULT_WORD_STATS = Object.freeze({
  correct: 0,
  incorrect: 0,
  total_reviews: 0,
  avg_response_time: 0,
  status: STATUS_NOVA,
  last_reviewed: null,
});

const EMPTY_PROGRESS = Object.freeze({
  totalCards: 0,
  studied: 0,
  dominated: 0,
  difficult: 0,
  learning: 0,
  fresh: 0,
  totalCorrect: 0,
  totalIncorrect: 0,
  totalReviews: 0,
  accuracyRate: 0,
  averageResponseMs: 0,
  hardestWords: [],
  dominatedWords: [],
  learningWords: [],
  newWords: [],
});

function toSafeNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function normalizeStatus(rawStatus) {
  const status = String(rawStatus || "")
    .trim()
    .toLowerCase();

  if (status === "dominada") return STATUS_DOMINADA;
  if (status === "dificil" || status === "difícil") return STATUS_DIFICIL;
  return STATUS_NOVA;
}

function normalizeStats(rawStats) {
  const merged = { ...DEFAULT_WORD_STATS, ...(rawStats || {}) };
  return {
    ...merged,
    correct: toSafeNumber(merged.correct),
    incorrect: toSafeNumber(merged.incorrect),
    total_reviews: toSafeNumber(merged.total_reviews),
    avg_response_time: toSafeNumber(merged.avg_response_time),
    status: normalizeStatus(merged.status),
    last_reviewed: merged.last_reviewed || null,
  };
}

function getItemLearningBucket(item) {
  const reviews = item.stats.total_reviews || 0;
  const status = item.stats.status;

  if (reviews <= 0) return STATUS_NOVA;
  if (status === STATUS_DOMINADA) return STATUS_DOMINADA;
  if (status === STATUS_DIFICIL) return STATUS_DIFICIL;
  return STATUS_APRENDENDO;
}

function toSafeWord(item, index) {
  return {
    id: item?.id ?? `item-${index}`,
    term: (item?.term || "").trim() || `Item ${index + 1}`,
    stats: normalizeStats(item?.stats),
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

function formatLastReviewed(value) {
  if (!value) return "Sem revisao";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Sem revisao";

  const diffMs = Date.now() - parsedDate.getTime();
  if (diffMs < 0) return "Hoje";

  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / dayMs);

  if (days <= 0) return "Hoje";
  if (days === 1) return "Ha 1 dia";
  if (days < 7) return `Ha ${days} dias`;

  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "Ha 1 semana";
  if (weeks < 5) return `Ha ${weeks} semanas`;

  const months = Math.floor(days / 30);
  if (months === 1) return "Ha 1 mes";
  if (months < 12) return `Ha ${months} meses`;

  const years = Math.floor(days / 365);
  return years === 1 ? "Ha 1 ano" : `Ha ${years} anos`;
}

function getAverageResponseHint(avgMs) {
  if (!avgMs || avgMs <= 0) return "Sem respostas suficientes para analise.";
  if (avgMs <= 2500) return "Respostas rapidas na media geral.";
  if (avgMs <= 5000) return "Ritmo de resposta moderado.";
  return "Tempo alto: revise itens mais dificeis para ganhar fluidez.";
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

      const buckets = safeVocab.reduce(
        (acc, item) => {
          const bucket = getItemLearningBucket(item);
          acc[bucket] += 1;
          return acc;
        },
        {
          [STATUS_DOMINADA]: 0,
          [STATUS_DIFICIL]: 0,
          [STATUS_APRENDENDO]: 0,
          [STATUS_NOVA]: 0,
        }
      );

      const studied = totalCards - buckets[STATUS_NOVA];

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

      const rankedDominatedWords = safeVocab
        .filter((item) => getItemLearningBucket(item) === STATUS_DOMINADA)
        .sort((a, b) => {
          const byCorrect = (b.stats.correct || 0) - (a.stats.correct || 0);
          if (byCorrect !== 0) return byCorrect;
          const byReviews = (b.stats.total_reviews || 0) - (a.stats.total_reviews || 0);
          if (byReviews !== 0) return byReviews;
          return a.term.localeCompare(b.term);
        })
        .slice(0, 5);

      const learningWords = safeVocab
        .filter((item) => getItemLearningBucket(item) === STATUS_APRENDENDO)
        .sort((a, b) => {
          const byErrors = (b.stats.incorrect || 0) - (a.stats.incorrect || 0);
          if (byErrors !== 0) return byErrors;
          const byReviews = (b.stats.total_reviews || 0) - (a.stats.total_reviews || 0);
          if (byReviews !== 0) return byReviews;
          return a.term.localeCompare(b.term);
        })
        .slice(0, 5);

      const newWords = safeVocab
        .filter((item) => getItemLearningBucket(item) === STATUS_NOVA)
        .sort((a, b) => a.term.localeCompare(b.term))
        .slice(0, 5);

      setProgress({
        totalCards,
        studied,
        dominated: buckets[STATUS_DOMINADA],
        difficult: buckets[STATUS_DIFICIL],
        learning: buckets[STATUS_APRENDENDO],
        fresh: buckets[STATUS_NOVA],
        totalCorrect: totals.correct,
        totalIncorrect: totals.incorrect,
        totalReviews: totals.reviews,
        accuracyRate,
        averageResponseMs,
        hardestWords,
        dominatedWords: rankedDominatedWords,
        learningWords,
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
            status: STATUS_NOVA,
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
  const difficultPct = getDistributionPercent(progress.difficult, progress.totalCards);
  const learningPct = getDistributionPercent(progress.learning, progress.totalCards);
  const freshPct = getDistributionPercent(progress.fresh, progress.totalCards);
  const averageResponseHint = getAverageResponseHint(progress.averageResponseMs);

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-8 px-4 py-4 md:min-h-[1047px] md:px-8 md:py-8">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Progresso</h1>
        <p className="text-muted-foreground">
          Acompanhe sua evolucao por item de vocabulario (palavras e frases), com foco em dominio, revisao e dificuldades.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
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
          <div className="mb-2 text-xs text-muted-foreground">Dificeis</div>
          <div className="text-3xl font-bold text-red-500">{progress.difficult}</div>
          <div className="mt-1 text-xs text-muted-foreground">de {progress.totalCards}</div>
        </div>

        <div className="flex flex-col items-center rounded-xl border border-border bg-white p-4 text-center shadow-sm">
          <div className="mb-2 text-xs text-muted-foreground">Novas</div>
          <div className="text-3xl font-bold text-slate-600">{progress.fresh}</div>
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
          <div className="mt-2 text-xs text-muted-foreground">
            Baseado em {formatCount(progress.totalReviews, "revisao", "revisoes")} registradas por item.
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 font-medium text-muted-foreground">
            <Clock3 className="h-5 w-5 text-blue-500" />
            Tempo medio
          </div>
          <div className="text-4xl font-bold">{formatResponseTime(progress.averageResponseMs)}</div>
          <div className="mt-2 text-sm text-muted-foreground">{averageResponseHint}</div>
          <div className="mt-2 text-xs text-muted-foreground">Calculado por media ponderada do tempo por revisao.</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-bold">Distribuicao do vocabulario</h3>

        <div className="mb-2 flex h-4 overflow-hidden rounded-full bg-muted">
          <div className="bg-orange-500" style={{ width: `${dominatedPct}%` }} />
          <div className="bg-blue-500" style={{ width: `${learningPct}%` }} />
          <div className="bg-red-500" style={{ width: `${difficultPct}%` }} />
          <div className="bg-slate-300" style={{ width: `${freshPct}%` }} />
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            Dominadas
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            Em aprendizado
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            Dificeis
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-slate-300" />
            Novas
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-bold">Mais dificeis</h3>

          {progress.hardestWords.length > 0 ? (
            <ul className="space-y-3">
              {progress.hardestWords.map((item) => (
                <li key={item.id} className="border-b border-border pb-2 text-sm last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-foreground">{item.term}</span>
                    <span className="whitespace-nowrap font-bold text-red-500">
                      {formatCount(item.stats.incorrect || 0, "erro", "erros")}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatCount(item.stats.total_reviews || 0, "revisao", "revisoes")} - {formatLastReviewed(item.stats.last_reviewed)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">Nenhum item com erros ainda.</div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-bold">Em aprendizado</h3>

          {progress.learningWords.length > 0 ? (
            <ul className="space-y-3">
              {progress.learningWords.map((item) => {
                const attempts = (item.stats.correct || 0) + (item.stats.incorrect || 0);
                const accuracy = attempts > 0 ? Math.round(((item.stats.correct || 0) / attempts) * 100) : 0;

                return (
                  <li key={item.id} className="border-b border-border pb-2 text-sm last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-foreground">{item.term}</span>
                      <span className="whitespace-nowrap font-bold text-blue-500">{accuracy}%</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatCount(item.stats.total_reviews || 0, "revisao", "revisoes")} - {formatLastReviewed(item.stats.last_reviewed)}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">Nenhum item em aprendizado no momento.</div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-bold">Dominadas</h3>

          {progress.dominatedWords.length > 0 ? (
            <ul className="space-y-3">
              {progress.dominatedWords.map((item) => (
                <li key={item.id} className="border-b border-border pb-2 text-sm last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-foreground">{item.term}</span>
                    <span className="whitespace-nowrap font-bold text-orange-500">
                      {formatCount(item.stats.correct || 0, "acerto", "acertos")}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatLastReviewed(item.stats.last_reviewed)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">Nenhum item dominado ainda.</div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-bold">Nunca revisadas</h3>

          {progress.newWords.length > 0 ? (
            <ul className="space-y-3">
              {progress.newWords.map((item) => (
                <li key={item.id} className="border-b border-border pb-2 text-sm last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-foreground">{item.term}</span>
                    <span className="whitespace-nowrap font-bold text-slate-600">Sem revisao</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">Nenhum item pendente de primeira revisao.</div>
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

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-bold">Guia dos status</h3>
        <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <strong className="text-foreground">Dominada:</strong> ao menos 3 revisoes e taxa de acerto igual ou acima de 80%.
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <strong className="text-foreground">Dificil:</strong> ao menos 3 revisoes e taxa de acerto abaixo de 50%.
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <strong className="text-foreground">Em aprendizado:</strong> item ja revisado, mas ainda sem consolidacao.
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <strong className="text-foreground">Nova:</strong> item ainda sem revisoes registradas.
          </div>
        </div>
      </div>
    </div>
  );
}
