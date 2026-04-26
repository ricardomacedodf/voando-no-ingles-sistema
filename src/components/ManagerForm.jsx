import { useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Hash,
  Languages,
  Lightbulb,
  Play,
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

const emptyExample = { sentence: "", translation: "", video: "", thumbnail: "" };

const emptyMeaning = {
  meaning: "",
  category: "vocabulário",
  tip: "",
  examples: [{ ...emptyExample }],
};

const meaningAccentPalette = [
  {
    bar: "#EF4444",
    soft: "rgba(239, 68, 68, 0.08)",
    border: "rgba(239, 68, 68, 0.24)",
  },
  {
    bar: "#14B8A6",
    soft: "rgba(20, 184, 166, 0.08)",
    border: "rgba(20, 184, 166, 0.24)",
  },
  {
    bar: "#F59E0B",
    soft: "rgba(245, 158, 11, 0.09)",
    border: "rgba(245, 158, 11, 0.26)",
  },
  {
    bar: "#3B82F6",
    soft: "rgba(59, 130, 246, 0.08)",
    border: "rgba(59, 130, 246, 0.24)",
  },
  {
    bar: "#8B5CF6",
    soft: "rgba(139, 92, 246, 0.08)",
    border: "rgba(139, 92, 246, 0.24)",
  },
  {
    bar: "#EC4899",
    soft: "rgba(236, 72, 153, 0.08)",
    border: "rgba(236, 72, 153, 0.24)",
  },
];

const emptyMeaningAccent = {
  bar: "#B91C1C",
  border: "rgba(239, 68, 68, 0.55)",
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

const normalizeExampleText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeExampleVideo = (example) => {
  const rawVideo =
    example?.video ?? example?.videoUrl ?? example?.video_url ?? "";

  return typeof rawVideo === "string" ? rawVideo.trim() : "";
};

const normalizeExampleThumbnail = (example) => {
  const rawThumbnail =
    example?.thumbnail ??
    example?.thumbnailUrl ??
    example?.thumbnail_url ??
    "";

  return typeof rawThumbnail === "string" ? rawThumbnail.trim() : "";
};

const hasExampleContent = (example) => {
  const sentence = normalizeExampleText(example?.sentence);
  const translation = normalizeExampleText(example?.translation);
  const video = normalizeExampleVideo(example);

  return Boolean(sentence || translation || video);
};

const createVideoThumbnailFromFile = async (file) =>
  new Promise((resolve) => {
    if (!file || typeof window === "undefined") {
      resolve("");
      return;
    }

    let settled = false;
    let objectUrl = "";
    let timer = null;

    const video = document.createElement("video");

    const finish = (value = "") => {
      if (settled) return;

      settled = true;

      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }

      try {
        video.pause();
        video.removeAttribute("src");
        video.load?.();

        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }

        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      } catch {
        // noop
      }

      resolve(value);
    };

    const drawFrame = () => {
      if (settled) return;

      try {
        const sourceWidth = video.videoWidth || 640;
        const sourceHeight = video.videoHeight || 360;

        if (!sourceWidth || !sourceHeight) {
          finish("");
          return;
        }

        const maxWidth = 560;
        const ratio = sourceHeight / sourceWidth;
        const canvasWidth = Math.min(maxWidth, sourceWidth);
        const canvasHeight = Math.max(1, Math.round(canvasWidth * ratio));

        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const context = canvas.getContext("2d");

        if (!context) {
          finish("");
          return;
        }

        context.drawImage(video, 0, 0, canvasWidth, canvasHeight);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        finish(dataUrl);
      } catch {
        finish("");
      }
    };

    const seekToMiddleFrame = () => {
      if (settled) return;

      const duration =
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : 0;

      if (!duration) {
        window.requestAnimationFrame(drawFrame);
        return;
      }

      const targetTime =
        duration > 1
          ? Math.min(Math.max(0.15, duration * 0.5), duration - 0.1)
          : 0.15;

      try {
        video.currentTime = targetTime;
      } catch {
        window.requestAnimationFrame(drawFrame);
      }
    };

    try {
      objectUrl = URL.createObjectURL(file);

      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.src = objectUrl;

      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");

      video.style.position = "fixed";
      video.style.left = "-9999px";
      video.style.top = "-9999px";
      video.style.width = "1px";
      video.style.height = "1px";
      video.style.opacity = "0";
      video.style.pointerEvents = "none";

      document.body.appendChild(video);

      timer = window.setTimeout(() => {
        finish("");
      }, 9000);

      video.addEventListener("loadedmetadata", seekToMiddleFrame, {
        once: true,
      });

      video.addEventListener(
        "seeked",
        () => {
          window.requestAnimationFrame(drawFrame);
        },
        { once: true }
      );

      video.addEventListener(
        "loadeddata",
        () => {
          if (
            !settled &&
            (!Number.isFinite(video.duration) || video.duration <= 0)
          ) {
            window.requestAnimationFrame(drawFrame);
          }
        },
        { once: true }
      );

      video.addEventListener(
        "error",
        () => {
          finish("");
        },
        { once: true }
      );

      video.load();
    } catch {
      finish("");
    }
  });

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

function MeaningLanguageLabel() {
  return (
    <label
      className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-foreground"
      aria-label="Significado em português"
    >
      <Languages className="h-4 w-4 text-primary" />
      <BrFlagIcon />
      <span className="sr-only">Significado em português</span>
    </label>
  );
}

function ExampleLanguageLabel({ flag, code }) {
  return (
    <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-foreground">
      {flag}
      <span className="font-bold text-[#14181F]">Sig.</span>
      <span className="font-normal text-[#6A7181]">—</span>
      <span className="font-bold text-[#14181F]">{code}</span>
    </label>
  );
}

function ExampleVideoPreview({ video, thumbnail, isActive, onPlay }) {
  if (!video) return null;

  const thumbnailSrc = typeof thumbnail === "string" ? thumbnail.trim() : "";

  if (isActive) {
    return (
      <div className="aspect-video overflow-hidden rounded-xl bg-black shadow-[0_10px_22px_rgba(15,23,42,0.12)]">
        <ExampleVideoPlayer
          video={video}
          autoPlay
          layout="compact"
          controlsMode="compact"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      className={[
        "group relative aspect-video w-full overflow-hidden rounded-xl border border-[#D9E2EC]",
        "bg-[#F8FAFC] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_18px_rgba(15,23,42,0.06)]",
        "transition-all duration-200 hover:border-[#ED9A0A]/70 hover:shadow-[0_12px_24px_rgba(15,23,42,0.10)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED9A0A]/35 focus-visible:ring-offset-2",
      ].join(" ")}
      aria-label="Reproduzir vídeo do exemplo"
      title="Reproduzir vídeo do exemplo"
    >
      {thumbnailSrc ? (
        <img
          src={thumbnailSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(237,154,10,0.18),transparent_32%),linear-gradient(135deg,#F8FAFC_0%,#EFF4F8_55%,#E6EDF5_100%)]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10" />
      <div className="absolute inset-0 bg-black/10 transition-colors duration-200 group-hover:bg-black/6" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={[
            "flex h-11 w-11 items-center justify-center rounded-full",
            "border border-white/70 bg-white/55",
            "shadow-[0_12px_24px_rgba(15,23,42,0.18),inset_0_1px_1px_rgba(255,255,255,0.75)]",
            "backdrop-blur-md transition-all duration-200",
            "group-hover:scale-105 group-hover:bg-white/72",
          ].join(" ")}
        >
          <Play className="ml-[2px] h-[18px] w-[18px] fill-[#ED9A0A] text-[#ED9A0A] stroke-[2.2]" />
        </div>
      </div>
    </button>
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
                  thumbnail: normalizeExampleThumbnail(e),
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
          meaning?.examples?.length > 0
            ? meaning.examples
            : [{ ...emptyExample }];

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
  const [activeVideoPreviewKey, setActiveVideoPreviewKey] = useState(null);

  const resetActiveVideoPreview = () => {
    setActiveVideoPreviewKey(null);
  };

  const toggleMeaningExpanded = (idx) => {
    resetActiveVideoPreview();

    setExpandedMeanings((current) => ({
      ...current,
      [idx]: !current[idx],
    }));
  };

  const toggleExampleExpanded = (mIdx, eIdx) => {
    const key = getExampleKey(mIdx, eIdx);

    resetActiveVideoPreview();

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

  const updateExampleFields = (mIdx, eIdx, fields) => {
    const updated = [...meanings];
    const examples = [...updated[mIdx].examples];

    examples[eIdx] = {
      ...examples[eIdx],
      ...fields,
    };

    updated[mIdx] = {
      ...updated[mIdx],
      examples,
    };

    setMeanings(updated);
  };

  const addMeaning = () => {
    const nextIndex = meanings.length;

    resetActiveVideoPreview();

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
      [nextIndex]: false,
    }));

    setExpandedExamples((current) => ({
      ...current,
      [getExampleKey(nextIndex, 0)]: false,
    }));
  };

  const removeMeaning = async (idx) => {
    if (meanings.length <= 1) return;

    resetActiveVideoPreview();

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

    resetActiveVideoPreview();

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

    resetActiveVideoPreview();

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

    resetActiveVideoPreview();

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

    resetActiveVideoPreview();

    try {
      setDeletingVideoKey(key);
      setVideoUploadErrors((current) => ({ ...current, [key]: "" }));

      if (oldVideoValue && oldVideoValue !== trimmedVideo) {
        await deleteExampleVideoFromR2(oldVideoValue);
      }

      updateExampleFields(mIdx, eIdx, {
        video: trimmedVideo,
        thumbnail: "",
      });

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

    resetActiveVideoPreview();

    try {
      setDeletingVideoKey(key);
      setVideoUploadErrors((current) => ({ ...current, [key]: "" }));

      if (videoValue) {
        await deleteExampleVideoFromR2(videoValue);
      }

      updateExampleFields(mIdx, eIdx, {
        video: "",
        thumbnail: "",
      });

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

    resetActiveVideoPreview();

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

      const [uploadedVideoUrl, generatedThumbnail] = await Promise.all([
        uploadExampleVideoFile(file),
        createVideoThumbnailFromFile(file),
      ]);

      updateExampleFields(mIdx, eIdx, {
        video: uploadedVideoUrl,
        thumbnail: generatedThumbnail || "",
      });

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
            .map((e) => {
              const video = normalizeExampleVideo(e);

              return {
                sentence: normalizeExampleText(e?.sentence),
                translation: normalizeExampleText(e?.translation),
                video,
                thumbnail: video ? normalizeExampleThumbnail(e) : "",
              };
            })
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
        type="button"
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
              const isMeaningEmpty = !meaningTitle;
              const meaningDisplayTitle = meaningTitle || "Significado vazio";
              const isDeletingMeaning = deletingVideoKey === `meaning-${mIdx}`;
              const meaningAccent =
                meaningAccentPalette[mIdx % meaningAccentPalette.length];
              const meaningBorderColor = isMeaningEmpty
                ? emptyMeaningAccent.border
                : meaningAccent.border;

              return (
                <div
                  key={mIdx}
                  className="overflow-hidden rounded-2xl border bg-white shadow-[0_10px_26px_rgba(15,23,42,0.05)]"
                  style={{ borderColor: meaningBorderColor }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleMeaningExpanded(mIdx)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleMeaningExpanded(mIdx);
                      }
                    }}
                    className="flex cursor-pointer items-stretch justify-between gap-4 border-b border-border/70 bg-white px-5 py-4 transition-colors hover:bg-[#F8FAFC]"
                    style={{ borderColor: meaningBorderColor }}
                    aria-expanded={isExpanded}
                  >
                    <div className="min-w-0 flex flex-1 items-center gap-2 text-left">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}

                      <span className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-snug">
                        <span className="shrink-0 text-sm font-normal text-[#6A7181]">
                          Sig.
                        </span>

                        <span className="shrink-0 text-sm font-normal text-[#6A7181]">
                          —
                        </span>

                        <span
                          className="min-w-0 break-words text-base font-bold leading-snug"
                          style={{
                            color: isMeaningEmpty
                              ? emptyMeaningAccent.bar
                              : "#14181F",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {meaningDisplayTitle}
                        </span>
                      </span>
                    </div>

                    {meanings.length > 1 ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeMeaning(mIdx);
                        }}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                        }}
                        disabled={isDeletingMeaning}
                        className="self-center rounded-lg p-1.5 transition-colors hover:bg-red-50 disabled:opacity-50"
                        aria-label={`Remover significado ${mIdx + 1}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    ) : null}
                  </div>

                  {isExpanded ? (
                    <div className="space-y-4 p-4">
                      <div className="rounded-xl border border-[#DCE4EE] bg-white p-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span
                            className="font-bold"
                            style={{
                              color: isMeaningEmpty
                                ? emptyMeaningAccent.bar
                                : meaningAccent.bar,
                            }}
                          >
                            {mIdx + 1}.
                          </span>

                          <span
                            className="text-base font-bold"
                            style={{
                              color: isMeaningEmpty
                                ? emptyMeaningAccent.bar
                                : "#181818",
                            }}
                          >
                            {meaningDisplayTitle}
                          </span>

                          <span className="rounded-full bg-[#EEF2F7] px-2 py-0.5 text-[10px] font-semibold text-[#64748B]">
                            {m.category}
                          </span>
                        </div>

                        <div className="border-l-2 border-[#CBD5E1] pl-4">
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                            <div>
                              <MeaningLanguageLabel />

                              <input
                                type="text"
                                value={m.meaning}
                                onChange={(e) =>
                                  updateMeaning(mIdx, "meaning", e.target.value)
                                }
                                placeholder="Significado em português"
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                name={`meaning-field-${mIdx}`}
                                inputMode="text"
                                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-[#181818] transition-all placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </div>

                            <div>
                              <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-foreground">
                                <Hash className="h-3.5 w-3.5 text-primary" />
                                <span>Tag</span>
                              </label>

                              <select
                                value={m.category}
                                onChange={(e) =>
                                  updateMeaning(
                                    mIdx,
                                    "category",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                              >
                                {categories.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#DCE4EE] bg-white p-4">
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
                            const thumbnailValue =
                              normalizeExampleThumbnail(ex);
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
                            const isPreviewActive =
                              activeVideoPreviewKey === exampleKey;
                            const exampleTitle =
                              normalizeExampleText(ex?.sentence) ||
                              "ainda sem frase";

                            return (
                              <div
                                key={exampleKey}
                                className="overflow-hidden rounded-xl border border-[#DCE4EE] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)]"
                              >
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() =>
                                    toggleExampleExpanded(mIdx, eIdx)
                                  }
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" ||
                                      event.key === " "
                                    ) {
                                      event.preventDefault();
                                      toggleExampleExpanded(mIdx, eIdx);
                                    }
                                  }}
                                  className="flex cursor-pointer items-stretch justify-between gap-3 border-b border-[#E2E8F0] bg-white px-4 py-3"
                                  aria-expanded={isExampleExpanded}
                                >
                                  <div className="min-w-0 flex flex-1 items-center gap-2 text-left">
                                    <Lightbulb className="h-4 w-4 shrink-0 text-[#ED9A0A]" />

                                    <span className="shrink-0 text-sm font-normal text-[#6A7181]">
                                      Exemplo:
                                    </span>

                                    <span
                                      className="shrink-0 text-sm font-bold"
                                      style={{ color: meaningAccent.bar }}
                                    >
                                      {eIdx + 1}
                                    </span>

                                    <span className="shrink-0 text-sm font-normal text-[#6A7181]">
                                      —
                                    </span>

                                    <span
                                      className="min-w-0 truncate text-sm font-bold text-[#14181F]"
                                      title={exampleTitle}
                                    >
                                      {exampleTitle}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void removeExample(mIdx, eIdx);
                                    }}
                                    onKeyDown={(event) => {
                                      event.stopPropagation();
                                    }}
                                    disabled={isDeletingVideo}
                                    className="self-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive disabled:opacity-50"
                                    aria-label={`Remover exemplo ${eIdx + 1}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>

                                {isExampleExpanded ? (
                                  <div className="p-4">
                                    <div
                                      className={
                                        hasVideo && !isEditingVideo
                                          ? "grid gap-4 md:grid-cols-[minmax(0,1fr)_190px]"
                                          : "grid gap-4"
                                      }
                                    >
                                      <div className="border-l-2 border-[#CBD5E1] pl-4">
                                        <div className="grid gap-3">
                                          <div>
                                            <ExampleLanguageLabel
                                              flag={<UsFlagIcon />}
                                              code="EN-US"
                                            />

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
                                              className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-[#758195] transition-all placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                          </div>

                                          <div>
                                            <ExampleLanguageLabel
                                              flag={<BrFlagIcon />}
                                              code="PT-BR"
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
                                              className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-[#758195] transition-all placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      {hasVideo && !isEditingVideo ? (
                                        <div className="self-start pt-[28px]">
                                          <ExampleVideoPreview
                                            video={videoValue}
                                            thumbnail={thumbnailValue}
                                            isActive={isPreviewActive}
                                            onPlay={() =>
                                              setActiveVideoPreviewKey(
                                                exampleKey
                                              )
                                            }
                                          />
                                        </div>
                                      ) : null}
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
                                        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
                                          {getExampleVideoDisplayLabel(
                                            videoValue
                                          )}
                                        </p>
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

                        <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
                            <Lightbulb className="h-3.5 w-3.5 text-[#ED9A0A]" />
                            Modo de uso
                          </div>

                          <input
                            type="text"
                            value={m.tip}
                            onChange={(e) =>
                              updateMeaning(mIdx, "tip", e.target.value)
                            }
                            placeholder="Explique como esse significado é usado no contexto"
                            className="w-full border-0 bg-transparent p-0 text-xs italic text-[#6A7181] placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0"
                          />
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
          type="button"
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