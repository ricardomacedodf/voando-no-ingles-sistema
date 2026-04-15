import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BookOpen, Trophy, AlertCircle, Sparkles, Clock, Target, RotateCcw } from "lucide-react";
import { saveGameState, getDefaultGameState } from "../lib/gameState";
import { getGameState } from "../lib/gameState";

export default function Progress() {
  const [vocab, setVocab] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("geral");

  useEffect(() => {
    async function load() {
      const data = await base44.entities.Vocabulary.list('-updated_date', 500);
      setVocab(data);
      setLoading(false);
    }
    load();
  }, []);

  const game = getGameState();
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    // Reset all vocab stats
    for (const v of vocab) {
      await base44.entities.Vocabulary.update(v.id, {
        stats: { correct: 0, incorrect: 0, total_reviews: 0, avg_response_time: 0, status: "nova" }
      });
    }
    // Reset game state
    saveGameState(getDefaultGameState());
    // Reload vocab
    const data = await base44.entities.Vocabulary.list('-updated_date', 500);
    setVocab(data);
    setResetting(false);
    setShowConfirm(false);
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 3000);
  };

  const filterByPeriod = (items) => {
    if (filter === "geral") return items;
    const now = new Date();
    const msMap = { hoje: 86400000, "7dias": 7 * 86400000, "30dias": 30 * 86400000 };
    const ms = msMap[filter] || 0;
    return items.filter(v => {
      if (!v.stats?.last_reviewed) return false;
      return (now - new Date(v.stats.last_reviewed)) <= ms;
    });
  };

  const filtered = filterByPeriod(vocab);
  const studied = filtered.filter(v => v.stats?.total_reviews > 0);
  const dominated = filtered.filter(v => v.stats?.status === "dominada");
  const difficult = filtered.filter(v => v.stats?.status === "difícil");
  const newItems = filtered.filter(v => !v.stats?.status || v.stats?.status === "nova");

  const avgAccuracy = studied.length > 0
    ? Math.round(studied.reduce((acc, v) => {
        const total = (v.stats?.correct || 0) + (v.stats?.incorrect || 0);
        return acc + (total > 0 ? (v.stats.correct / total) * 100 : 0);
      }, 0) / studied.length)
    : 0;

  const avgTime = studied.length > 0
    ? Math.round(studied.reduce((acc, v) => acc + (v.stats?.avg_response_time || 0), 0) / studied.length)
    : 0;

  const filters = [
    { key: "geral", label: "Geral" },
    { key: "hoje", label: "Hoje" },
    { key: "7dias", label: "7 dias" },
    { key: "30dias", label: "30 dias" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-7 h-7 border-3 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold text-foreground">Progresso e Estatísticas</h1>
        <button
          onClick={() => setShowConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-destructive/30 text-destructive bg-red-50 hover:bg-red-100 transition-colors flex-shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Resetar progresso
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Acompanhe sua evolução, tempo de resposta e nível de domínio das palavras e frases.
      </p>

      {resetSuccess && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-medium text-primary">
          ✓ Progresso resetado com sucesso! Sua jornada recomeça do zero.
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <RotateCcw className="w-5 h-5 text-destructive" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-2">Resetar progresso?</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Tem certeza que deseja resetar todo o seu progresso? Esta ação apagará seu histórico e memória de aprendizado. O conteúdo cadastrado será mantido.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={resetting}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {resetting ? "Resetando..." : "Confirmar reset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Period filter */}
      <div className="flex gap-1.5 mb-5">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground border border-border/80 hover:border-primary/30"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <SummaryCard icon={BookOpen} iconBg="bg-blue-50" iconColor="text-blue-500" label="Estudadas" value={studied.length} />
        <SummaryCard icon={Trophy} iconBg="bg-emerald-50" iconColor="text-primary" label="Dominadas" value={dominated.length} />
        <SummaryCard icon={AlertCircle} iconBg="bg-red-50" iconColor="text-destructive" label="Difíceis" value={difficult.length} />
        <SummaryCard icon={Sparkles} iconBg="bg-purple-50" iconColor="text-purple-500" label="Novas" value={newItems.length} />
        <SummaryCard icon={Target} iconBg="bg-orange-50" iconColor="text-orange-500" label="Taxa de acerto" value={`${avgAccuracy}%`} />
        <SummaryCard icon={Clock} iconBg="bg-cyan-50" iconColor="text-cyan-500" label="Tempo médio" value={avgTime > 0 ? `${(avgTime / 1000).toFixed(1)}s` : "—"} />
      </div>

      {/* Distribution bar */}
      {studied.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-2">Distribuição</h2>
          <div className="h-3 rounded-full overflow-hidden flex bg-muted">
            {dominated.length > 0 && (
              <div className="bg-primary h-full transition-all duration-500" style={{ width: `${(dominated.length / filtered.length) * 100}%` }} />
            )}
            {difficult.length > 0 && (
              <div className="bg-destructive h-full transition-all duration-500" style={{ width: `${(difficult.length / filtered.length) * 100}%` }} />
            )}
            {newItems.length > 0 && (
              <div className="bg-muted-foreground/30 h-full transition-all duration-500" style={{ width: `${(newItems.length / filtered.length) * 100}%` }} />
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" /> Dominadas ({dominated.length})</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive" /> Difíceis ({difficult.length})</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted-foreground/30" /> Novas ({newItems.length})</span>
          </div>
        </div>
      )}

      {/* Lists */}
      {difficult.length > 0 && (
        <VocabList title="Itens com mais dificuldade" items={difficult} />
      )}
      {dominated.length > 0 && (
        <VocabList title="Itens dominados" items={dominated} />
      )}
      {newItems.length > 0 && (
        <VocabList title="Itens novos" items={newItems} />
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, iconBg, iconColor, label, value }) {
  return (
    <div className="bg-card rounded-xl p-4 border border-border/60">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div>
          <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
        </div>
      </div>
    </div>
  );
}

function VocabList({ title, items }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-foreground mb-2">{title}</h2>
      <div className="space-y-1.5">
        {items.slice(0, 10).map(v => (
          <div key={v.id} className="bg-card border border-border/60 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{v.term}</p>
              <p className="text-xs text-muted-foreground truncate">
                {v.meanings?.[0]?.meaning}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-medium text-foreground">
                {v.stats?.correct || 0}✓ {v.stats?.incorrect || 0}✗
              </p>
              <p className="text-[10px] text-muted-foreground">
                {v.stats?.total_reviews || 0} revisões
                {v.stats?.avg_response_time ? ` • ${(v.stats.avg_response_time / 1000).toFixed(1)}s` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}