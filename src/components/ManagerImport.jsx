import { useState } from "react";
import { ArrowLeft, FileJson, Download, Loader2 } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";

const normalizeExampleVideo = (example) => {
  const rawVideo =
    example?.video ?? example?.videoUrl ?? example?.video_url ?? "";
  return typeof rawVideo === "string" ? rawVideo.trim() : "";
};

const hasExampleContent = (example) => {
  const sentence =
    typeof example?.sentence === "string" ? example.sentence.trim() : "";
  const translation =
    typeof example?.translation === "string" ? example.translation.trim() : "";
  const video = normalizeExampleVideo(example);

  return Boolean(sentence || translation || video);
};

export default function ManagerImport({ vocab, onBack, onDone }) {
  const { user } = useAuth();

  const [json, setJson] = useState("");
  const [status, setStatus] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, pct: 0 });

  const exportJSON = () => {
    const data = vocab.map((v) => ({
      term: v.term,
      pronunciation: v.pronunciation || "",
      meanings: (v.meanings || []).map((m) => ({
        meaning: m.meaning,
        category: m.category || "",
        tip: m.tip || "",
        examples: (m.examples || []).map((e) => ({
          sentence: e.sentence,
          translation: e.translation,
          video: normalizeExampleVideo(e),
        })),
      })),
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "voando-no-ingles-vocabulario.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validate = (text) => {
    try {
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed)) {
        return { valid: false, msg: "JSON inválido: deve ser um array." };
      }

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];

        if (!item.term) {
          return { valid: false, msg: `Item ${i + 1}: falta campo "term".` };
        }

        if (!item.meanings || !Array.isArray(item.meanings)) {
          return {
            valid: false,
            msg: `Item ${i + 1}: falta campo "meanings" (array).`,
          };
        }
      }

      return {
        valid: true,
        data: parsed,
        msg: `${parsed.length} palavras detectadas. Estrutura válida.`,
      };
    } catch {
      return { valid: false, msg: "JSON inválido. Verifique a sintaxe." };
    }
  };

  const processJSON = async () => {
    const result = validate(json);

    if (!result.valid) {
      setStatus({ type: "error", msg: result.msg });
      return;
    }

    if (!user?.id) {
      setStatus({
        type: "error",
        msg: "Usuário não identificado.",
      });
      return;
    }

    try {
      setProcessing(true);
      setProgress({ current: 0, total: result.data.length, pct: 0 });
      setStatus({
        type: "info",
        msg: `Processando ${result.data.length} palavras...`,
      });

      const now = new Date().toISOString();

      const importedItems = result.data.map((item) => ({
        user_id: user.id,
        term: (item.term || "").trim(),
        pronunciation: (item.pronunciation || "").trim(),
        meanings: (item.meanings || [])
          .map((m) => ({
            meaning: (m.meaning || "").trim(),
            category: m.category || "vocabulário",
            tip: (m.tip || "").trim(),
            examples: (m.examples || [])
              .map((e) => ({
                sentence: (e.sentence || "").trim(),
                translation: (e.translation || "").trim(),
                video: normalizeExampleVideo(e),
              }))
              .filter(hasExampleContent),
          }))
          .filter((m) => m.meaning),
        stats: {
          correct: 0,
          incorrect: 0,
          total_reviews: 0,
          avg_response_time: 0,
          status: "nova",
        },
        created_at: now,
        updated_at: now,
      }));

      for (let i = 0; i < importedItems.length; i++) {
        const { error } = await supabase
          .from("vocabulary")
          .insert([importedItems[i]]);

        if (error) {
          throw error;
        }

        setProgress({
          current: i + 1,
          total: importedItems.length,
          pct: Math.round(((i + 1) / importedItems.length) * 100),
        });
      }

      setStatus({
        type: "success",
        msg: `${importedItems.length} palavras importadas com sucesso!`,
      });

      setTimeout(() => onDone?.(), 1000);
    } catch (error) {
      console.error("Erro ao importar JSON no Supabase:", error);
      setStatus({
        type: "error",
        msg: "Não foi possível importar o JSON.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const validationPreview = json.trim() ? validate(json) : null;

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-orange-500 transition-colors mb-4 font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <h1 className="text-xl font-bold text-foreground">Importar JSON</h1>
        {vocab.length > 0 && (
          <button
            onClick={exportJSON}
            className="flex items-center gap-1.5 px-3 py-2 bg-card text-foreground border border-border rounded-lg text-xs font-semibold hover:bg-muted transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Exportar palavras atuais
          </button>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Cole o JSON com as palavras e significados no campo abaixo. O formato deve seguir o padrão oficial do sistema, incluindo termo principal, pronúncia, significados, categorias, dicas e exemplos.
      </p>

      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder="Cole aqui seu código JSON..."
        className="w-full h-64 px-4 py-3 bg-card border border-border rounded-xl text-sm font-mono resize-y placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
      />

      {validationPreview && (
        <p
          className={`text-xs font-medium mt-2 ${
            validationPreview.valid ? "text-primary" : "text-destructive"
          }`}
        >
          {validationPreview.msg}
        </p>
      )}

      {processing && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Processando...</span>
            <span>
              {progress.current} de {progress.total} ({progress.pct}%)
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </div>
      )}

      {status && !processing && (
        <div
          className={`mt-3 p-3 rounded-xl text-sm font-medium ${
            status.type === "success"
              ? "bg-emerald-50 text-primary"
              : status.type === "error"
              ? "bg-red-50 text-destructive"
              : "bg-blue-50 text-info"
          }`}
        >
          {status.msg}
        </div>
      )}

      <button
        onClick={processJSON}
        disabled={!json.trim() || processing || !validationPreview?.valid}
        className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-all"
      >
        {processing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileJson className="w-4 h-4" />
        )}
        Processar JSON
      </button>
    </div>
  );
}
