export default function ModeSelector({ mode, setMode, variant = "default" }) {
  const modes = [
    { key: "en_pt", defaultLabel: "EN -> PT", quizLabel: "EN→PT" },
    { key: "pt_en", defaultLabel: "PT -> EN", quizLabel: "PT→EN" },
    { key: "random", defaultLabel: "Aleatório", quizLabel: "Aleatório" },
  ];

  const isQuiz = variant === "quiz";

  if (isQuiz) {
    return (
      <div className="h-[34px] w-[269px] min-w-[269px] shrink-0 md:h-[42px]">
        <div className="flex h-full items-center rounded-full border border-border bg-white p-[3px] shadow-sm md:p-1">
          {modes.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                if (item.key !== mode) setMode(item.key);
              }}
              className={`flex h-full min-w-0 flex-1 items-center justify-center rounded-full px-2 text-xs font-medium leading-4 whitespace-nowrap transition-colors duration-200 md:px-4 md:text-sm md:leading-5 ${
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
          onClick={() => {
            if (item.key !== mode) setMode(item.key);
          }}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors duration-200 ${
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
