import { useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";

const categories = [
  "vocabulário",
  "expressão",
  "adjetivo",
  "verbo",
  "substantivo",
  "phrasal verb",
  "advérbio",
  "preposição",
  "interjeição",
  "pronome",
  "conjunção",
  "idiom",
  "collocation",
];

const emptyExample = { sentence: "", translation: "" };
const emptyMeaning = {
  meaning: "",
  category: "vocabulário",
  tip: "",
  examples: [{ ...emptyExample }, { ...emptyExample }, { ...emptyExample }],
};

export default function ManagerForm({ item, onBack, onSaved }) {
  const { user } = useAuth();

  const [term, setTerm] = useState(item?.term || "");
  const [pronunciation, setPronunciation] = useState(item?.pronunciation || "");
  const [meanings, setMeanings] = useState(
    item?.meanings?.length > 0
      ? item.meanings.map((m) => ({
          meaning: m.meaning || "",
          category: m.category || "vocabulário",
          tip: m.tip || "",
          examples:
            m.examples?.length > 0
              ? m.examples.map((e) => ({
                  sentence: e.sentence || "",
                  translation: e.translation || "",
                }))
              : [{ ...emptyExample }, { ...emptyExample }, { ...emptyExample }],
        }))
      : [{ ...emptyMeaning }]
  );
  const [saving, setSaving] = useState(false);

  const updateMeaning = (idx, field, value) => {
    const updated = [...meanings];
    updated[idx] = { ...updated[idx], [field]: value };
    setMeanings(updated);
  };

  const updateExample = (mIdx, eIdx, field, value) => {
    const updated = [...meanings];
    const examples = [...updated[mIdx].examples];
    examples[eIdx] = { ...examples[eIdx], [field]: value };
    updated[mIdx] = { ...updated[mIdx], examples };
    setMeanings(updated);
  };

  const addMeaning = () => {
    setMeanings([
      ...meanings,
      {
        meaning: "",
        category: "vocabulário",
        tip: "",
        examples: [{ ...emptyExample }, { ...emptyExample }, { ...emptyExample }],
      },
    ]);
  };

  const removeMeaning = (idx) => {
    if (meanings.length <= 1) return;
    setMeanings(meanings.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!term.trim()) return;

    if (!user?.id) {
      alert("Usuário não identificado.");
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();

      const cleanedMeanings = meanings
        .map((m) => ({
          meaning: m.meaning.trim(),
          category: m.category,
          tip: m.tip.trim(),
          examples: m.examples
            .map((e) => ({
              sentence: e.sentence.trim(),
              translation: e.translation.trim(),
            }))
            .filter((e) => e.sentence),
        }))
        .filter((m) => m.meaning);

      const stats = item?.stats || {
        correct: 0,
        incorrect: 0,
        total_reviews: 0,
        avg_response_time: 0,
        status: "nova",
      };

      if (item?.id) {
        const payload = {
          term: term.trim(),
          pronunciation: pronunciation.trim(),
          meanings: cleanedMeanings,
          stats,
          updated_at: now,
        };

        const { error } = await supabase
          .from("vocabulary")
          .update(payload)
          .eq("id", item.id)
          .eq("user_id", user.id);

        if (error) {
          throw error;
        }
      } else {
        const payload = {
          user_id: user.id,
          term: term.trim(),
          pronunciation: pronunciation.trim(),
          meanings: cleanedMeanings,
          stats,
          created_at: now,
          updated_at: now,
        };

        const { error } = await supabase
          .from("vocabulary")
          .insert([payload]);

        if (error) {
          throw error;
        }
      }

      onSaved?.();
    } catch (error) {
      console.error("Erro ao salvar item no Supabase:", error);
      alert("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-orange-500 transition-colors mb-4 font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="text-xl font-bold text-foreground mb-6">
        {item ? "Editar palavra ou frase" : "Nova palavra ou frase"}
      </h1>

      <div className="space-y-5">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Palavra ou frase em inglês
          </label>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            placeholder="Ex: break down"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Pronúncia
          </label>
          <input
            type="text"
            value={pronunciation}
            onChange={(e) => setPronunciation(e.target.value)}
            className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            placeholder="Ex: breik daun"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Significados
            </label>
            <button
              onClick={addMeaning}
              className="text-xs font-semibold text-foreground hover:text-orange-500 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>

          <div className="space-y-4">
            {meanings.map((m, mIdx) => (
              <div key={mIdx} className="bg-card border border-border/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Significado {mIdx + 1}
                  </span>
                  {meanings.length > 1 && (
                    <button
                      onClick={() => removeMeaning(mIdx)}
                      className="p-1 rounded hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={m.meaning}
                    onChange={(e) => updateMeaning(mIdx, "meaning", e.target.value)}
                    placeholder="Significado em português"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                  />

                  <select
                    value={m.category}
                    onChange={(e) => updateMeaning(mIdx, "category", e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={m.tip}
                    onChange={(e) => updateMeaning(mIdx, "tip", e.target.value)}
                    placeholder="Dica de aprendizado"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                  />

                  <div className="pt-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Exemplos
                    </span>
                    <div className="space-y-2 mt-2">
                      {m.examples.map((ex, eIdx) => (
                        <div key={eIdx} className="pl-3 border-l-2 border-orange-200 space-y-1.5">
                          <input
                            type="text"
                            value={ex.sentence}
                            onChange={(e) =>
                              updateExample(mIdx, eIdx, "sentence", e.target.value)
                            }
                            placeholder={`Exemplo ${eIdx + 1} em inglês`}
                            className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                          <input
                            type="text"
                            value={ex.translation}
                            onChange={(e) =>
                              updateExample(mIdx, eIdx, "translation", e.target.value)
                            }
                            placeholder="Tradução em português"
                            className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !term.trim()}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}