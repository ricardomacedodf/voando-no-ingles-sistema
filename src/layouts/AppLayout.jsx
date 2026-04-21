import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Home,
  BookOpen,
  HelpCircle,
  Puzzle,
  Settings,
  X,
  Volume2,
  VolumeX,
  LogOut,
  UserCircle2,
  RefreshCw,
  Database,
  BarChart3,
  SlidersHorizontal,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import { getSoundState, saveSoundState } from "../lib/gameState";
import { useAuth } from "../contexts/AuthContext";

const mobilePrimaryNavItems = [
  { label: "In\u00EDcio", path: "/", icon: Home },
  { label: "Flashcards", path: "/flashcards", icon: BookOpen },
  { label: "Quiz", path: "/quiz", icon: HelpCircle },
  { label: "Combina\u00E7\u00F5es", path: "/combinacoes", icon: Puzzle },
  { label: "Personalizar", icon: Settings, openPanel: true },
];

const mobileSecondaryNavItems = [
  { label: "Gerenciador", path: "/gerenciador", icon: Database },
  { label: "Progresso", path: "/progresso", icon: BarChart3 },
  { label: "Personalizar", path: "/personalizar", icon: SlidersHorizontal },
];

export default function AppLayout() {
  const location = useLocation();
  const { user, logout, navigateToLogin } = useAuth();

  const [isPersonalizeOpen, setIsPersonalizeOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => getSoundState().enabled);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setIsPersonalizeOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isPersonalizeOpen) return undefined;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isPersonalizeOpen]);

  const isRouteActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

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
      setIsPersonalizeOpen(false);
    } catch (error) {
      console.error("Erro ao sair da conta:", error);
      alert("N\u00E3o foi poss\u00EDvel sair da conta.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const displayName = user?.firstName || user?.name || user?.full_name || "Usu\u00E1rio";
  const displayEmail = user?.email || "";
  const avatarUrl = user?.avatar_url || "";
  const isPersonalizeActive =
    isPersonalizeOpen || location.pathname.startsWith("/personalizar");

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-50 hidden border-r border-border bg-white md:flex md:w-[250px] md:min-w-[250px] md:max-w-[250px]">
        <Sidebar />
      </aside>

      {isPersonalizeOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] md:hidden"
          onClick={() => setIsPersonalizeOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 w-[86vw] max-w-[320px] transform border-l border-border bg-white transition-transform duration-300 ease-out md:hidden ${
          isPersonalizeOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isPersonalizeOpen}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-border p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Personalizar</h2>
              <button
                type="button"
                onClick={() => setIsPersonalizeOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
                aria-label="Fechar painel"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-muted-foreground">
                  {avatarUrl && !avatarError ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <UserCircle2 className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight text-foreground">
                    {displayName}
                  </p>
                  <p className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">
                    {displayEmail || "Login"}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2">
                <Link
                  to="/personalizar"
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                  Perfil
                </Link>

                <button
                  type="button"
                  onClick={async () => {
                    await navigateToLogin?.();
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  {user ? "Alternar conta" : "Login"}
                </button>

                {user ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                    {isLoggingOut ? "Saindo..." : "Sair"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Atalhos
            </p>

            <div className="space-y-2">
              {mobileSecondaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isRouteActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#25B15F] text-white"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon
                      className={`h-[18px] w-[18px] ${
                        isActive ? "text-white" : "text-muted-foreground"
                      }`}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border p-4">
            <button
              type="button"
              onClick={toggleSound}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {soundEnabled ? (
                <Volume2 className="h-[18px] w-[18px] text-[#25B15F]" />
              ) : (
                <VolumeX className="h-[18px] w-[18px] text-muted-foreground" />
              )}
              <span>{soundEnabled ? "Som ligado" : "Som desligado"}</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="md:ml-[250px]">
        <main className="min-h-screen p-4 pb-24 pt-4 md:p-6 md:pt-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 shadow-[0_-6px_16px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {mobilePrimaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.openPanel
              ? isPersonalizeActive
              : isRouteActive(item.path);

            const content = (
              <>
                <Icon className={`h-4 w-4 ${isActive ? "text-[#25B15F]" : "text-muted-foreground"}`} />
                <span className={`mt-1 text-[11px] font-medium ${isActive ? "text-[#25B15F]" : "text-muted-foreground"}`}>
                  {item.label}
                </span>
              </>
            );

            if (item.openPanel) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setIsPersonalizeOpen((open) => !open)}
                  className="flex min-h-[66px] flex-col items-center justify-center px-1 py-2 transition-colors hover:bg-muted/60"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex min-h-[66px] flex-col items-center justify-center px-1 py-2 transition-colors hover:bg-muted/60"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
