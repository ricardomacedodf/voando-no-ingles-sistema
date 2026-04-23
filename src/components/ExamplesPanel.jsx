import { Lightbulb, X } from "lucide-react";
import { playSound } from "../lib/gameState";
import { SFX_EVENTS } from "../lib/sfx";

export default function ExamplesPanel({
  allMeanings,
  activeMeaning,
  examples,
  meaning,
  titleTerm,
  variant = "default",
  onClose,
}) {
  const meanings = allMeanings || (examples ? [{ meaning, examples }] : []);
  if (meanings.length === 0) return null;

  const normalized = meanings.map((item, index) => ({
    meaning: item?.meaning || `Significado ${index + 1}`,
    category: item?.category || "vocabulário",
    tip: item?.tip || "",
    examples: Array.isArray(item?.examples) ? item.examples : [],
  }));

  const sorted = activeMeaning
    ? [...normalized].sort((a, b) =>
        a.meaning === activeMeaning ? -1 : b.meaning === activeMeaning ? 1 : 0
      )
    : normalized;

  const isFlashcard = variant === "flashcard";
  const title = titleTerm ? `Exemplos — ${titleTerm}` : "Exemplos";

  const handleClose = () => {
    playSound(SFX_EVENTS.EXAMPLES_CLOSE);
    onClose?.();
  };

  return (
    <div
      className={
        isFlashcard
          ? "mt-0 rounded-xl border border-[#EDF0F3] bg-white p-6 text-[#1A1A1A] animate-in slide-in-from-top-4 duration-200"
          : "mt-4 rounded-2xl border border-border/70 bg-[#F9FAFB] p-5 animate-in fade-in slide-in-from-top-2 duration-200"
      }
    >
      <div
        className={
          isFlashcard
            ? "mb-4 flex items-center justify-between border-b border-border pb-2"
            : "mb-4 flex items-center justify-between gap-3 border-b border-border/70 pb-3"
        }
      >
        <div className="flex items-center gap-2 text-foreground">
          <Lightbulb className={isFlashcard ? "h-[18px] w-[18px] text-[#ED9A0A]" : "h-4 w-4 text-[#ED9A0A]"} />
          <h3 className={isFlashcard ? "text-base font-bold" : "text-2xl font-semibold leading-none"}>{title}</h3>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className={
            isFlashcard
              ? "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              : "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          }
          aria-label="Fechar exemplos"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className={isFlashcard ? "space-y-6" : "space-y-5"}>
        {sorted.map((entry, index) => (
          <section key={`${entry.meaning}-${index}`} className={isFlashcard ? "space-y-3" : "space-y-3"}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={isFlashcard ? "font-semibold text-[#25B15F]" : "font-bold text-[#26A95C]"}>{index + 1}.</span>
              <span className={isFlashcard ? "font-medium text-foreground" : "text-foreground font-semibold"}>{entry.meaning}</span>
              {entry.category ? (
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{entry.category}</span>
              ) : null}
            </div>

            {entry.tip ? (
              <p className={isFlashcard ? "pl-6 text-xs italic text-muted-foreground" : "flex items-start gap-1.5 text-sm italic text-muted-foreground"}>
                {isFlashcard ? "💡 " : <Lightbulb className="mt-0.5 h-3.5 w-3.5 text-[#ED9A0A]" />}
                <span>{entry.tip}</span>
              </p>
            ) : null}

            <div className={isFlashcard ? "space-y-2" : "space-y-2.5"}>
              {entry.examples.slice(0, 3).map((example, exampleIndex) => (
                <article
                  key={`${entry.meaning}-${exampleIndex}`}
                  className={isFlashcard ? "space-y-0.5 border-l-2 border-[#64748B]/30 pl-6" : "border-l-2 border-[#F3D7A8] pl-3"}
                >
                  <p className={isFlashcard ? "font-medium text-foreground" : "text-xl font-semibold text-foreground leading-snug"}>
                    {example?.sentence || "Sem exemplo em inglês."}
                  </p>
                  <p className={isFlashcard ? "text-sm text-muted-foreground" : "mt-0.5 text-lg text-muted-foreground leading-snug"}>
                    {example?.translation || "Sem tradução cadastrada."}
                  </p>
                </article>
              ))}

              {entry.examples.length === 0 ? (
                <p className={isFlashcard ? "border-l-2 border-[#64748B]/30 pl-6 text-sm italic text-muted-foreground" : "border-l-2 border-[#F3D7A8] pl-3 text-sm italic text-muted-foreground"}>
                  Nenhum exemplo cadastrado.
                </p>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
