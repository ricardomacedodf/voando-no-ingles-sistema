import { useRef, useState } from "react";
import { ArrowLeft, FileJson, Download, Loader2, Upload } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { createInitialStats } from "../lib/learningEngine";

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const isThirdPartyEmbeddedVideo = (value) => {
  const cleanValue = normalizeText(value);

  if (!cleanValue) return false;

  return (
    /<iframe/i.test(cleanValue) ||
    /\[iframe/i.test(cleanValue) ||
    /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|dai\.ly|tiktok\.com|instagram\.com|facebook\.com\/plugins\/video|player\.twitch\.tv|clip\.cafe|playphrase\.me|yarn\.co|y\.yarn\.co/i.test(
      cleanValue
    )
  );
};

const normalizeEmbeddedVideo = (value) => {
  const cleanVideo = normalizeText(value);

  return isThirdPartyEmbeddedVideo(cleanVideo) ? cleanVideo : "";
};

const normalizeThumbnail = (value) => normalizeText(value);

const normalizeExampleVideo = (example) => {
  const rawVideo =
    example?.video ?? example?.videoUrl ?? example?.video_url ?? "";

  return normalizeEmbeddedVideo(rawVideo);
};

const normalizeMeaningVideo = (meaning) => {
  const rawVideo =
    meaning?.video ??
    meaning?.videoUrl ??
    meaning?.video_url ??
    meaning?.meaningVideo ??
    meaning?.meaning_video ??
    "";

  return normalizeEmbeddedVideo(rawVideo);
};

const normalizeWordVideo = (item) => {
  const rawVideo =
    item?.video ??
    item?.videoUrl ??
    item?.video_url ??
    item?.wordVideo ??
    item?.word_video ??
    item?.globalVideo ??
    item?.global_video ??
    item?.stats?.video ??
    item?.stats?.videoUrl ??
    item?.stats?.video_url ??
    item?.stats?.wordVideo ??
    item?.stats?.word_video ??
    item?.stats?.globalVideo ??
    item?.stats?.global_video ??
    "";

  return normalizeEmbeddedVideo(rawVideo);
};

const normalizeVideoEntry = (entry, fallbackThumbnail = "") => {
  if (typeof entry === "string") {
    const video = normalizeEmbeddedVideo(entry);

    return video
      ? {
          video,
          thumbnail: normalizeThumbnail(fallbackThumbnail),
        }
      : null;
  }

  if (!entry || typeof entry !== "object") return null;

  const video = normalizeEmbeddedVideo(
    entry.video ??
      entry.videoUrl ??
      entry.video_url ??
      entry.wordVideo ??
      entry.word_video ??
      entry.globalVideo ??
      entry.global_video ??
      ""
  );

  if (!video) return null;

  return {
    video,
    thumbnail: normalizeThumbnail(
      entry.thumbnail ??
        entry.thumbnailUrl ??
        entry.thumbnail_url ??
        entry.wordThumbnail ??
        entry.word_thumbnail ??
        entry.globalThumbnail ??
        entry.global_thumbnail ??
        fallbackThumbnail
    ),
  };
};

const normalizeVideoList = (value, fallbackThumbnail = "") => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeVideoEntry(entry, fallbackThumbnail))
      .filter(Boolean);
  }

  const entry = normalizeVideoEntry(value, fallbackThumbnail);

  return entry ? [entry] : [];
};

const dedupeVideoEntries = (entries) => {
  const seen = new Set();

  return entries.filter((entry) => {
    const video = normalizeText(entry?.video);

    if (!video || seen.has(video)) return false;

    seen.add(video);
    return true;
  });
};

const normalizeWordVideos = (item) => {
  const fallbackThumbnail = normalizeThumbnail(
    item?.thumbnail ??
      item?.thumbnailUrl ??
      item?.thumbnail_url ??
      item?.wordThumbnail ??
      item?.word_thumbnail ??
      item?.globalThumbnail ??
      item?.global_thumbnail ??
      item?.stats?.thumbnail ??
      item?.stats?.thumbnailUrl ??
      item?.stats?.thumbnail_url ??
      item?.stats?.wordThumbnail ??
      item?.stats?.word_thumbnail ??
      item?.stats?.globalThumbnail ??
      item?.stats?.global_thumbnail ??
      ""
  );

  return dedupeVideoEntries([
    ...normalizeVideoList(item?.wordVideos, fallbackThumbnail),
    ...normalizeVideoList(item?.word_videos, fallbackThumbnail),
    ...normalizeVideoList(item?.globalVideos, fallbackThumbnail),
    ...normalizeVideoList(item?.global_videos, fallbackThumbnail),
    ...normalizeVideoList(item?.stats?.wordVideos, fallbackThumbnail),
    ...normalizeVideoList(item?.stats?.word_videos, fallbackThumbnail),
    ...normalizeVideoList(item?.stats?.globalVideos, fallbackThumbnail),
    ...normalizeVideoList(item?.stats?.global_videos, fallbackThumbnail),
    ...normalizeVideoList(normalizeWordVideo(item), fallbackThumbnail),
  ]);
};

const hasExampleContent = (example) => {
  const sentence = normalizeText(example?.sentence);
  const translation = normalizeText(example?.translation);
  const video = normalizeExampleVideo(example);

  return Boolean(sentence || translation || video);
};

const buildStatsWithWordVideos = (wordVideos) => {
  const cleanWordVideos = dedupeVideoEntries(
    (Array.isArray(wordVideos) ? wordVideos : [])
      .map((entry) => ({
        video: normalizeEmbeddedVideo(entry?.video),
        thumbnail: normalizeThumbnail(entry?.thumbnail),
      }))
      .filter((entry) => entry.video)
  );

  const firstWordVideo = cleanWordVideos[0] || { video: "", thumbnail: "" };

  return {
    ...createInitialStats(),
    wordVideo: firstWordVideo.video,
    wordThumbnail: firstWordVideo.thumbnail,
    wordVideos: cleanWordVideos,
  };
};

const buildExportItem = (item) => {
  const wordVideos = normalizeWordVideos(item);
  const firstWordVideo = wordVideos[0] || { video: "", thumbnail: "" };

  return {
    term: item?.term || "",
    pronunciation: item?.pronunciation || "",
    wordVideos,
    video: firstWordVideo.video,
    thumbnail: firstWordVideo.thumbnail,
    meanings: (item?.meanings || []).map((meaning) => {
      const meaningVideo = normalizeMeaningVideo(meaning);

      return {
        meaning: meaning?.meaning || "",
        category: meaning?.category || "",
        tip: meaning?.tip || "",
        video: meaningVideo,
        thumbnail: meaningVideo
          ? normalizeThumbnail(
              meaning?.thumbnail ??
                meaning?.thumbnailUrl ??
                meaning?.thumbnail_url ??
                ""
            )
          : "",
        examples: (meaning?.examples || [])
          .map((example) => {
            const exampleVideo = normalizeExampleVideo(example);

            return {
              sentence: example?.sentence || "",
              translation: example?.translation || "",
              video: exampleVideo,
              thumbnail: exampleVideo
                ? normalizeThumbnail(
                    example?.thumbnail ??
                      example?.thumbnailUrl ??
                      example?.thumbnail_url ??
                      ""
                  )
                : "",
            };
          })
          .filter(hasExampleContent),
      };
    }),
  };
};

export default function ManagerImport({ vocab, onBack, onDone }) {
  const { user } = useAuth();

  const [json, setJson] = useState("");
  const [status, setStatus] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, pct: 0 });
  const fileInputRef = useRef(null);

  const exportJSON = () => {
    const data = vocab.map(buildExportItem);

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

  const handleImportFile = (event) => {
    const input = event.target;
    const file = input.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      const result = validate(content);

      setJson(content);
      setStatus({
        type: result.valid ? "success" : "error",
        msg: result.valid ? `Arquivo carregado. ${result.msg}` : result.msg,
      });
      input.value = "";
    };

    reader.onerror = () => {
      setStatus({
        type: "error",
        msg: "Não foi possível ler o arquivo JSON.",
      });
      input.value = "";
    };

    reader.readAsText(file);
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

      const importedItems = result.data.map((item) => {
        const wordVideos = normalizeWordVideos(item);
        const firstWordVideo = wordVideos[0] || { video: "", thumbnail: "" };

        const meanings = (item.meanings || [])
          .map((m, index) => {
            const meaningVideo = normalizeMeaningVideo(m);
            const examples = (m.examples || [])
              .map((e) => {
                const exampleVideo = normalizeExampleVideo(e);

                return {
                  sentence: normalizeText(e?.sentence),
                  translation: normalizeText(e?.translation),
                  video: exampleVideo,
                  thumbnail: exampleVideo
                    ? normalizeThumbnail(
                        e?.thumbnail ??
                          e?.thumbnailUrl ??
                          e?.thumbnail_url ??
                          ""
                      )
                    : "",
                };
              })
              .filter(hasExampleContent);

            const cleanMeaning = {
              meaning: normalizeText(m?.meaning),
              category: m?.category || "vocabulário",
              tip: normalizeText(m?.tip),
              video: meaningVideo,
              thumbnail: meaningVideo
                ? normalizeThumbnail(
                    m?.thumbnail ?? m?.thumbnailUrl ?? m?.thumbnail_url ?? ""
                  )
                : "",
              examples,
            };

            if (index !== 0 || wordVideos.length === 0) return cleanMeaning;

            return {
              ...cleanMeaning,
              _wordVideo: firstWordVideo.video,
              _wordThumbnail: firstWordVideo.thumbnail,
              _wordVideos: wordVideos,
            };
          })
          .filter((m) => m.meaning);

        return {
          user_id: user.id,
          term: normalizeText(item.term),
          pronunciation: normalizeText(item.pronunciation),
          meanings,
          stats: buildStatsWithWordVideos(wordVideos),
          created_at: now,
          updated_at: now,
        };
      });

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

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-2 bg-card text-foreground border border-border rounded-lg text-xs font-semibold hover:bg-muted disabled:opacity-40 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Importar arquivo
          </button>

          {vocab.length > 0 && (
            <button
              onClick={exportJSON}
              className="flex items-center gap-1.5 px-3 py-2 bg-card text-foreground border border-border rounded-lg text-xs font-semibold hover:bg-muted transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Exportar palavras atuais
            </button>
          )}
        </div>
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
