import { Star } from "lucide-react";
import { getGameState } from "../lib/gameState";
import { useAuth } from "../contexts/AuthContext";

export default function WelcomeCard() {
  const game = getGameState();
  const { user } = useAuth();

  const xpInLevel = game.xp % 100;
  const xpProgress = (xpInLevel / 100) * 100;

  const firstName =
    user?.firstName ||
    user?.name?.split(" ")[0] ||
    user?.full_name?.split(" ")[0] ||
    "Usuário";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-emerald-600 p-8 text-white shadow-sm">
      <div className="absolute -mr-10 -mt-10 h-64 w-64 rounded-full bg-white/5 blur-3xl top-0 right-0" />

      <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <div className="mb-2 text-4xl">Olá, {firstName}</div>
          <h2 className="text-2xl font-bold opacity-90">
            Pronto para aprender inglês hoje?
          </h2>
        </div>

        <div className="w-full min-w-[280px] rounded-xl border border-white/10 bg-white/20 p-5 backdrop-blur-md md:w-auto">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-400 shadow-inner">
              <Star className="h-6 w-6 fill-yellow-700 text-yellow-700" />
            </div>

            <div>
              <div className="text-lg font-bold">Nível {game.level}</div>
              <div className="text-sm opacity-80">{xpInLevel} / 100 XP</div>
            </div>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-black/20">
            <div
              className="h-full rounded-full bg-white transition-all duration-1000 ease-out"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
