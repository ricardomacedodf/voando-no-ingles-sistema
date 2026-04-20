export default function FlashcardModeSelector({ mode, setMode }) {
  const modes = [
    { key: "en_pt", label: "EN/PT" },
    { key: "pt_en", label: "PT/EN" },
    { key: "random", label: "Aleat\u00F3rio", compactLabel: "Aleat." },
  ];

  return (
    <div className="w-fit max-w-full min-w-0">
      <div className="flex max-w-full rounded-full border border-[#EDF0F3] bg-white p-0.5 shadow-sm sm:p-1">
        {modes.map((item) => {
          const isActive = mode === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setMode(item.key)}
              className={`min-w-0 rounded-full px-2 py-1 text-center text-[11px] font-medium leading-4 transition-colors sm:px-4 sm:py-1.5 sm:text-sm sm:leading-5 ${
                isActive
                  ? "bg-[#25B15F] text-white"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className="sm:hidden">{item.compactLabel ?? item.label}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
