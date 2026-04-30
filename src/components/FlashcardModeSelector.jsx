export default function FlashcardModeSelector({ mode, setMode }) {
  const modes = [
    { key: "en_pt", label: "EN\u2192PT" },
    { key: "pt_en", label: "PT\u2192EN" },
    { key: "random", label: "Aleat\u00F3rio" },
  ];

  return (
    <div className="h-[34px] w-[269px] min-w-[269px] shrink-0 md:h-[42px]">
      <div className="flex h-full items-center rounded-full border border-border bg-card p-[3px] shadow-sm md:p-1">
        {modes.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              if (item.key !== mode) setMode(item.key);
            }}
            className={`flex h-full min-w-0 flex-1 items-center justify-center rounded-full px-2 text-xs font-medium leading-4 whitespace-nowrap transition-colors duration-200 md:text-sm md:leading-5 ${
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
