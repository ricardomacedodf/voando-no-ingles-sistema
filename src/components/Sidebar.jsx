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
  ChevronDown,
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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

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

      <div className="pt-2">
        <div className="h-px bg-border" />

        <div className="px-4 py-3">
          <button
            onClick={toggleSound}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-primary" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
            <span>{soundEnabled ? "Som ligado" : "Som desligado"}</span>
          </button>

          <div className="relative mt-2">
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((open) => !open)}
              className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                  {avatarUrl && !avatarError ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <UserCircle2 className="h-4 w-4" />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[17px] font-medium leading-tight text-foreground">
                    {displayName}
                  </p>
                  <p className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">
                    {displayEmail}
                  </p>
                </div>
              </div>

              <ChevronDown
                className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${
                  isProfileMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isProfileMenuOpen && (
              <button
                onClick={async () => {
                  setIsProfileMenuOpen(false);
                  await handleLogout();
                }}
                disabled={isLoggingOut}
                className="absolute bottom-full left-2 right-2 mb-2 flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                <span>{isLoggingOut ? "Saindo..." : "Sair"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
