export default function ModeSelector({ mode, setMode }) {
  const modes = [
    { key: "en_pt", label: "EN -> PT" },
    { key: "pt_en", label: "PT -> EN" },
    { key: "random", label: "Aleatório" },
  ];

  return (
    <div className="inline-flex items-center rounded-full border border-border/80 bg-card p-1 shadow-sm">
      {modes.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => setMode(item.key)}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors duration-200 ${
            mode === item.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

