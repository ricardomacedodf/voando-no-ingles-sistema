import { useRef } from "react";
import { Lightbulb } from "lucide-react";
import { playSound } from "../lib/gameState";
import { SFX_EVENTS } from "../lib/sfx";

const EXAMPLES_POINTER_SFX_GUARD_MS = 700;

export default function ExamplesToggleButton({
  expanded,
  onClick,
  collapsedLabel = "Ver exemplos",
  expandedLabel = "Ocultar exemplos",
  variant = "default",
  className = "",
}) {
  const lastPointerSfxAtRef = useRef(0);
  const sfxEvent = expanded ? SFX_EVENTS.EXAMPLES_CLOSE : SFX_EVENTS.EXAMPLES_OPEN;

  const shouldSkipClickSfxAfterPointer = (event) => {
    if (!event) return false;
    if (event.detail === 0) return false;
    return Date.now() - lastPointerSfxAtRef.current < EXAMPLES_POINTER_SFX_GUARD_MS;
  };

  const handleToggle = (event) => {
    if (!shouldSkipClickSfxAfterPointer(event)) {
      playSound(sfxEvent);
    }
    onClick?.();
  };

  const handlePointerDown = () => {
    lastPointerSfxAtRef.current = Date.now();
    playSound(sfxEvent);
  };

  if (variant === "flashcard") {
    return (
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onClick={handleToggle}
        className={`group flex h-14 w-full items-center justify-center gap-2 rounded-lg border border-[#D6DEE8] bg-[#F5F7FA] px-4 py-2 text-center text-sm font-semibold leading-5 text-[#475569] transition-colors dark:border-border dark:bg-card dark:text-slate-200 sm:h-12 sm:rounded-md sm:bg-white sm:font-medium sm:text-[#1A1A1A] sm:hover:border-[#ED9A0A] sm:hover:bg-[#ED9A0A] sm:hover:text-white dark:sm:bg-card dark:sm:text-slate-200 ${expanded ? "mb-6" : ""} ${className}`}
      >
        <Lightbulb
          className={`h-[18px] w-[18px] transition-colors sm:group-hover:text-white ${
            expanded ? "text-[#ED9A0A]" : "text-[#64748B] dark:text-slate-400"
          }`}
        />
        {expanded ? expandedLabel : collapsedLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onClick={handleToggle}
      className={`w-full flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${
        expanded
          ? "bg-[#F5F7FA] border-[#D9E1E8] text-[#2F3A45] dark:bg-muted/40 dark:border-border dark:text-slate-200"
          : "bg-card border-border/70 text-foreground"
      } hover:bg-[#ED9A0A] hover:border-[#ED9A0A] hover:text-white ${className}`}
    >
      <Lightbulb className="w-4 h-4" />
      {expanded ? expandedLabel : collapsedLabel}
    </button>
  );
}
