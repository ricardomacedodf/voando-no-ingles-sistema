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

const MAX_VIDEO_UPLOAD_BYTES = 200 * 1024 * 1024;
const VIDEO_MIME_PREFIX = "video/";
const WORD_VIDEO_KEY = "word-video";

const emptyExample = {
  sentence: "",
  translation: "",
  video: "",
  thumbnail: "",
};

const emptyMeaning = {
  meaning: "",
  category: "vocabulário",
  tip: "",
  video: "",
  thumbnail: "",
  examples: [{ ...emptyExample }],
};

const meaningAccentPalette = [
  { bar: "#EF4444", border: "rgba(239, 68, 68, 0.24)" },
  { bar: "#14B8A6", border: "rgba(20, 184, 166, 0.24)" },
  { bar: "#F59E0B", border: "rgba(245, 158, 11, 0.26)" },
  { bar: "#3B82F6", border: "rgba(59, 130, 246, 0.24)" },
  { bar: "#8B5CF6", border: "rgba(139, 92, 246, 0.24)" },
  { bar: "#EC4899", border: "rgba(236, 72, 153, 0.24)" },
];

const emptyMeaningAccent = {
  bar: "#B91C1C",
  border: "rgba(239, 68, 68, 0.55)",
};

const getExampleKey = (mIdx, eIdx) => `${mIdx}-${eIdx}`;
const getMeaningVideoKey = (mIdx) => `meaning-${mIdx}`;

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeExampleText = (value) =>
  typeof value === "string" ? value.trim() : "";

const getDefaultStats = () => ({
  correct: 0,
  incorrect: 0,
  total_reviews: 0,
  avg_response_time: 0,
  status: "nova",
});

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

const getWordVideoFromMeanings = (item) => {
  if (!Array.isArray(item?.meanings)) return "";

  const meaningWithVideo = item.meanings.find((meaning) =>
    normalizeText(meaning?._wordVideo || meaning?._globalVideo)
  );

  return normalizeText(
    meaningWithVideo?._wordVideo || meaningWithVideo?._globalVideo || ""
  );
};

const getWordThumbnailFromMeanings = (item) => {
  if (!Array.isArray(item?.meanings)) return "";

  const meaningWithThumbnail = item.meanings.find((meaning) =>
    normalizeText(meaning?._wordThumbnail || meaning?._globalThumbnail)
  );

  return normalizeText(
    meaningWithThumbnail?._wordThumbnail ||
      meaningWithThumbnail?._globalThumbnail ||
      ""
  );
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
    getWordVideoFromMeanings(item) ??
    "";

  return normalizeText(rawVideo);
};

const normalizeWordThumbnail = (item) => {
  const rawThumbnail =
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
    getWordThumbnailFromMeanings(item) ??
    "";

  return normalizeText(rawThumbnail);
};

const normalizeMeaningVideo = (meaning) => {
  const rawVideo =
    meaning?.video ??
    meaning?.videoUrl ??
    meaning?.video_url ??
    meaning?.meaningVideo ??
    meaning?.meaning_video ??
    "";

  return normalizeText(rawVideo);
};

const normalizeMeaningThumbnail = (meaning) => {
  const rawThumbnail =
    meaning?.thumbnail ??
    meaning?.thumbnailUrl ??
    meaning?.thumbnail_url ??
    meaning?.meaningThumbnail ??
    meaning?.meaning_thumbnail ??
    "";

  return normalizeText(rawThumbnail);
};

const normalizeExampleVideo = (example) => {
  const rawVideo =
    example?.video ?? example?.videoUrl ?? example?.video_url ?? "";

  return normalizeText(rawVideo);
};

const normalizeExampleThumbnail = (example) => {
  const rawThumbnail =
    example?.thumbnail ??
    example?.thumbnailUrl ??
    example?.thumbnail_url ??
    "";

  return normalizeText(rawThumbnail);
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
        finish(canvas.toDataURL("image/jpeg", 0.82));
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

const uploadVideoFileToR2 = async (file, scope = "example") => {
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
      scope,
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

const deleteVideoFromR2 = async (videoUrl) => {
  const cleanVideoUrl = normalizeText(videoUrl);

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

  const thumbnailSrc = normalizeText(thumbnail);

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
      className="group relative aspect-video w-full overflow-hidden rounded-xl border border-[#D9E2EC] bg-[#F8FAFC] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_18px_rgba(15,23,42,0.06)] transition-all duration-200 hover:border-[#ED9A0A]/70 hover:shadow-[0_12px_24px_rgba(15,23,42,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED9A0A]/35 focus-visible:ring-offset-2"
      aria-label="Reproduzir vídeo"
      title="Reproduzir vídeo"
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
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/55 shadow-[0_12px_24px_rgba(15,23,42,0.18),inset_0_1px_1px_rgba(255,255,255,0.75)] backdrop-blur-md transition-all duration-200 group-hover:scale-105 group-hover:bg-white/72">
          <Play className="ml-[2px] h-[18px] w-[18px] fill-[#ED9A0A] text-[#ED9A0A] stroke-[2.2]" />
        </div>
      </div>
    </button>
  );
}

function VideoControlCard({
  title,
  description,
  emptyLabel,
  video,
  thumbnail,
  isEditing,
  editorValue,
  uploadError,
  isUploading,
  isDeleting,
  isPreviewActive,
  onPlay,
  onOpenEditor,
  onEditorChange,
  onSave,
  onCancel,
  onTriggerUpload,
  onRemove,
  fileInputRef,
  onFileChange,
  uploadButtonText,
}) {
  const hasVideo = Boolean(video);

  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
            {title}
          </span>

          {description ? (
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        {hasVideo ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            <CheckCircle2 className="h-3 w-3" />
            Vídeo anexado
          </span>
        ) : (
          <span className="text-[10px] font-medium text-muted-foreground">
            {emptyLabel}
          </span>
        )}
      </div>

      {hasVideo && !isEditing ? (
        <div className="mt-3 space-y-2">
          <p className="truncate text-[11px] text-muted-foreground">
            {getExampleVideoDisplayLabel(video)}
          </p>

          <ExampleVideoPreview
            video={video}
            thumbnail={thumbnail}
            isActive={isPreviewActive}
            onPlay={onPlay}
          />
        </div>
      ) : null}

      {isEditing ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={editorValue}
            onChange={(e) => onEditorChange(e.target.value)}
            placeholder="Cole o link do vídeo, iframe/embed completo ou BBCode"
            rows={4}
            spellCheck={false}
            className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={!editorValue.trim() || isDeleting}
              className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isDeleting
                ? "Salvando..."
                : hasVideo
                ? "Salvar vídeo"
                : "Anexar vídeo"}
            </button>

            <button
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
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
            onClick={onOpenEditor}
            disabled={isDeleting}
            className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {hasVideo ? "Trocar vídeo" : "Adicionar vídeo"}
          </button>

          <input
            type="file"
            accept="video/*"
            className="hidden"
            ref={fileInputRef}
            onChange={onFileChange}
          />

          <button
            type="button"
            onClick={onTriggerUpload}
            disabled={isUploading || isDeleting}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Upload className="h-3 w-3" />
            {isUploading ? "Enviando para R2..." : uploadButtonText}
          </button>

          {hasVideo ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={isDeleting}
              className="rounded-lg border border-destructive/40 px-3 py-1.5 text-[11px] font-bold text-destructive transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {isDeleting ? "Removendo..." : "Remover vídeo"}
            </button>
          ) : null}
        </div>
      )}

      {uploadError ? (
        <p className="mt-2 text-[11px] font-medium text-destructive">
          {uploadError}
        </p>
      ) : null}
    </div>
  );
}

export default function ManagerForm({ item, onBack, onSaved }) {
  const { user } = useAuth();
  const fileInputsRef = useRef({});

  const [term, setTerm] = useState(item?.term || "");
  const [pronunciation, setPronunciation] = useState(item?.pronunciation || "");
  const [wordVideo, setWordVideo] = useState(normalizeWordVideo(item));
  const [wordThumbnail, setWordThumbnail] = useState(
    normalizeWordThumbnail(item)
  );

  const [meanings, setMeanings] = useState(
    item?.meanings?.length > 0
      ? item.meanings.map((m) => ({
          meaning: m.meaning || "",
          category: m.category || "vocabulário",
          tip: m.tip || "",
          video: normalizeMeaningVideo(m),
          thumbnail: normalizeMeaningThumbnail(m),
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

  const setVideoError = (key, message = "") => {
    setVideoUploadErrors((current) => ({ ...current, [key]: message }));
  };

  const toggleMeaningExpanded = (idx) => {
    resetActiveVideoPreview();
    setExpandedMeanings((current) => ({ ...current, [idx]: !current[idx] }));
  };

  const toggleExampleExpanded = (mIdx, eIdx) => {
    const key = getExampleKey(mIdx, eIdx);
    resetActiveVideoPreview();
    setExpandedExamples((current) => ({ ...current, [key]: !current[key] }));
  };

  const updateMeaning = (idx, field, value) => {
    const updated = [...meanings];
    updated[idx] = { ...updated[idx], [field]: value };
    setMeanings(updated);
  };

  const updateMeaningFields = (idx, fields) => {
    const updated = [...meanings];
    updated[idx] = { ...updated[idx], ...fields };
    setMeanings(updated);
  };

  const updateExample = (mIdx, eIdx, field, value) => {
    const updated = [...meanings];
    const examples = [...updated[mIdx].examples];
    examples[eIdx] = { ...examples[eIdx], [field]: value };
    updated[mIdx] = { ...updated[mIdx], examples };
    setMeanings(updated);
  };

  const updateExampleFields = (mIdx, eIdx, fields) => {
    const updated = [...meanings];
    const examples = [...updated[mIdx].examples];
    examples[eIdx] = { ...examples[eIdx], ...fields };
    updated[mIdx] = { ...updated[mIdx], examples };
    setMeanings(updated);
  };

  const addMeaning = () => {
    const nextIndex = meanings.length;
    resetActiveVideoPreview();
    setMeanings([...meanings, { ...emptyMeaning }]);
    setExpandedMeanings((current) => ({ ...current, [nextIndex]: true }));
    setExpandedExamples((current) => ({
      ...current,
      [getExampleKey(nextIndex, 0)]: true,
    }));
  };

  const removeMeaning = async (idx) => {
    if (meanings.length <= 1) return;

    const meaningVideo = normalizeMeaningVideo(meanings[idx]);
    const exampleVideos = meanings[idx].examples
      .map((example) => normalizeExampleVideo(example))
      .filter(Boolean);
    const videosToDelete = Array.from(
      new Set([meaningVideo, ...exampleVideos].filter(Boolean))
    );

    try {
      setDeletingVideoKey(`meaning-${idx}`);

      for (const videoUrl of videosToDelete) {
        await deleteVideoFromR2(videoUrl);
      }

      setMeanings((current) => current.filter((_, index) => index !== idx));
      setExpandedMeanings((current) => {
        const next = {};

        Object.entries(current).forEach(([key, value]) => {
          const currentIndex = Number(key);
          if (currentIndex === idx) return;
          const nextIndex = currentIndex > idx ? currentIndex - 1 : currentIndex;
          next[nextIndex] = value;
        });

        return next;
      });
      setExpandedExamples({});
      setVideoEditor({ key: null, value: "" });
    } catch (error) {
      console.error("Erro ao apagar vídeos do significado no R2:", error);
      alert(
        error?.message ||
          "Não foi possível apagar os vídeos deste significado no Cloudflare R2."
      );
    } finally {
      setDeletingVideoKey(null);
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

    try {
      setDeletingVideoKey(key);
      setVideoError(key);

      if (videoValue) {
        await deleteVideoFromR2(videoValue);
      }

      const updated = [...meanings];
      updated[mIdx] = {
        ...updated[mIdx],
        examples: updated[mIdx].examples.filter((_, index) => index !== eIdx),
      };
      setMeanings(updated);
      setVideoEditor((current) =>
        current.key === key ? { key: null, value: "" } : current
      );
    } catch (error) {
      console.error("Erro ao apagar vídeo do exemplo no R2:", error);
      setVideoError(
        key,
        error?.message ||
          "Não foi possível apagar o vídeo deste exemplo no Cloudflare R2."
      );
    } finally {
      setDeletingVideoKey((current) => (current === key ? null : current));
    }
  };

  const openVideoEditor = (key, currentVideo = "") => {
    resetActiveVideoPreview();
    setVideoEditor({
      key,
      value: typeof currentVideo === "string" ? currentVideo : "",
    });
  };

  const closeVideoEditor = () => {
    setVideoEditor({ key: null, value: "" });
  };

  const saveVideoFromEditor = async ({ key, oldVideo, onSuccess }) => {
    const nextVideo = videoEditor.value.trim();

    try {
      setDeletingVideoKey(key);
      setVideoError(key);

      if (oldVideo && oldVideo !== nextVideo) {
        await deleteVideoFromR2(oldVideo);
      }

      onSuccess({ video: nextVideo, thumbnail: "" });
      closeVideoEditor();
    } catch (error) {
      console.error("Erro ao trocar vídeo:", error);
      setVideoError(
        key,
        error?.message || "Não foi possível trocar o vídeo anterior no R2."
      );
    } finally {
      setDeletingVideoKey((current) => (current === key ? null : current));
    }
  };

  const removeVideo = async ({ key, oldVideo, onSuccess }) => {
    try {
      setDeletingVideoKey(key);
      setVideoError(key);

      if (oldVideo) {
        await deleteVideoFromR2(oldVideo);
      }

      onSuccess();
      setVideoEditor((current) =>
        current.key === key ? { key: null, value: "" } : current
      );
    } catch (error) {
      console.error("Erro ao remover vídeo:", error);
      setVideoError(
        key,
        error?.message || "Não foi possível apagar este vídeo no R2."
      );
    } finally {
      setDeletingVideoKey((current) => (current === key ? null : current));
    }
  };

  const validateVideoFile = (file, key) => {
    const fileType = String(file.type || "").toLowerCase();
    const hasVideoMime = fileType.startsWith(VIDEO_MIME_PREFIX);
    const hasVideoExtension = /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name);

    if (!hasVideoMime && !hasVideoExtension) {
      setVideoError(key, "Arquivo inválido. Selecione um vídeo válido.");
      return false;
    }

    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      setVideoError(key, "Vídeo muito grande. Limite máximo: 200 MB.");
      return false;
    }

    return true;
  };

  const triggerVideoFilePicker = (videoKey) => {
    const input = fileInputsRef.current[videoKey];
    if (input) input.click();
  };

  const handleVideoFileSelected = async ({
    key,
    file,
    scope,
    oldVideo,
    onSuccess,
  }) => {
    if (!file) return;

    if (!user?.id) {
      alert("Usuário não identificado.");
      return;
    }

    if (!validateVideoFile(file, key)) return;

    try {
      setUploadingVideoKey(key);
      setVideoError(key);

      const [uploadedVideoUrl, generatedThumbnail] = await Promise.all([
        uploadVideoFileToR2(file, scope),
        createVideoThumbnailFromFile(file),
      ]);

      onSuccess({
        video: uploadedVideoUrl,
        thumbnail: generatedThumbnail || "",
      });

      setVideoEditor((current) =>
        current.key === key ? { ...current, value: uploadedVideoUrl } : current
      );

      if (oldVideo && oldVideo !== uploadedVideoUrl) {
        try {
          await deleteVideoFromR2(oldVideo);
        } catch (deleteError) {
          console.warn(
            "Novo vídeo enviado, mas o vídeo anterior não foi apagado:",
            deleteError
          );

          setVideoError(
            key,
            "Novo vídeo enviado, mas não foi possível apagar o vídeo anterior do R2."
          );
        }
      }
    } catch (error) {
      console.error("Erro ao enviar vídeo para o R2:", error);
      setVideoError(
        key,
        error?.message || "Não foi possível enviar o vídeo para o Cloudflare R2."
      );
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
      const cleanWordVideo = normalizeText(wordVideo);
      const cleanWordThumbnail = cleanWordVideo
        ? normalizeText(wordThumbnail)
        : "";

      const cleanedMeanings = meanings
        .map((meaningItem) => {
          const meaningVideo = normalizeMeaningVideo(meaningItem);

          return {
            meaning: normalizeText(meaningItem.meaning),
            category: meaningItem.category,
            tip: normalizeText(meaningItem.tip),
            video: meaningVideo,
            thumbnail: meaningVideo
              ? normalizeMeaningThumbnail(meaningItem)
              : "",
            examples: meaningItem.examples
              .map((example) => {
                const video = normalizeExampleVideo(example);

                return {
                  sentence: normalizeExampleText(example?.sentence),
                  translation: normalizeExampleText(example?.translation),
                  video,
                  thumbnail: video ? normalizeExampleThumbnail(example) : "",
                };
              })
              .filter(hasExampleContent),
          };
        })
        .filter((meaningItem) => meaningItem.meaning)
        .map((meaningItem, index) => {
          if (index !== 0) return meaningItem;

          const {
            _wordVideo,
            _wordThumbnail,
            _globalVideo,
            _globalThumbnail,
            ...cleanMeaning
          } = meaningItem;

          if (!cleanWordVideo) return cleanMeaning;

          return {
            ...cleanMeaning,
            _wordVideo: cleanWordVideo,
            _wordThumbnail: cleanWordThumbnail,
          };
        });

      const stats = {
        ...(item?.stats || getDefaultStats()),
        wordVideo: cleanWordVideo,
        wordThumbnail: cleanWordThumbnail,
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

  const isEditingWordVideo = videoEditor.key === WORD_VIDEO_KEY;
  const isUploadingWordVideo = uploadingVideoKey === WORD_VIDEO_KEY;
  const isDeletingWordVideo = deletingVideoKey === WORD_VIDEO_KEY;
  const wordVideoUploadError = videoUploadErrors[WORD_VIDEO_KEY] || "";
  const isWordPreviewActive = activeVideoPreviewKey === WORD_VIDEO_KEY;

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
          <FieldLabel icon={<UsFlagIcon />}>Palavra ou frase em inglês</FieldLabel>

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
            {meanings.map((meaningItem, mIdx) => {
              const isExpanded = Boolean(expandedMeanings[mIdx]);
              const meaningTitle = normalizeText(meaningItem.meaning);
              const isMeaningEmpty = !meaningTitle;
              const meaningDisplayTitle = meaningTitle || "Significado vazio";
              const accent = meaningAccentPalette[mIdx % meaningAccentPalette.length];
              const borderColor = isMeaningEmpty
                ? emptyMeaningAccent.border
                : accent.border;
              const meaningVideoKey = getMeaningVideoKey(mIdx);
              const meaningVideoValue = normalizeMeaningVideo(meaningItem);
              const meaningThumbnailValue = normalizeMeaningThumbnail(meaningItem);
              const hasMeaningVideo = Boolean(meaningVideoValue);
              const isEditingMeaningVideo = videoEditor.key === meaningVideoKey;
              const isUploadingMeaningVideo = uploadingVideoKey === meaningVideoKey;
              const isDeletingMeaningVideo = deletingVideoKey === meaningVideoKey;
              const meaningVideoUploadError = videoUploadErrors[meaningVideoKey] || "";
              const isMeaningPreviewActive = activeVideoPreviewKey === meaningVideoKey;

              return (
                <div
                  key={mIdx}
                  className="overflow-hidden rounded-2xl border bg-white shadow-[0_10px_26px_rgba(15,23,42,0.05)]"
                  style={{ borderColor }}
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
                    style={{ borderColor }}
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
                            color: isMeaningEmpty ? emptyMeaningAccent.bar : "#14181F",
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
                        disabled={deletingVideoKey === `meaning-${mIdx}`}
                        className="self-center rounded-lg p-1.5 transition-colors hover:bg-red-50 disabled:opacity-50"
                        aria-label={`Remover significado ${mIdx + 1}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    ) : null}
                  </div>

                  {isExpanded ? (
                    <div className="space-y-4 p-4">
                      <div className="border-b border-[#D8E1EC] pb-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="font-bold" style={{ color: accent.bar }}>
                            {mIdx + 1}.
                          </span>
                          <span className="text-base font-bold text-[#181818]">
                            {meaningDisplayTitle}
                          </span>
                          <span className="rounded-full bg-[#EEF2F7] px-2 py-0.5 text-[10px] font-semibold text-[#64748B]">
                            {meaningItem.category}
                          </span>
                        </div>

                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                          <div>
                            <MeaningLanguageLabel />
                            <input
                              type="text"
                              value={meaningItem.meaning}
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
                              value={meaningItem.category}
                              onChange={(e) =>
                                updateMeaning(mIdx, "category", e.target.value)
                              }
                              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              {categories.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="mt-4">
                          <VideoControlCard
                            title="Vídeo geral do significado"
                            description="Esse vídeo vale para todos os exemplos deste significado que não tiverem vídeo próprio."
                            emptyLabel={
                              wordVideo
                                ? "Usando vídeo geral da palavra"
                                : "Sem vídeo geral"
                            }
                            video={meaningVideoValue}
                            thumbnail={meaningThumbnailValue}
                            isEditing={isEditingMeaningVideo}
                            editorValue={videoEditor.value}
                            uploadError={meaningVideoUploadError}
                            isUploading={isUploadingMeaningVideo}
                            isDeleting={isDeletingMeaningVideo}
                            isPreviewActive={isMeaningPreviewActive}
                            onPlay={() => setActiveVideoPreviewKey(meaningVideoKey)}
                            onOpenEditor={() =>
                              openVideoEditor(meaningVideoKey, meaningVideoValue)
                            }
                            onEditorChange={(value) =>
                              setVideoEditor((current) => ({ ...current, value }))
                            }
                            onSave={() =>
                              void saveVideoFromEditor({
                                key: meaningVideoKey,
                                oldVideo: meaningVideoValue,
                                onSuccess: ({ video, thumbnail }) =>
                                  updateMeaningFields(mIdx, { video, thumbnail }),
                              })
                            }
                            onCancel={closeVideoEditor}
                            onTriggerUpload={() => triggerVideoFilePicker(meaningVideoKey)}
                            onRemove={() =>
                              void removeVideo({
                                key: meaningVideoKey,
                                oldVideo: meaningVideoValue,
                                onSuccess: () =>
                                  updateMeaningFields(mIdx, { video: "", thumbnail: "" }),
                              })
                            }
                            fileInputRef={(element) => {
                              if (element) fileInputsRef.current[meaningVideoKey] = element;
                            }}
                            onFileChange={(event) => {
                              const inputElement = event?.target;
                              const file = inputElement?.files?.[0];
                              if (inputElement) inputElement.value = "";
                              void handleVideoFileSelected({
                                key: meaningVideoKey,
                                file,
                                scope: "meaning",
                                oldVideo: meaningVideoValue,
                                onSuccess: ({ video, thumbnail }) =>
                                  updateMeaningFields(mIdx, { video, thumbnail }),
                              });
                            }}
                            uploadButtonText={
                              hasMeaningVideo ? "Trocar por upload" : "Enviar arquivo"
                            }
                          />
                        </div>
                      </div>

                      <div>
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
                          {meaningItem.examples.map((example, eIdx) => {
                            const exampleKey = getExampleKey(mIdx, eIdx);
                            const isEditingVideo = videoEditor.key === exampleKey;
                            const videoValue = normalizeExampleVideo(example);
                            const thumbnailValue = normalizeExampleThumbnail(example);
                            const hasVideo = Boolean(videoValue);
                            const isExampleExpanded = Boolean(
                              expandedExamples[exampleKey]
                            );
                            const isUploadingVideo = uploadingVideoKey === exampleKey;
                            const isDeletingVideo = deletingVideoKey === exampleKey;
                            const videoUploadError = videoUploadErrors[exampleKey] || "";
                            const isPreviewActive =
                              activeVideoPreviewKey === exampleKey;
                            const exampleTitle =
                              normalizeExampleText(example?.sentence) || "ainda sem frase";

                            return (
                              <div
                                key={exampleKey}
                                className="overflow-hidden rounded-xl border border-[#DCE4EE] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)]"
                              >
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => toggleExampleExpanded(mIdx, eIdx)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
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
                                    <span className="shrink-0 text-sm font-bold" style={{ color: accent.bar }}>
                                      {eIdx + 1}
                                    </span>
                                    <span className="shrink-0 text-sm font-normal text-[#6A7181]">
                                      —
                                    </span>
                                    <span className="min-w-0 truncate text-sm font-bold text-[#14181F]" title={exampleTitle}>
                                      {exampleTitle}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void removeExample(mIdx, eIdx);
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
                                    <div className={hasVideo && !isEditingVideo ? "grid gap-4 md:grid-cols-[minmax(0,1fr)_190px]" : "grid gap-4"}>
                                      <div className="border-l-2 border-[#CBD5E1] pl-4">
                                        <div className="grid gap-3">
                                          <div>
                                            <ExampleLanguageLabel flag={<UsFlagIcon />} code="EN-US" />
                                            <input
                                              type="text"
                                              value={example.sentence}
                                              onChange={(e) =>
                                                updateExample(mIdx, eIdx, "sentence", e.target.value)
                                              }
                                              placeholder={`Exemplo ${eIdx + 1} em inglês`}
                                              className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-[#758195] transition-all placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                          </div>

                                          <div>
                                            <ExampleLanguageLabel flag={<BrFlagIcon />} code="PT-BR" />
                                            <input
                                              type="text"
                                              value={example.translation}
                                              onChange={(e) =>
                                                updateExample(mIdx, eIdx, "translation", e.target.value)
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
                                            onPlay={() => setActiveVideoPreviewKey(exampleKey)}
                                          />
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="mt-3">
                                      <VideoControlCard
                                        title="Vídeo do exemplo"
                                        description={
                                          hasMeaningVideo
                                            ? "Se este exemplo não tiver vídeo próprio, ele usa o vídeo geral do significado."
                                            : wordVideo
                                            ? "Se este exemplo não tiver vídeo próprio, ele usa o vídeo geral da palavra."
                                            : ""
                                        }
                                        emptyLabel={
                                          hasMeaningVideo
                                            ? "Usando vídeo geral do significado"
                                            : wordVideo
                                            ? "Usando vídeo geral da palavra"
                                            : "Sem vídeo"
                                        }
                                        video={videoValue}
                                        thumbnail={thumbnailValue}
                                        isEditing={isEditingVideo}
                                        editorValue={videoEditor.value}
                                        uploadError={videoUploadError}
                                        isUploading={isUploadingVideo}
                                        isDeleting={isDeletingVideo}
                                        isPreviewActive={isPreviewActive}
                                        onPlay={() => setActiveVideoPreviewKey(exampleKey)}
                                        onOpenEditor={() => openVideoEditor(exampleKey, videoValue)}
                                        onEditorChange={(value) =>
                                          setVideoEditor((current) => ({ ...current, value }))
                                        }
                                        onSave={() =>
                                          void saveVideoFromEditor({
                                            key: exampleKey,
                                            oldVideo: videoValue,
                                            onSuccess: ({ video, thumbnail }) =>
                                              updateExampleFields(mIdx, eIdx, { video, thumbnail }),
                                          })
                                        }
                                        onCancel={closeVideoEditor}
                                        onTriggerUpload={() => triggerVideoFilePicker(exampleKey)}
                                        onRemove={() =>
                                          void removeVideo({
                                            key: exampleKey,
                                            oldVideo: videoValue,
                                            onSuccess: () =>
                                              updateExampleFields(mIdx, eIdx, {
                                                video: "",
                                                thumbnail: "",
                                              }),
                                          })
                                        }
                                        fileInputRef={(element) => {
                                          if (element) fileInputsRef.current[exampleKey] = element;
                                        }}
                                        onFileChange={(event) => {
                                          const inputElement = event?.target;
                                          const file = inputElement?.files?.[0];
                                          if (inputElement) inputElement.value = "";
                                          void handleVideoFileSelected({
                                            key: exampleKey,
                                            file,
                                            scope: "example",
                                            oldVideo: videoValue,
                                            onSuccess: ({ video, thumbnail }) =>
                                              updateExampleFields(mIdx, eIdx, { video, thumbnail }),
                                          });
                                        }}
                                        uploadButtonText={hasVideo ? "Trocar por upload" : "Enviar arquivo"}
                                      />
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="border-t border-[#E2E8F0] pt-4">
                        <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
                          <Lightbulb className="h-3.5 w-3.5 text-[#ED9A0A]" />
                          Modo de uso
                        </label>

                        <input
                          type="text"
                          value={meaningItem.tip}
                          onChange={(e) => updateMeaning(mIdx, "tip", e.target.value)}
                          placeholder="Explique como esse significado é usado no contexto"
                          className="w-full border-0 border-b border-[#D8E1EC] bg-transparent px-0 pb-1 text-xs italic text-[#6A7181] placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-0"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
          <VideoControlCard
            title="Vídeo geral da palavra/frase"
            description="Esse vídeo será usado como padrão quando o exemplo e o significado não tiverem vídeo próprio."
            emptyLabel="Sem vídeo geral da palavra"
            video={wordVideo}
            thumbnail={wordThumbnail}
            isEditing={isEditingWordVideo}
            editorValue={videoEditor.value}
            uploadError={wordVideoUploadError}
            isUploading={isUploadingWordVideo}
            isDeleting={isDeletingWordVideo}
            isPreviewActive={isWordPreviewActive}
            onPlay={() => setActiveVideoPreviewKey(WORD_VIDEO_KEY)}
            onOpenEditor={() => openVideoEditor(WORD_VIDEO_KEY, wordVideo)}
            onEditorChange={(value) =>
              setVideoEditor((current) => ({ ...current, value }))
            }
            onSave={() =>
              void saveVideoFromEditor({
                key: WORD_VIDEO_KEY,
                oldVideo: wordVideo,
                onSuccess: ({ video, thumbnail }) => {
                  setWordVideo(video);
                  setWordThumbnail(thumbnail);
                },
              })
            }
            onCancel={closeVideoEditor}
            onTriggerUpload={() => triggerVideoFilePicker(WORD_VIDEO_KEY)}
            onRemove={() =>
              void removeVideo({
                key: WORD_VIDEO_KEY,
                oldVideo: wordVideo,
                onSuccess: () => {
                  setWordVideo("");
                  setWordThumbnail("");
                },
              })
            }
            fileInputRef={(element) => {
              if (element) fileInputsRef.current[WORD_VIDEO_KEY] = element;
            }}
            onFileChange={(event) => {
              const inputElement = event?.target;
              const file = inputElement?.files?.[0];
              if (inputElement) inputElement.value = "";
              void handleVideoFileSelected({
                key: WORD_VIDEO_KEY,
                file,
                scope: "word",
                oldVideo: wordVideo,
                onSuccess: ({ video, thumbnail }) => {
                  setWordVideo(video);
                  setWordThumbnail(thumbnail);
                },
              });
            }}
            uploadButtonText={wordVideo ? "Trocar por upload" : "Enviar arquivo"}
          />
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