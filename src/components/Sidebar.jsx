import { Link, useLocation } from "react-router-dom";
import {
  Home,
  BarChart3,
  BookOpen,
  HelpCircle,
  Puzzle,
  Database,
  Settings,
  LogOut,
  ChevronDown,
  User,
} from "lucide-react";
import Logo from "./Logo";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { label: "Início", path: "/", icon: Home },
  { label: "Progresso", path: "/progresso", icon: BarChart3 },
  { label: "Flashcards", path: "/flashcards", icon: BookOpen },
  { label: "Quiz", path: "/quiz", icon: HelpCircle },
  { label: "Combinações", path: "/combinacoes", icon: Puzzle },
  { label: "Gerenciador", path: "/gerenciador", icon: Database },
  { label: "Configuração", path: "/configuracao", icon: Settings },
];

export default function Sidebar({ onClose }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const profileAreaRef = useRef(null);

  const displayName = user?.firstName || user?.name || user?.full_name || "Usuário";
  const displayEmail = user?.email || "";
  const avatarUrl = user?.avatar_url || "";

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

  useEffect(() => {
    if (!isProfileMenuOpen) return undefined;

    const handleOutsidePointerDown = (event) => {
      const profileNode = profileAreaRef.current;
      if (!profileNode) return;
      if (profileNode.contains(event.target)) return;
      setIsProfileMenuOpen(false);
    };

    document.addEventListener("mousedown", handleOutsidePointerDown);
    document.addEventListener("touchstart", handleOutsidePointerDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsidePointerDown);
      document.removeEventListener("touchstart", handleOutsidePointerDown);
    };
  }, [isProfileMenuOpen]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b border-border px-4 py-5">
        <Logo variant="sidebar" className="mx-auto w-[228px]" />
      </div>

      <nav className="flex-1 overflow-y-auto pt-6 pb-2">
        <div className="mx-auto flex w-[222px] flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`group flex h-[45px] w-[222px] items-center gap-2.5 rounded-xl px-3.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-[#25B15F] text-white" : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${
                    isActive ? "text-white" : "text-muted-foreground"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-border px-4 py-3">
        <div ref={profileAreaRef} className="relative mx-auto w-[222px]">
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen((open) => !open)}
            className="mx-auto flex h-[52px] w-[222px] items-center justify-between rounded-xl px-3.5 text-left text-sm font-medium transition-colors hover:bg-muted"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <User className="h-[18px] w-[18px] flex-shrink-0 text-muted-foreground" />
              <span className="truncate text-foreground">Perfil</span>
            </div>

            <ChevronDown
              className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${
                isProfileMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isProfileMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 z-10 mb-2 rounded-xl border border-border bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2.5 rounded-md bg-muted/40 px-2.5 py-2">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-muted-foreground">
                  {avatarUrl && !avatarError ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                  {displayEmail ? (
                    <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
                  ) : null}
                </div>
              </div>

              <button
                onClick={async () => {
                  setIsProfileMenuOpen(false);
                  await handleLogout();
                }}
                disabled={isLoggingOut}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                <span>{isLoggingOut ? "Saindo..." : "Sair"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
