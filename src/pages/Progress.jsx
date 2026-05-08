import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BellRing,
  CalendarClock,
  Clock3,
  Target,
  TriangleAlert,
} from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { resetStudyHistory } from "../lib/gameState";
import {
  LEARNING_STATUS,
  REVIEW_PACE,
  createInitialStats,
  getInternalNotifications,
  getProgressSummary,
  loadReviewPreferences,
  normalizeVocabularyItem,
  saveReviewPreferences,
} from "../lib/learningEngine";
import {
  clearCachedVocabularyRows,
  markVocabularyCacheForRefresh,
} from "../lib/vocabularyCache";

const EMPTY_PROGRESS = Object.freeze(
  getProgressSummary([], { pace: REVIEW_PACE.EQUILIBRADO })
);

const REVIEW_PACE_OPTIONS = [
  {
    value: REVIEW_PACE.INTENSIVO,
    label: "Intensivo",
    description: "Mais repeticoes e intervalos menores.",
  },
  {
    value: REVIEW_PACE.EQUILIBRADO,
    label: "Equilibrado",
    description: "Ritmo padrao para estudo diario.",
  },
  {
    value: REVIEW_PACE.LEVE,
    label: "Leve",
    description: "Menos carga diaria e mais espacamento.",
  },
];

function formatCount(value, singular, plural) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatResponseTime(ms) {
  if (!ms || ms <= 0) return "0.0s";
  return `${(ms / 1000).toFixed(1)}s`;
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

function formatNextReview(value) {
  if (!value) return "Sem data";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startNextDay = new Date(startToday.getTime() + 24 * 60 * 60 * 1000);

  if (date < startToday) return "Atrasada";
  if (date < startNextDay) return "Hoje";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getDistributionPercent(part, total) {
  if (!total) return 0;
  return (part / total) * 100;
}

function SessionLinks() {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Link
        to="/flashcards?focus=today"
        className="rounded-lg border border-border bg-card px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-muted"
      >
        Revisar no Flashcards
      </Link>
      <Link
        to="/quiz?focus=today"
        className="rounded-lg border border-border bg-card px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-muted"
      >
        Revisar no Quiz
      </Link>
      <Link
        to="/combinacoes?focus=attention"
        className="rounded-lg border border-border bg-card px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-muted"
      >
        Reforcar em Combinacoes
      </Link>
    </div>
  );
}

function WordList({ title, emptyText, items, valueRenderer }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 font-bold">{title}</h3>

      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="border-b border-border pb-2 text-sm last:border-0">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-foreground">{item.term}</span>
                <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">
                  {valueRenderer(item)}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatCount(item.stats?.total_reviews || 0, "revisao", "revisoes")} -{" "}
                {formatLastReviewed(item.stats?.last_reviewed)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-4 text-center text-sm text-muted-foreground">{emptyText}</div>
      )}
    </div>
  );
}

function SignalMetricCard({ label, value, description }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </div>
  );
}

export default function Progress() {
  const { user } = useAuth();

  const [vocabItems, setVocabItems] = useState([]);
  const [progress, setProgress] = useState(EMPTY_PROGRESS);
  const [notifications, setNotifications] = useState([]);
  const [reviewPreferences, setReviewPreferences] = useState(() =>
    loadReviewPreferences()
  );
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const selectedPace = reviewPreferences.pace || REVIEW_PACE.EQUILIBRADO;

  const loadProgress = async () => {
    try {
      setLoading(true);

      if (!user?.id) {
        setVocabItems([]);
        setProgress(EMPTY_PROGRESS);
        setNotifications(getInternalNotifications([], reviewPreferences));
        return;
      }

      const { data, error } = await supabase
        .from("vocabulary")
        .select("id, term, stats")
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      const normalizedItems = (Array.isArray(data) ? data : []).map((row) =>
        normalizeVocabularyItem(row, reviewPreferences)
      );

      setVocabItems(normalizedItems);
    } catch (error) {
      console.error("Erro ao carregar progresso:", error);
      setVocabItems([]);
      setProgress(EMPTY_PROGRESS);
      setNotifications(getInternalNotifications([], reviewPreferences));
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
  }, [user?.id, reviewPreferences]);

  useEffect(() => {
    const summary = getProgressSummary(vocabItems, reviewPreferences);
    setProgress(summary);
    setNotifications(getInternalNotifications(vocabItems, reviewPreferences));
  }, [vocabItems, reviewPreferences]);

  const handleReviewPaceChange = (pace) => {
    const nextPreferences = saveReviewPreferences({ pace });
    setReviewPreferences(nextPreferences);
  };

  useEffect(() => {
    if (!showResetConfirm) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isResetting) {
        setShowResetConfirm(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showResetConfirm, isResetting]);

  const handleResetHistory = async () => {
    if (isResetting) return;

    if (!user?.id) {
      setShowResetConfirm(false);
      alert("Usuario nao identificado.");
      return;
    }

    try {
      setIsResetting(true);
      const resetStats = createInitialStats();

      const { error } = await supabase
        .from("vocabulary")
        .update({
          stats: resetStats,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      clearCachedVocabularyRows(user.id);
      markVocabularyCacheForRefresh(user.id);

      const result = resetStudyHistory();
      if (!result.success) {
        alert("Nao foi possivel resetar o progresso.");
        return;
      }

      setVocabItems([]);
      setProgress(EMPTY_PROGRESS);
      setNotifications(getInternalNotifications([], reviewPreferences));
      await loadProgress();
      setShowResetConfirm(false);
    } catch (error) {
      console.error("Erro ao resetar progresso:", error);
      alert("Ocorreu um erro ao resetar o progresso.");
    } finally {
      setIsResetting(false);
    }
  };

  const dominatedPct = useMemo(
    () => getDistributionPercent(progress.dominated, progress.totalCards),
    [progress.dominated, progress.totalCards]
  );
  const difficultPct = useMemo(
    () => getDistributionPercent(progress.difficult, progress.totalCards),
    [progress.difficult, progress.totalCards]
  );
  const learningPct = useMemo(
    () => getDistributionPercent(progress.learning, progress.totalCards),
    [progress.learning, progress.totalCards]
  );
  const freshPct = useMemo(
    () => getDistributionPercent(progress.fresh, progress.totalCards),
    [progress.fresh, progress.totalCards]
  );

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-3 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[1080px] space-y-8 px-4 py-4 md:min-h-[1047px] md:px-8 md:py-8">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Progresso</h1>
        <p className="text-muted-foreground">
          Painel central de revisao: acompanhe fila diaria, itens atrasados e saude da memoria.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarClock className="h-4 w-4 text-primary" />
          Ritmo de revisao
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {REVIEW_PACE_OPTIONS.map((option) => {
            const isActive = selectedPace === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleReviewPaceChange(option.value)}
                className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                  isActive
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <div className="text-sm font-semibold">{option.label}</div>
                <div className="mt-1 text-xs">{option.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-7">
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4 text-center shadow-sm">
          <div className="mb-2 text-xs text-muted-foreground">Revisoes hoje</div>
          <div className="text-3xl font-bold text-primary">{progress.dueToday}</div>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4 text-center shadow-sm">
          <div className="mb-2 text-xs text-muted-foreground">Atrasadas</div>
          <div className="text-3xl font-bold text-red-500">{progress.overdue}</div>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4 text-center shadow-sm">
          <div className="mb-2 text-xs text-muted-foreground">Atencao</div>
          <div className="text-3xl font-bold text-amber-500">{progress.needsAttention}</div>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4 text-center shadow-sm">
          <div className="mb-2 text-xs text-muted-foreground">Dificeis</div>
          <div className="text-3xl font-bold text-red-500">{progress.difficult}</div>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4 text-center shadow-sm">
          <div className="mb-2 text-xs text-muted-foreground">Aprendendo</div>
          <div className="text-3xl font-bold text-blue-500">{progress.learning}</div>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4 text-center shadow-sm">
          <div className="mb-2 text-xs text-muted-foreground">Dominadas</div>
          <div className="text-3xl font-bold text-orange-500">{progress.dominated}</div>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4 text-center shadow-sm">
          <div className="mb-2 text-xs text-muted-foreground">Novas</div>
          <div className="text-3xl font-bold text-slate-600 dark:text-slate-300">{progress.fresh}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 font-bold">Novas metricas de aprendizado</h3>
        <div className="grid gap-4 md:grid-cols-4">
          <SignalMetricCard
            label="Dominio"
            value={`${progress.masteryCorrectStreak || 10} acertos seguidos`}
            description="A palavra so entra como dominada quando atinge essa sequencia."
          />
          <SignalMetricCard
            label="Flashcards"
            value={progress.flashcardRevealedBeforeAnswer || 0}
            description="Revelacoes antes de responder viram sinal de atencao."
          />
          <SignalMetricCard
            label="Quiz"
            value={formatResponseTime(progress.quizAverageResponseMs || 0)}
            description="Tempo medio contado somente ate confirmar a resposta."
          />
          <SignalMetricCard
            label="Combinacoes"
            value={`${(progress.combinationsAverageAttempts || 0).toFixed(1)} tentativas`}
            description="Acerto de primeira pesa positivo; repeticoes indicam dificuldade."
          />
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Sinais de confianca: {progress.confidenceSignals || 0}. Sinais de atencao:{" "}
          {progress.difficultySignals || 0}.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:col-span-2">
          <div className="mb-4 flex items-center gap-2 font-medium text-muted-foreground">
            <Target className="h-5 w-5 text-primary" />
            Taxa de acerto
          </div>
          <div className="text-4xl font-bold">{progress.accuracyRate}%</div>
          <div className="mt-2 text-sm">
            <span className="font-medium text-primary">
              {formatCount(progress.totalCorrect, "acerto", "acertos")}
            </span>
            {" / "}
            <span className="font-medium text-destructive">
              {formatCount(progress.totalIncorrect, "erro", "erros")}
            </span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Baseado em {formatCount(progress.totalReviews, "revisao", "revisoes")} registradas.
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 font-medium text-muted-foreground">
            <Clock3 className="h-5 w-5 text-blue-500" />
            Tempo medio
          </div>
          <div className="text-4xl font-bold">{formatResponseTime(progress.averageResponseMs)}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            Saude da memoria: {progress.health.score}/100 ({progress.health.label})
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{progress.health.description}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 font-bold">Distribuicao do vocabulario</h3>

        <div className="mb-2 flex h-4 overflow-hidden rounded-full bg-muted">
          <div className="bg-orange-500" style={{ width: `${dominatedPct}%` }} />
          <div className="bg-blue-500" style={{ width: `${learningPct}%` }} />
          <div className="bg-red-500" style={{ width: `${difficultPct}%` }} />
          <div className="bg-slate-300 dark:bg-slate-500" style={{ width: `${freshPct}%` }} />
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
            <div className="h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-500" />
            Novas
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 font-semibold text-foreground">
          <BellRing className="h-4 w-4 text-primary" />
          Notificacoes internas
        </div>
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-lg border px-3 py-2 text-sm ${
                notification.type === "warning"
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                  : notification.type === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                  : "border-border bg-muted/40 text-foreground"
              }`}
            >
              <div className="font-semibold">{notification.title}</div>
              <div className="text-xs opacity-90">{notification.message}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 font-bold">Iniciar sessao de revisao</h3>
        <SessionLinks />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <WordList
          title="Fila de hoje"
          emptyText="Nenhuma revisao prevista para hoje."
          items={progress.dueTodayWords}
          valueRenderer={(item) => formatNextReview(item.stats?.next_review_at)}
        />
        <WordList
          title="Itens atrasados"
          emptyText="Nao ha itens atrasados agora."
          items={progress.overdueWords}
          valueRenderer={(item) => `${item.overdueDays || 0} dia(s)`}
        />
        <WordList
          title="Mais dificeis"
          emptyText="Nenhum item com erros ainda."
          items={progress.hardestWords}
          valueRenderer={(item) =>
            formatCount(item.stats?.incorrect || 0, "erro", "erros")
          }
        />
        <WordList
          title="Proximas revisoes"
          emptyText="Sem itens agendados no momento."
          items={progress.upcomingWords}
          valueRenderer={(item) => formatNextReview(item.stats?.next_review_at)}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <WordList
          title="Em aprendizado"
          emptyText="Nenhum item em aprendizado no momento."
          items={progress.learningWords}
          valueRenderer={(item) => `${item.accuracyRate || 0}%`}
        />
        <WordList
          title="Perto de dominar"
          emptyText="Ainda nao ha itens perto da dominacao."
          items={progress.nearMasteryWords}
          valueRenderer={(item) => `${item.stats?.correct_streak || 0}/${progress.masteryCorrectStreak || 10}`}
        />
        <WordList
          title="Dominadas"
          emptyText="Nenhum item dominado ainda."
          items={progress.dominatedWords}
          valueRenderer={(item) =>
            formatCount(item.stats?.correct_streak || 0, "acerto seguido", "acertos seguidos")
          }
        />
        <WordList
          title="Novas"
          emptyText="Nenhum item pendente de primeira revisao."
          items={progress.newWords}
          valueRenderer={() => LEARNING_STATUS.NOVA}
        />
      </div>

      <div className="border-t border-border pt-8">
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          disabled={isResetting}
          className="inline-flex items-center justify-center rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-white disabled:opacity-50"
        >
          <TriangleAlert className="mr-2 h-4 w-4" />
          {isResetting ? "Resetando..." : "Resetar progresso"}
        </button>
      </div>
      </div>

      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-progress-title"
          onClick={() => !isResetting && setShowResetConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="reset-progress-title" className="text-lg font-bold text-foreground">
                  Resetar progresso?
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Essa acao afeta apenas o historico de estudo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="rounded-full p-1 text-xl leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <TriangleAlert className="h-5 w-5" />
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">
                    Tem certeza que deseja resetar apenas o progresso de estudo?
                  </p>
                  <p>As palavras cadastradas serao mantidas.</p>
                  <p>
                    Serao zerados XP, nivel, streak, medalhas e estatisticas de aprendizado.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetHistory}
                disabled={isResetting}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                {isResetting ? "Resetando..." : "Confirmar reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
