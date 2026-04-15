import { Star } from "lucide-react";
import { getGameState } from "../lib/gameState";

export default function WelcomeCard() {
  const game = getGameState();
  const xpInLevel = game.xp % 100;
  const xpProgress = (xpInLevel / 100) * 100;

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 md:p-8"
      style={{
        background: "linear-gradient(135deg, #28AF60 0%, #1a8a4a 40%, #1e6b5a 100%)",
      }}
    >
      <div className="absolute top-[-40px] right-[-40px] w-[200px] h-[200px] rounded-full bg-white/5" />
      <div className="absolute bottom-[-60px] right-[60px] w-[150px] h-[150px] rounded-full bg-white/5" />

      <div className="relative z-10">
        <p className="text-white/80 text-sm font-medium mb-1">Olá 👋</p>
        <h1 className="text-white text-lg md:text-xl font-bold mb-6">
          Pronto para aprender inglês hoje?
        </h1>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-yellow-400/90 flex items-center justify-center shadow-sm">
            <Star className="w-4 h-4 text-yellow-800" fill="currentColor" />
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white font-semibold text-sm">Nível {game.level}</span>
              <span className="text-white/70 text-xs font-medium">{xpInLevel} / 100 XP</span>
            </div>

            <div className="h-2.5 rounded-full bg-white/15 backdrop-blur-sm overflow-hidden">
              <div
                className="h-full rounded-full bg-white/80 transition-all duration-700 ease-out"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}