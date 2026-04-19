import { Link, useLocation } from "react-router-dom";
import {
  Home,
  BarChart3,
  BookOpen,
  HelpCircle,
  Puzzle,
  Database,
  Settings,
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
  { label: "Flashcards", path: "/flashcards", icon: BookOpen },
  { label: "Quiz", path: "/quiz", icon: HelpCircle },
  { label: "Combinações", path: "/combinacoes", icon: Puzzle },
  { label: "Gerenciador", path: "/gerenciador", icon: Database },
  { label: "Personalizar", path: "/personalizar", icon: Settings },
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

  const displayName = user?.firstName || user?.name || user?.full_name || "Usuário";
  const displayEmail = user?.email || "";
  const avatarUrl = user?.avatar_url || "";

  return (
    <div className="flex h-full flex-col border-r border-border bg-white">
      <div className="p-6">
        <Logo variant="sidebar" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? "bg-[#25B15F] text-white" : "text-foreground hover:bg-muted"
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${
                  isActive ? "text-white" : "text-muted-foreground"
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <button
          onClick={toggleSound}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          {soundEnabled ? (
            <Volume2 className="h-[18px] w-[18px] text-[#25B15F]" />
          ) : (
            <VolumeX className="h-[18px] w-[18px] text-muted-foreground" />
          )}
          <span>{soundEnabled ? "Som Ligado" : "Som Desligado"}</span>
        </button>

        <div className="relative mt-2">
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors hover:bg-muted"
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
                <p className="truncate text-sm font-medium leading-tight text-foreground">{displayName}</p>
                <p className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">{displayEmail}</p>
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
              className="absolute bottom-full left-2 right-2 mb-2 flex items-center justify-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              <span>{isLoggingOut ? "Saindo..." : "Sair"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
