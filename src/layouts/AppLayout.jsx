import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Home,
  BookOpen,
  HelpCircle,
  Puzzle,
  Settings,
  X,
  LogOut,
  UserCircle2,
  Database,
  BarChart3,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../contexts/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

const mobilePrimaryNavItems = [
  { label: "In\u00EDcio", path: "/", icon: Home },
  { label: "Flashcards", path: "/flashcards", icon: BookOpen },
  { label: "Quiz", path: "/quiz", icon: HelpCircle },
  { label: "Combina\u00E7\u00F5es", path: "/combinacoes", icon: Puzzle },
  { label: "Configura\u00E7\u00F5es", icon: Settings, openPanel: true },
];

const mobilePanelNavItems = [
  { label: "Progresso", path: "/progresso", icon: BarChart3 },
  { label: "Vocabul\u00E1rio", path: "/gerenciador", icon: Database },
];

export default function AppLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const [isPersonalizeOpen, setIsPersonalizeOpen] = useState(false);
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
  const isPersonalizeActive = isPersonalizeOpen;

  return (
    <div className="app-mobile-safe-shell min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-50 hidden border-r border-border bg-card md:bottom-0 md:top-[env(safe-area-inset-top,0px)] md:flex md:w-[255px] md:min-w-[255px] md:max-w-[255px] lg:top-0">
        <Sidebar />
      </aside>

      {isPersonalizeOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] md:hidden"
          onClick={() => setIsPersonalizeOpen(false)}
        />
      )}

      <aside
        className={`app-mobile-safe-slide-panel fixed inset-y-0 right-0 z-50 w-[86vw] max-w-[320px] transform border-l border-border bg-card transition-transform duration-300 ease-out md:hidden ${
          isPersonalizeOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isPersonalizeOpen}
      >
        <div className="flex h-full flex-col">
          <div className="relative px-4 pb-3 pt-3">
            <button
              type="button"
              onClick={() => setIsPersonalizeOpen(false)}
              className="absolute right-4 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
              aria-label="Fechar painel"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>

            <div className="rounded-lg border border-border bg-muted/30 p-3 pr-12">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-card text-muted-foreground">
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
            </div>

            <ThemeToggle align="start" className="mt-3" />

            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut className="h-4 w-4 text-foreground" />
                {isLoggingOut ? "Saindo..." : "Sair"}
              </button>
            ) : null}

            <div className="mt-3 h-px w-full bg-border" />
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
            <div className="space-y-3">
              {mobilePanelNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isRouteActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex min-h-[50px] w-full items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-[#25B15F] bg-[#25B15F] text-white"
                        : "border-border/70 bg-card text-foreground hover:bg-muted"
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
        </div>
      </aside>

      <div className="md:ml-[255px]">
        <main className="app-mobile-safe-main min-h-screen lg:p-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="app-mobile-safe-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 shadow-[0_-6px_16px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
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
