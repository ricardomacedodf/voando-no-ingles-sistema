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
    <div className="relative mx-auto h-auto w-full max-w-[960px] overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-emerald-600 px-5 py-4 text-white shadow-sm sm:px-6 sm:py-5 md:h-[182px] md:px-7 md:py-6">
      <div className="absolute -mr-10 -mt-10 h-64 w-64 rounded-full bg-white/5 blur-3xl top-0 right-0" />

      <div className="relative z-10 flex h-full flex-col justify-between gap-4 md:flex-row md:items-center md:gap-6">
        <div className="max-w-[560px]">
          <div className="mb-1 text-3xl leading-tight sm:mb-2 sm:text-4xl">Olá, {firstName}</div>
          <h2 className="text-xl font-bold leading-tight opacity-90 sm:text-2xl">
            Pronto para aprender inglês hoje?
          </h2>
        </div>

        <div className="w-full rounded-xl border border-white/10 bg-white/20 p-4 backdrop-blur-md sm:p-5 md:w-[290px] md:min-w-[290px] md:p-4">
          <div className="mb-3 flex items-center gap-3 sm:mb-4 sm:gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400 shadow-inner sm:h-12 sm:w-12">
              <Star className="h-5 w-5 fill-yellow-700 text-yellow-700 sm:h-6 sm:w-6" />
            </div>

            <div>
              <div className="text-base font-bold sm:text-lg">Nível {game.level}</div>
              <div className="text-sm opacity-80">{xpInLevel} / 100 XP</div>
            </div>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-black/20">
            <div
              className="h-full rounded-full bg-white dark:bg-[#ededed] transition-all duration-1000 ease-out"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
