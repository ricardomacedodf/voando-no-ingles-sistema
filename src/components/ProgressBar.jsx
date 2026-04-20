export default function ProgressBar({ current, total, variant = "default" }) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  const isQuiz = variant === "quiz";

  return (
    <div className={isQuiz ? "flex items-center gap-4 text-sm font-medium" : "flex items-center gap-3"}>
      <span
        className={
          isQuiz
            ? "whitespace-nowrap text-muted-foreground"
            : "whitespace-nowrap text-xs font-medium text-muted-foreground"
        }
      >
        {current} de {total}
      </span>

      <div
        className={
          isQuiz
            ? "h-2 flex-1 overflow-hidden rounded-full bg-muted"
            : "h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        }
      >
        <div
          className={`h-full rounded-full bg-primary transition-all ${isQuiz ? "duration-300" : "duration-500 ease-out"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
