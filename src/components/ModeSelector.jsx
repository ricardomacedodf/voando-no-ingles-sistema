export default function ModeSelector({ mode, setMode, variant = "default" }) {
  const modes = [
    { key: "en_pt", defaultLabel: "EN -> PT", quizLabel: "EN→PT" },
    { key: "pt_en", defaultLabel: "PT -> EN", quizLabel: "PT→EN" },
    { key: "random", defaultLabel: "Aleatório", quizLabel: "Aleatório" },
  ];

  const isQuiz = variant === "quiz";

  return (
    <div
      className={
        isQuiz
          ? "flex items-center rounded-full border border-border bg-white p-1 shadow-sm"
          : "inline-flex items-center rounded-full border border-border/80 bg-card p-1 shadow-sm"
      }
    >
      {modes.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => {
            if (item.key !== mode) setMode(item.key);
          }}
          className={`rounded-full px-4 py-1.5 transition-colors duration-200 ${
            isQuiz ? "text-sm font-medium" : "text-xs font-semibold"
          } ${
            mode === item.key
              ? "bg-primary text-white"
              : isQuiz
                ? "text-muted-foreground hover:bg-muted"
                : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {isQuiz ? item.quizLabel : item.defaultLabel}
        </button>
      ))}
    </div>
  );
}
