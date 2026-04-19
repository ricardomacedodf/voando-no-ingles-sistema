import { Link, useLocation } from "react-router-dom";
import {
  Home,
  BarChart3,
  Layers,
  HelpCircle,
  Puzzle,
  Settings2,
  Palette,
  Volume2,
  VolumeX,
  LogOut,
  UserCircle2,
} from "lucide-react";
import Logo from "./Logo";
import { getSoundState, saveSoundState } from "../lib/gameState";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { label: "Início", path: "/", icon: Home },
  { label: "Progresso", path: "/progresso", icon: BarChart3 },
  { label: "Flashcards", path: "/flashcards", icon: Layers },
  { label: "Quiz", path: "/quiz", icon: HelpCircle },
  { label: "Combinações", path: "/combinacoes", icon: Puzzle },
  { label: "Gerenciador", path: "/gerenciador", icon: Settings2 },
  { label: "Personalizar", path: "/personalizar", icon: Palette },
];

export default function Sidebar({ onClose }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [soundEnabled, setSoundEnabled] = useState(() => getSoundState().enabled);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const toggleSound = () => {
    const state = getSoundState();
    state.enabled = !state.enabled;
    saveSoundState(state);
    setSoundEnabled(state.enabled);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout?.();
      onClose?.();
    } catch (error) {
      console.error("Erro ao sair da conta:", error);
      alert("Não foi possível sair da conta.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const displayName =
    user?.firstName ||
    user?.name ||
    user?.full_name ||
    "Usuário";

  const displayEmail = user?.email || "";
  const avatarUrl = user?.avatar_url || "";

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      <div className="p-5 pb-3">
        <Logo />
      </div>

      <div className="mx-4 h-px bg-border mb-2" />

      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ease-out group ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:text-muted-foreground"
              }`}
            >
              <Icon
                className={`w-[18px] h-[18px] flex-shrink-0 ${
                  isActive ? "" : "opacity-70 group-hover:opacity-50"
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-5 pt-2">
        <div className="mx-1 h-px bg-border mb-3" />

        <div className="mx-1 mb-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Perfil Google
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              conectado
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-md border border-border/80 bg-background px-2.5 py-2.5">
            <div className="h-11 w-11 rounded-full overflow-hidden bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0 border border-border/80">
              {avatarUrl && !avatarError ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <UserCircle2 className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate leading-tight">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {displayEmail}
              </p>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={toggleSound}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-xs font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors duration-200"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 opacity-70" />
              ) : (
                <VolumeX className="w-4 h-4 opacity-70" />
              )}
              <span>{soundEnabled ? "Som ligado" : "Som desligado"}</span>
            </button>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-xs font-medium border border-red-200 bg-background text-red-600 hover:bg-red-50 transition-colors duration-200 disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span>{isLoggingOut ? "Saindo..." : "Sair"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
