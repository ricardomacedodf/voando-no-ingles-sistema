import { useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Hash,
  Languages,
  Lightbulb,
  Plus,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import ExampleVideoPlayer from "@/components/ExampleVideoPlayer";
import { getExampleVideoDisplayLabel } from "@/lib/exampleVideoStorage";
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
  examples: [{ ...emptyExample }],
};

const MAX_VIDEO_UPLOAD_BYTES = 200 * 1024 * 1024;
const VIDEO_MIME_PREFIX = "video/";

const getExampleKey = (mIdx, eIdx) => `${mIdx}-${eIdx}`;

const getR2UploadApiUrl = () => {
  const customUrl = import.meta.env.VITE_R2_UPLOAD_API_URL;

  if (customUrl) return customUrl;

  const isLocalVite =
    typeof window !== "undefined" &&
    window.location.hostname === "localhost" &&
    window.location.port === "5173";

  if (isLocalVite) {
    return "http://localhost:3000/api/upload";
  }

  return "/api/upload";
};

const getR2DeleteApiUrl = () => {
  const customUrl = import.meta.env.VITE_R2_DELETE_API_URL;

  if (customUrl) return customUrl;

  const isLocalVite =
    typeof window !== "undefined" &&
    window.location.hostname === "localhost" &&
    window.location.port === "5173";

  if (isLocalVite) {
    return "http://localhost:3000/api/delete-video";
  }

  return "/api/delete-video";
};

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

const uploadExampleVideoFile = async (file) => {
  const contentType = file.type || "video/mp4";

  const prepareResponse = await fetch(getR2UploadApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType,
      size: file.size,
    }),
  });

  let prepareData = null;

  try {
    prepareData = await prepareResponse.json();
  } catch {
    prepareData = null;
  }

  if (
    !prepareResponse.ok ||
    !prepareData?.uploadUrl ||
    !prepareData?.publicUrl
  ) {
    throw new Error(
      prepareData?.error || "Não foi possível preparar o upload para o R2."
    );
  }

  const uploadResponse = await fetch(prepareData.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Não foi possível enviar o vídeo para o Cloudflare R2.");
  }

  return prepareData.publicUrl;
};

const deleteExampleVideoFromR2 = async (videoUrl) => {
  const cleanVideoUrl = typeof videoUrl === "string" ? videoUrl.trim() : "";

  if (!cleanVideoUrl) {
    return {
      deleted: false,
      skipped: true,
    };
  }

  const deleteResponse = await fetch(getR2DeleteApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      videoUrl: cleanVideoUrl,
    }),
  });

  let deleteData = null;

  try {
    deleteData = await deleteResponse.json();
  } catch {
    deleteData = null;
  }

  if (!deleteResponse.ok) {
    throw new Error(
      deleteData?.error || "Não foi possível apagar o vídeo do Cloudflare R2."
    );
  }

  return deleteData;
};

function UsFlagIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 36 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="36" height="24" rx="4" fill="#ffffff" />
      <path
        fill="#D22F27"
        d="M0 0h36v3H0V0Zm0 6h36v3H0V6Zm0 6h36v3H0v-3Zm0 6h36v3H0v-3Z"
      />
      <rect width="16" height="12" rx="3" fill="#234B9B" />
      <circle cx="4" cy="3" r="0.8" fill="#ffffff" />
      <circle cx="8" cy="3" r="0.8" fill="#ffffff" />
      <circle cx="12" cy="3" r="0.8" fill="#ffffff" />
      <circle cx="6" cy="6" r="0.8" fill="#ffffff" />
      <circle cx="10" cy="6" r="0.8" fill="#ffffff" />
      <circle cx="4" cy="9" r="0.8" fill="#ffffff" />
      <circle cx="8" cy="9" r="0.8" fill="#ffffff" />
      <circle cx="12" cy="9" r="0.8" fill="#ffffff" />
    </svg>
  );
}

function BrFlagIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 36 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="36" height="24" rx="4" fill="#229E45" />
      <path d="M18 4 31 12 18 20 5 12 18 4Z" fill="#F8D34B" />
      <circle cx="18" cy="12" r="5" fill="#234B9B" />
      <path
        d="M13.5 11.4c3.5-.9 6.8-.5 9.3 1.2"
        stroke="#ffffff"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FieldLabel({ children, icon }) {
  return (
    <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-foreground">
      {icon}
      <span>{children}</span>
    </label>
  );
}

function ExampleVideoPreview({ video }) {
  if (!video) return null;

  return (
    <div className="mt-2 aspect-video overflow-hidden rounded-xl bg-black">
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
              : [{ ...emptyExample }],
        }))
      : [{ ...emptyMeaning }]
  );

  const [expandedMeanings, setExpandedMeanings] = useState(() => {
    if (item?.meanings?.length > 0) {
      return Object.fromEntries(
        item.meanings.map((_, index) => [index, false])
      );
    }

    return { 0: true };
  });

  const [expandedExamples, setExpandedExamples] = useState(() => {
    if (item?.meanings?.length > 0) {
      return item.meanings.reduce((acc, meaning, meaningIndex) => {
        const examples =
          meaning?.examples?.length > 0 ? meaning.examples : [{ ...emptyExample }];

        examples.forEach((_, exampleIndex) => {
          acc[getExampleKey(meaningIndex, exampleIndex)] = false;
        });

        return acc;
      }, {});
    }

    return {
      [getExampleKey(0, 0)]: true,
    };
  });

  const [saving, setSaving] = useState(false);
  const [videoEditor, setVideoEditor] = useState({ key: null, value: "" });
  const [uploadingVideoKey, setUploadingVideoKey] = useState(null);
  const [deletingVideoKey, setDeletingVideoKey] = useState(null);
  const [videoUploadErrors, setVideoUploadErrors] = useState({});

  const toggleMeaningExpanded = (idx) => {
    setExpandedMeanings((current) => ({
      ...current,
      [idx]: !current[idx],
    }));
  };

  const toggleExampleExpanded = (mIdx, eIdx) => {
    const key = getExampleKey(mIdx, eIdx);

    setExpandedExamples((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const updateMeaning = (idx, field, value) => {
    const updated = [...meanings];

    updated[idx] = {
      ...updated[idx],
      [field]: value,
    };

    setMeanings(updated);
  };

  const updateExample = (mIdx, eIdx, field, value) => {
    const updated = [...meanings];
    const examples = [...updated[mIdx].examples];

    examples[eIdx] = {
      ...examples[eIdx],
      [field]: value,
    };

    updated[mIdx] = {
      ...updated[mIdx],
      examples,
    };

    setMeanings(updated);
  };

  const addMeaning = () => {
    const nextIndex = meanings.length;

    setMeanings([
      ...meanings,
      {
        meaning: "",
        category: "vocabulário",
        tip: "",
        examples: [{ ...emptyExample }],
      },
    ]);

    setExpandedMeanings((current) => ({
      ...current,
      [nextIndex]: true,
    }));

    setExpandedExamples((current) => ({
      ...current,
      [getExampleKey(nextIndex, 0)]: true,
    }));
  };

  const removeMeaning = async (idx) => {
    if (meanings.length <= 1) return;

    const videosToDelete = meanings[idx].examples
      .map((example) => normalizeExampleVideo(example))
      .filter(Boolean);

    const meaningDeleteKey = `meaning-${idx}`;

    try {
      setDeletingVideoKey(meaningDeleteKey);

      for (const videoUrl of videosToDelete) {
        await deleteExampleVideoFromR2(videoUrl);
      }

      setMeanings(meanings.filter((_, i) => i !== idx));

      setExpandedMeanings((current) => {
        const next = {};

        meanings.forEach((_, currentIndex) => {
          if (currentIndex === idx) return;

          const newIndex = currentIndex > idx ? currentIndex - 1 : currentIndex;
          next[newIndex] = Boolean(current[currentIndex]);
        });

        return next;
      });

      setExpandedExamples((current) => {
        const next = {};

        meanings.forEach((meaning, currentMeaningIndex) => {
          if (currentMeaningIndex === idx) return;

          const newMeaningIndex =
            currentMeaningIndex > idx
              ? currentMeaningIndex - 1
              : currentMeaningIndex;

          meaning.examples.forEach((_, exampleIndex) => {
            const oldKey = getExampleKey(currentMeaningIndex, exampleIndex);
            const newKey = getExampleKey(newMeaningIndex, exampleIndex);

            next[newKey] = Boolean(current[oldKey]);
          });
        });

        return next;
      });

      setVideoEditor((current) => {
        if (current.key === null) return current;

        const [meaningIdx] = current.key.split("-").map(Number);
        return meaningIdx === idx ? { key: null, value: "" } : current;
      });
    } catch (error) {
      console.error("Erro ao apagar vídeos do significado no R2:", error);
      alert(
        error?.message ||
          "Não foi possível apagar os vídeos deste significado no Cloudflare R2."
      );
    } finally {
      setDeletingVideoKey((current) =>
        current === meaningDeleteKey ? null : current
      );
    }
  };

  const addExample = (mIdx) => {
    const updated = [...meanings];
    const nextExampleIndex = updated[mIdx].examples.length;

    updated[mIdx] = {
      ...updated[mIdx],
      examples: [...updated[mIdx].examples, { ...emptyExample }],
    };

    setMeanings(updated);

    setExpandedExamples((current) => ({
      ...current,
      [getExampleKey(mIdx, nextExampleIndex)]: true,
    }));
  };

  const removeExample = async (mIdx, eIdx) => {
    const key = getExampleKey(mIdx, eIdx);
    const videoValue = normalizeExampleVideo(meanings[mIdx]?.examples?.[eIdx]);

    try {
      setDeletingVideoKey(key);
      setVideoUploadErrors((current) => ({ ...current, [key]: "" }));

      if (videoValue) {
        await deleteExampleVideoFromR2(videoValue);
      }

      const updated = [...meanings];

      updated[mIdx] = {
        ...updated[mIdx],
        examples: updated[mIdx].examples.filter((_, index) => index !== eIdx),
      };

      setMeanings(updated);

      setExpandedExamples((current) => {
        const next = {};

        Object.entries(current).forEach(([currentKey, value]) => {
          const [meaningIdx, exampleIdx] = currentKey.split("-").map(Number);

          if (Number.isNaN(meaningIdx) || Number.isNaN(exampleIdx)) return;

          if (meaningIdx !== mIdx) {
            next[currentKey] = value;
            return;
          }

          if (exampleIdx === eIdx) return;

          const nextExampleIdx =
            exampleIdx > eIdx ? exampleIdx - 1 : exampleIdx;

          next[getExampleKey(mIdx, nextExampleIdx)] = value;
        });

        return next;
      });

      setVideoEditor((current) => {
        if (current.key === null) return current;

        const [meaningIdx, exampleIdx] = current.key.split("-").map(Number);

        if (meaningIdx === mIdx && exampleIdx >= eIdx) {
          return { key: null, value: "" };
        }

        return current;
      });
    } catch (error) {
      console.error("Erro ao apagar vídeo do exemplo no R2:", error);

      setVideoUploadErrors((current) => ({
        ...current,
        [key]:
          error?.message ||
          "Não foi possível apagar o vídeo deste exemplo no Cloudflare R2.",
      }));
    } finally {
      setDeletingVideoKey((current) => (current === key ? null : current));
    }
  };

  const openVideoEditor = (mIdx, eIdx, currentVideo) => {
    const key = getExampleKey(mIdx, eIdx);

    setVideoEditor({
      key,
      value: typeof currentVideo === "string" ? currentVideo : "",
    });

    setExpandedExamples((current) => ({
      ...current,
      [key]: true,
    }));
  };

  const closeVideoEditor = () => {
    setVideoEditor({ key: null, value: "" });
  };

  const saveExampleVideo = async (mIdx, eIdx) => {
    const key = getExampleKey(mIdx, eIdx);
    const oldVideoValue = normalizeExampleVideo(meanings[mIdx]?.examples?.[eIdx]);
    const trimmedVideo = videoEditor.value.trim();

    try {
      setDeletingVideoKey(key);
      setVideoUploadErrors((current) => ({ ...current, [key]: "" }));

      if (oldVideoValue && oldVideoValue !== trimmedVideo) {
        await deleteExampleVideoFromR2(oldVideoValue);
      }

      updateExample(mIdx, eIdx, "video", trimmedVideo);
      closeVideoEditor();
    } catch (error) {
      console.error("Erro ao trocar vídeo do exemplo:", error);

      setVideoUploadErrors((current) => ({
        ...current,
        [key]:
          error?.message ||
          "Não foi possível trocar o vídeo anterior no Cloudflare R2.",
      }));
    } finally {
      setDeletingVideoKey((current) => (current === key ? null : current));
    }
  };

  const removeExampleVideo = async (mIdx, eIdx) => {
    const key = getExampleKey(mIdx, eIdx);
    const videoValue = normalizeExampleVideo(meanings[mIdx]?.examples?.[eIdx]);

    try {
      setDeletingVideoKey(key);
      setVideoUploadErrors((current) => ({ ...current, [key]: "" }));

      if (videoValue) {
        await deleteExampleVideoFromR2(videoValue);
      }

      updateExample(mIdx, eIdx, "video", "");

      setVideoEditor((current) =>
        current.key === key ? { key: null, value: "" } : current
      );
    } catch (error) {
      console.error("Erro ao remover vídeo do exemplo:", error);

      setVideoUploadErrors((current) => ({
        ...current,
        [key]:
          error?.message ||
          "Não foi possível apagar este vídeo no Cloudflare R2.",
      }));
    } finally {
      setDeletingVideoKey((current) => (current === key ? null : current));
    }
  };

  const triggerVideoFilePicker = (exampleKey) => {
    const input = fileInputsRef.current[exampleKey];

    if (input) input.click();
  };

  const handleVideoFileSelected = async (mIdx, eIdx, event) => {
    const inputElement = event?.target;
    const file = inputElement?.files?.[0];

    if (inputElement) {
      inputElement.value = "";
    }

    if (!file) return;

    const key = getExampleKey(mIdx, eIdx);
    const oldVideoValue = normalizeExampleVideo(meanings[mIdx]?.examples?.[eIdx]);

    if (!user?.id) {
      alert("Usuário não identificado.");
      return;
    }

    const fileType = String(file.type || "").toLowerCase();
    const hasVideoMime = fileType.startsWith(VIDEO_MIME_PREFIX);
    const hasVideoExtension = /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name);

    if (!hasVideoMime && !hasVideoExtension) {
      setVideoUploadErrors((current) => ({
        ...current,
        [key]: "Arquivo inválido. Selecione um vídeo válido.",
      }));
      return;
    }

    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      setVideoUploadErrors((current) => ({
        ...current,
        [key]: "Vídeo muito grande. Limite máximo: 200 MB.",
      }));
      return;
    }

    try {
      setUploadingVideoKey(key);
      setVideoUploadErrors((current) => ({ ...current, [key]: "" }));

      const uploadedVideoUrl = await uploadExampleVideoFile(file);

      updateExample(mIdx, eIdx, "video", uploadedVideoUrl);

      setVideoEditor((current) =>
        current.key === key ? { ...current, value: uploadedVideoUrl } : current
      );

      if (oldVideoValue && oldVideoValue !== uploadedVideoUrl) {
        try {
          await deleteExampleVideoFromR2(oldVideoValue);
        } catch (deleteError) {
          console.warn(
            "Novo vídeo enviado, mas o vídeo anterior não foi apagado:",
            deleteError
          );

          setVideoUploadErrors((current) => ({
            ...current,
            [key]:
              "Novo vídeo enviado, mas não foi possível apagar o vídeo anterior do R2.",
          }));
        }
      }
    } catch (error) {
      console.error("Erro ao enviar vídeo do exemplo para o R2:", error);

      setVideoUploadErrors((current) => ({
        ...current,
        [key]:
          error?.message ||
          "Não foi possível enviar o vídeo para o Cloudflare R2.",
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
    <div className="mx-auto max-w-5xl">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <h1 className="mb-6 text-3xl font-bold tracking-tight text-foreground">
        {item ? "Editar palavra ou frase" : "Nova palavra ou frase"}
      </h1>

      <div className="space-y-5">
        <div>
          <FieldLabel icon={<UsFlagIcon />}>
            Palavra ou frase em inglês
          </FieldLabel>

          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm transition-all placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Ex: break down"
          />

          <div className="mt-2 flex items-center gap-1.5 pl-0 text-sm italic text-[#6A7181]">
            <Volume2 className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">Pronúncia:</span>

            <input
              type="text"
              value={pronunciation}
              onChange={(e) => setPronunciation(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm italic text-[#6A7181] placeholder:text-[#6A7181]/60 focus:outline-none focus:ring-0"
              placeholder="Ex: breik daun"
            />
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">
              Significados
            </label>

            <button
              type="button"
              onClick={addMeaning}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
            >
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>

          <div className="space-y-4">
            {meanings.map((m, mIdx) => {
              const isExpanded = Boolean(expandedMeanings[mIdx]);
              const meaningTitle = m.meaning.trim();
              const isDeletingMeaning = deletingVideoKey === `meaning-${mIdx}`;

              return (
                <div
                  key={mIdx}
                  className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4 border-b border-border/70 bg-primary/5 px-5 py-3">
                    <button
                      type="button"
                      onClick={() => toggleMeaningExpanded(mIdx)}
                      className="min-w-0 flex flex-1 items-center gap-2 text-left"
                      aria-expanded={isExpanded}
                    >
                      <span className="shrink-0 text-base font-bold text-foreground">
                        Significado {mIdx + 1}
                      </span>

                      {meaningTitle ? (
                        <span className="min-w-0 truncate text-base font-bold text-primary">
                          — {meaningTitle}
                        </span>
                      ) : (
                        <span className="min-w-0 truncate text-sm font-semibold text-muted-foreground">
                          — ainda sem nome
                        </span>
                      )}
                    </button>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {meanings.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => void removeMeaning(mIdx)}
                          disabled={isDeletingMeaning}
                          className="rounded-lg p-1.5 transition-colors hover:bg-red-50 disabled:opacity-50"
                          aria-label={`Remover significado ${mIdx + 1}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => toggleMeaningExpanded(mIdx)}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                        aria-label={
                          isExpanded
                            ? `Recolher significado ${mIdx + 1}`
                            : `Expandir significado ${mIdx + 1}`
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="space-y-4 p-5">
                      <div>
                        <FieldLabel
                          icon={<Languages className="h-4 w-4 text-primary" />}
                        >
                          Significado em português
                        </FieldLabel>

                        <input
                          type="text"
                          value={m.meaning}
                          onChange={(e) =>
                            updateMeaning(mIdx, "meaning", e.target.value)
                          }
                          placeholder="Significado em português"
                          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-all placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="pt-1">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">
                            Exemplos
                          </span>

                          <button
                            type="button"
                            onClick={() => addExample(mIdx)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted"
                          >
                            <Plus className="h-3.5 w-3.5 text-primary" />
                            Adicionar exemplo
                          </button>
                        </div>

                        <div className="space-y-3">
                          {m.examples.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border bg-background/70 p-4 text-center text-sm font-semibold text-muted-foreground">
                              Nenhum exemplo adicionado ainda.
                            </div>
                          ) : null}

                          {m.examples.map((ex, eIdx) => {
                            const exampleKey = getExampleKey(mIdx, eIdx);
                            const isEditingVideo =
                              videoEditor.key === exampleKey;
                            const videoValue = normalizeExampleVideo(ex);
                            const hasVideo = Boolean(videoValue);
                            const isExampleExpanded = Boolean(
                              expandedExamples[exampleKey]
                            );
                            const isUploadingVideo =
                              uploadingVideoKey === exampleKey;
                            const isDeletingVideo =
                              deletingVideoKey === exampleKey;
                            const videoUploadError =
                              videoUploadErrors[exampleKey] || "";

                            return (
                              <div
                                key={exampleKey}
                                className="overflow-hidden rounded-2xl border border-border/70 bg-background/70 shadow-sm"
                              >
                                <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleExampleExpanded(mIdx, eIdx)
                                    }
                                    className="min-w-0 flex flex-1 items-center gap-2 text-left"
                                    aria-expanded={isExampleExpanded}
                                  >
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">
                                      {eIdx + 1}
                                    </div>

                                    <span className="truncate text-sm font-bold text-foreground">
                                      Exemplo {eIdx + 1}
                                    </span>
                                  </button>

                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void removeExample(mIdx, eIdx)
                                      }
                                      disabled={isDeletingVideo}
                                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive disabled:opacity-50"
                                      aria-label={`Remover exemplo ${eIdx + 1}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleExampleExpanded(mIdx, eIdx)
                                      }
                                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                                      aria-label={
                                        isExampleExpanded
                                          ? `Recolher exemplo ${eIdx + 1}`
                                          : `Expandir exemplo ${eIdx + 1}`
                                      }
                                    >
                                      {isExampleExpanded ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {isExampleExpanded ? (
                                  <div className="p-4">
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <div>
                                        <FieldLabel icon={<UsFlagIcon />}>
                                          Exemplo em inglês
                                        </FieldLabel>

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
                                          placeholder={`Exemplo ${
                                            eIdx + 1
                                          } em inglês`}
                                          className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs transition-all placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                      </div>

                                      <div>
                                        <FieldLabel icon={<BrFlagIcon />}>
                                          Tradução em português
                                        </FieldLabel>

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
                                          className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs transition-all placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                      </div>
                                    </div>

                                    <div className="mt-3 rounded-xl border border-border bg-card px-3.5 py-3">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
                                          Vídeo do exemplo
                                        </span>

                                        {hasVideo ? (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Vídeo anexado
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-medium text-muted-foreground">
                                            Sem vídeo
                                          </span>
                                        )}
                                      </div>

                                      {hasVideo && !isEditingVideo ? (
                                        <>
                                          <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
                                            {getExampleVideoDisplayLabel(
                                              videoValue
                                            )}
                                          </p>

                                          <ExampleVideoPreview
                                            video={videoValue}
                                          />
                                        </>
                                      ) : null}

                                      {isEditingVideo ? (
                                        <div className="mt-3 space-y-2">
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
                                            className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                          />

                                          <p className="text-[10px] leading-snug text-muted-foreground">
                                            Aceita URL simples, vídeo direto,
                                            Cloudflare R2, Supabase, YouTube,
                                            Vimeo, Google Drive, Yarn,
                                            Clip.Cafe, iframe/embed e BBCode.
                                          </p>

                                          <div className="flex flex-wrap gap-2">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                void saveExampleVideo(mIdx, eIdx)
                                              }
                                              disabled={
                                                !videoEditor.value.trim() ||
                                                isDeletingVideo
                                              }
                                              className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                                            >
                                              {isDeletingVideo
                                                ? "Salvando..."
                                                : hasVideo
                                                ? "Salvar vídeo"
                                                : "Anexar vídeo"}
                                            </button>

                                            <button
                                              type="button"
                                              onClick={closeVideoEditor}
                                              disabled={isDeletingVideo}
                                              className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                            >
                                              Cancelar
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openVideoEditor(
                                                mIdx,
                                                eIdx,
                                                videoValue
                                              )
                                            }
                                            disabled={isDeletingVideo}
                                            className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                          >
                                            {hasVideo
                                              ? "Trocar vídeo"
                                              : "Adicionar vídeo"}
                                          </button>

                                          <input
                                            type="file"
                                            accept="video/*"
                                            className="hidden"
                                            ref={(element) => {
                                              if (element) {
                                                fileInputsRef.current[
                                                  exampleKey
                                                ] = element;
                                              }
                                            }}
                                            onChange={(event) =>
                                              void handleVideoFileSelected(
                                                mIdx,
                                                eIdx,
                                                event
                                              )
                                            }
                                          />

                                          <button
                                            type="button"
                                            onClick={() =>
                                              triggerVideoFilePicker(exampleKey)
                                            }
                                            disabled={
                                              isUploadingVideo || isDeletingVideo
                                            }
                                            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                          >
                                            <Upload className="h-3 w-3" />
                                            {isUploadingVideo
                                              ? "Enviando para R2..."
                                              : hasVideo
                                              ? "Trocar por upload"
                                              : "Enviar arquivo"}
                                          </button>

                                          {hasVideo ? (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                void removeExampleVideo(
                                                  mIdx,
                                                  eIdx
                                                )
                                              }
                                              disabled={isDeletingVideo}
                                              className="rounded-lg border border-destructive/40 px-3 py-1.5 text-[11px] font-bold text-destructive transition-colors hover:bg-red-50 disabled:opacity-50"
                                            >
                                              {isDeletingVideo
                                                ? "Removendo..."
                                                : "Remover vídeo"}
                                            </button>
                                          ) : null}
                                        </div>
                                      )}

                                      {videoUploadError ? (
                                        <p className="mt-2 text-[11px] font-medium text-destructive">
                                          {videoUploadError}
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-3 grid gap-3 rounded-2xl border border-border/70 bg-background/80 p-3.5 md:grid-cols-[220px_1fr] md:items-start">
                          <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
                              <Hash className="h-3.5 w-3.5 text-primary" />
                              Tag
                            </label>

                            <select
                              value={m.category}
                              onChange={(e) =>
                                updateMeaning(mIdx, "category", e.target.value)
                              }
                              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              {categories.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="min-w-0 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2">
                            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
                              <Lightbulb className="h-3.5 w-3.5 text-primary" />
                              Modo de uso
                            </div>

                            <input
                              type="text"
                              value={m.tip}
                              onChange={(e) =>
                                updateMeaning(mIdx, "tip", e.target.value)
                              }
                              placeholder="Explique como esse significado é usado no contexto"
                              className="w-full border-0 bg-transparent p-0 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !term.trim()}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}