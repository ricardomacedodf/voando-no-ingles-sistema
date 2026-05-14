import { memo, startTransition, useCallback } from "react";

function FlashcardModeSelector({ mode, setMode }) {
  const modes = [
    { key: "en_pt", label: "EN\u2192PT" },
    { key: "pt_en", label: "PT\u2192EN" },
    { key: "random", label: "Aleat\u00F3rio" },
  ];
  const selectMode = useCallback(
    (nextMode) => {
      if (nextMode !== mode) {
        startTransition(() => setMode(nextMode));
      }
    },
    [mode, setMode]
  );

  return (
    <div className="h-[42px] w-[269px] min-w-[269px] shrink-0">
      <div className="flex h-full items-stretch rounded-full border border-border bg-card p-[2px] shadow-sm touch-manipulation">
        {modes.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => selectMode(item.key)}
            aria-pressed={mode === item.key}
            className={`relative flex self-stretch min-w-0 flex-1 touch-manipulation select-none items-center justify-center rounded-full px-2 py-2 text-xs font-medium leading-4 whitespace-nowrap outline-none transition-colors duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7CC8F8]/45 focus-visible:ring-offset-0 [-webkit-tap-highlight-color:transparent] md:text-sm md:leading-5 ${
              mode === item.key
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default memo(FlashcardModeSelector);
