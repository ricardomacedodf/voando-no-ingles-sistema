import { Moon, Sun } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export default function ThemeToggle({
  compact = false,
  className = "",
  align = "center",
}) {
  const { isDark, toggleTheme } = useTheme();

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted ${className}`}
        title={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
        aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    );
  }

  const alignClass =
    align === "start"
      ? "justify-start"
      : align === "end"
      ? "justify-end"
      : "justify-center";

  return (
    <div className={`flex ${alignClass} ${className}`}>
      <button
        type="button"
        onClick={toggleTheme}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        title={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
        aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        <span>{isDark ? "Modo claro" : "Modo dark"}</span>
      </button>
    </div>
  );
}
