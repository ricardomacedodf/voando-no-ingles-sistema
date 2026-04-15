import { useEffect, useState } from "react";
import ProgressBar from "../components/ProgressBar";
import { getGameState, resetStudyHistory } from "../lib/gameState";

export default function Progress() {
  const [gameState, setGameState] = useState(() => getGameState());
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const refreshProgress = () => {
      setGameState(getGameState());
    };

    refreshProgress();

    const interval = setInterval(refreshProgress, 800);

    window.addEventListener("focus", refreshProgress);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refreshProgress);
    };
  }, []);

  const currentLevelXp = gameState.xp % 100;
  const nextLevelXp = 100;

  const cards = [
    { label: "XP total", value: gameState.xp },
    { label: "Nível atual", value: gameState.level },
    { label: "Dias seguidos", value: gameState.streak },
    { label: "Sessões de estudo", value: gameState.totalStudySessions },
    { label: "Acertos seguidos", value: gameState.consecutiveCorrect },
    { label: "Maior sequência", value: gameState.maxConsecutiveCorrect },
    { label: "Palavras dominadas", value: gameState.dominatedCount },
    { label: "Medalhas", value: gameState.medals.length }
  ];

  const handleResetHistory = () => {
    const confirmed = window.confirm(
      "Tem certeza que deseja resetar apenas o progresso de estudo?\n\nAs palavras cadastradas serão mantidas.\n\nSerão zerados XP, nível, streak, medalhas e estatísticas de aprendizado."
    );

    if (!confirmed) return;

    try {
      setIsResetting(true);

      const result = resetStudyHistory();

      if (!result.success) {
        alert("Não foi possível resetar o progresso.");
        return;
      }

      setGameState(getGameState());
      alert("Progresso resetado com sucesso. Suas palavras cadastradas foram mantidas.");
    } catch (error) {
      console.error("Erro ao resetar progresso:", error);
      alert("Ocorreu um erro ao resetar o progresso.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Seu progresso</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe sua evolução no sistema.
          </p>
        </div>

        <button
          onClick={handleResetHistory}
          disabled={isResetting}
          className="px-4 py-2.5 rounded-xl border border-destructive/30 bg-card text-destructive text-sm font-semibold hover:bg-destructive hover:text-white transition-colors disabled:opacity-50"
        >
          {isResetting ? "Resetando..." : "Resetar progresso"}
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Progresso do nível
            </h2>
            <p className="text-sm text-muted-foreground">
              Nível {gameState.level} • XP total: {gameState.xp}
            </p>
          </div>
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            {currentLevelXp} / {nextLevelXp} XP
          </span>
        </div>

        <ProgressBar current={currentLevelXp} total={nextLevelXp} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="text-2xl font-bold text-foreground mt-2">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Medalhas desbloqueadas
        </h2>

        {gameState.medals.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {gameState.medals.map((medal) => (
              <span
                key={medal}
                className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium"
              >
                {medal}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma medalha desbloqueada ainda.
          </p>
        )}
      </div>
    </div>
  );
}