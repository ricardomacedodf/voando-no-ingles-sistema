import { useRef } from "react";
import { ChevronDown, Lightbulb } from "lucide-react";
import { playSound } from "../lib/gameState";
import { SFX_EVENTS } from "../lib/sfx";

const EXAMPLES_POINTER_SFX_GUARD_MS = 700;

export default function ExamplesToggleButton({
  expanded,
  onClick,
  collapsedLabel = "Ver exemplo",
  expandedLabel = "Ver exemplo",
  disabled = false,
  className = "",
  examplesPanelRef = null,
}) {
  const lastPointerSfxAtRef = useRef(0);
  const suppressSpaceClickRef = useRef(false);
  const handledSpaceOnKeyDownRef = useRef(false);
  const sfxEvent = expanded ? SFX_EVENTS.EXAMPLES_CLOSE : SFX_EVENTS.EXAMPLES_OPEN;

  const isDesktopViewport = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px)").matches;
  };

  const isFullscreenActive = () => {
    if (typeof document === "undefined") return false;
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  };

  const handlePanelVideoSpaceShortcut = () => {
    const panelRoot = examplesPanelRef?.current;

    if (!panelRoot) return false;

    const candidateVideos = Array.from(panelRoot.querySelectorAll("video")).filter(Boolean);
    const targetVideo =
      candidateVideos.find((video) => !video.paused && !video.ended) || candidateVideos[0];

    if (!targetVideo) {
      const previewSurface = panelRoot.querySelector('[role="button"].aspect-video');
      if (!previewSurface) return false;

      previewSurface.click();
      return true;
    }

    try {
      if (targetVideo.paused || targetVideo.ended) {
        void targetVideo.play();
      } else {
        targetVideo.pause();
      }
      return true;
    } catch {
      return false;
    }
  };

  const shouldSkipClickSfxAfterPointer = (event) => {
    if (!event) return false;
    if (event.detail === 0) return false;
    return Date.now() - lastPointerSfxAtRef.current < EXAMPLES_POINTER_SFX_GUARD_MS;
  };

  const handleToggle = (event) => {
    if (disabled) return;
    if (suppressSpaceClickRef.current) {
      const isKeyboardSyntheticClick =
        !event || typeof event.detail !== "number" || event.detail === 0;

      suppressSpaceClickRef.current = false;

      if (isKeyboardSyntheticClick) {
        return;
      }
    }
    if (!shouldSkipClickSfxAfterPointer(event)) {
      playSound(sfxEvent);
    }
    onClick?.();
  };

  const handlePointerDown = () => {
    if (disabled) return;
    // Garante que um clique real do mouse/toque nunca seja bloqueado por
    // um guard antigo da barra de espaço.
    suppressSpaceClickRef.current = false;
    handledSpaceOnKeyDownRef.current = false;
    lastPointerSfxAtRef.current = Date.now();
    playSound(sfxEvent);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    const isSpaceKey =
      event.key === " " || event.key === "Spacebar" || event.code === "Space";

    if (!isSpaceKey) return;
    if (!expanded) return;
    if (!isDesktopViewport()) return;
    if (isFullscreenActive()) return;

    const handledByVideo = handlePanelVideoSpaceShortcut();
    if (!handledByVideo) return;

    handledSpaceOnKeyDownRef.current = true;
    suppressSpaceClickRef.current = true;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleKeyUp = (event) => {
    const isSpaceKey =
      event.key === " " || event.key === "Spacebar" || event.code === "Space";

    if (!isSpaceKey) return;
    if (!suppressSpaceClickRef.current && !handledSpaceOnKeyDownRef.current) return;

    handledSpaceOnKeyDownRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const disabledClasses =
    "cursor-not-allowed border-border bg-card text-foreground opacity-[0.44] dark:border-border dark:bg-card dark:text-foreground dark:opacity-[0.29]";

  const enabledCollapsedClasses =
    "border-border bg-card text-foreground shadow-[0_2px_0_rgba(148,163,184,0.24)] dark:shadow-[0_2px_0_rgba(2,6,23,0.45)] md:hover:border-[#93c5fd] md:hover:bg-blue-50/30 dark:md:hover:border-sky-500/70 dark:md:hover:bg-sky-500/15";

  const enabledExpandedClasses =
    "border-border bg-card text-foreground shadow-[0_2px_0_rgba(148,163,184,0.24)] dark:border-border dark:bg-card dark:text-foreground dark:shadow-[0_2px_0_rgba(2,6,23,0.45)]";

  const resolvedStateClasses = disabled
    ? disabledClasses
    : expanded
    ? enabledExpandedClasses
    : enabledCollapsedClasses;

  const iconClasses = disabled
    ? "text-amber-400/65"
    : expanded
    ? "text-amber-500 dark:text-amber-400"
    : "text-[#64748B] dark:text-slate-400";

  const buttonShapeClasses = expanded
    ? "rounded-t-[18px] rounded-b-none"
    : "rounded-xl";

  const contentLayoutClasses = expanded
    ? "justify-between px-3.5"
    : "justify-center px-3";

  const arrowWrapperClasses = expanded
    ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
    : "absolute right-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors";

  const labelText = expanded ? expandedLabel : collapsedLabel;

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      disabled={disabled}
      className={`group relative flex h-[58px] w-full items-center border text-sm font-semibold outline-none transition-[background-color,border-color,color,box-shadow] duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-border dark:focus-visible:border-border [-webkit-tap-highlight-color:transparent] ${buttonShapeClasses} ${contentLayoutClasses} ${resolvedStateClasses} ${className}`}
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
          <Lightbulb className={`h-[18px] w-[18px] ${iconClasses}`} />
        </span>
        <span className="truncate">{labelText}</span>
      </span>

      <span
        className={`${arrowWrapperClasses} ${
          disabled
            ? "text-muted-foreground/60"
            : expanded
            ? "text-[#6E6E73] dark:text-[#A1A1A6]"
            : "text-[#6E6E73] group-hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:group-hover:text-[#F5F5F7]"
        }`}
        aria-hidden="true"
      >
        <ChevronDown
          className={`h-[18px] w-[18px] stroke-[2.2] transition-transform duration-200 ${
            expanded ? "rotate-180" : "rotate-0"
          }`}
        />
      </span>
    </button>
  );
}
