import { memo, startTransition, useCallback } from "react";

function ModeSelector({ mode, setMode, variant = "default" }) {
  const modes = [
    { key: "en_pt", defaultLabel: "EN -> PT", quizLabel: "EN\u2192PT" },
    { key: "pt_en", defaultLabel: "PT -> EN", quizLabel: "PT\u2192EN" },
    { key: "random", defaultLabel: "Aleat\u00F3rio", quizLabel: "Aleat\u00F3rio" },
  ];
  const selectMode = useCallback(
    (nextMode) => {
      if (nextMode !== mode) {
        startTransition(() => setMode(nextMode));
      }
    },
    [mode, setMode]
  );

  const isQuiz = variant === "quiz";

  if (isQuiz) {
    return (
      <div className="h-[42px] w-[269px] min-w-[269px] shrink-0">
        <div className="flex h-full items-stretch rounded-full border border-border bg-card p-[2px] shadow-sm touch-manipulation">
          {modes.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => selectMode(item.key)}
              aria-pressed={mode === item.key}
              className={`relative flex h-full min-h-[38px] min-w-0 flex-1 touch-manipulation select-none items-center justify-center rounded-full px-2 py-2 text-xs font-medium leading-4 whitespace-nowrap outline-none transition-colors duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7CC8F8]/45 focus-visible:ring-offset-0 [-webkit-tap-highlight-color:transparent] md:px-4 md:text-sm md:leading-5 ${
                mode === item.key
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {item.quizLabel}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center rounded-full border border-border/80 bg-card p-1 shadow-sm">
      {modes.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => selectMode(item.key)}
          aria-pressed={mode === item.key}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold outline-none transition-colors duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7CC8F8]/45 focus-visible:ring-offset-0 [-webkit-tap-highlight-color:transparent] ${
            mode === item.key
              ? "bg-primary text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {item.defaultLabel}
        </button>
      ))}
    </div>
  );
}

export default memo(ModeSelector);
