import { Link, useLocation } from "react-router-dom";
import {
  Home,
  BarChart3,
  BookOpen,
  HelpCircle,
  Puzzle,
  Layers3,
  LogOut,
  ChevronDown,
  User,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import ThemeToggle from "./ThemeToggle";

const SIDEBAR_OPEN_WIDTH = 292;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const COLLAPSED_PROFILE_MENU_WIDTH = 252;
const SIDEBAR_TRANSITION_MS = 300;
const SIDEBAR_COLLAPSED_BRAND_SRC = "/sidebar-avatar-collapsed.png";
const SIDEBAR_COLLAPSED_BRAND_LIGHT_SRC = "/sidebar-avatar-collapsed - branco.png";
const SIDEBAR_EXPANDED_BRAND_MASK_SRC = "/sidebar-logo-normal.png";

const sidebarExpandedBrandMaskStyle = {
  WebkitMaskImage: `url('${SIDEBAR_EXPANDED_BRAND_MASK_SRC}')`,
  maskImage: `url('${SIDEBAR_EXPANDED_BRAND_MASK_SRC}')`,
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
  WebkitMaskSize: "contain",
  maskSize: "contain",
};

const navItems = [
  { label: "Início", path: "/", icon: Home },
  { label: "Flashcards", path: "/flashcards", icon: BookOpen },
  { label: "Quiz", path: "/quiz", icon: HelpCircle },
  { label: "Combinações", path: "/combinacoes", icon: Puzzle },
  { label: "Progresso", path: "/progresso", icon: BarChart3 },
  { label: "Gerenciador", path: "/gerenciador", icon: Layers3 },
];

function SidebarToggleIcon({ isCollapsed = false, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect
        x="4.5"
        y="5"
        width="15"
        height="14"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.65"
      />
      <path
        d={isCollapsed ? "M10 8.5V15.5" : "M14 8.5V15.5"}
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProfileAvatar({
  avatarUrl,
  avatarError,
  setAvatarError,
  displayName,
  className = "",
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground ${className}`}
    >
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
  );
}

export default function Sidebar({
  onClose,
  collapsed: controlledCollapsed,
  isCollapsed: controlledIsCollapsed,
  onCollapsedChange,
}) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("voando-sidebar-collapsed") === "true";
  });
  const [isSidebarTransitioning, setIsSidebarTransitioning] = useState(false);
  const [showExpandedContent, setShowExpandedContent] = useState(() => !internalCollapsed);
  const [collapsedProfileMenuPosition, setCollapsedProfileMenuPosition] = useState({
    left: 84,
    bottom: 12,
  });

  const profileAreaRef = useRef(null);
  const profileButtonRef = useRef(null);
  const sidebarRef = useRef(null);
  const transitionTimerRef = useRef(null);
  const hasMountedRef = useRef(false);

  const resolvedControlledCollapsed =
    typeof controlledCollapsed === "boolean"
      ? controlledCollapsed
      : typeof controlledIsCollapsed === "boolean"
      ? controlledIsCollapsed
      : undefined;

  const isCollapsed =
    typeof resolvedControlledCollapsed === "boolean"
      ? resolvedControlledCollapsed
      : internalCollapsed;
  const isCompactVisual = isCollapsed || (!isCollapsed && !showExpandedContent);
  const isThemeToggleCompact = isCompactVisual;

  const sidebarWidth = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_OPEN_WIDTH;
  const sidebarWidthValue = `${sidebarWidth}px`;

  const displayName = user?.firstName || user?.name || user?.full_name || "Usuário";
  const displayEmail = user?.email || "";
  const avatarUrl =
    user?.avatar_url ||
    user?.avatarUrl ||
    user?.picture ||
    user?.photo_url ||
    user?.photoURL ||
    user?.user_metadata?.picture ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.photo_url ||
    "";

  const collapsedBrandSrc = isDark
    ? SIDEBAR_COLLAPSED_BRAND_SRC
    : SIDEBAR_COLLAPSED_BRAND_LIGHT_SRC;

  const setSidebarCollapsed = useCallback(
    (nextCollapsed) => {
      setIsProfileMenuOpen(false);

      if (typeof onCollapsedChange === "function") {
        onCollapsedChange(nextCollapsed);
      } else {
        setInternalCollapsed(nextCollapsed);
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "voando-sidebar-collapsed",
          nextCollapsed ? "true" : "false"
        );
      }
    },
    [onCollapsedChange]
  );

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(!isCollapsed);
  }, [isCollapsed, setSidebarCollapsed]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      setShowExpandedContent(!isCollapsed);
      return undefined;
    }

    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
    }

    setIsSidebarTransitioning(true);
    setShowExpandedContent(!isCollapsed);

    transitionTimerRef.current = window.setTimeout(() => {
      setIsSidebarTransitioning(false);
      transitionTimerRef.current = null;
    }, SIDEBAR_TRANSITION_MS);

    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, [isCollapsed]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  const updateCollapsedProfileMenuPosition = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!isCollapsed || !isProfileMenuOpen) return;

    const profileButtonNode = profileButtonRef.current;
    if (!profileButtonNode) return;

    const rect = profileButtonNode.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const preferredLeft = rect.right + 10;
    const maxLeft = viewportWidth - COLLAPSED_PROFILE_MENU_WIDTH - 12;
    const left = Math.max(12, Math.min(preferredLeft, maxLeft));
    const bottom = Math.max(12, viewportHeight - rect.bottom);

    setCollapsedProfileMenuPosition({ left, bottom });
  }, [isCollapsed, isProfileMenuOpen]);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return undefined;

    const root = document.documentElement;
    const body = document.body;
    const sidebarNode = sidebarRef.current;
    const sidebarHost = sidebarNode?.parentElement || null;
    const canControlHost =
      sidebarHost &&
      sidebarHost !== body &&
      sidebarHost !== root &&
      sidebarHost.id !== "root";

    root.style.setProperty("--app-sidebar-open-width", `${SIDEBAR_OPEN_WIDTH}px`);
    root.style.setProperty(
      "--app-sidebar-collapsed-width",
      `${SIDEBAR_COLLAPSED_WIDTH}px`
    );
    root.style.setProperty("--app-sidebar-current-width", sidebarWidthValue);
    root.dataset.sidebarState = isCollapsed ? "collapsed" : "expanded";

    body?.classList.toggle("app-sidebar-collapsed", isCollapsed);
    body?.classList.toggle("app-sidebar-expanded", !isCollapsed);

    if (canControlHost) {
      sidebarHost.style.setProperty("--app-sidebar-current-width", sidebarWidthValue);
      sidebarHost.style.width = sidebarWidthValue;
      sidebarHost.style.minWidth = sidebarWidthValue;
      sidebarHost.style.maxWidth = sidebarWidthValue;
      sidebarHost.style.flex = `0 0 ${sidebarWidthValue}`;
      sidebarHost.style.flexBasis = sidebarWidthValue;
      sidebarHost.style.overflow = "hidden";
      sidebarHost.style.transition =
        "width 300ms ease, min-width 300ms ease, max-width 300ms ease, flex-basis 300ms ease";
    }

    return () => {
      body?.classList.remove("app-sidebar-collapsed", "app-sidebar-expanded");
      delete root.dataset.sidebarState;
    };
  }, [isCollapsed, sidebarWidthValue]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isShortcut =
        (event.ctrlKey || event.metaKey) && event.key?.toLowerCase() === "i";

      if (!isShortcut) return;

      event.preventDefault();
      setSidebarCollapsed(!isCollapsed);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCollapsed, setSidebarCollapsed]);

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

  useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl]);

  useLayoutEffect(() => {
    updateCollapsedProfileMenuPosition();
  }, [updateCollapsedProfileMenuPosition]);

  useEffect(() => {
    if (!isCollapsed || !isProfileMenuOpen) return undefined;

    const syncPosition = () => {
      updateCollapsedProfileMenuPosition();
    };

    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);

    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, [isCollapsed, isProfileMenuOpen, updateCollapsedProfileMenuPosition]);

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

  return (
    <aside
      ref={sidebarRef}
      style={{
        width: sidebarWidthValue,
        minWidth: sidebarWidthValue,
        maxWidth: sidebarWidthValue,
      }}
      className="flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground transition-[width,min-width,max-width] duration-300 ease-out"
      data-sidebar-collapsed={isCollapsed ? "true" : "false"}
      data-sidebar-transitioning={isSidebarTransitioning ? "true" : "false"}
    >
      <header
        className={`flex shrink-0 items-center ${
          isCompactVisual
            ? "h-[64px] justify-start px-3"
            : "h-[64px] justify-between px-4"
        }`}
      >
        {isCompactVisual ? (
          <button
            type="button"
            onClick={toggleSidebar}
            className="group flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Expandir barra lateral"
            title="Expandir barra lateral"
          >
            <span className="relative flex h-[24px] w-[24px] items-center justify-center">
              <img
                src={collapsedBrandSrc}
                alt="Logo Voando no Inglês"
                className="h-full w-full object-contain"
                draggable="false"
              />
            </span>
          </button>
        ) : (
          <>
            <Link
              to="/"
              onClick={onClose}
              className="group flex h-[44px] max-w-[calc(100%-2.25rem)] items-center gap-3 overflow-hidden rounded-xl px-3 text-[18px] font-semibold tracking-[-0.02em] text-foreground transition-colors hover:bg-muted/70"
              aria-label="Ir para Início"
              title="Início"
            >
              <span
                aria-hidden="true"
                className="h-[18px] w-[18px] shrink-0 bg-current"
                style={sidebarExpandedBrandMaskStyle}
              />
              <span className="truncate">Voando no Inglês</span>
            </Link>

            <button
              type="button"
              onClick={toggleSidebar}
              className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Recolher barra lateral"
              title="Recolher barra lateral"
            >
              <SidebarToggleIcon className="h-[19px] w-[19px]" />
            </button>
          </>
        )}
      </header>
      <div className="mx-4 h-px bg-border/70" />

      <nav className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
        <div className="flex flex-col items-start gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                title={isCompactVisual ? item.label : undefined}
                aria-label={item.label}
                className={`group flex h-[44px] items-center rounded-xl text-sm font-medium transition-colors ${
                  isCompactVisual
                    ? "w-10 justify-center px-0"
                    : "w-full justify-start gap-3 px-3"
                } ${
                  isActive
                    ? "bg-[#25B15F] text-white"
                    : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                    isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                {!isCompactVisual ? <span className="truncate">{item.label}</span> : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div
        className={`shrink-0 flex min-h-[48px] items-center pb-2 ${
          isCompactVisual
            ? "justify-start px-3"
            : "px-3"
        }`}
      >
        <div className={isThemeToggleCompact ? "sidebar-theme-toggle-collapsed-shell" : "w-full"}>
          <ThemeToggle
            compact={isThemeToggleCompact}
            align="start"
            className={isThemeToggleCompact ? "" : "w-full"}
          />
        </div>
      </div>

      <div
        className={`shrink-0 flex min-h-[84px] items-center border-t border-border px-3 py-3 ${
          isCompactVisual
            ? "justify-start"
            : ""
        }`}
      >
        <div
          ref={profileAreaRef}
          className={`relative min-h-[58px] ${isCompactVisual ? "w-10" : "w-full"}`}
        >
          <button
            ref={profileButtonRef}
            type="button"
            onClick={() => setIsProfileMenuOpen((open) => !open)}
            className={`flex items-center text-left text-sm transition-colors ${
              isCompactVisual
                ? "h-[58px] w-10 justify-center rounded-full hover:bg-muted/70"
                : "h-[58px] w-full justify-between rounded-xl px-2.5 py-2 hover:bg-muted"
            }`}
            aria-label="Abrir menu do perfil"
            title={isCompactVisual ? displayName : undefined}
          >
            <div className={`flex min-w-0 items-center ${isCompactVisual ? "justify-center" : "gap-2.5"}`}>
              <ProfileAvatar
                avatarUrl={avatarUrl}
                avatarError={avatarError}
                setAvatarError={setAvatarError}
                displayName={displayName}
                className={isCompactVisual ? "h-8 w-8" : "h-9 w-9"}
              />

              {!isCompactVisual ? (
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                  {displayEmail ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{displayEmail}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {!isCompactVisual ? (
              <ChevronDown
                className={`ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  isProfileMenuOpen ? "rotate-180" : ""
                }`}
              />
            ) : null}
          </button>

          {isProfileMenuOpen && (
            <div
              className={`rounded-2xl border border-border bg-card/95 p-2 shadow-lg shadow-black/15 backdrop-blur-sm dark:shadow-black/35 ${
                isCollapsed
                  ? "fixed z-[120] w-[252px]"
                  : "absolute bottom-full left-0 right-0 z-30 mb-2"
              }`}
              style={
                isCollapsed
                  ? {
                      left: `${collapsedProfileMenuPosition.left}px`,
                      bottom: `${collapsedProfileMenuPosition.bottom}px`,
                    }
                  : undefined
              }
            >
              <div className="flex items-center gap-2.5 rounded-xl px-2.5 py-2">
                <ProfileAvatar
                  avatarUrl={avatarUrl}
                  avatarError={avatarError}
                  setAvatarError={setAvatarError}
                  displayName={displayName}
                  className="h-9 w-9"
                />

                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-medium text-card-foreground">{displayName}</p>
                  {displayEmail ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{displayEmail}</p>
                  ) : null}
                </div>
              </div>

              <div className="my-1 h-px bg-border" />

              <button
                onClick={async () => {
                  setIsProfileMenuOpen(false);
                  await handleLogout();
                }}
                disabled={isLoggingOut}
                className="mt-1 flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
                <span>{isLoggingOut ? "Saindo..." : "Sair"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
