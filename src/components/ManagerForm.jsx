import { useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import ExampleVideoPlayer from "@/components/ExampleVideoPlayer";
import {
  createExampleVideoStorageRef,
  EXAMPLE_VIDEO_BUCKET,
  getExampleVideoContentType,
  getExampleVideoDisplayLabel,
  getExampleVideoUploadPath,
} from "@/lib/exampleVideoStorage";
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

const emptyExample = { sentence: "", translation: "", video: "" };
const emptyMeaning = {
  meaning: "",
  category: "vocabulário",
  tip: "",
  examples: [{ ...emptyExample }, { ...emptyExample }, { ...emptyExample }],
};

const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;
const VIDEO_MIME_PREFIX = "video/";

const getExampleKey = (mIdx, eIdx) => `${mIdx}-${eIdx}`;

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

const uploadExampleVideoFile = async (file, userId) => {
  const uploadPath = getExampleVideoUploadPath(userId, file);

  const { error } = await supabase.storage
    .from(EXAMPLE_VIDEO_BUCKET)
    .upload(uploadPath, file, {
      upsert: false,
      cacheControl: "3600",
      contentType: getExampleVideoContentType(file),
    });

  if (error) throw error;

  return createExampleVideoStorageRef(EXAMPLE_VIDEO_BUCKET, uploadPath);
};

function ExampleVideoPreview({ video }) {
  if (!video) return null;

  return (
    <div className="mt-2 aspect-video overflow-hidden rounded-lg bg-black">
      <ExampleVideoPlayer video={video} />
    </div>
  );
}

export default function ManagerForm({ item, onBack, onSaved }) {
  const { user } = useAuth();
  const fileInputsRef = useRef({});

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
                  sentence: e?.sentence || "",
                  translation: e?.translation || "",
                  video: normalizeExampleVideo(e),
                }))
              : [{ ...emptyExample }, { ...emptyExample }, { ...emptyExample }],
        }))
      : [{ ...emptyMeaning }]
  );
  const [saving, setSaving] = useState(false);
  const [videoEditor, setVideoEditor] = useState({ key: null, value: "" });
  const [uploadingVideoKey, setUploadingVideoKey] = useState(null);
  const [videoUploadErrors, setVideoUploadErrors] = useState({});

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
    setVideoEditor((current) => {
      if (current.key === null) return current;
      const [meaningIdx] = current.key.split("-").map(Number);
      return meaningIdx === idx ? { key: null, value: "" } : current;
    });
  };

  const openVideoEditor = (mIdx, eIdx, currentVideo) => {
    setVideoEditor({
      key: getExampleKey(mIdx, eIdx),
      value: typeof currentVideo === "string" ? currentVideo : "",
    });
  };

  const closeVideoEditor = () => {
    setVideoEditor({ key: null, value: "" });
  };

  const saveExampleVideo = (mIdx, eIdx) => {
    const trimmedVideo = videoEditor.value.trim();
    const key = getExampleKey(mIdx, eIdx);

    setVideoUploadErrors((current) => ({ ...current, [key]: "" }));
    updateExample(mIdx, eIdx, "video", trimmedVideo);
    closeVideoEditor();
  };

  const removeExampleVideo = (mIdx, eIdx) => {
    updateExample(mIdx, eIdx, "video", "");
    const key = getExampleKey(mIdx, eIdx);

    setVideoUploadErrors((current) => ({ ...current, [key]: "" }));
    setVideoEditor((current) =>
      current.key === key ? { key: null, value: "" } : current
    );
  };

  const triggerVideoFilePicker = (exampleKey) => {
    const input = fileInputsRef.current[exampleKey];
    if (input) input.click();
  };

  const handleVideoFileSelected = async (mIdx, eIdx, event) => {
    const file = event?.target?.files?.[0];
    event.target.value = "";
    if (!file) return;

    const key = getExampleKey(mIdx, eIdx);

    if (!user?.id) {
      alert("Usuário não identificado.");
      return;
    }

    if (!String(file.type || "").toLowerCase().startsWith(VIDEO_MIME_PREFIX)) {
      setVideoUploadErrors((current) => ({
        ...current,
        [key]: "Arquivo inválido. Selecione um vídeo válido.",
      }));
      return;
    }

    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      setVideoUploadErrors((current) => ({
        ...current,
        [key]: "Vídeo muito grande. Limite máximo: 50 MB.",
      }));
      return;
    }

    try {
      setUploadingVideoKey(key);
      setVideoUploadErrors((current) => ({ ...current, [key]: "" }));

      const uploadedVideoUrl = await uploadExampleVideoFile(file, user.id);
      updateExample(mIdx, eIdx, "video", uploadedVideoUrl);
      setVideoEditor((current) =>
        current.key === key ? { ...current, value: uploadedVideoUrl } : current
      );
    } catch (error) {
      console.error("Erro ao enviar vídeo do exemplo:", error);
      setVideoUploadErrors((current) => ({
        ...current,
        [key]:
          "Não foi possível enviar o vídeo. Verifique as permissões do bucket de storage no Supabase.",
      }));
    } finally {
      setUploadingVideoKey((current) => (current === key ? null : current));
    }
  };

  const handleSave = async () => {
    if (!term.trim()) return;

    if (!user?.id) {
      alert("Usuário não identificado.");
      return;
    }

    if (uploadingVideoKey) {
      alert("Aguarde o envio do vídeo terminar para salvar.");
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
              sentence:
                typeof e?.sentence === "string" ? e.sentence.trim() : "",
              translation:
                typeof e?.translation === "string" ? e.translation.trim() : "",
              video: normalizeExampleVideo(e),
            }))
            .filter(hasExampleContent),
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

        if (error) throw error;
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

        const { error } = await supabase.from("vocabulary").insert([payload]);
        if (error) throw error;
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
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-orange-500"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <h1 className="mb-6 text-xl font-bold text-foreground">
        {item ? "Editar palavra ou frase" : "Nova palavra ou frase"}
      </h1>

      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Palavra ou frase em inglês
          </label>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Ex: break down"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pronúncia
          </label>
          <input
            type="text"
            value={pronunciation}
            onChange={(e) => setPronunciation(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Ex: breik daun"
          />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Significados
            </label>
            <button
              type="button"
              onClick={addMeaning}
              className="flex items-center gap-1 text-xs font-semibold text-foreground transition-colors hover:text-orange-500"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>

          <div className="space-y-4">
            {meanings.map((m, mIdx) => (
              <div
                key={mIdx}
                className="rounded-xl border border-border/60 bg-card p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Significado {mIdx + 1}
                  </span>
                  {meanings.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeMeaning(mIdx)}
                      className="rounded p-1 transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={m.meaning}
                    onChange={(e) => updateMeaning(mIdx, "meaning", e.target.value)}
                    placeholder="Significado em português"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />

                  <select
                    value={m.category}
                    onChange={(e) => updateMeaning(mIdx, "category", e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />

                  <div className="pt-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Exemplos
                    </span>

                    <div className="mt-2 space-y-2">
                      {m.examples.map((ex, eIdx) => {
                        const exampleKey = getExampleKey(mIdx, eIdx);
                        const isEditingVideo = videoEditor.key === exampleKey;
                        const isUploadingVideo = uploadingVideoKey === exampleKey;
                        const videoValue = normalizeExampleVideo(ex);
                        const hasVideo = Boolean(videoValue);
                        const uploadError = videoUploadErrors[exampleKey] || "";

                        return (
                          <div
                            key={exampleKey}
                            className="space-y-2 border-l-2 border-orange-200 pl-3"
                          >
                            <input
                              type="text"
                              value={ex.sentence}
                              onChange={(e) =>
                                updateExample(
                                  mIdx,
                                  eIdx,
                                  "sentence",
                                  e.target.value
                                )
                              }
                              placeholder={`Exemplo ${eIdx + 1} em inglês`}
                              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />

                            <input
                              type="text"
                              value={ex.translation}
                              onChange={(e) =>
                                updateExample(
                                  mIdx,
                                  eIdx,
                                  "translation",
                                  e.target.value
                                )
                              }
                              placeholder="Tradução em português"
                              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />

                            <div className="rounded-lg border border-border/70 bg-background px-2.5 py-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Vídeo do exemplo
                                </span>

                                {hasVideo ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Vídeo anexado
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">
                                    Sem vídeo
                                  </span>
                                )}
                              </div>

                              {hasVideo && !isEditingVideo ? (
                                <>
                                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                                    {getExampleVideoDisplayLabel(videoValue)}
                                  </p>
                                  <ExampleVideoPreview video={videoValue} />
                                </>
                              ) : null}

                              {isEditingVideo ? (
                                <div className="mt-2 space-y-2">
                                  <textarea
                                    value={videoEditor.value}
                                    onChange={(e) =>
                                      setVideoEditor((current) => ({
                                        ...current,
                                        value: e.target.value,
                                      }))
                                    }
                                    placeholder="Cole o link do vídeo, iframe/embed completo ou BBCode"
                                    rows={4}
                                    spellCheck={false}
                                    className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-xs transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                                  />

                                  <p className="text-[10px] leading-snug text-muted-foreground">
                                    Aceita URL simples, vídeo direto, Supabase,
                                    YouTube, Vimeo, Google Drive, Yarn,
                                    Clip.Cafe, iframe/embed e BBCode.
                                  </p>

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => saveExampleVideo(mIdx, eIdx)}
                                      disabled={!videoEditor.value.trim()}
                                      className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                                    >
                                      {hasVideo ? "Salvar vídeo" : "Anexar vídeo"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={closeVideoEditor}
                                      className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openVideoEditor(mIdx, eIdx, videoValue)
                                    }
                                    className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
                                  >
                                    {hasVideo ? "Trocar vídeo" : "Adicionar vídeo"}
                                  </button>

                                  <input
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    ref={(element) => {
                                      if (element) {
                                        fileInputsRef.current[exampleKey] = element;
                                      }
                                    }}
                                    onChange={(event) =>
                                      void handleVideoFileSelected(mIdx, eIdx, event)
                                    }
                                  />

                                  <button
                                    type="button"
                                    onClick={() => triggerVideoFilePicker(exampleKey)}
                                    disabled={isUploadingVideo}
                                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                  >
                                    <Upload className="h-3 w-3" />
                                    {isUploadingVideo
                                      ? "Enviando..."
                                      : hasVideo
                                      ? "Trocar por upload"
                                      : "Enviar arquivo"}
                                  </button>

                                  {hasVideo ? (
                                    <button
                                      type="button"
                                      onClick={() => removeExampleVideo(mIdx, eIdx)}
                                      className="rounded-lg border border-destructive/40 px-2.5 py-1.5 text-[11px] font-semibold text-destructive transition-colors hover:bg-red-50"
                                    >
                                      Remover vídeo
                                    </button>
                                  ) : null}
                                </div>
                              )}

                              {uploadError ? (
                                <p className="mt-1.5 text-[11px] text-destructive">
                                  {uploadError}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !term.trim() || Boolean(uploadingVideoKey)}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}