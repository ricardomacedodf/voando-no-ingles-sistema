import { Lightbulb, X } from "lucide-react";

export default function ExamplesPanel({ allMeanings, activeMeaning, examples, meaning, onClose }) {
  // Support both new (allMeanings) and legacy (examples + meaning) props
  const meanings = allMeanings || (examples ? [{ meaning: meaning, examples }] : []);
  if (meanings.length === 0) return null;

  // Sort: active meaning first
  const sorted = activeMeaning
    ? [...meanings].sort((a, b) => (a.meaning === activeMeaning ? -1 : b.meaning === activeMeaning ? 1 : 0))
    : meanings;

  return (
    <div className="bg-card border border-border/60 rounded-xl p-4 mt-3 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-foreground">Exemplos</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="space-y-4">
        {sorted.map((m, mi) => (
          <div key={mi}>
            <p className="text-xs font-bold text-primary mb-2">{m.meaning}</p>
            <div className="space-y-2.5">
              {(m.examples || []).slice(0, 3).map((ex, i) => (
                <div key={i} className="pl-3 border-l-2 border-orange-200">
                  <p className="text-sm font-medium text-foreground">{ex.sentence}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ex.translation}</p>
                </div>
              ))}
              {(!m.examples || m.examples.length === 0) && (
                <p className="text-xs text-muted-foreground italic pl-3">Nenhum exemplo cadastrado.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}