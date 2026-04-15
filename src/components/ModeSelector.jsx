export default function ModeSelector({ mode, setMode }) {
  const modes = [
    { key: "en_pt", label: "EN → PT" },
    { key: "pt_en", label: "PT → EN" },
    { key: "random", label: "Aleatório" },
  ];

  return (
    <div className="flex gap-1.5">
      {modes.map((m) => (
        <button
          key={m.key}
          onClick={() => setMode(m.key)}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
            ${mode === m.key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card text-foreground border border-border/80 hover:border-primary/30"
            }
          `}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}