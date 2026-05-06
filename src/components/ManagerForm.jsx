import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenText,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clapperboard,
  FileVideo,
  Hash,
  Languages,
  Layers3,
  Lightbulb,
  Link2,
  Loader2,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import ExampleVideoPlayer from "@/components/ExampleVideoPlayer";
import {
  getExampleVideoDisplayLabel,
  resolveExampleVideoThumbnail,
} from "@/lib/exampleVideoStorage";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { createInitialStats } from "../lib/learningEngine";

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
const NEW_WORD_VIDEO_KEY = `${WORD_VIDEO_KEY}-new`;
const getWordVideoKey = (index) => `${WORD_VIDEO_KEY}-${index}`;
// Third-party/embed only:
// Render larger and scale down to tune native control size,
// while keeping the preview fully filled and aligned.
const EMBED_PREVIEW_VISUAL_SCALE = 0.65;
const THUMBNAIL_CAPTURE_TIME_SECONDS = 1;
const THUMBNAIL_END_GUARD_SECONDS = 0.05;
const WORD_VIDEO_CONFLICT_MESSAGE =
  "Você já tem vídeo em um significado ou exemplo. Para usar vídeo geral da palavra/frase, remova primeiro os vídeos internos.";
const INTERNAL_VIDEO_CONFLICT_MESSAGE =
  "Você já tem vídeo geral na palavra/frase. Para adicionar vídeo em significado ou exemplo, remova primeiro o vídeo geral.";
const UNSAVED_CHANGES_CONFIRM_MESSAGE =
  "Existem alterações não salvas. Tem certeza que deseja sair sem salvar?";

const isVideoLayerConflictMessage = (message) =>
  message === WORD_VIDEO_CONFLICT_MESSAGE ||
  message === INTERNAL_VIDEO_CONFLICT_MESSAGE;

const emptyExample = {
  sentence: "",
  translation: "",
  video: "",
  thumbnail: "",
  exampleVideos: [],
};

const emptyMeaning = {
  meaning: "",
  category: "vocabulário",
  tip: "",
  video: "",
  thumbnail: "",
  meaningVideos: [],
  examples: [{ ...emptyExample }],
};

const meaningAccentPalette = [
  { bar: "#1D1D1F", border: "#E5E5EA" },
  { bar: "#4B5563", border: "#E5E5EA" },
  { bar: "#0071E3", border: "#D6E8FA" },
  { bar: "#6E6E73", border: "#E5E5EA" },
  { bar: "#3A3A3C", border: "#E5E5EA" },
  { bar: "#0A84FF", border: "#D6E8FA" },
];

const meaningAccentPaletteDark = [
  { bar: "#F5F5F7", border: "#2C2C2E" },
  { bar: "#D1D1D6", border: "#2C2C2E" },
  { bar: "#0A84FF", border: "#244B72" },
  { bar: "#AEAEB2", border: "#2C2C2E" },
  { bar: "#E5E5EA", border: "#2C2C2E" },
  { bar: "#64D2FF", border: "#244B72" },
];

const emptyMeaningAccent = {
  bar: "#B42318",
  border: "#F2D7D5",
};

const meaningAccentLowContrastPairs = new Set([
  "1-3",
  "3-1",
  "2-5",
  "5-2",
]);

const isMeaningAccentTooClose = (previousIndex, nextIndex) =>
  previousIndex === nextIndex ||
  meaningAccentLowContrastPairs.has(`${previousIndex}-${nextIndex}`);

const getMeaningAccentIndexes = (
  totalMeanings,
  paletteLength = meaningAccentPalette.length
) => {

  if (paletteLength === 0 || totalMeanings <= 0) return [];

  const indexes = [];

  for (let meaningIndex = 0; meaningIndex < totalMeanings; meaningIndex += 1) {
    let accentIndex = meaningIndex % paletteLength;

    if (meaningIndex > 0) {
      const previousAccentIndex = indexes[meaningIndex - 1];
      let attempts = 0;

      while (
        attempts < paletteLength &&
        isMeaningAccentTooClose(previousAccentIndex, accentIndex)
      ) {
        accentIndex = (accentIndex + 1) % paletteLength;
        attempts += 1;
      }
    }

    indexes.push(accentIndex);
  }

  return indexes;
};

const getExampleKey = (mIdx, eIdx) => `${mIdx}-${eIdx}`;
const getMeaningVideoKey = (mIdx, videoIndex = 0) =>
  `meaning-${mIdx}-${videoIndex}`;
const getNewMeaningVideoKey = (mIdx) => `meaning-${mIdx}-new`;
const getExampleVideoKey = (mIdx, eIdx, videoIndex = 0) =>
  `example-${mIdx}-${eIdx}-${videoIndex}`;
const getNewExampleVideoKey = (mIdx, eIdx) => `example-${mIdx}-${eIdx}-new`;

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeExampleText = (value) =>
  typeof value === "string" ? value.trim() : "";

const isWordVideoLayerKey = (key) => {
  const cleanKey = normalizeText(key);

  return (
    cleanKey === WORD_VIDEO_KEY ||
    cleanKey === NEW_WORD_VIDEO_KEY ||
    cleanKey.startsWith(`${WORD_VIDEO_KEY}-`)
  );
};

const isMeaningOrExampleVideoLayerKey = (key) => {
  const cleanKey = normalizeText(key);

  return (
    cleanKey.startsWith("meaning-") ||
    cleanKey.startsWith("example-") ||
    /^\d+-\d+$/.test(cleanKey)
  );
};

const getDefaultStats = () => ({
  ...createInitialStats(),
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

const normalizeVideoEntry = (entry, fallbackThumbnail = "") => {
  if (typeof entry === "string") {
    const video = normalizeText(entry);

    return video
      ? {
          video,
          thumbnail: normalizeText(fallbackThumbnail),
        }
      : null;
  }

  if (!entry || typeof entry !== "object") return null;

  const video = normalizeText(
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
    thumbnail: normalizeText(
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

const getWordVideosFromMeanings = (item) => {
  if (!Array.isArray(item?.meanings)) return [];

  const meaningWithVideos = item.meanings.find((meaning) => {
    const videos = normalizeVideoList(
      meaning?._wordVideos || meaning?._globalVideos,
      meaning?._wordThumbnail || meaning?._globalThumbnail
    );

    return videos.length > 0;
  });

  if (meaningWithVideos) {
    return normalizeVideoList(
      meaningWithVideos?._wordVideos || meaningWithVideos?._globalVideos,
      meaningWithVideos?._wordThumbnail || meaningWithVideos?._globalThumbnail
    );
  }

  const singleVideo = getWordVideoFromMeanings(item);
  const singleThumbnail = getWordThumbnailFromMeanings(item);

  return normalizeVideoList(singleVideo, singleThumbnail);
};

const normalizeWordVideos = (item) => {
  const fallbackThumbnail = normalizeWordThumbnail(item);

  return dedupeVideoEntries([
    ...normalizeVideoList(item?.wordVideos, fallbackThumbnail),
    ...normalizeVideoList(item?.word_videos, fallbackThumbnail),
    ...normalizeVideoList(item?.globalVideos, fallbackThumbnail),
    ...normalizeVideoList(item?.global_videos, fallbackThumbnail),
    ...normalizeVideoList(item?.stats?.wordVideos, fallbackThumbnail),
    ...normalizeVideoList(item?.stats?.word_videos, fallbackThumbnail),
    ...normalizeVideoList(item?.stats?.globalVideos, fallbackThumbnail),
    ...normalizeVideoList(item?.stats?.global_videos, fallbackThumbnail),
    ...getWordVideosFromMeanings(item),
    ...normalizeVideoList(normalizeWordVideo(item), fallbackThumbnail),
  ]);
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

const normalizeMeaningVideos = (meaning) => {
  const fallbackThumbnail = normalizeMeaningThumbnail(meaning);

  return dedupeVideoEntries([
    ...normalizeVideoList(meaning?.meaningVideos, fallbackThumbnail),
    ...normalizeVideoList(meaning?.meaning_videos, fallbackThumbnail),
    ...normalizeVideoList(normalizeMeaningVideo(meaning), fallbackThumbnail),
  ]);
};

const normalizeExampleVideo = (example) => {
  const rawVideo =
    example?.video ?? example?.videoUrl ?? example?.video_url ?? "";

  return normalizeText(rawVideo);
};

const normalizeExampleThumbnail = (example) => {
  const rawThumbnail =
    example?.thumbnail ?? example?.thumbnailUrl ?? example?.thumbnail_url ?? "";

  return normalizeText(rawThumbnail);
};

const normalizeExampleVideos = (example) => {
  const fallbackThumbnail = normalizeExampleThumbnail(example);

  return dedupeVideoEntries([
    ...normalizeVideoList(example?.exampleVideos, fallbackThumbnail),
    ...normalizeVideoList(example?.example_videos, fallbackThumbnail),
    ...normalizeVideoList(normalizeExampleVideo(example), fallbackThumbnail),
  ]).slice(0, 1);
};

const extractIframeSrc = (value) => {
  const cleanValue = normalizeText(value);

  if (!cleanValue) return "";

  const match = cleanValue.match(/<iframe[^>]+src=["']([^"']+)["']/i);

  return normalizeText(match?.[1] || "");
};

const getYouTubeVideoId = (value) => {
  const cleanValue = normalizeText(value);

  if (!cleanValue) return "";

  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/watch\?[^"'\s>]*v=([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/i,
  ];

  for (const pattern of patterns) {
    const match = cleanValue.match(pattern);

    if (match?.[1]) return match[1];
  }

  return "";
};

const getVimeoVideoId = (value) => {
  const cleanValue = normalizeText(value);

  if (!cleanValue) return "";

  const patterns = [
    /player\.vimeo\.com\/video\/(\d+)/i,
    /vimeo\.com\/video\/(\d+)/i,
    /vimeo\.com\/(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = cleanValue.match(pattern);

    if (match?.[1]) return match[1];
  }

  return "";
};

const getDailymotionVideoId = (value) => {
  const cleanValue = normalizeText(value);

  if (!cleanValue) return "";

  const patterns = [
    /dailymotion\.com\/video\/([a-zA-Z0-9]+)/i,
    /dailymotion\.com\/embed\/video\/([a-zA-Z0-9]+)/i,
    /dai\.ly\/([a-zA-Z0-9]+)/i,
  ];

  for (const pattern of patterns) {
    const match = cleanValue.match(pattern);

    if (match?.[1]) return match[1];
  }

  return "";
};

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

const shouldDeleteVideoFromR2 = (videoUrl) => {
  const cleanVideoUrl = normalizeText(videoUrl);

  return Boolean(cleanVideoUrl) && !isThirdPartyEmbeddedVideo(cleanVideoUrl);
};

const getThirdPartyEmbedSrc = (value) => {
  const cleanValue = normalizeText(value);

  if (!cleanValue) return "";

  const iframeSrc = extractIframeSrc(cleanValue);

  if (iframeSrc) return iframeSrc;

  const youtubeId = getYouTubeVideoId(cleanValue);

  if (youtubeId) {
    return `https://www.youtube.com/embed/${youtubeId}`;
  }

  const vimeoId = getVimeoVideoId(cleanValue);

  if (vimeoId) {
    return `https://player.vimeo.com/video/${vimeoId}`;
  }

  const dailymotionId = getDailymotionVideoId(cleanValue);

  if (dailymotionId) {
    return `https://www.dailymotion.com/embed/video/${dailymotionId}`;
  }

  if (/clip\.cafe|playphrase\.me|yarn\.co|y\.yarn\.co/i.test(cleanValue)) {
    const firstUrl = cleanValue.match(/https?:\/\/[^\s"'<>[\]]+/i)?.[0] || "";
    return normalizeText(firstUrl);
  }

  return "";
};

const getCompactThirdPartyEmbedSrc = (value) => {
  const embedSrc = getThirdPartyEmbedSrc(value);

  if (!embedSrc) return "";

  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "https://local";

    const url = new URL(embedSrc, base);

    url.searchParams.set("playsinline", "1");

    if (/youtube\.com|youtu\.be/i.test(url.hostname)) {
      url.searchParams.set("rel", "0");
    }

    return url.toString();
  } catch {
    if (embedSrc.includes("?")) {
      return `${embedSrc}&playsinline=1`;
    }

    return `${embedSrc}?playsinline=1`;
  }
};

const getEmbedPreviewTuning = (embedSrc) => {
  const cleanSrc = normalizeText(embedSrc);
  if (!cleanSrc) {
    return {
      visualScale: 1,
      containerOffsetXPercent: 0,
    };
  }

  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "https://local";
    const url = new URL(cleanSrc, base);
    const host = normalizeText(url.hostname).toLowerCase();

    if (/clip\.cafe/.test(host)) {
      return {
        visualScale: 0.525,
        containerOffsetXPercent: 1.5,
      };
    }

    if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|dai\.ly/.test(host)) {
      return {
        visualScale: EMBED_PREVIEW_VISUAL_SCALE,
        containerOffsetXPercent: 0,
      };
    }
  } catch {
    // keep default fallback
  }

  return {
    visualScale: 0.82,
    containerOffsetXPercent: 2,
  };
};

const hasExampleContent = (example) => {
  const sentence = normalizeExampleText(example?.sentence);
  const translation = normalizeExampleText(example?.translation);
  const video = normalizeExampleVideo(example);
  const videos = normalizeExampleVideos(example);

  return Boolean(sentence || translation || video || videos.length > 0);
};

const buildEditableDraftSnapshot = ({ term, pronunciation, wordVideos, meanings }) => {
  const cleanWordVideos = dedupeVideoEntries(
    (Array.isArray(wordVideos) ? wordVideos : [])
      .map((entry) => ({
        video: normalizeText(entry?.video),
        thumbnail: entry?.video ? normalizeText(entry?.thumbnail) : "",
      }))
      .filter((entry) => entry.video)
  );

  const firstCleanWordVideo = cleanWordVideos[0] || {
    video: "",
    thumbnail: "",
  };
  const cleanWordVideo = normalizeText(firstCleanWordVideo.video);
  const cleanWordThumbnail = cleanWordVideo
    ? normalizeText(firstCleanWordVideo.thumbnail)
    : "";

  const cleanedMeanings = (Array.isArray(meanings) ? meanings : [])
    .map((meaningItem) => {
      const cleanMeaningVideos = dedupeVideoEntries(
        normalizeMeaningVideos(meaningItem)
          .map((entry) => ({
            video: normalizeText(entry?.video),
            thumbnail: entry?.video ? normalizeText(entry?.thumbnail) : "",
          }))
          .filter((entry) => entry.video)
      );
      const firstCleanMeaningVideo = cleanMeaningVideos[0] || {
        video: "",
        thumbnail: "",
      };
      const meaningVideo = normalizeText(firstCleanMeaningVideo.video);
      const meaningThumbnail = meaningVideo
        ? normalizeText(firstCleanMeaningVideo.thumbnail)
        : "";

      return {
        meaning: normalizeText(meaningItem.meaning),
        category: meaningItem.category,
        tip: normalizeText(meaningItem.tip),
        video: meaningVideo,
        thumbnail: meaningThumbnail,
        meaningVideos: cleanMeaningVideos,
        examples: (Array.isArray(meaningItem.examples) ? meaningItem.examples : [])
          .map((example) => {
            const cleanExampleVideos = dedupeVideoEntries(
              normalizeExampleVideos(example)
                .map((entry) => ({
                  video: normalizeText(entry?.video),
                  thumbnail: entry?.video ? normalizeText(entry?.thumbnail) : "",
                }))
                .filter((entry) => entry.video)
            );
            const firstCleanExampleVideo = cleanExampleVideos[0] || {
              video: "",
              thumbnail: "",
            };
            const video = normalizeText(firstCleanExampleVideo.video);

            return {
              sentence: normalizeExampleText(example?.sentence),
              translation: normalizeExampleText(example?.translation),
              video,
              thumbnail: video ? normalizeText(firstCleanExampleVideo.thumbnail) : "",
              exampleVideos: cleanExampleVideos,
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
        _wordVideos,
        _globalVideo,
        _globalThumbnail,
        _globalVideos,
        ...cleanMeaning
      } = meaningItem;

      if (cleanWordVideos.length === 0) return cleanMeaning;

      return {
        ...cleanMeaning,
        _wordVideo: cleanWordVideo,
        _wordThumbnail: cleanWordThumbnail,
        _wordVideos: cleanWordVideos,
      };
    });

  return {
    term: normalizeText(term),
    pronunciation: normalizeText(pronunciation),
    cleanWordVideos,
    cleanWordVideo,
    cleanWordThumbnail,
    cleanedMeanings,
  };
};

const createEditableDraftSignature = (snapshot) =>
  JSON.stringify({
    term: snapshot.term,
    pronunciation: snapshot.pronunciation,
    wordVideos: snapshot.cleanWordVideos,
    meanings: snapshot.cleanedMeanings,
  });

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

    const getThumbnailCaptureTime = () => {
      const duration =
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : 0;

      if (!duration) return 0;

      const latestSafeTime = Math.max(0, duration - THUMBNAIL_END_GUARD_SECONDS);

      return Math.min(THUMBNAIL_CAPTURE_TIME_SECONDS, latestSafeTime);
    };

    const seekToThumbnailCaptureFrame = () => {
      if (settled) return;

      const targetTime = getThumbnailCaptureTime();

      if (targetTime <= 0) {
        window.requestAnimationFrame(drawFrame);
        return;
      }

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

      video.addEventListener("loadedmetadata", seekToThumbnailCaptureFrame, {
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

  if (!shouldDeleteVideoFromR2(cleanVideoUrl)) {
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
    <label className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-normal text-[#6E6E73] dark:text-[#A1A1A6]">
      {icon}
      <span>{children}</span>
    </label>
  );
}

function MeaningLanguageLabel({ compact = false }) {
  return (
    <label
      className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-normal text-[#6E6E73] dark:text-[#A1A1A6]"
      aria-label="Significado em português"
    >
      <Languages className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" />
      <BrFlagIcon />
      <span>{compact ? "Sig. PT-BR" : "Significado de palavra ou frase em português"}</span>
      <span className="sr-only">Significado em português</span>
    </label>
  );
}

function ExampleLanguageLabel({ flag, code }) {
  const isPortuguese = code === "PT-BR";
  const fullLabel = isPortuguese
    ? "Exemplo de frase em português"
    : "Exemplo de frase em inglês";
  const compactLabel = `Exemplo: ${code}`;

  return (
    <label className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-normal text-[#6E6E73] dark:text-[#A1A1A6]">
      <Languages className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" />
      {flag}
      <span className="hidden md:inline">{fullLabel}</span>
      <span className="md:hidden">{compactLabel}</span>
    </label>
  );
}

function VideoAttachmentGlyph({ className = "" }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M200 760H565M200 760C145 760 110 725 110 670V280C110 225 145 190 200 190H760C815 190 850 225 850 280V475"
        stroke="currentColor"
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M430 385C430 366 451 355 467 365L620 460C636 470 636 494 620 504L467 599C451 609 430 598 430 579Z"
        stroke="currentColor"
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M685 790L847 628C892 583 965 615 965 679C965 699 957 718 943 732L777 898C716 959 615 916 615 829C615 798 627 768 649 746L788 607C822 573 880 597 880 645C880 660 874 675 863 686L731 818"
        stroke="currentColor"
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VideoAttachedBadge({ className = "" }) {
  return (
    <span
      className={[
        "inline-flex h-8 w-8 shrink-0 items-center justify-center text-[#2E2E2D] transition-colors dark:text-[#D1D1D6]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Vídeo anexado"
    >
      <VideoAttachmentGlyph className="h-4 w-4" />
      <span className="sr-only">Vídeo anexado</span>
    </span>
  );
}

function StatusPill({
  children,
  icon,
  tone = "neutral",
  className = "",
}) {
  const toneClasses = {
    neutral:
      "border-[#E5E5EA] bg-[#F5F5F7] text-[#6E6E73] dark:border-[#2C2C2E] dark:bg-[#1C1C1E] dark:text-[#A1A1A6]",
    success:
      "border-[#D6E8FA] bg-[#F5FAFF] text-[#0066CC] dark:border-[#244B72] dark:bg-[#102235] dark:text-[#66B7FF]",
    warning:
      "border-[#E5E5EA] bg-[#FAFAFC] text-[#424245] dark:border-[#3A3A3C] dark:bg-[#1C1C1E] dark:text-[#D1D1D6]",
    danger:
      "border-[#F2D7D5] bg-[#FFF7F6] text-[#B42318] dark:border-[#5A2521] dark:bg-[#2B1513] dark:text-[#FF9F95]",
    info:
      "border-[#D6E8FA] bg-[#F5FAFF] text-[#0066CC] dark:border-[#244B72] dark:bg-[#102235] dark:text-[#66B7FF]",
  };

  return (
    <span
      className={[
        "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold leading-none",
        toneClasses[tone] || toneClasses.neutral,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}

function LayerRuleNotice({ children, tone = "warning" }) {
  return (
    <div
      className={[
        "flex gap-2 rounded-[18px] border px-3.5 py-3 text-xs leading-relaxed",
        tone === "warning"
          ? "border-[#E5E5EA] bg-[#FAFAFC] text-[#424245] dark:border-[#3A3A3C] dark:bg-[#1C1C1E] dark:text-[#D1D1D6]"
          : "border-[#D6E8FA] bg-[#F5FAFF] text-[#0066CC] dark:border-[#244B72] dark:bg-[#102235] dark:text-[#66B7FF]",
      ].join(" ")}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  icon,
  action,
  meta,
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#86868B] dark:text-[#8E8E93]">
            {icon}
            <span>{eyebrow}</span>
          </div>
        ) : null}

        <h2 className="text-xl font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] md:text-2xl">
          {title}
        </h2>

        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      {(action || meta) ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {meta}
          {action}
        </div>
      ) : null}
    </div>
  );
}

function SummaryMetric({ icon, label, value, tone = "neutral" }) {
  const toneClasses = {
    neutral: "bg-[#F5F5F7] text-[#1D1D1F] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]",
    success: "bg-[#F5F5F7] text-[#1D1D1F] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]",
    warning:
      "bg-[#F5F5F7] text-[#1D1D1F] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]",
    info: "bg-[#F5F5F7] text-[#1D1D1F] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]",
  };

  return (
    <div
      className={[
        "flex min-h-[72px] items-center gap-3 rounded-[22px] border border-transparent px-4 py-3 shadow-none ring-1 ring-black/[0.035] dark:ring-white/[0.07]",
        toneClasses[tone] || toneClasses.neutral,
      ].join(" ")}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0071E3] shadow-none ring-1 ring-black/[0.04] dark:bg-[#2C2C2E] dark:text-[#0A84FF] dark:ring-white/[0.06]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B] dark:text-[#A1A1A6]">
          {label}
        </span>
        <span className="block text-lg font-semibold leading-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
          {value}
        </span>
      </span>
    </div>
  );
}

function AppendVideoPanel({
  title,
  description,
  helperLabel,
  countLabel,
  isEditing,
  editorValue,
  uploadError,
  isUploading,
  isDeleting,
  onOpenEditor,
  onEditorChange,
  onSave,
  onCancel,
  onTriggerUpload,
  addButtonLabel,
  uploadButtonLabel = "Enviar arquivo",
  saveButtonLabel = "Anexar vídeo",
  isContextCollapsible = false,
  isContextExpanded = true,
  onToggleContext,
  promoteRemoveToHeader = false,
  isEmbeddedInContext = false,
  compactInfoHeader = false,
}) {
  const shouldShowContextContent =
    !isContextCollapsible ||
    isContextExpanded ||
    isEditing ||
    isUploading ||
    isDeleting ||
    Boolean(uploadError);

  return (
    <div
      className={
        isEmbeddedInContext
          ? "mt-4 border-t border-[#E5E5EA] pt-4 dark:border-[#2C2C2E]"
          : "rounded-[22px] border border-[#E5E5EA] bg-[#FAFAFC] p-4 shadow-none dark:border-[#2C2C2E] dark:bg-[#1C1C1E]"
      }
    >
      <div className={compactInfoHeader ? "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" : "flex flex-col gap-3 md:flex-row md:items-start md:justify-between"}>
        <div className="min-w-0">
          {compactInfoHeader ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-relaxed">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#424245] dark:text-[#D1D1D6]">
                {title}
              </span>
              {description ? (
                <span className="text-muted-foreground">
                  {description}
                </span>
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#424245] dark:text-[#D1D1D6]">
                  {title}
                </span>
                {countLabel ? (
                  <StatusPill tone="neutral">{countLabel}</StatusPill>
                ) : null}
              </div>

              {description ? (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </>
          )}
        </div>

        {isContextCollapsible ? (
          <button
            type="button"
            onClick={onToggleContext}
            className="inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#D2D2D7] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#6E6E73] transition-colors hover:bg-[#F5F5F7] active:bg-[#EDEDF0] dark:border-[#3A3A3C] dark:bg-[#2C2C2E] dark:text-[#D1D1D6] dark:hover:bg-[#3A3A3C]"
            aria-expanded={shouldShowContextContent}
          >
            {shouldShowContextContent ? "Ocultar" : "Mostrar"}
            {shouldShowContextContent ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        ) : compactInfoHeader && countLabel ? (
          <StatusPill
            tone="neutral"
            icon={<VideoAttachmentGlyph className="h-3.5 w-3.5" />}
            className="shrink-0"
          >
            {countLabel}
          </StatusPill>
        ) : !isEditing && helperLabel ? (
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6E6E73] ring-1 ring-black/[0.04] dark:bg-[#2C2C2E] dark:text-[#A1A1A6] dark:ring-white/[0.06]">
            {helperLabel}
          </span>
        ) : null}
      </div>

      {shouldShowContextContent ? (
        <>
          {isEditing ? (
            <div className="mt-3 space-y-2.5">
              <textarea
                value={editorValue}
                onChange={(event) => onEditorChange(event.target.value)}
                placeholder="Cole link, iframe, embed ou BBCode do vídeo"
                rows={3}
                spellCheck={false}
                className="min-h-[112px] w-full resize-y rounded-[18px] border border-[#D2D2D7] bg-white px-3.5 py-3 text-sm text-[#1D1D1F] shadow-none transition-all placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15 dark:border-[#3A3A3C] dark:bg-[#111113] dark:text-[#F5F5F7] dark:placeholder:text-[#8E8E93] dark:focus:border-[#0A84FF] dark:focus:ring-[#0A84FF]/20"
              />

              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Aceita links, iframes, embeds, BBCode ou arquivo enviado.
              </p>

              <div className="grid gap-2 sm:grid-cols-[auto_auto_auto]">
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!editorValue.trim() || isDeleting}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#0071E3] px-4 py-2 text-xs font-semibold text-white shadow-none transition-colors hover:bg-[#0077ED] active:bg-[#006EDB] disabled:cursor-not-allowed disabled:opacity-55 dark:bg-[#0A84FF] dark:hover:bg-[#2290FF]"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  {isDeleting ? "Salvando..." : saveButtonLabel}
                </button>

                <button
                  type="button"
                  onClick={onTriggerUpload}
                  disabled={isUploading || isDeleting}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#D2D2D7] bg-white px-4 py-2 text-xs font-semibold text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] active:bg-[#EDEDF0] disabled:cursor-not-allowed disabled:opacity-55 dark:border-[#3A3A3C] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] dark:hover:bg-[#3A3A3C]"
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {isUploading ? "Enviando..." : uploadButtonLabel}
                </button>

                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isDeleting}
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#D2D2D7] px-4 py-2 text-xs font-semibold text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] active:bg-[#EDEDF0] disabled:cursor-not-allowed disabled:opacity-55 dark:border-[#3A3A3C] dark:text-[#F5F5F7] dark:hover:bg-[#2C2C2E]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-[auto_auto]">
              <button
                type="button"
                onClick={onOpenEditor}
                disabled={isDeleting}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#D2D2D7] bg-white px-4 py-2 text-xs font-semibold text-[#1D1D1F] shadow-none transition-colors hover:bg-[#F5F5F7] active:bg-[#EDEDF0] disabled:cursor-not-allowed disabled:opacity-55 dark:border-[#3A3A3C] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] dark:hover:bg-[#3A3A3C]"
              >
                <Plus className="h-3.5 w-3.5 text-[#0071E3] dark:text-[#0A84FF]" />
                {addButtonLabel}
              </button>

              <button
                type="button"
                onClick={onTriggerUpload}
                disabled={isUploading || isDeleting}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#D2D2D7] bg-white px-4 py-2 text-xs font-semibold text-[#1D1D1F] shadow-none transition-colors hover:bg-[#F5F5F7] active:bg-[#EDEDF0] disabled:cursor-not-allowed disabled:opacity-55 dark:border-[#3A3A3C] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] dark:hover:bg-[#3A3A3C]"
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {isUploading ? "Enviando..." : uploadButtonLabel}
              </button>
            </div>
          )}

          {uploadError ? (
            <div
              data-video-layer-conflict-message={
                isVideoLayerConflictMessage(uploadError) ? "true" : undefined
              }
              className="mt-3 flex gap-2 rounded-[16px] border border-[#F2D7D5] bg-[#FFF7F6] px-3 py-2 text-xs font-medium leading-relaxed text-[#B42318] dark:border-[#5A2521] dark:bg-[#2B1513] dark:text-[#FF9F95]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{uploadError}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function UnsavedChangesModal({ open, onClose, onConfirm }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Fechar modal"
        onClick={onClose}
        className="absolute inset-0 bg-[#0B0F14]/28 backdrop-blur-[6px] transition-opacity dark:bg-[#02060D]/62"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-modal-title"
        className="relative z-10 w-full max-w-[452px] overflow-hidden rounded-[28px] border border-[#E5E5EA] bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.04] dark:border-[#263245] dark:bg-[linear-gradient(180deg,#111925_0%,#0F1722_100%)] dark:shadow-[0_32px_90px_rgba(0,0,0,0.55)] dark:ring-white/[0.05] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3
              id="unsaved-changes-modal-title"
              className="text-[1.75rem] font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7]"
            >
              Sair sem salvar?
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-[#6E6E73] dark:text-[#A1A1A6]">
              Existem alterações não salvas neste formulário.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6E6E73] transition-colors hover:bg-[#F5F5F7] active:bg-[#EDEDF0] dark:text-[#AEB7C4] dark:hover:bg-white/5"
            aria-label="Fechar"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="mt-6 rounded-[22px] border border-[#F0A7A2] bg-[#FFF1F0] p-5 dark:border-[#7A2323] dark:bg-[#2A171D]">
          <div className="flex items-start gap-3.5">
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FDE2E0] text-[#EF4444] dark:bg-[#4A151A] dark:text-[#FF6B6B]">
              <AlertTriangle className="h-5 w-5" />
            </span>

            <div className="min-w-0">
              <p className="text-lg font-semibold leading-snug text-[#2C2C2E] dark:text-[#F5F5F7]">
                Tem certeza que deseja sair sem salvar?
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-[#6B7280] dark:text-[#C0C7D2]">
                As alterações feitas em palavra ou frase, significados, exemplos, vídeos, links e thumbnails serão perdidas.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#D2D2D7] bg-white px-5 py-2.5 text-sm font-semibold text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] active:bg-[#EDEDF0] dark:border-[#344256] dark:bg-[#121C29] dark:text-[#F5F5F7] dark:hover:bg-[#182334]"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#EF4444] px-5 py-2.5 text-sm font-semibold text-white shadow-none transition-colors hover:bg-[#DC2626] active:bg-[#C81E1E] dark:bg-[#EF4444] dark:hover:bg-[#F05252]"
          >
            Sair sem salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function ExampleVideoPreview({
  video,
  thumbnail,
  isActive,
  onPlay,
  className = "",
}) {
  if (!video) return null;

  const cleanVideo = normalizeText(video);
  const thumbnailSrc = normalizeText(thumbnail);
  const isThirdPartyVideo = isThirdPartyEmbeddedVideo(cleanVideo);
  const thirdPartyEmbedSrc = getCompactThirdPartyEmbedSrc(cleanVideo);
  const shouldRenderEmbedPreview =
    isThirdPartyVideo && Boolean(thirdPartyEmbedSrc);
  const embedPreviewTuning = getEmbedPreviewTuning(thirdPartyEmbedSrc);
  const embedPreviewVisualScale = embedPreviewTuning.visualScale;
  const embedPreviewRenderScale = 1 / embedPreviewVisualScale;
  const embedPreviewContainerOffsetXPercent =
    embedPreviewTuning.containerOffsetXPercent;
  const shouldRenderCustomThumbnail =
    !isThirdPartyVideo && Boolean(thumbnailSrc);
  if (shouldRenderEmbedPreview) {
    return (
      <div
        className={[
          "relative aspect-video overflow-hidden rounded-[20px] border border-[#E5E5EA] bg-black shadow-none dark:border-[#2C2C2E]",
          className,
        ].join(" ")}
      >
        <iframe
          src={thirdPartyEmbedSrc}
          title="Vídeo do exemplo"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute border-0 bg-black"
          style={{
            left: `calc(50% + ${embedPreviewContainerOffsetXPercent}%)`,
            top: "50%",
            width: `${embedPreviewRenderScale * 100}%`,
            height: `${embedPreviewRenderScale * 100}%`,
            transform: `translate(-50%, -50%) scale(${embedPreviewVisualScale})`,
            transformOrigin: "center center",
            clipPath: "inset(1px)",
          }}
        />
      </div>
    );
  }

  if (isActive) {
    return (
      <div
        className={[
          "manager-form-video-preview-active-shell aspect-video overflow-hidden rounded-[20px] bg-black shadow-none",
          className,
        ].join(" ")}
      >
        <style>{`
          .manager-form-video-preview-active-shell .example-video-player-shell button:not(.absolute),
          .manager-form-video-preview-active-shell .example-video-player-shell button:not(.absolute):focus,
          .manager-form-video-preview-active-shell .example-video-player-shell button:not(.absolute):focus-visible {
            outline: none !important;
            transform: none !important;
            --tw-ring-color: transparent !important;
            --tw-ring-offset-width: 0px !important;
            --tw-ring-offset-color: transparent !important;
            --tw-ring-shadow: 0 0 #0000 !important;
          }

          .manager-form-video-preview-active-shell .example-video-player-shell button:not(.absolute):hover {
            transform: none !important;
            border-color: rgba(255,255,255,0.65) !important;
            background-color: rgba(255,255,255,0.16) !important;
            box-shadow: 0 5px 12px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.24) !important;
          }

          .manager-form-video-preview-active-shell .example-video-player-shell button:not(.absolute):active {
            transform: none !important;
            border-color: rgba(255,255,255,0.60) !important;
            background-color: rgba(255,255,255,0.12) !important;
            box-shadow: 0 2px 6px rgba(15,23,42,0.14), inset 0 2px 4px rgba(0,0,0,0.14) !important;
          }

          .manager-form-video-preview-active-shell .example-video-player-shell button.absolute:hover,
          .manager-form-video-preview-active-shell .example-video-player-shell button.absolute:active {
            transform: none !important;
          }
        `}</style>
        <ExampleVideoPlayer
          video={cleanVideo}
          autoPlay
          layout="compact"
          controlsMode="compact"
          resetPlaybackOnMount
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.currentTarget.blur();
        onPlay?.(event);
      }}
      onMouseDown={(event) => {
        if (event.button === 0) event.preventDefault();
      }}
      onPointerUp={(event) => event.currentTarget.blur()}
      onTouchEnd={(event) => event.currentTarget.blur()}
      className={[
        "group relative aspect-video w-full overflow-hidden rounded-[20px] border border-[#E5E5EA]",
        "bg-[#F5F5F7] shadow-none dark:border-[#2C2C2E] dark:bg-[#1C1C1E]",
        "transition-colors duration-200",
        "outline-none ring-0 ring-offset-0 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 focus-visible:ring-offset-0",
        className,
      ].join(" ")}
      aria-label="Reproduzir vídeo"
      title="Reproduzir vídeo"
    >
      {shouldRenderCustomThumbnail ? (
        <img
          src={thumbnailSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#FAFAFC_0%,#F5F5F7_100%)] dark:bg-[linear-gradient(135deg,#1C1C1E_0%,#111113_100%)]" />
      )}

      <div className="absolute inset-0 bg-black/[0.03] dark:bg-white/[0.025]" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={[
            "flex h-10 w-10 items-center justify-center rounded-full",
            "border border-white/55 bg-white/10 text-white",
            "shadow-[0_4px_10px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.22)]",
            "backdrop-blur-[2px] transition-[background-color,border-color,box-shadow,opacity] duration-200 ease-out",
            "hover:border-white/65 hover:bg-white/[0.16] hover:shadow-[0_5px_12px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.24)] active:border-white/60 active:bg-white/[0.12] active:shadow-[0_2px_6px_rgba(15,23,42,0.14),inset_0_2px_4px_rgba(0,0,0,0.14)]",
          ].join(" ")}
        >
          <Play className="ml-[1.5px] h-4 w-4 fill-white text-white stroke-[2.2]" />
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
  previewVariant = "default",
  inlineSize = "normal",
  showPreview = true,
  mobileCompact = false,
  removeButtonMode = "button",
  addButtonLabel = "Adicionar vídeo",
  changeButtonLabel = "Trocar vídeo",
  saveButtonLabel,
  layerIcon,
  helperText,
  isContextCollapsible = false,
  isContextExpanded = true,
  onToggleContext,
  promoteRemoveToHeader = false,
  showHeaderVideoAttachedIndicator = true,
  mobileMinimalControls = false,
  children,
}) {
  const hasVideo = Boolean(video);
  const shouldShowContextContent =
    !isContextCollapsible ||
    isContextExpanded ||
    isEditing ||
    isUploading ||
    isDeleting ||
    Boolean(uploadError);
  const isInlinePreview = previewVariant === "inline-right";
  const isWideInline = inlineSize === "wide";
  const isExampleInline = inlineSize === "example";
  const showRemoveIcon =
    !promoteRemoveToHeader &&
    shouldShowContextContent &&
    hasVideo &&
    !isEditing &&
    removeButtonMode === "mobile-icon";
  const showRemoveInlineIcon =
    !promoteRemoveToHeader &&
    shouldShowContextContent &&
    hasVideo &&
    !isEditing &&
    removeButtonMode === "icon";
  const showTextRemoveButton =
    !promoteRemoveToHeader &&
    shouldShowContextContent &&
    hasVideo &&
    (removeButtonMode === "button" || removeButtonMode === "mobile-icon");
  const showPromotedRemoveButton =
    promoteRemoveToHeader &&
    hasVideo &&
    typeof onRemove === "function";
  const removeIconResponsiveClass =
    removeButtonMode === "mobile-icon" ? "lg:hidden" : "";
  const removeTextResponsiveClass =
    removeButtonMode === "mobile-icon" ? "hidden lg:inline-flex" : "";
  const shouldShowPreview = shouldShowContextContent && hasVideo && !isEditing && showPreview;
  const contentLayoutClass =
    shouldShowPreview && isInlinePreview
      ? isWideInline
        ? mobileCompact
          ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_272px] lg:items-center"
          : "grid gap-4 md:grid-cols-[minmax(0,1fr)_272px] md:items-center"
        : isExampleInline
        ? mobileCompact
          ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_264px] lg:items-center"
          : "grid gap-4 md:grid-cols-[minmax(0,1fr)_264px] md:items-center"
        : mobileCompact
        ? "grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_208px] lg:items-center"
        : "grid gap-3.5 md:grid-cols-[minmax(0,1fr)_208px] md:items-center"
      : "space-y-3";
  const previewSizeClass = isWideInline
    ? mobileCompact
      ? "mx-auto w-full max-w-[340px] lg:w-[272px] lg:max-w-none"
      : "w-full md:w-[272px]"
    : isExampleInline
    ? mobileCompact
      ? "mx-auto w-full max-w-[320px] lg:w-[264px] lg:max-w-none"
      : "w-full md:w-[264px]"
    : mobileCompact
    ? "mx-auto w-full max-w-[230px] lg:w-[208px] lg:max-w-none"
    : "w-full md:w-[208px]";
  const previewAlignmentClass = mobileCompact
    ? "lg:justify-end lg:self-center"
    : "md:justify-end md:self-center";
  const statusTone = uploadError
    ? "danger"
    : isUploading || isDeleting
    ? "warning"
    : isEditing
    ? "info"
    : hasVideo
    ? "success"
    : "neutral";
  const statusIcon = uploadError ? (
    <AlertTriangle className="h-3.5 w-3.5" />
  ) : isUploading || isDeleting ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin" />
  ) : hasVideo ? (
    <VideoAttachmentGlyph className="h-3.5 w-3.5" />
  ) : (
    <FileVideo className="h-3.5 w-3.5" />
  );
  const shouldUseVideoAttachedIndicator =
    showHeaderVideoAttachedIndicator &&
    hasVideo &&
    !uploadError &&
    !isUploading &&
    !isDeleting &&
    !isEditing;
  const shouldHideAttachedHeaderStatus =
    !showHeaderVideoAttachedIndicator &&
    hasVideo &&
    !uploadError &&
    !isUploading &&
    !isDeleting &&
    !isEditing;
  const shouldShowHeaderStatus = !shouldHideAttachedHeaderStatus;
  const statusLabel = uploadError
    ? "Precisa de atenção"
    : isUploading
    ? "Enviando"
    : isDeleting
    ? "Processando"
    : isEditing
    ? "Editando"
    : hasVideo
    ? "Anexado"
    : emptyLabel;
  const mainActionLabel = hasVideo ? changeButtonLabel : addButtonLabel;
  const nextSaveLabel =
    saveButtonLabel || (hasVideo ? "Salvar troca" : "Anexar vídeo");
  const actionGridClass = mobileMinimalControls
    ? "grid grid-cols-2 gap-2 max-md:items-center sm:flex sm:flex-wrap"
    : mobileCompact
    ? showRemoveInlineIcon
      ? "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2 sm:flex sm:flex-wrap"
      : "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
    : "flex flex-wrap gap-2";
  const secondaryButtonClass = [
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#D2D2D7] bg-white px-3.5 py-2 text-xs font-semibold text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] active:bg-[#EDEDF0] focus:outline-none focus-visible:border-[#C7C7CC] focus-visible:ring-2 focus-visible:ring-black/[0.08] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-55 dark:border-[#3A3A3C] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] dark:hover:bg-[#3A3A3C] dark:focus-visible:border-[#48484A] dark:focus-visible:ring-white/[0.1]",
    mobileMinimalControls
      ? "max-md:min-h-8 max-md:px-3 max-md:py-1.5 max-md:text-[11px]"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const primaryButtonClass =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#0071E3] px-4 py-2 text-xs font-semibold text-white shadow-none transition-colors hover:bg-[#0077ED] active:bg-[#006EDB] focus:outline-none focus-visible:ring-2 focus-visible:ring-black/[0.08] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-[#0A84FF] dark:hover:bg-[#2290FF] dark:focus-visible:ring-white/[0.1]";
  const dangerButtonClass =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#F2D7D5] px-3.5 py-2 text-xs font-semibold text-[#B42318] transition-colors hover:bg-[#FFF7F6] active:bg-[#FCEDEA] focus:outline-none focus-visible:border-[#F2D7D5] focus-visible:ring-2 focus-visible:ring-black/[0.08] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-55 dark:border-[#5A2521] dark:text-[#FF9F95] dark:hover:bg-[#2B1513] dark:focus-visible:ring-white/[0.1]";
  const dangerIconButtonClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#F2D7D5] text-[#B42318] transition-colors hover:bg-[#FFF7F6] active:bg-[#FCEDEA] focus:outline-none focus-visible:border-[#F2D7D5] focus-visible:ring-2 focus-visible:ring-black/[0.08] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-55 dark:border-[#5A2521] dark:text-[#FF9F95] dark:hover:bg-[#2B1513] dark:focus-visible:ring-white/[0.1]";
  const neutralActionIconClass = "h-3.5 w-3.5 text-[#6E6E73] dark:text-[#A1A1A6]";

  return (
    <div
      className={[
        "relative rounded-[22px] border border-[#E5E5EA] bg-white p-4 shadow-none ring-1 ring-black/[0.025] transition-colors dark:border-[#2C2C2E] dark:bg-[#1C1C1E] dark:ring-white/[0.05]",
        mobileMinimalControls
          ? "max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:ring-0 max-md:dark:bg-transparent"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showRemoveIcon ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={isDeleting}
          className={`absolute right-2 top-2 z-10 rounded-full p-2 transition-colors hover:bg-[#FFF7F6] dark:hover:bg-[#2B1513] disabled:opacity-50 ${removeIconResponsiveClass}`}
          aria-label="Remover vídeo"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </button>
      ) : null}

      <input
        type="file"
        accept="video/*"
        className="hidden"
        ref={fileInputRef}
        onChange={onFileChange}
      />

      <div className={contentLayoutClass}>
        <div className="min-w-0 space-y-3">
          {mobileMinimalControls && hasVideo && !isEditing ? (
            <div className="hidden max-md:grid max-md:grid-cols-2 max-md:items-center max-md:gap-3">
              {isContextCollapsible ? (
                <button
                  type="button"
                  onClick={onToggleContext}
                  className="inline-flex min-h-8 w-full items-center justify-center gap-1.5 rounded-full border border-[#D2D2D7] bg-white px-4 py-1.5 text-[11px] font-semibold text-[#6E6E73] transition-colors hover:bg-[#F5F5F7] active:bg-[#EDEDF0] dark:border-[#3A3A3C] dark:bg-[#2C2C2E] dark:text-[#D1D1D6] dark:hover:bg-[#3A3A3C]"
                  aria-expanded={shouldShowContextContent}
                >
                  {shouldShowContextContent ? "Ocultar" : "Mostrar"}
                  {shouldShowContextContent ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : null}

              {showPromotedRemoveButton ? (
                <button
                  type="button"
                  onClick={onRemove}
                  disabled={isDeleting}
                  className="inline-flex min-h-8 w-full items-center justify-center gap-1.5 rounded-full border border-[#F2D7D5] px-4 py-1.5 text-[11px] font-semibold text-[#B42318] transition-colors hover:bg-[#FFF7F6] active:bg-[#FCEDEA] disabled:cursor-not-allowed disabled:opacity-55 dark:border-[#5A2521] dark:text-[#FF9F95] dark:hover:bg-[#2B1513]"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  {isDeleting ? "Removendo" : "Remover"}
                </button>
              ) : null}
            </div>
          ) : null}

          <div
            className={[
              promoteRemoveToHeader
                ? "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                : "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
              mobileMinimalControls ? "max-md:hidden" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={
                promoteRemoveToHeader
                  ? "flex min-w-0 items-center gap-3"
                  : "flex min-w-0 gap-3"
              }
            >
              <span
                className={[
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5F7] text-[#0071E3] ring-1 ring-black/[0.035] dark:bg-[#2C2C2E] dark:text-[#0A84FF] dark:ring-white/[0.06]",
                  mobileMinimalControls ? "max-md:hidden" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {layerIcon || <FileVideo className="h-4 w-4" />}
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#424245] dark:text-[#D1D1D6]",
                      mobileMinimalControls ? "max-md:hidden" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {title}
                  </span>

                  {showPromotedRemoveButton ? (
                    <button
                      type="button"
                      onClick={onRemove}
                      disabled={isDeleting}
                      className="inline-flex min-h-7 items-center justify-center gap-1.5 rounded-full border border-[#F2D7D5] px-2.5 py-1 text-[10px] font-semibold text-[#B42318] transition-colors hover:bg-[#FFF7F6] active:bg-[#FCEDEA] disabled:cursor-not-allowed disabled:opacity-55 dark:border-[#5A2521] dark:text-[#FF9F95] dark:hover:bg-[#2B1513]"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      {isDeleting ? "Removendo" : "Remover"}
                    </button>
                  ) : null}
                </div>

                {description ? (
                  <p
                    className={[
                      "mt-1 text-xs leading-relaxed text-muted-foreground",
                      mobileMinimalControls ? "max-md:hidden" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:justify-end">
              {shouldUseVideoAttachedIndicator ? (
                <VideoAttachedBadge className="h-7 w-7" />
              ) : shouldShowHeaderStatus ? (
                <StatusPill tone={statusTone} icon={statusIcon}>
                  {statusLabel}
                </StatusPill>
              ) : null}

              {isContextCollapsible ? (
                <button
                  type="button"
                  onClick={onToggleContext}
                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border border-[#D2D2D7] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#6E6E73] transition-colors hover:bg-[#F5F5F7] active:bg-[#EDEDF0] dark:border-[#3A3A3C] dark:bg-[#2C2C2E] dark:text-[#D1D1D6] dark:hover:bg-[#3A3A3C]"
                  aria-expanded={shouldShowContextContent}
                >
                  {shouldShowContextContent ? "Ocultar" : "Mostrar"}
                  {shouldShowContextContent ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : null}
            </div>
          </div>

          {shouldShowContextContent ? (
            <>
              {helperText && !hasVideo && !isEditing ? (
                <p className="rounded-[14px] bg-[#F5F5F7] px-3 py-2 text-[11px] leading-relaxed text-[#6E6E73] dark:bg-[#2C2C2E] dark:text-[#A1A1A6]">
                  {helperText}
                </p>
              ) : null}

              {isEditing ? (
                <div className="space-y-2.5">
                  <textarea
                    value={editorValue}
                    onChange={(e) => onEditorChange(e.target.value)}
                    placeholder="Cole link, iframe, embed ou BBCode do vídeo"
                    rows={mobileCompact ? 3 : 4}
                    spellCheck={false}
                    className="min-h-[112px] w-full resize-y rounded-[18px] border border-[#D2D2D7] bg-white px-3.5 py-3 text-sm text-[#1D1D1F] transition-all placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15 dark:border-[#3A3A3C] dark:bg-[#111113] dark:text-[#F5F5F7] dark:placeholder:text-[#8E8E93] dark:focus:border-[#0A84FF] dark:focus:ring-[#0A84FF]/20"
                  />

                  <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Cole um link simples ou o código completo do embed. O sistema mantém a compatibilidade ao salvar.
                  </p>

                  <div className={mobileCompact ? "grid gap-2 sm:flex sm:flex-wrap" : "flex flex-wrap gap-2"}>
                    <button
                      type="button"
                      onClick={onSave}
                      disabled={!editorValue.trim() || isDeleting}
                      className={primaryButtonClass}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      {isDeleting ? "Salvando..." : nextSaveLabel}
                    </button>

                    <button
                      type="button"
                      onClick={onCancel}
                      disabled={isDeleting}
                      className={secondaryButtonClass}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className={actionGridClass}>
                  <button
                    type="button"
                    onClick={onOpenEditor}
                    disabled={isDeleting}
                    className={secondaryButtonClass}
                  >
                    <Link2 className={neutralActionIconClass} />
                    {mobileMinimalControls ? (
                      <>
                        <span className="md:hidden">Trocar vídeo</span>
                        <span className="hidden md:inline">{mainActionLabel}</span>
                      </>
                    ) : (
                      mainActionLabel
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onTriggerUpload}
                    disabled={isUploading || isDeleting}
                    className={secondaryButtonClass}
                  >
                    {isUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {isUploading ? (
                      "Enviando..."
                    ) : mobileMinimalControls ? (
                      <>
                        <span className="md:hidden">Upload</span>
                        <span className="hidden md:inline">{uploadButtonText}</span>
                      </>
                    ) : (
                      uploadButtonText
                    )}
                  </button>

                  {showRemoveInlineIcon ? (
                    <button
                      type="button"
                      onClick={onRemove}
                      disabled={isDeleting}
                      className={dangerIconButtonClass}
                      aria-label="Remover vídeo"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  ) : null}

                  {showTextRemoveButton ? (
                    <button
                      type="button"
                      onClick={onRemove}
                      disabled={isDeleting}
                      className={`${dangerButtonClass} ${removeTextResponsiveClass}`}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      {isDeleting ? "Removendo..." : "Remover vídeo"}
                    </button>
                  ) : null}
                </div>
              )}

              {uploadError ? (
                <div
                  data-video-layer-conflict-message={
                    isVideoLayerConflictMessage(uploadError) ? "true" : undefined
                  }
                  className="flex gap-2 rounded-[16px] border border-[#F2D7D5] bg-[#FFF7F6] px-3 py-2 text-xs font-medium leading-relaxed text-[#B42318] dark:border-[#5A2521] dark:bg-[#2B1513] dark:text-[#FF9F95]"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{uploadError}</p>
                </div>
              ) : null}

              {children}
            </>
          ) : null}
        </div>

        {shouldShowPreview ? (
          <div
            className={
              isInlinePreview
                ? `flex w-full justify-center overflow-visible ${previewAlignmentClass}`
                : ""
            }
          >
            <ExampleVideoPreview
              video={video}
              thumbnail={thumbnail}
              isActive={isPreviewActive}
              onPlay={onPlay}
              className={isInlinePreview ? previewSizeClass : ""}
            />
          </div>
        ) : null}
      </div>

    </div>
  );
}

export default function ManagerForm({ item, onBack, onSaved }) {
  const { user } = useAuth();
  const { isDark: isDarkTheme } = useTheme();
  const fileInputsRef = useRef({});
  const meaningCardRefs = useRef({});
  const exampleCardRefs = useRef({});

  const [term, setTerm] = useState(item?.term || "");
  const [pronunciation, setPronunciation] = useState(item?.pronunciation || "");
  const [wordVideos, setWordVideos] = useState(() => normalizeWordVideos(item));

  const firstWordVideoEntry = wordVideos[0] || { video: "", thumbnail: "" };
  const wordVideo = normalizeText(firstWordVideoEntry.video);
  const wordThumbnail = wordVideo
    ? normalizeText(firstWordVideoEntry.thumbnail)
    : "";


  const [meanings, setMeanings] = useState(
    item?.meanings?.length > 0
      ? item.meanings.map((m) => ({
          meaning: m.meaning || "",
          category: m.category || "vocabulário",
          tip: m.tip || "",
          video: normalizeMeaningVideo(m),
          thumbnail: normalizeMeaningThumbnail(m),
          meaningVideos: normalizeMeaningVideos(m),
          examples:
            m.examples?.length > 0
              ? m.examples.map((e) => ({
                  sentence: e?.sentence || "",
                  translation: e?.translation || "",
                  video: normalizeExampleVideo(e),
                  thumbnail: normalizeExampleThumbnail(e),
                  exampleVideos: normalizeExampleVideos(e),
                }))
              : [{ ...emptyExample }],
        }))
      : [{ ...emptyMeaning }]
  );
  const initialDraftSignatureRef = useRef(null);
  if (initialDraftSignatureRef.current === null) {
    initialDraftSignatureRef.current = createEditableDraftSignature(
      buildEditableDraftSnapshot({
        term: item?.term || "",
        pronunciation: item?.pronunciation || "",
        wordVideos: normalizeWordVideos(item),
        meanings:
          item?.meanings?.length > 0
            ? item.meanings.map((m) => ({
                meaning: m.meaning || "",
                category: m.category || "vocabulário",
                tip: m.tip || "",
                video: normalizeMeaningVideo(m),
                thumbnail: normalizeMeaningThumbnail(m),
                meaningVideos: normalizeMeaningVideos(m),
                examples:
                  m.examples?.length > 0
                    ? m.examples.map((e) => ({
                        sentence: e?.sentence || "",
                        translation: e?.translation || "",
                        video: normalizeExampleVideo(e),
                        thumbnail: normalizeExampleThumbnail(e),
                        exampleVideos: normalizeExampleVideos(e),
                      }))
                    : [{ ...emptyExample }],
              }))
            : [{ ...emptyMeaning }],
      })
    );
  }

  const [savedDraftSignature, setSavedDraftSignature] = useState(
    initialDraftSignatureRef.current
  );
  const [pendingNewMeanings, setPendingNewMeanings] = useState({});
  const [recentlyAddedMeaningIndex, setRecentlyAddedMeaningIndex] = useState(null);
  const [recentlyAddedExampleKey, setRecentlyAddedExampleKey] = useState(null);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [isWordVideoSectionExpanded, setIsWordVideoSectionExpanded] = useState(
    () => normalizeWordVideos(item).length > 0
  );

  const [expandedMeanings, setExpandedMeanings] = useState(() => {
    if (item?.meanings?.length > 0) {
      return Object.fromEntries(
        item.meanings.map((_, index) => [index, false])
      );
    }

    return { 0: false };
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
      [getExampleKey(0, 0)]: false,
    };
  });

  const [saving, setSaving] = useState(false);
  const [videoEditor, setVideoEditor] = useState({
    key: null,
    value: "",
    initialValue: "",
  });
  const [uploadingVideoKey, setUploadingVideoKey] = useState(null);
  const [deletingVideoKey, setDeletingVideoKey] = useState(null);
  const [videoUploadErrors, setVideoUploadErrors] = useState({});
  const [activeVideoPreviewKey, setActiveVideoPreviewKey] = useState(null);
  const [expandedVideoContextCards, setExpandedVideoContextCards] = useState({});
  const activeMeaningAccentPalette = isDarkTheme
    ? meaningAccentPaletteDark
    : meaningAccentPalette;
  const meaningAccentIndexes = getMeaningAccentIndexes(
    meanings.length,
    activeMeaningAccentPalette.length
  );
  const currentDraftSnapshot = buildEditableDraftSnapshot({
    term,
    pronunciation,
    wordVideos,
    meanings,
  });
  const currentDraftSignature = createEditableDraftSignature(currentDraftSnapshot);
  const hasPendingChanges = currentDraftSignature !== savedDraftSignature;
  const hasUnsavedVideoEditorChanges = Boolean(
    videoEditor.key &&
      normalizeText(videoEditor.value) !== normalizeText(videoEditor.initialValue)
  );
  const hasUnsavedFormChanges = hasPendingChanges || hasUnsavedVideoEditorChanges;
  const canSave = !saving && Boolean(term.trim()) && hasPendingChanges;
  const hasWordLevelVideos = wordVideos.some((entry) =>
    Boolean(normalizeText(entry?.video))
  );
  const hasMeaningOrExampleVideos = meanings.some((meaningItem) => {
    const hasMeaningVideo = normalizeMeaningVideos(meaningItem).some((entry) =>
      Boolean(normalizeText(entry?.video))
    );
    const hasExampleVideo = Array.isArray(meaningItem?.examples)
      ? meaningItem.examples.some((example) =>
          normalizeExampleVideos(example).some((entry) =>
            Boolean(normalizeText(entry?.video))
          )
        )
      : false;

    return hasMeaningVideo || hasExampleVideo;
  });

  const hasVisibleVideoLayerConflictMessage = Object.values(videoUploadErrors).some(
    isVideoLayerConflictMessage
  );

  const resetActiveVideoPreview = () => {
    setActiveVideoPreviewKey(null);
  };

  const isVideoContextCardExpanded = (key) =>
    Boolean(expandedVideoContextCards[key]);

  const toggleVideoContextCard = (key) => {
    resetActiveVideoPreview();

    setExpandedVideoContextCards((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const appendWordVideo = ({ video, thumbnail = "" }) => {
    const cleanVideo = normalizeText(video);

    if (!cleanVideo) return;

    setWordVideos((current) =>
      dedupeVideoEntries([
        ...current,
        {
          video: cleanVideo,
          thumbnail: normalizeText(thumbnail),
        },
      ])
    );
  };

  const updateWordVideoAt = (index, { video, thumbnail = "" }) => {
    const cleanVideo = normalizeText(video);

    if (!cleanVideo) return;

    setWordVideos((current) => {
      const next = [...current];

      next[index] = {
        video: cleanVideo,
        thumbnail: normalizeText(thumbnail),
      };

      return dedupeVideoEntries(next);
    });
  };

  const removeWordVideoAt = (index) => {
    setWordVideos((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const syncMeaningVideoFields = (meaningItem, nextMeaningVideos) => {
    const cleanMeaningVideos = dedupeVideoEntries(
      (Array.isArray(nextMeaningVideos) ? nextMeaningVideos : [])
        .map((entry) => ({
          video: normalizeText(entry?.video),
          thumbnail: entry?.video ? normalizeText(entry?.thumbnail) : "",
        }))
        .filter((entry) => entry.video)
    );
    const firstMeaningVideo = cleanMeaningVideos[0] || {
      video: "",
      thumbnail: "",
    };
    const cleanFirstVideo = normalizeText(firstMeaningVideo.video);

    return {
      ...meaningItem,
      video: cleanFirstVideo,
      thumbnail: cleanFirstVideo
        ? normalizeText(firstMeaningVideo.thumbnail)
        : "",
      meaningVideos: cleanMeaningVideos,
    };
  };

  const appendMeaningVideo = (meaningIndex, { video, thumbnail = "" }) => {
    const cleanVideo = normalizeText(video);

    if (!cleanVideo) return;

    setMeanings((current) => {
      const next = [...current];
      const currentMeaning = next[meaningIndex];

      if (!currentMeaning) return current;

      const currentMeaningVideos = normalizeMeaningVideos(currentMeaning);
      next[meaningIndex] = syncMeaningVideoFields(currentMeaning, [
        ...currentMeaningVideos,
        {
          video: cleanVideo,
          thumbnail: normalizeText(thumbnail),
        },
      ]);

      return next;
    });
  };

  const updateMeaningVideoAt = (meaningIndex, videoIndex, { video, thumbnail = "" }) => {
    const cleanVideo = normalizeText(video);

    if (!cleanVideo) return;

    setMeanings((current) => {
      const next = [...current];
      const currentMeaning = next[meaningIndex];

      if (!currentMeaning) return current;

      const currentMeaningVideos = normalizeMeaningVideos(currentMeaning);
      const nextMeaningVideos = [...currentMeaningVideos];

      nextMeaningVideos[videoIndex] = {
        video: cleanVideo,
        thumbnail: normalizeText(thumbnail),
      };

      next[meaningIndex] = syncMeaningVideoFields(currentMeaning, nextMeaningVideos);

      return next;
    });
  };

  const removeMeaningVideoAt = (meaningIndex, videoIndex) => {
    setMeanings((current) => {
      const next = [...current];
      const currentMeaning = next[meaningIndex];

      if (!currentMeaning) return current;

      const nextMeaningVideos = normalizeMeaningVideos(currentMeaning).filter(
        (_, currentIndex) => currentIndex !== videoIndex
      );

      next[meaningIndex] = syncMeaningVideoFields(currentMeaning, nextMeaningVideos);

      return next;
    });
  };

  const syncExampleVideoFields = (exampleItem, nextExampleVideos) => {
    const cleanExampleVideos = dedupeVideoEntries(
      (Array.isArray(nextExampleVideos) ? nextExampleVideos : [])
        .map((entry) => ({
          video: normalizeText(entry?.video),
          thumbnail: entry?.video ? normalizeText(entry?.thumbnail) : "",
        }))
        .filter((entry) => entry.video)
    ).slice(0, 1);
    const firstExampleVideo = cleanExampleVideos[0] || {
      video: "",
      thumbnail: "",
    };
    const cleanFirstVideo = normalizeText(firstExampleVideo.video);

    return {
      ...exampleItem,
      video: cleanFirstVideo,
      thumbnail: cleanFirstVideo
        ? normalizeText(firstExampleVideo.thumbnail)
        : "",
      exampleVideos: cleanExampleVideos,
    };
  };

  const appendExampleVideo = (meaningIndex, exampleIndex, { video, thumbnail = "" }) => {
    const cleanVideo = normalizeText(video);

    if (!cleanVideo) return;

    setMeanings((current) => {
      const next = [...current];
      const currentMeaning = next[meaningIndex];
      const currentExample = currentMeaning?.examples?.[exampleIndex];

      if (!currentMeaning || !currentExample) return current;

      const nextExamples = [...currentMeaning.examples];

      nextExamples[exampleIndex] = syncExampleVideoFields(currentExample, [
        {
          video: cleanVideo,
          thumbnail: normalizeText(thumbnail),
        },
      ]);

      next[meaningIndex] = {
        ...currentMeaning,
        examples: nextExamples,
      };

      return next;
    });
  };

  const updateExampleVideoAt = (
    meaningIndex,
    exampleIndex,
    videoIndex,
    { video, thumbnail = "" }
  ) => {
    const cleanVideo = normalizeText(video);

    if (!cleanVideo) return;

    setMeanings((current) => {
      const next = [...current];
      const currentMeaning = next[meaningIndex];
      const currentExample = currentMeaning?.examples?.[exampleIndex];

      if (!currentMeaning || !currentExample) return current;

      const currentExampleVideos = normalizeExampleVideos(currentExample);
      const nextExampleVideos = [...currentExampleVideos];
      const nextExamples = [...currentMeaning.examples];

      nextExampleVideos[0] = {
        video: cleanVideo,
        thumbnail: normalizeText(thumbnail),
      };

      nextExamples[exampleIndex] = syncExampleVideoFields(
        currentExample,
        nextExampleVideos
      );

      next[meaningIndex] = {
        ...currentMeaning,
        examples: nextExamples,
      };

      return next;
    });
  };

  const removeExampleVideoAt = async (meaningIndex, exampleIndex, videoIndex) => {
    const videoKey = getExampleVideoKey(meaningIndex, exampleIndex, videoIndex);
    const currentExample = meanings[meaningIndex]?.examples?.[exampleIndex];
    const videoValue = normalizeText(
      normalizeExampleVideos(currentExample)?.[videoIndex]?.video
    );

    try {
      setDeletingVideoKey(videoKey);
      setVideoError(videoKey);

      if (videoValue) {
        await deleteVideoFromR2(videoValue);
      }

      setMeanings((current) => {
        const next = [...current];
        const currentMeaning = next[meaningIndex];
        const currentExampleItem = currentMeaning?.examples?.[exampleIndex];

        if (!currentMeaning || !currentExampleItem) return current;

        const nextExampleVideos = normalizeExampleVideos(currentExampleItem).filter(
          (_, currentIndex) => currentIndex !== videoIndex
        );
        const nextExamples = [...currentMeaning.examples];

        nextExamples[exampleIndex] = syncExampleVideoFields(
          currentExampleItem,
          nextExampleVideos
        );

        next[meaningIndex] = {
          ...currentMeaning,
          examples: nextExamples,
        };

        return next;
      });
    } catch (error) {
      console.error("Erro ao remover vídeo do exemplo:", error);
      setVideoError(
        videoKey,
        error?.message ||
          "Não foi possível apagar este vídeo do exemplo no Cloudflare R2."
      );
    } finally {
      setDeletingVideoKey((current) =>
        current === videoKey ? null : current
      );
    }
  };

  const setVideoError = (key, message = "") => {
    setVideoUploadErrors((current) => ({ ...current, [key]: message }));
  };

  const getVideoLayerConflictMessage = (key) => {
    if (isWordVideoLayerKey(key) && hasMeaningOrExampleVideos) {
      return WORD_VIDEO_CONFLICT_MESSAGE;
    }

    if (isMeaningOrExampleVideoLayerKey(key) && hasWordLevelVideos) {
      return INTERNAL_VIDEO_CONFLICT_MESSAGE;
    }

    return "";
  };

  const clearVideoLayerConflictMessages = ({ onlyResolved = false } = {}) => {
    setVideoUploadErrors((current) => {
      let changed = false;
      const next = { ...current };

      Object.entries(current).forEach(([currentKey, currentMessage]) => {
        if (!isVideoLayerConflictMessage(currentMessage)) return;
        if (onlyResolved && getVideoLayerConflictMessage(currentKey)) return;

        next[currentKey] = "";
        changed = true;
      });

      return changed ? next : current;
    });
  };

  const setVideoLayerConflictMessage = (key, message) => {
    setVideoUploadErrors((current) => {
      let changed = false;
      const next = { ...current };

      Object.entries(current).forEach(([currentKey, currentMessage]) => {
        if (!isVideoLayerConflictMessage(currentMessage)) return;

        next[currentKey] = "";
        changed = true;
      });

      if (next[key] !== message) {
        next[key] = message;
        changed = true;
      }

      return changed ? next : current;
    });
  };

  useEffect(() => {
    clearVideoLayerConflictMessages({ onlyResolved: true });
  }, [hasWordLevelVideos, hasMeaningOrExampleVideos]);

  useEffect(() => {
    if (!hasVisibleVideoLayerConflictMessage || typeof document === "undefined") {
      return undefined;
    }

    const handlePointerDownOutsideConflictMessage = (event) => {
      const target = event.target;

      if (
        target &&
        typeof target.closest === "function" &&
        target.closest('[data-video-layer-conflict-message="true"]')
      ) {
        return;
      }

      clearVideoLayerConflictMessages();
    };

    document.addEventListener(
      "pointerdown",
      handlePointerDownOutsideConflictMessage,
      true
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDownOutsideConflictMessage,
        true
      );
    };
  }, [hasVisibleVideoLayerConflictMessage]);

  useEffect(() => {
    if (!hasUnsavedFormChanges || typeof window === "undefined") {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = UNSAVED_CHANGES_CONFIRM_MESSAGE;
      return UNSAVED_CHANGES_CONFIRM_MESSAGE;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedFormChanges]);

  useEffect(() => {
    if (!showUnsavedChangesModal || typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowUnsavedChangesModal(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showUnsavedChangesModal]);

  useEffect(() => {
    if (!hasUnsavedFormChanges && showUnsavedChangesModal) {
      setShowUnsavedChangesModal(false);
    }
  }, [hasUnsavedFormChanges, showUnsavedChangesModal]);

  useEffect(() => {
    if (recentlyAddedMeaningIndex === null || typeof window === "undefined") {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRecentlyAddedMeaningIndex(null);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [recentlyAddedMeaningIndex]);

  useEffect(() => {
    if (recentlyAddedExampleKey === null || typeof window === "undefined") {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRecentlyAddedExampleKey(null);
    }, 1100);

    return () => {
      window.clearTimeout(timer);
    };
  }, [recentlyAddedExampleKey]);

  const canUseVideoLayer = (key) => {
    const conflictMessage = getVideoLayerConflictMessage(key);

    if (conflictMessage) {
      setVideoLayerConflictMessage(key, conflictMessage);
      return false;
    }

    clearVideoLayerConflictMessages();
    setVideoError(key);
    return true;
  };

  const getEditorScrollTopOffset = () => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches
    ) {
      return 88;
    }

    return 112;
  };

  const scrollCardIntoComfortableView = (cardElement) => {
    if (typeof window === "undefined" || !cardElement) return;

    const cardRect = cardElement.getBoundingClientRect();
    const targetTop = Math.max(
      0,
      window.scrollY + cardRect.top - getEditorScrollTopOffset()
    );

    window.scrollTo({
      top: targetTop,
      behavior: "smooth",
    });
  };

  const focusFirstEditableField = (
    cardElement,
    preferredSelectors = [],
    focusDelay = 220
  ) => {
    if (!cardElement || typeof cardElement.querySelector !== "function") {
      return false;
    }

    const fallbackSelectors = [
      'input:not([type="hidden"]):not([disabled])',
      "textarea:not([disabled])",
      "select:not([disabled])",
    ];
    const selectors = [...preferredSelectors, ...fallbackSelectors];
    const targetField = selectors.reduce((current, selector) => {
      if (current) return current;
      return cardElement.querySelector(selector);
    }, null);

    if (!targetField || typeof targetField.focus !== "function") {
      return false;
    }

    window.setTimeout(() => {
      try {
        targetField.focus({ preventScroll: true });
      } catch {
        targetField.focus();
      }
    }, focusDelay);

    return true;
  };

  const revealMeaningCardForEditing = (
    meaningIndex,
    options = { shouldHighlight: false }
  ) => {
    const { shouldHighlight = false } = options;

    if (shouldHighlight) {
      setRecentlyAddedMeaningIndex(meaningIndex);
    }

    const ensureVisible = (attempt = 0) => {
      const meaningCard = meaningCardRefs.current[meaningIndex];

      if (meaningCard) {
        scrollCardIntoComfortableView(meaningCard);
        const didFocus = focusFirstEditableField(meaningCard, [
          `input[name="meaning-field-${meaningIndex}"]`,
        ]);

        if (didFocus || attempt >= 12 || typeof window === "undefined") {
          return;
        }
      }

      if (attempt < 12 && typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          ensureVisible(attempt + 1);
        });
      }
    };

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        ensureVisible();
      });
    }
  };

  const revealExampleCardForEditing = (
    meaningIndex,
    exampleIndex,
    options = { shouldHighlight: false }
  ) => {
    const exampleKey = getExampleKey(meaningIndex, exampleIndex);
    const { shouldHighlight = false } = options;

    if (shouldHighlight) {
      setRecentlyAddedExampleKey(exampleKey);
    }

    const ensureVisible = (attempt = 0) => {
      const exampleCard = exampleCardRefs.current[exampleKey];

      if (exampleCard) {
        scrollCardIntoComfortableView(exampleCard);
        const didFocus = focusFirstEditableField(exampleCard, [
          `input[name="example-sentence-field-${meaningIndex}-${exampleIndex}"]`,
        ]);

        if (didFocus || attempt >= 12 || typeof window === "undefined") {
          return;
        }
      }

      if (attempt < 12 && typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          ensureVisible(attempt + 1);
        });
      }
    };

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        ensureVisible();
      });
    }
  };

  const toggleMeaningExpanded = (idx) => {
    const shouldExpandMeaning = !expandedMeanings[idx];
    resetActiveVideoPreview();

    setExpandedMeanings((current) => {
      const isClosing = Boolean(current[idx]);

      if (isClosing) {
        setExpandedExamples((currentExamples) => {
          const nextExamples = { ...currentExamples };
          const meaningKeyPrefix = `${idx}-`;
          let changed = false;

          Object.keys(nextExamples).forEach((exampleKey) => {
            if (!exampleKey.startsWith(meaningKeyPrefix)) return;
            if (!nextExamples[exampleKey]) return;

            nextExamples[exampleKey] = false;
            changed = true;
          });

          return changed ? nextExamples : currentExamples;
        });
      }

      return { ...current, [idx]: !current[idx] };
    });

    if (shouldExpandMeaning) {
      revealMeaningCardForEditing(idx);
    }
  };

  const toggleExampleExpanded = (mIdx, eIdx) => {
    const key = getExampleKey(mIdx, eIdx);
    const shouldExpandExample = !expandedExamples[key];
    resetActiveVideoPreview();
    setExpandedExamples((current) => ({ ...current, [key]: !current[key] }));

    if (shouldExpandExample) {
      revealExampleCardForEditing(mIdx, eIdx);
    }
  };

  const updateMeaning = (idx, field, value) => {
    const updated = [...meanings];
    updated[idx] = { ...updated[idx], [field]: value };
    setMeanings(updated);

    if (field === "meaning" && normalizeText(value)) {
      setPendingNewMeanings((current) => {
        if (!current[idx]) return current;

        const next = { ...current };
        delete next[idx];
        return next;
      });
    }
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

  const isExampleDraftEmpty = (example = {}) =>
    !normalizeExampleText(example?.sentence) &&
    !normalizeExampleText(example?.translation) &&
    normalizeExampleVideos(example).length === 0;

  const addMeaning = () => {
    const nextIndex = meanings.length;
    const firstExampleKey = getExampleKey(nextIndex, 0);

    resetActiveVideoPreview();
    setMeanings([...meanings, { ...emptyMeaning, examples: [{ ...emptyExample }] }]);
    setExpandedMeanings((current) => ({ ...current, [nextIndex]: true }));
    setExpandedExamples((current) => ({ ...current, [firstExampleKey]: false }));
    setPendingNewMeanings((current) => ({ ...current, [nextIndex]: true }));
    revealMeaningCardForEditing(nextIndex, { shouldHighlight: true });
  };

  const removeMeaning = async (idx) => {
    if (meanings.length <= 1) return;

    const meaningVideos = normalizeMeaningVideos(meanings[idx])
      .map((entry) => normalizeText(entry?.video))
      .filter(Boolean);
    const exampleVideos = meanings[idx].examples
      .flatMap((example) =>
        normalizeExampleVideos(example).map((entry) => normalizeText(entry?.video))
      )
      .filter(Boolean);

    const videosToDelete = Array.from(
      new Set([...meaningVideos, ...exampleVideos].filter(Boolean))
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

      setPendingNewMeanings((current) => {
        const next = {};

        Object.entries(current).forEach(([key, value]) => {
          const currentIndex = Number(key);
          if (!value || currentIndex === idx) return;
          const nextIndex = currentIndex > idx ? currentIndex - 1 : currentIndex;
          next[nextIndex] = true;
        });

        return next;
      });

      setExpandedExamples({});
      setVideoEditor({ key: null, value: "", initialValue: "" });
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
    const currentExamples = updated[mIdx]?.examples || [];
    const reusableEmptyExampleIndex = currentExamples.findIndex((example, index) => {
      const exampleKey = getExampleKey(mIdx, index);
      return isExampleDraftEmpty(example) && !expandedExamples[exampleKey];
    });

    resetActiveVideoPreview();

    if (reusableEmptyExampleIndex >= 0) {
      setExpandedExamples((current) => ({
        ...current,
        [getExampleKey(mIdx, reusableEmptyExampleIndex)]: true,
      }));

      revealExampleCardForEditing(mIdx, reusableEmptyExampleIndex, {
        shouldHighlight: true,
      });
      return;
    }

    const nextExampleIndex = currentExamples.length;

    updated[mIdx] = {
      ...updated[mIdx],
      examples: [...currentExamples, { ...emptyExample }],
    };

    setMeanings(updated);

    setExpandedExamples((current) => ({
      ...current,
      [getExampleKey(mIdx, nextExampleIndex)]: true,
    }));

    revealExampleCardForEditing(mIdx, nextExampleIndex, {
      shouldHighlight: true,
    });
  };

  const removeExample = async (mIdx, eIdx) => {
    const key = getExampleKey(mIdx, eIdx);
    const videoValues = normalizeExampleVideos(meanings[mIdx]?.examples?.[eIdx])
      .map((entry) => normalizeText(entry?.video))
      .filter(Boolean);

    try {
      setDeletingVideoKey(key);
      setVideoError(key);

      for (const videoValue of videoValues) {
        await deleteVideoFromR2(videoValue);
      }

      const updated = [...meanings];
      const remainingExamples = updated[mIdx].examples.filter(
        (_, index) => index !== eIdx
      );

      updated[mIdx] = {
        ...updated[mIdx],
        examples: remainingExamples.length > 0 ? remainingExamples : [{ ...emptyExample }],
      };

      setMeanings(updated);

      setVideoEditor((current) =>
        current.key === key ? { key: null, value: "", initialValue: "" } : current
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
    if (!canUseVideoLayer(key)) return;

    resetActiveVideoPreview();

    const cleanCurrentVideo = typeof currentVideo === "string" ? currentVideo : "";

    setVideoEditor({
      key,
      value: cleanCurrentVideo,
      initialValue: cleanCurrentVideo,
    });
  };

  const closeVideoEditor = () => {
    clearVideoLayerConflictMessages();
    setVideoEditor({ key: null, value: "", initialValue: "" });
  };

  const saveVideoFromEditor = async ({ key, oldVideo, onSuccess }) => {
    const nextVideo = videoEditor.value.trim();

    if (!canUseVideoLayer(key)) return;

    try {
      setDeletingVideoKey(key);
      setVideoError(key);

      if (oldVideo && oldVideo !== nextVideo) {
        await deleteVideoFromR2(oldVideo);
      }

      const nextThumbnail = await resolveExampleVideoThumbnail(nextVideo);

      onSuccess({ video: nextVideo, thumbnail: nextThumbnail });
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
        current.key === key ? { key: null, value: "", initialValue: "" } : current
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
    if (!canUseVideoLayer(videoKey)) return;

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

    if (!canUseVideoLayer(key)) return;

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
    if (!hasPendingChanges) return;

    if (!term.trim()) {
      alert("Preencha a palavra ou frase em inglês antes de salvar.");
      return;
    }

    if (!user?.id) {
      alert("Usuário não identificado.");
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();
      const {
        term: cleanTerm,
        pronunciation: cleanPronunciation,
        cleanWordVideos,
        cleanWordVideo,
        cleanWordThumbnail,
        cleanedMeanings,
      } = currentDraftSnapshot;

      const stats = {
        ...(item?.stats || getDefaultStats()),
        wordVideo: cleanWordVideo,
        wordThumbnail: cleanWordThumbnail,
        wordVideos: cleanWordVideos,
      };

      if (item?.id) {
        const payload = {
          term: cleanTerm,
          pronunciation: cleanPronunciation,
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
          term: cleanTerm,
          pronunciation: cleanPronunciation,
          meanings: cleanedMeanings,
          stats,
          created_at: now,
          updated_at: now,
        };

        const { data: insertedItem, error } = await supabase
          .from("vocabulary")
          .insert([payload])
          .select("*")
          .single();

        if (error) throw error;

        onSaved?.({
          ...(item || {}),
          id: insertedItem?.id || null,
          term: cleanTerm,
          pronunciation: cleanPronunciation,
          meanings: cleanedMeanings,
          stats,
        });

        setSavedDraftSignature(currentDraftSignature);
        setVideoEditor((current) =>
          current.key ? { ...current, initialValue: current.value } : current
        );
        return;
      }

      onSaved?.({
        ...(item || {}),
        id: item?.id || null,
        term: cleanTerm,
        pronunciation: cleanPronunciation,
        meanings: cleanedMeanings,
        stats,
      });
      setSavedDraftSignature(currentDraftSignature);
      setVideoEditor((current) =>
        current.key ? { ...current, initialValue: current.value } : current
      );
    } catch (error) {
      console.error("Erro ao salvar item no Supabase:", error);
      alert("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const leaveEditorWithoutSaving = () => {
    if (typeof onBack === "function") {
      onBack();
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    }
  };

  const handleBackClick = () => {
    if (hasUnsavedFormChanges) {
      setShowUnsavedChangesModal(true);
      return;
    }

    leaveEditorWithoutSaving();
  };

  const handleCancelLeaveWithoutSaving = () => {
    setShowUnsavedChangesModal(false);
  };

  const handleConfirmLeaveWithoutSaving = () => {
    setShowUnsavedChangesModal(false);
    leaveEditorWithoutSaving();
  };

  const newWordVideoUploadError = videoUploadErrors[NEW_WORD_VIDEO_KEY] || "";
  const totalExamples = meanings.reduce(
    (total, meaningItem) =>
      total +
      (meaningItem.examples || []).filter((example) => !isExampleDraftEmpty(example))
        .length,
    0
  );
  const meaningVideoCount = meanings.reduce(
    (total, meaningItem) => total + normalizeMeaningVideos(meaningItem).length,
    0
  );
  const exampleVideoCount = meanings.reduce(
    (total, meaningItem) =>
      total +
      (meaningItem.examples || []).reduce(
        (exampleTotal, example) =>
          exampleTotal + normalizeExampleVideos(example).length,
        0
      ),
    0
  );
  const totalVideoCount =
    wordVideos.length + meaningVideoCount + exampleVideoCount;
  const completedMeanings = meanings.filter((meaningItem) =>
    normalizeText(meaningItem.meaning)
  ).length;
  const hasAnyMeaningContent = meanings.some(
    (meaningItem) =>
      normalizeText(meaningItem.meaning) ||
      normalizeText(meaningItem.tip) ||
      normalizeMeaningVideos(meaningItem).length > 0 ||
      (meaningItem.examples || []).some((example) => !isExampleDraftEmpty(example))
  );

  return (
    <>
      <div className="manager-form-editor-shell mx-auto w-full max-w-6xl overflow-x-hidden overscroll-x-none touch-pan-y pb-10 md:pb-8 md:pl-12 lg:pl-14">
      <div className="mb-5 px-2 py-1 md:mb-8 md:px-1 md:py-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={handleBackClick}
              className="mb-3 inline-flex min-h-[40px] touch-manipulation items-center gap-2 rounded-full border border-transparent px-2.5 text-sm font-semibold text-[#0066CC] transition-colors hover:bg-[#F5F5F7] active:bg-[#EDEDF0] dark:text-[#66B7FF] dark:hover:bg-[#2C2C2E] md:mb-5"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>

            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.015em] text-[#1D1D1F] dark:text-[#F5F5F7] md:mt-4 md:text-4xl">
              {item ? "Editar palavra ou frase" : "Nova palavra ou frase"}
            </h1>
            <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[#6E6E73] dark:text-[#A1A1A6]">
              Monte o conteúdo em camadas: dados principais, vídeo geral,
              significados, dicas, exemplos e vídeos específicos.
            </p>
          </div>

        </div>

        <div className="mt-6 hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          <SummaryMetric
            icon={<Languages className="h-4 w-4" />}
            label="Significados"
            value={`${completedMeanings}/${meanings.length}`}
            tone={completedMeanings > 0 ? "success" : "warning"}
          />
          <SummaryMetric
            icon={<BookOpenText className="h-4 w-4" />}
            label="Exemplos"
            value={totalExamples}
            tone={totalExamples > 0 ? "info" : "neutral"}
          />
          <SummaryMetric
            icon={<Clapperboard className="h-4 w-4" />}
            label="Vídeos"
            value={totalVideoCount}
            tone={totalVideoCount > 0 ? "warning" : "neutral"}
          />
          <SummaryMetric
            icon={<Layers3 className="h-4 w-4" />}
            label="Camada ativa"
            value={hasWordLevelVideos ? "Geral" : hasMeaningOrExampleVideos ? "Interna" : "Livre"}
            tone={hasWordLevelVideos || hasMeaningOrExampleVideos ? "info" : "neutral"}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-6 md:gap-8">
        <section className="order-1 rounded-[28px] border border-[#E5E5EA] bg-white p-5 shadow-none ring-1 ring-black/[0.025] dark:border-[#2C2C2E] dark:bg-[#1C1C1E] dark:ring-white/[0.05] md:p-6">
          <SectionHeader
            eyebrow="Camada 1"
            title="Dados principais"
            description="Comece pela palavra ou frase em inglês. A pronúncia é opcional, mas ajuda nos modos de estudo."
            icon={<Languages className="h-3.5 w-3.5" />}
          />

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <FieldLabel icon={<UsFlagIcon />}>
                Palavra ou frase em inglês
              </FieldLabel>

              <input
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="min-h-12 w-full rounded-[16px] border border-[#D2D2D7] bg-white px-4 py-3 text-base font-semibold text-[#1D1D1F] shadow-none transition-all placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15 dark:border-[#3A3A3C] dark:bg-[#111113] dark:text-[#F5F5F7] dark:placeholder:text-[#8E8E93] dark:focus:border-[#0A84FF] dark:focus:ring-[#0A84FF]/20"
                placeholder="Ex: break down"
              />
            </div>

            <div>
              <FieldLabel icon={<Volume2 className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" />}>
                Pronúncia
              </FieldLabel>

              <input
                type="text"
                value={pronunciation}
                onChange={(e) => setPronunciation(e.target.value)}
                className="min-h-12 w-full rounded-[16px] border border-[#D2D2D7] bg-white px-4 py-3 text-sm italic text-[#1D1D1F] shadow-none transition-all placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15 dark:border-[#3A3A3C] dark:bg-[#111113] dark:text-[#F5F5F7] dark:placeholder:text-[#8E8E93] dark:focus:border-[#0A84FF] dark:focus:ring-[#0A84FF]/20"
                placeholder="Ex: breik daun"
              />
            </div>
          </div>
        </section>

        <section className="order-2 space-y-4 px-2 sm:px-0">
          <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,720px)_auto] md:items-end md:justify-between md:gap-x-8">
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#86868B] dark:text-[#8E8E93]">
                <Layers3 className="h-3.5 w-3.5" />
                <span>Camada 2</span>
              </div>

              <h2 className="text-xl font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] md:text-2xl">
                Significados, dicas e exemplos
              </h2>

              <p className="mt-1 max-w-full text-sm leading-relaxed text-muted-foreground md:max-w-[680px]">
                Cada significado funciona como uma camada própria. Dentro dele você pode adicionar dica, vídeo do significado e exemplos com vídeo específico.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 md:translate-y-1">
              <StatusPill tone="neutral">
                {meanings.length} significado{meanings.length === 1 ? "" : "s"}
              </StatusPill>

              <button
                type="button"
                onClick={addMeaning}
                className={`min-h-10 items-center justify-center gap-2 rounded-full bg-[#0071E3] px-4 py-2 text-sm font-semibold text-white shadow-none transition-colors hover:bg-[#0077ED] active:bg-[#006EDB] dark:bg-[#0A84FF] dark:hover:bg-[#2290FF] ${
                  hasAnyMeaningContent ? "inline-flex" : "hidden md:inline-flex"
                }`}
              >
                <Plus className="h-4 w-4" /> Adicionar significado
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {meanings.map((meaningItem, mIdx) => {
              const isExpanded = Boolean(expandedMeanings[mIdx]);
              const meaningTitle = normalizeText(meaningItem.meaning);
              const isMeaningEmpty = !meaningTitle;
              const isPendingNewMeaning = Boolean(pendingNewMeanings[mIdx]);
              const shouldUseEmptyMeaningAccent =
                (isPendingNewMeaning || !hasAnyMeaningContent) && isMeaningEmpty;
              const meaningDisplayTitle = meaningTitle || "Adicionar significado";
              const accentIndex =
                meaningAccentIndexes[mIdx] ??
                (mIdx % activeMeaningAccentPalette.length);
              const accent = activeMeaningAccentPalette[accentIndex];
              const borderColor = shouldUseEmptyMeaningAccent
                ? emptyMeaningAccent.border
                : accent.border;

              const meaningVideoEntries = normalizeMeaningVideos(meaningItem);
              const hasMeaningVideo = meaningVideoEntries.length > 0;
              const hasExampleVideoInsideMeaning = meaningItem.examples.some((example) =>
                normalizeExampleVideos(example).some((entry) =>
                  Boolean(normalizeText(entry?.video))
                )
              );
              const hasAnyVideoInsideMeaning =
                hasMeaningVideo || hasExampleVideoInsideMeaning;
              const newMeaningVideoKey = getNewMeaningVideoKey(mIdx);
              const newMeaningVideoUploadError =
                videoUploadErrors[newMeaningVideoKey] || "";
              const filledExamplesCount = meaningItem.examples.filter(
                (example) => !isExampleDraftEmpty(example)
              ).length;
              const meaningExamplesLabel = `${filledExamplesCount} ${
                filledExamplesCount === 1 ? "exemplo" : "exemplos"
              }`;
              const meaningCardClassName = shouldUseEmptyMeaningAccent
                ? "border-[#E5E5EA] dark:border-[#2C2C2E]"
                : isExpanded
                  ? "border-[#D6E8FA] shadow-[0_14px_36px_rgba(15,23,42,0.08)] dark:border-[#244B72] dark:shadow-[0_18px_38px_rgba(0,0,0,0.28)]"
                  : "border-[#E5E5EA] dark:border-[#2C2C2E]";
              const meaningHeaderClassName = shouldUseEmptyMeaningAccent
                ? isExpanded
                  ? "border-[#D6E8FA] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] dark:border-[#244B72] dark:bg-[linear-gradient(180deg,#1D232C_0%,#181D24_100%)]"
                  : "border-transparent bg-[#FBFBFD] hover:bg-white dark:bg-[#1A1C20] dark:hover:bg-[#20242B]"
                : isExpanded
                  ? "border-[#D6E8FA] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] dark:border-[#244B72] dark:bg-[linear-gradient(180deg,#1D232C_0%,#181D24_100%)]"
                  : "border-[#E5E5EA] bg-[#FBFBFD] hover:bg-white dark:border-[#2C2C2E] dark:bg-[#1A1C20] dark:hover:bg-[#20242B]";
              const meaningIndexClassName = isExpanded
                ? "border-[#0071E3] bg-[#0071E3] text-white shadow-[0_8px_18px_rgba(0,113,227,0.22)] dark:border-[#0A84FF] dark:bg-[#0A84FF] dark:shadow-[0_10px_20px_rgba(10,132,255,0.28)]"
                : "border-[#E5E5EA] bg-[#F5F5F7] text-[#6E6E73] dark:border-[#3A3A3C] dark:bg-[#2A2D33] dark:text-[#D1D1D6]";
              const emptyMeaningIndexClassName = isExpanded
                ? "border-[#0071E3] bg-[#0071E3] text-white shadow-[0_8px_18px_rgba(0,113,227,0.22)] dark:border-[#0A84FF] dark:bg-[#0A84FF] dark:shadow-[0_10px_20px_rgba(10,132,255,0.28)]"
                : "border-[#D6E8FA] bg-[#F5FAFF] text-[#0071E3] dark:border-[#244B72] dark:bg-[#102235] dark:text-[#66B7FF]";

              return (
                <div
                  key={mIdx}
                  ref={(element) => {
                    if (element) {
                      meaningCardRefs.current[mIdx] = element;
                    } else {
                      delete meaningCardRefs.current[mIdx];
                    }
                  }}
                  className={`overflow-hidden rounded-[28px] border bg-white ring-1 ring-black/[0.025] transition-all duration-200 dark:bg-[#17181C] dark:ring-white/[0.05] ${meaningCardClassName} ${
                    recentlyAddedMeaningIndex === mIdx
                      ? "manager-form-editor-card-created"
                      : ""
                  }`}
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
                    className={`group flex cursor-pointer items-stretch justify-between gap-4 border-b px-4 py-4 transition-all duration-200 md:px-5 ${meaningHeaderClassName}`}
                    aria-expanded={isExpanded}
                  >
                    <div className="min-w-0 flex flex-1 items-center gap-3 text-left">
                      <span className="min-w-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 leading-snug">
                        {shouldUseEmptyMeaningAccent ? (
                          <>
                            <span
                              className={`inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full border px-2 text-xs font-semibold transition-all duration-200 ${emptyMeaningIndexClassName}`}
                              aria-hidden="true"
                            >
                              <Plus className="h-4 w-4 stroke-[2.2]" />
                            </span>
                            <span
                              className={`min-w-0 break-words text-base font-semibold leading-snug transition-colors ${
                                isExpanded
                                  ? "text-[#111827] dark:text-[#F5F5F7]"
                                  : "text-[#1D1D1F] dark:text-[#F2F4F8]"
                              }`}
                              style={{ overflowWrap: "anywhere" }}
                            >
                              {meaningDisplayTitle}
                            </span>
                          </>
                        ) : (
                          <>
                            <span
                              className={`inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full border px-2 text-xs font-semibold transition-all duration-200 ${meaningIndexClassName}`}
                            >
                              {mIdx + 1}
                            </span>
                            <span
                              className={`min-w-0 break-words text-base font-semibold leading-snug transition-colors ${
                                isExpanded
                                  ? "text-[#111827] dark:text-[#F5F5F7]"
                                  : "text-[#1D1D1F] dark:text-[#F2F4F8]"
                              }`}
                              style={{
                                overflowWrap: "anywhere",
                              }}
                            >
                              {meaningDisplayTitle}
                            </span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 self-center">
                      <StatusPill
                        tone="neutral"
                        className="hidden min-h-8 border-[#E5E5EA] bg-[#FFFFFF]/88 px-3 text-[11px] text-[#51545B] dark:border-[#343943] dark:bg-[#20242B] dark:text-[#C8CDD5] md:inline-flex"
                      >
                        {meaningExamplesLabel}
                      </StatusPill>

                      {hasAnyVideoInsideMeaning ? (
                        <VideoAttachedBadge className="h-8 w-8" />
                      ) : null}

                      {meanings.length > 1 ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeMeaning(mIdx);
                          }}
                          disabled={deletingVideoKey === `meaning-${mIdx}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-[#B42318] transition-colors hover:bg-[#FFF7F6] dark:text-[#FF8A80] dark:hover:bg-[#311918] disabled:opacity-50"
                          aria-label={`Remover significado ${mIdx + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}

                      <span
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-[#6E6E73] transition-colors duration-200 group-hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:group-hover:text-[#F5F5F7]"
                        aria-hidden="true"
                      >
                        <ChevronRight
                          className={`h-5 w-5 stroke-[2.2] transition-transform duration-200 ${
                            isExpanded ? "rotate-90" : "rotate-0"
                          }`}
                        />
                      </span>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="flex flex-col gap-5 p-4 md:p-5">
                      <div className="order-1 border-b border-[#E5E5EA] pb-5 dark:border-[#2C2C2E]">
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                          <div className="hidden md:block">
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
                              className="w-full rounded-[16px] border border-[#D2D2D7] bg-white px-4 py-2.5 text-sm font-semibold text-[#1D1D1F] transition-all placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15 dark:border-[#3A3A3C] dark:bg-[#111113] dark:text-[#F5F5F7] dark:placeholder:text-[#8E8E93] dark:focus:border-[#0A84FF] dark:focus:ring-[#0A84FF]/20"
                            />
                          </div>

                          <div className="hidden md:block">
                            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#6E6E73] dark:text-[#A1A1A6]">
                              <Hash className="h-3.5 w-3.5 text-[#0071E3] dark:text-[#0A84FF]" />
                              <span>Tag</span>
                            </label>

                            <div className="relative">
                              <select
                                value={meaningItem.category}
                                onChange={(e) =>
                                  updateMeaning(mIdx, "category", e.target.value)
                                }
                                className="w-full appearance-none rounded-[16px] border border-[#D2D2D7] bg-white py-2.5 pl-3 pr-11 text-sm font-semibold text-[#1D1D1F] transition-all focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15 dark:border-[#3A3A3C] dark:bg-[#111113] dark:text-[#F5F5F7] dark:focus:border-[#0A84FF] dark:focus:ring-[#0A84FF]/20"
                              >
                                {categories.map((category) => (
                                  <option key={category} value={category}>
                                    {category}
                                  </option>
                                ))}
                              </select>

                              <span
                                className="pointer-events-none absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#6E6E73] transition-colors dark:text-[#D1D1D6]"
                                aria-hidden="true"
                              >
                                <ChevronDown className="h-4 w-4 stroke-[2.2]" />
                              </span>
                            </div>
                          </div>
                        </div>

                      </div>

                      <div className="order-2 border-b border-[#E5E5EA] pb-5 dark:border-[#2C2C2E] md:hidden">
                        <MeaningLanguageLabel compact />
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
                          name={`meaning-field-mobile-${mIdx}`}
                          inputMode="text"
                          className="w-full rounded-[16px] border border-[#D2D2D7] bg-white px-4 py-2.5 text-sm font-semibold text-[#1D1D1F] transition-all placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15 dark:border-[#3A3A3C] dark:bg-[#111113] dark:text-[#F5F5F7] dark:placeholder:text-[#8E8E93] dark:focus:border-[#0A84FF] dark:focus:ring-[#0A84FF]/20"
                        />
                      </div>

                      <div className="order-3 md:order-2">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#424245] dark:text-[#D1D1D6]">
                            <BookOpenText className="h-3.5 w-3.5 text-[#0071E3] dark:text-[#0A84FF]" />
                            <span>Exemplos</span>
                          </span>

                          {filledExamplesCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => addExample(mIdx)}
                              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[#D2D2D7] bg-white px-3.5 py-2 text-xs font-semibold text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] active:bg-[#EDEDF0] dark:border-[#3A3A3C] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] dark:hover:bg-[#3A3A3C]"
                            >
                              <Plus className="h-3.5 w-3.5 text-[#0071E3] dark:text-[#0A84FF]" />
                              Adicionar exemplo
                            </button>
                          ) : null}
                        </div>

                        <div className="space-y-3">
                          {meaningItem.examples.map((example, eIdx) => {
                            const exampleKey = getExampleKey(mIdx, eIdx);
                            const exampleVideoEntries = normalizeExampleVideos(example);
                            const hasVideo = exampleVideoEntries.length > 0;
                            const activeExampleVideoIndex = Math.max(
                              0,
                              exampleVideoEntries.findIndex((_, videoIndex) =>
                                activeVideoPreviewKey ===
                                getExampleVideoKey(mIdx, eIdx, videoIndex)
                              )
                            );
                            const activeExampleVideoKey = hasVideo
                              ? getExampleVideoKey(
                                  mIdx,
                                  eIdx,
                                  activeExampleVideoIndex
                                )
                              : "";
                            const activeExampleVideoEntry =
                              exampleVideoEntries[activeExampleVideoIndex] ||
                              exampleVideoEntries[0];
                            const isPreviewActive =
                              activeVideoPreviewKey === activeExampleVideoKey;
                            const videoValue = normalizeText(
                              activeExampleVideoEntry?.video
                            );
                            const thumbnailValue = videoValue
                              ? normalizeText(activeExampleVideoEntry?.thumbnail)
                              : "";
                            const isExampleExpanded = Boolean(
                              expandedExamples[exampleKey]
                            );
                            const isExampleEmptyDraft = isExampleDraftEmpty(example);
                            const shouldShowEmptyExamplePlaceholder =
                              filledExamplesCount === 0 &&
                              isExampleEmptyDraft &&
                              !isExampleExpanded;
                            const shouldShowExampleCard =
                              !isExampleEmptyDraft ||
                              isExampleExpanded ||
                              shouldShowEmptyExamplePlaceholder;

                            if (!shouldShowExampleCard) {
                              return null;
                            }

                            const isDeletingExample =
                              deletingVideoKey === exampleKey;
                            const exampleSentence = normalizeExampleText(
                              example?.sentence
                            );
                            const exampleTranslation = normalizeExampleText(
                              example?.translation
                            );
                            const exampleTitle =
                              exampleTranslation || exampleSentence || "Adicionar exemplo";
                            const isExampleIncomplete =
                              !shouldShowEmptyExamplePlaceholder &&
                              (!exampleSentence || !exampleTranslation);
                            const isExampleEmpty = isExampleEmptyDraft;
                            const newExampleVideoKey = getNewExampleVideoKey(
                              mIdx,
                              eIdx
                            );
                            const isNewExampleVideoEditing =
                              videoEditor.key === newExampleVideoKey;
                            const newExampleVideoUploadError =
                              videoUploadErrors[newExampleVideoKey] || "";
                            const exampleCardClassName = shouldShowEmptyExamplePlaceholder
                              ? "border-[#E5E5EA] bg-[#FBFBFD] dark:border-[#2C2C2E] dark:bg-[#1A1C20]"
                              : isExampleIncomplete
                              ? "border-[#D6E8FA] bg-white shadow-[0_14px_36px_rgba(15,23,42,0.08)] dark:border-[#244B72] dark:bg-[#1C1C1E] dark:shadow-[0_18px_38px_rgba(0,0,0,0.28)]"
                              : "border-[#E5E5EA] bg-white dark:border-[#2C2C2E] dark:bg-[#1C1C1E]";
                            const exampleHeaderClassName = shouldShowEmptyExamplePlaceholder
                              ? "group flex cursor-pointer items-stretch justify-between gap-3 border-b-0 bg-[#FBFBFD] px-4 py-4 transition-colors hover:bg-white dark:bg-[#1A1C20] dark:hover:bg-[#20242B]"
                              : isExampleIncomplete
                              ? "group flex cursor-pointer items-stretch justify-between gap-3 border-b border-[#D6E8FA] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] px-4 py-3 transition-colors hover:bg-[#FAFAFC] dark:border-[#244B72] dark:bg-[linear-gradient(180deg,#1D232C_0%,#181D24_100%)] dark:hover:bg-[#20242B]"
                              : "group flex cursor-pointer items-stretch justify-between gap-3 border-b border-[#E5E5EA] bg-white px-4 py-3 transition-colors hover:bg-[#FAFAFC] dark:border-[#2C2C2E] dark:bg-[#1C1C1E] dark:hover:bg-[#2C2C2E]";

                            return (
                              <div
                                key={exampleKey}
                                ref={(element) => {
                                  if (element) {
                                    exampleCardRefs.current[exampleKey] = element;
                                  } else {
                                    delete exampleCardRefs.current[exampleKey];
                                  }
                                }}
                                className={`overflow-hidden rounded-[22px] border shadow-none transition-colors duration-200 ${exampleCardClassName} ${
                                  recentlyAddedExampleKey === exampleKey && !isExampleIncomplete
                                    ? "manager-form-editor-card-created"
                                    : ""
                                }`}
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
                                  className={exampleHeaderClassName}
                                  aria-expanded={isExampleExpanded}
                                >
                                  <div className="min-w-0 flex flex-1 items-center gap-2 text-left">
                                    {isExampleEmpty ? (
                                      <span
                                        className="inline-flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-[#6E6E73] dark:text-[#D1D1D6]"
                                        title={exampleTitle}
                                      >
                                        <Plus className="h-3.5 w-3.5 text-[#0071E3] dark:text-[#0A84FF]" />
                                        {exampleTitle}
                                      </span>
                                    ) : (
                                      <>
                                        <span className="shrink-0 text-sm font-normal text-[#6E6E73] dark:text-[#A1A1A6]">
                                          EX:
                                        </span>
                                        <span
                                          className="shrink-0 text-sm font-semibold"
                                          style={{ color: accent.bar }}
                                        >
                                          {eIdx + 1}
                                        </span>
                                        <span className="shrink-0 text-sm font-normal text-[#8E8E93] dark:text-[#8E8E93]">
                                          —
                                        </span>
                                        <span
                                          className="min-w-0 truncate text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]"
                                          title={exampleTitle}
                                        >
                                          {exampleTitle}
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  <div className="flex shrink-0 items-center gap-1.5 self-center">
                                    {hasVideo ? (
                                      <VideoAttachedBadge className="h-7 w-7" />
                                    ) : null}

                                    {!shouldShowEmptyExamplePlaceholder ? (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void removeExample(mIdx, eIdx);
                                        }}
                                        disabled={isDeletingExample}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#86868B] transition-colors hover:bg-[#FFF7F6] hover:text-[#B42318] dark:text-[#A1A1A6] dark:hover:bg-[#2B1513] dark:hover:text-[#FF9F95] disabled:opacity-50"
                                        aria-label={`Remover exemplo ${eIdx + 1}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    ) : null}

                                    <span
                                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-[#6E6E73] transition-colors duration-200 group-hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:group-hover:text-[#F5F5F7]"
                                      aria-hidden="true"
                                    >
                                      <ChevronRight
                                        className={`h-5 w-5 stroke-[2.2] transition-transform duration-200 ${
                                          isExampleExpanded ? "rotate-90" : "rotate-0"
                                        }`}
                                      />
                                    </span>
                                  </div>
                                </div>

                                {isExampleExpanded ? (
                                  <div className="p-4">
                                    <div
                                      className={
                                        hasVideo
                                          ? "grid items-stretch gap-4 md:grid-cols-[minmax(0,1fr)_264px]"
                                          : "grid gap-4"
                                      }
                                    >
                                      <div className="min-w-0">
                                        <div className="grid gap-3">
                                          <div>
                                            <ExampleLanguageLabel
                                              flag={<UsFlagIcon />}
                                              code="EN-US"
                                            />
                                            <input
                                              type="text"
                                              value={example.sentence}
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
                                              name={`example-sentence-field-${mIdx}-${eIdx}`}
                                              className="w-full rounded-[16px] border border-[#D2D2D7] bg-white px-3.5 py-2 text-sm text-[#1D1D1F] transition-all placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15 dark:border-[#3A3A3C] dark:bg-[#111113] dark:text-[#F5F5F7] dark:placeholder:text-[#8E8E93] dark:focus:border-[#0A84FF] dark:focus:ring-[#0A84FF]/20"
                                            />
                                          </div>

                                          <div>
                                            <ExampleLanguageLabel
                                              flag={<BrFlagIcon />}
                                              code="PT-BR"
                                            />
                                            <input
                                              type="text"
                                              value={example.translation}
                                              onChange={(e) =>
                                                updateExample(
                                                  mIdx,
                                                  eIdx,
                                                  "translation",
                                                  e.target.value
                                                )
                                              }
                                              name={`example-translation-field-${mIdx}-${eIdx}`}
                                              placeholder="Tradução em português"
                                              className="w-full rounded-[16px] border border-[#D2D2D7] bg-white px-3.5 py-2 text-sm text-[#1D1D1F] transition-all placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15 dark:border-[#3A3A3C] dark:bg-[#111113] dark:text-[#F5F5F7] dark:placeholder:text-[#8E8E93] dark:focus:border-[#0A84FF] dark:focus:ring-[#0A84FF]/20"
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      {hasVideo ? (
                                        <div className="flex h-full self-stretch md:items-start">
                                          <ExampleVideoPreview
                                            video={videoValue}
                                            thumbnail={thumbnailValue}
                                            isActive={isPreviewActive}
                                            onPlay={() =>
                                              setActiveVideoPreviewKey(
                                                activeExampleVideoKey
                                              )
                                            }
                                            className="w-full md:w-[264px]"
                                          />
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="mt-3 space-y-2">
                                      {exampleVideoEntries.map((exampleVideoEntry, videoIndex) => {
                                        const exampleVideoKey = getExampleVideoKey(
                                          mIdx,
                                          eIdx,
                                          videoIndex
                                        );
                                        const currentVideoValue = normalizeText(
                                          exampleVideoEntry?.video
                                        );
                                        const currentThumbnailValue = currentVideoValue
                                          ? normalizeText(exampleVideoEntry?.thumbnail)
                                          : "";
                                        const isEditingExampleVideo =
                                          videoEditor.key === exampleVideoKey;
                                        const isUploadingExampleVideo =
                                          uploadingVideoKey === exampleVideoKey;
                                        const isDeletingExampleVideo =
                                          deletingVideoKey === exampleVideoKey;
                                        const exampleVideoUploadError =
                                          videoUploadErrors[exampleVideoKey] || "";
                                        const isCurrentPreviewActive =
                                          activeVideoPreviewKey === exampleVideoKey;

                                        return (
                                          <VideoControlCard
                                            key={exampleVideoKey}
                                            title={`Vídeo do exemplo ${videoIndex + 1}`}
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
                                            video={currentVideoValue}
                                            thumbnail={currentThumbnailValue}
                                            isEditing={isEditingExampleVideo}
                                            editorValue={videoEditor.value}
                                            uploadError={exampleVideoUploadError}
                                            isUploading={isUploadingExampleVideo}
                                            isDeleting={isDeletingExampleVideo}
                                            isContextCollapsible
                                            isContextExpanded={isVideoContextCardExpanded(exampleVideoKey)}
                                            onToggleContext={() =>
                                              toggleVideoContextCard(exampleVideoKey)
                                            }
                                            isPreviewActive={isCurrentPreviewActive}
                                            showPreview={false}
                                            showHeaderVideoAttachedIndicator={false}
                                            mobileMinimalControls
                                            removeButtonMode="mobile-icon"
                                            promoteRemoveToHeader
                                            layerIcon={<Clapperboard className="h-4 w-4" />}
                                            addButtonLabel="Adicionar vídeo do exemplo"
                                            changeButtonLabel="Trocar vídeo do exemplo"
                                            saveButtonLabel="Salvar vídeo do exemplo"
                                            onPlay={() =>
                                              setActiveVideoPreviewKey(exampleVideoKey)
                                            }
                                            onOpenEditor={() =>
                                              openVideoEditor(
                                                exampleVideoKey,
                                                currentVideoValue
                                              )
                                            }
                                            onEditorChange={(value) =>
                                              setVideoEditor((current) => ({
                                                ...current,
                                                value,
                                              }))
                                            }
                                            onSave={() =>
                                              void saveVideoFromEditor({
                                                key: exampleVideoKey,
                                                oldVideo: currentVideoValue,
                                                onSuccess: ({
                                                  video,
                                                  thumbnail,
                                                }) =>
                                                  updateExampleVideoAt(
                                                    mIdx,
                                                    eIdx,
                                                    videoIndex,
                                                    {
                                                      video,
                                                      thumbnail,
                                                    }
                                                  ),
                                              })
                                            }
                                            onCancel={closeVideoEditor}
                                            onTriggerUpload={() =>
                                              triggerVideoFilePicker(exampleVideoKey)
                                            }
                                            onRemove={() =>
                                              void removeExampleVideoAt(
                                                mIdx,
                                                eIdx,
                                                videoIndex
                                              )
                                            }
                                            fileInputRef={(element) => {
                                              if (element) {
                                                fileInputsRef.current[exampleVideoKey] =
                                                  element;
                                              }
                                            }}
                                            onFileChange={(event) => {
                                              const inputElement = event?.target;
                                              const file =
                                                inputElement?.files?.[0];

                                              if (inputElement) {
                                                inputElement.value = "";
                                              }

                                              void handleVideoFileSelected({
                                                key: exampleVideoKey,
                                                file,
                                                scope: "example",
                                                oldVideo: currentVideoValue,
                                                onSuccess: ({
                                                  video,
                                                  thumbnail,
                                                }) =>
                                                  updateExampleVideoAt(
                                                    mIdx,
                                                    eIdx,
                                                    videoIndex,
                                                    {
                                                      video,
                                                      thumbnail,
                                                    }
                                                  ),
                                              });
                                            }}
                                            uploadButtonText="Trocar por upload"
                                          />
                                        );
                                      })}



                                      {exampleVideoEntries.length === 0 ? (
                                        <>
                                          <input
                                            type="file"
                                            accept="video/*"
                                            className="hidden"
                                            ref={(element) => {
                                              if (element) {
                                                fileInputsRef.current[newExampleVideoKey] =
                                                  element;
                                              }
                                            }}
                                            onChange={(event) => {
                                              const inputElement = event?.target;
                                              const file = inputElement?.files?.[0];

                                              if (inputElement) {
                                                inputElement.value = "";
                                              }

                                              void handleVideoFileSelected({
                                                key: newExampleVideoKey,
                                                file,
                                                scope: "example",
                                                oldVideo: "",
                                                onSuccess: ({ video, thumbnail }) =>
                                                  appendExampleVideo(mIdx, eIdx, {
                                                    video,
                                                    thumbnail,
                                                  }),
                                              });
                                            }}
                                          />

                                          <AppendVideoPanel
                                          title="Adicionar vídeo ao exemplo"
                                          description="Este vídeo será usado somente neste exemplo."
                                          helperLabel=""
                                          countLabel="0 vídeo anexado"
                                          isEditing={isNewExampleVideoEditing}
                                          editorValue={videoEditor.value}
                                          uploadError={newExampleVideoUploadError}
                                          isUploading={
                                            uploadingVideoKey ===
                                            newExampleVideoKey
                                          }
                                          isDeleting={
                                            deletingVideoKey ===
                                            newExampleVideoKey
                                          }
                                          onOpenEditor={() =>
                                            openVideoEditor(
                                              newExampleVideoKey,
                                              ""
                                            )
                                          }
                                          onEditorChange={(value) =>
                                            setVideoEditor((current) => ({
                                              ...current,
                                              value,
                                            }))
                                          }
                                          onSave={() =>
                                            void saveVideoFromEditor({
                                              key: newExampleVideoKey,
                                              oldVideo: "",
                                              onSuccess: ({
                                                video,
                                                thumbnail,
                                              }) =>
                                                appendExampleVideo(mIdx, eIdx, {
                                                  video,
                                                  thumbnail,
                                                }),
                                            })
                                          }
                                          onCancel={closeVideoEditor}
                                          onTriggerUpload={() =>
                                            triggerVideoFilePicker(
                                              newExampleVideoKey
                                            )
                                          }
                                          addButtonLabel="Adicionar por link"
                                          uploadButtonLabel="Enviar arquivo"
                                          saveButtonLabel="Anexar ao exemplo"
                                          compactInfoHeader
                                        />
                                        </>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {!hasExampleVideoInsideMeaning ? (
                        <div className="order-4 md:order-3">
                          {hasWordLevelVideos ? (
                          <LayerRuleNotice>
                            Este significado está usando o vídeo geral da palavra/frase. Para anexar vídeo aqui, remova primeiro o vídeo geral.
                          </LayerRuleNotice>
                        ) : null}

                        <div className="mt-4 space-y-2.5">
                          {meaningVideoEntries.map((meaningVideoEntry, videoIndex) => {
                            const meaningVideoKey = getMeaningVideoKey(mIdx, videoIndex);
                            const meaningVideoValue = normalizeText(meaningVideoEntry?.video);
                            const meaningThumbnailValue = meaningVideoValue
                              ? normalizeText(meaningVideoEntry?.thumbnail)
                              : "";
                            const isEditingMeaningVideo =
                              videoEditor.key === meaningVideoKey;
                            const isUploadingMeaningVideo =
                              uploadingVideoKey === meaningVideoKey;
                            const isDeletingMeaningVideo =
                              deletingVideoKey === meaningVideoKey;
                            const meaningVideoUploadError =
                              videoUploadErrors[meaningVideoKey] || "";
                            const isMeaningPreviewActive =
                              activeVideoPreviewKey === meaningVideoKey;

                            return (
                              <VideoControlCard
                                key={meaningVideoKey}
                                title={`Vídeo do significado ${videoIndex + 1}`}
                                description="Esse vídeo vale para todos os exemplos deste significado que não tiverem vídeo próprio."
                                emptyLabel="Sem vídeo geral"
                                video={meaningVideoValue}
                                thumbnail={meaningThumbnailValue}
                                isEditing={isEditingMeaningVideo}
                                editorValue={videoEditor.value}
                                uploadError={meaningVideoUploadError}
                                isUploading={isUploadingMeaningVideo}
                                isDeleting={isDeletingMeaningVideo}
                                isContextCollapsible
                                isContextExpanded={isVideoContextCardExpanded(meaningVideoKey)}
                                onToggleContext={() =>
                                  toggleVideoContextCard(meaningVideoKey)
                                }
                                isPreviewActive={isMeaningPreviewActive}
                                previewVariant="inline-right"
                                inlineSize="example"
                                removeButtonMode="mobile-icon"
                                layerIcon={<Clapperboard className="h-4 w-4" />}
                                addButtonLabel="Adicionar vídeo do significado"
                                changeButtonLabel="Trocar vídeo do significado"
                                saveButtonLabel="Salvar vídeo do significado"
                                onPlay={() =>
                                  setActiveVideoPreviewKey(meaningVideoKey)
                                }
                                onOpenEditor={() =>
                                  openVideoEditor(
                                    meaningVideoKey,
                                    meaningVideoValue
                                  )
                                }
                                onEditorChange={(value) =>
                                  setVideoEditor((current) => ({
                                    ...current,
                                    value,
                                  }))
                                }
                                onSave={() =>
                                  void saveVideoFromEditor({
                                    key: meaningVideoKey,
                                    oldVideo: meaningVideoValue,
                                    onSuccess: ({ video, thumbnail }) =>
                                      updateMeaningVideoAt(mIdx, videoIndex, {
                                        video,
                                        thumbnail,
                                      }),
                                  })
                                }
                                onCancel={closeVideoEditor}
                                onTriggerUpload={() =>
                                  triggerVideoFilePicker(meaningVideoKey)
                                }
                                onRemove={() =>
                                  void removeVideo({
                                    key: meaningVideoKey,
                                    oldVideo: meaningVideoValue,
                                    onSuccess: () =>
                                      removeMeaningVideoAt(mIdx, videoIndex),
                                  })
                                }
                                fileInputRef={(element) => {
                                  if (element) {
                                    fileInputsRef.current[meaningVideoKey] =
                                      element;
                                  }
                                }}
                                onFileChange={(event) => {
                                  const inputElement = event?.target;
                                  const file = inputElement?.files?.[0];

                                  if (inputElement) {
                                    inputElement.value = "";
                                  }

                                  void handleVideoFileSelected({
                                    key: meaningVideoKey,
                                    file,
                                    scope: "meaning",
                                    oldVideo: meaningVideoValue,
                                    onSuccess: ({ video, thumbnail }) =>
                                      updateMeaningVideoAt(mIdx, videoIndex, {
                                        video,
                                        thumbnail,
                                      }),
                                  });
                                }}
                                uploadButtonText="Trocar por upload"
                              />
                            );
                          })}

                          {!hasMeaningVideo ? (
                            <VideoControlCard
                              title="Vídeo geral do significado"
                              description="Esse vídeo vale para todos os exemplos deste significado que não tiverem vídeo próprio."
                              emptyLabel={
                                hasWordLevelVideos
                                  ? "Usando vídeo geral da palavra"
                                  : "Sem vídeo geral"
                              }
                              video=""
                              thumbnail=""
                              isEditing={videoEditor.key === newMeaningVideoKey}
                              editorValue={videoEditor.value}
                              uploadError={newMeaningVideoUploadError}
                              isUploading={uploadingVideoKey === newMeaningVideoKey}
                              isDeleting={deletingVideoKey === newMeaningVideoKey}
                              isContextCollapsible
                              isContextExpanded={isVideoContextCardExpanded(newMeaningVideoKey)}
                              onToggleContext={() =>
                                toggleVideoContextCard(newMeaningVideoKey)
                              }
                              isPreviewActive={false}
                              previewVariant="inline-right"
                              removeButtonMode="mobile-icon"
                              layerIcon={<Clapperboard className="h-4 w-4" />}
                              addButtonLabel="Adicionar vídeo do significado"
                              changeButtonLabel="Trocar vídeo do significado"
                              saveButtonLabel="Anexar vídeo do significado"
                              helperText="Este espaço fica vazio quando o significado usa o vídeo geral da palavra/frase ou quando os exemplos têm seus próprios vídeos."
                              onPlay={() => undefined}
                              onOpenEditor={() =>
                                openVideoEditor(newMeaningVideoKey, "")
                              }
                              onEditorChange={(value) =>
                                setVideoEditor((current) => ({
                                  ...current,
                                  value,
                                }))
                              }
                              onSave={() =>
                                void saveVideoFromEditor({
                                  key: newMeaningVideoKey,
                                  oldVideo: "",
                                  onSuccess: ({ video, thumbnail }) =>
                                    appendMeaningVideo(mIdx, { video, thumbnail }),
                                })
                              }
                              onCancel={closeVideoEditor}
                              onTriggerUpload={() =>
                                triggerVideoFilePicker(newMeaningVideoKey)
                              }
                              onRemove={() => undefined}
                              fileInputRef={(element) => {
                                if (element) {
                                  fileInputsRef.current[newMeaningVideoKey] =
                                    element;
                                }
                              }}
                              onFileChange={(event) => {
                                const inputElement = event?.target;
                                const file = inputElement?.files?.[0];

                                if (inputElement) {
                                  inputElement.value = "";
                                }

                                void handleVideoFileSelected({
                                  key: newMeaningVideoKey,
                                  file,
                                  scope: "meaning",
                                  oldVideo: "",
                                  onSuccess: ({ video, thumbnail }) =>
                                    appendMeaningVideo(mIdx, { video, thumbnail }),
                                });
                              }}
                              uploadButtonText="Enviar arquivo"
                            />
                          ) : (
                            <div className="pt-0.5">
                              <input
                                type="file"
                                accept="video/*"
                                className="hidden"
                                ref={(element) => {
                                  if (element) {
                                    fileInputsRef.current[newMeaningVideoKey] =
                                      element;
                                  }
                                }}
                                onChange={(event) => {
                                  const inputElement = event?.target;
                                  const file = inputElement?.files?.[0];

                                  if (inputElement) {
                                    inputElement.value = "";
                                  }

                                  void handleVideoFileSelected({
                                    key: newMeaningVideoKey,
                                    file,
                                    scope: "meaning",
                                    oldVideo: "",
                                    onSuccess: ({ video, thumbnail }) =>
                                      appendMeaningVideo(mIdx, { video, thumbnail }),
                                  });
                                }}
                              />

                              <AppendVideoPanel
                                title="Adicionar outro vídeo ao significado"
                                description="Use quando este significado precisa de mais um vídeo próprio."
                                helperLabel="+ vídeo do significado"
                                countLabel={`${meaningVideoEntries.length} anexado${meaningVideoEntries.length === 1 ? "" : "s"}`}
                                isEditing={videoEditor.key === newMeaningVideoKey}
                                editorValue={videoEditor.value}
                                uploadError={newMeaningVideoUploadError}
                                isUploading={
                                  uploadingVideoKey === newMeaningVideoKey
                                }
                                isDeleting={
                                  deletingVideoKey === newMeaningVideoKey
                                }
                                isContextCollapsible
                                isContextExpanded={isVideoContextCardExpanded(newMeaningVideoKey)}
                                onToggleContext={() =>
                                  toggleVideoContextCard(newMeaningVideoKey)
                                }
                                onOpenEditor={() =>
                                  openVideoEditor(newMeaningVideoKey, "")
                                }
                                onEditorChange={(value) =>
                                  setVideoEditor((current) => ({
                                    ...current,
                                    value,
                                  }))
                                }
                                onSave={() =>
                                  void saveVideoFromEditor({
                                    key: newMeaningVideoKey,
                                    oldVideo: "",
                                    onSuccess: ({ video, thumbnail }) =>
                                      appendMeaningVideo(mIdx, {
                                        video,
                                        thumbnail,
                                      }),
                                  })
                                }
                                onCancel={closeVideoEditor}
                                onTriggerUpload={() =>
                                  triggerVideoFilePicker(newMeaningVideoKey)
                                }
                                addButtonLabel="Adicionar por link"
                                uploadButtonLabel="Enviar arquivo"
                                saveButtonLabel="Anexar ao significado"
                              />
                            </div>
                          )}
                          </div>
                        </div>
                      ) : null}

                      <div className="order-5 md:hidden">
                        <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#6E6E73] dark:text-[#A1A1A6]">
                          <Hash className="h-3.5 w-3.5 text-[#0071E3] dark:text-[#0A84FF]" />
                          <span>Tag</span>
                        </label>

                        <div className="relative">
                          <select
                            value={meaningItem.category}
                            onChange={(e) =>
                              updateMeaning(mIdx, "category", e.target.value)
                            }
                            className="w-full appearance-none rounded-[16px] border border-[#D2D2D7] bg-white py-2.5 pl-3 pr-11 text-sm font-semibold text-[#1D1D1F] transition-all focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15 dark:border-[#3A3A3C] dark:bg-[#111113] dark:text-[#F5F5F7] dark:focus:border-[#0A84FF] dark:focus:ring-[#0A84FF]/20"
                          >
                            {categories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>

                          <span
                            className="pointer-events-none absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#6E6E73] transition-colors dark:text-[#D1D1D6]"
                            aria-hidden="true"
                          >
                            <ChevronDown className="h-4 w-4 stroke-[2.2]" />
                          </span>
                        </div>
                      </div>

                      <div className="order-6 rounded-[22px] border border-[#E5E5EA] bg-[#FAFAFC] p-4 dark:border-[#2C2C2E] dark:bg-[#111113] md:order-4">
                        <label className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#424245] dark:text-[#D1D1D6]">
                          <Lightbulb className="h-3.5 w-3.5 text-[#0071E3] dark:text-[#0A84FF]" />
                          Dica de uso
                        </label>

                        <input
                          type="text"
                          value={meaningItem.tip}
                          onChange={(e) =>
                            updateMeaning(mIdx, "tip", e.target.value)
                          }
                          placeholder="Explique quando usar este significado"
                          className="min-h-11 w-full rounded-[16px] border border-[#D2D2D7] bg-white px-3.5 py-2 text-sm italic text-[#424245] transition-all placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15 dark:border-[#3A3A3C] dark:bg-[#1C1C1E] dark:text-[#F5F5F7] dark:placeholder:text-[#8E8E93] dark:focus:border-[#0A84FF] dark:focus:ring-[#0A84FF]/20"
                        />
                      </div>

                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
        {!hasMeaningOrExampleVideos ? (
          <section className="order-4 overflow-hidden rounded-[26px] border border-[#E5E5EA] bg-white shadow-none ring-1 ring-black/[0.025] dark:border-[#2C2C2E] dark:bg-[#1C1C1E] dark:ring-white/[0.05]">
          <button
            type="button"
            onClick={() =>
              setIsWordVideoSectionExpanded((current) => !current)
            }
            className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[#FAFAFC] dark:hover:bg-[#222225] md:px-6 md:py-5"
            aria-expanded={isWordVideoSectionExpanded}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86868B] dark:text-[#8E8E93]">
                  <Clapperboard className="h-3.5 w-3.5" />
                  Recurso opcional
                </span>

                <StatusPill
                  tone={wordVideos.length > 0 ? "success" : "neutral"}
                  className="min-h-6 px-2 text-[10px]"
                  icon={
                    wordVideos.length > 0 ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <FileVideo className="h-3.5 w-3.5" />
                    )
                  }
                >
                  {wordVideos.length > 0
                    ? `${wordVideos.length} vídeo${wordVideos.length === 1 ? "" : "s"}`
                    : "sem vídeo"}
                </StatusPill>
              </div>

              <h3 className="mt-2 text-xl font-semibold tracking-[-0.015em] text-[#1D1D1F] dark:text-[#F5F5F7] md:text-2xl">
                Vídeo geral da palavra/frase
              </h3>

              <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[#6E6E73] dark:text-[#A1A1A6] md:text-sm">
                Use apenas quando um único vídeo precisar representar a palavra inteira.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              <span className="hidden text-xs font-semibold text-[#86868B] dark:text-[#8E8E93] sm:inline">
                {isWordVideoSectionExpanded ? "Ocultar" : "Mostrar"}
              </span>

              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D2D2D7] bg-[#F5F5F7] text-[#6E6E73] transition-colors dark:border-[#3A3A3C] dark:bg-[#2C2C2E] dark:text-[#D1D1D6]">
                {isWordVideoSectionExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </span>
            </div>
          </button>

          {isWordVideoSectionExpanded ? (
            <div className="space-y-4 border-t border-[#E5E5EA] bg-[#FAFAFC] px-5 py-4 dark:border-[#2C2C2E] dark:bg-[#161618] md:px-6 md:py-5">
              {hasMeaningOrExampleVideos ? (
                <LayerRuleNotice>
                  Há vídeos anexados em significados ou exemplos. Para adicionar
                  vídeo geral, remova primeiro esses vídeos internos.
                </LayerRuleNotice>
              ) : null}

              {wordVideos.map((wordVideoEntry, index) => {
                const wordVideoKey = getWordVideoKey(index);
                const videoValue = normalizeText(wordVideoEntry?.video);
                const thumbnailValue = videoValue
                  ? normalizeText(wordVideoEntry?.thumbnail)
                  : "";
                const isEditingWordVideo = videoEditor.key === wordVideoKey;
                const isUploadingWordVideo = uploadingVideoKey === wordVideoKey;
                const isDeletingWordVideo = deletingVideoKey === wordVideoKey;
                const wordVideoUploadError = videoUploadErrors[wordVideoKey] || "";
                const isWordPreviewActive = activeVideoPreviewKey === wordVideoKey;

                return (
                  <VideoControlCard
                    key={wordVideoKey}
                    title={`Vídeo geral ${index + 1}`}
                    description="Use para explicar a palavra ou frase de forma geral."
                    emptyLabel="Sem vídeo geral"
                    video={videoValue}
                    thumbnail={thumbnailValue}
                    isEditing={isEditingWordVideo}
                    editorValue={videoEditor.value}
                    uploadError={wordVideoUploadError}
                    isUploading={isUploadingWordVideo}
                    isDeleting={isDeletingWordVideo}
                    isPreviewActive={isWordPreviewActive}
                    previewVariant="inline-right"
                    inlineSize="wide"
                    mobileCompact
                    removeButtonMode="icon"
                    layerIcon={<Clapperboard className="h-4 w-4" />}
                    addButtonLabel="Adicionar vídeo geral"
                    changeButtonLabel="Trocar vídeo geral"
                    saveButtonLabel="Salvar vídeo geral"
                    onPlay={() => setActiveVideoPreviewKey(wordVideoKey)}
                    onOpenEditor={() => openVideoEditor(wordVideoKey, videoValue)}
                    onEditorChange={(value) =>
                      setVideoEditor((current) => ({ ...current, value }))
                    }
                    onSave={() =>
                      void saveVideoFromEditor({
                        key: wordVideoKey,
                        oldVideo: videoValue,
                        onSuccess: ({ video, thumbnail }) =>
                          updateWordVideoAt(index, { video, thumbnail }),
                      })
                    }
                    onCancel={closeVideoEditor}
                    onTriggerUpload={() => triggerVideoFilePicker(wordVideoKey)}
                    onRemove={() =>
                      void removeVideo({
                        key: wordVideoKey,
                        oldVideo: videoValue,
                        onSuccess: () => removeWordVideoAt(index),
                      })
                    }
                    fileInputRef={(element) => {
                      if (element) {
                        fileInputsRef.current[wordVideoKey] = element;
                      }
                    }}
                    onFileChange={(event) => {
                      const inputElement = event?.target;
                      const file = inputElement?.files?.[0];

                      if (inputElement) {
                        inputElement.value = "";
                      }

                      void handleVideoFileSelected({
                        key: wordVideoKey,
                        file,
                        scope: "word",
                        oldVideo: videoValue,
                        onSuccess: ({ video, thumbnail }) =>
                          updateWordVideoAt(index, { video, thumbnail }),
                      });
                    }}
                    uploadButtonText={videoValue ? "Trocar por upload" : "Enviar arquivo"}
                  />
                );
              })}

              <input
                type="file"
                accept="video/*"
                className="hidden"
                ref={(element) => {
                  if (element) {
                    fileInputsRef.current[NEW_WORD_VIDEO_KEY] = element;
                  }
                }}
                onChange={(event) => {
                  const inputElement = event?.target;
                  const file = inputElement?.files?.[0];

                  if (inputElement) {
                    inputElement.value = "";
                  }

                  void handleVideoFileSelected({
                    key: NEW_WORD_VIDEO_KEY,
                    file,
                    scope: "word",
                    oldVideo: "",
                    onSuccess: ({ video, thumbnail }) =>
                      appendWordVideo({ video, thumbnail }),
                  });
                }}
              />

              <AppendVideoPanel
                title="Adicionar vídeo geral"
                description="Cole um vídeo por link/embed ou envie um arquivo para usar como vídeo padrão desta palavra/frase."
                helperLabel="+ vídeo geral"
                countLabel={`${wordVideos.length} anexado${wordVideos.length === 1 ? "" : "s"}`}
                isEditing={videoEditor.key === NEW_WORD_VIDEO_KEY}
                editorValue={videoEditor.value}
                uploadError={newWordVideoUploadError}
                isUploading={uploadingVideoKey === NEW_WORD_VIDEO_KEY}
                isDeleting={deletingVideoKey === NEW_WORD_VIDEO_KEY}
                onOpenEditor={() => openVideoEditor(NEW_WORD_VIDEO_KEY, "")}
                onEditorChange={(value) =>
                  setVideoEditor((current) => ({
                    ...current,
                    value,
                  }))
                }
                onSave={() =>
                  void saveVideoFromEditor({
                    key: NEW_WORD_VIDEO_KEY,
                    oldVideo: "",
                    onSuccess: ({ video, thumbnail }) =>
                      appendWordVideo({ video, thumbnail }),
                  })
                }
                onCancel={closeVideoEditor}
                onTriggerUpload={() => triggerVideoFilePicker(NEW_WORD_VIDEO_KEY)}
                addButtonLabel="Adicionar vídeo geral por link"
                uploadButtonLabel="Enviar vídeo geral"
                saveButtonLabel="Anexar vídeo geral"
              />
            </div>
          ) : null}
          </section>
        ) : null}

          <div className="order-5 pt-1 md:pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0071E3] px-5 py-2.5 text-sm font-semibold text-white shadow-none transition-colors dark:bg-[#0A84FF] ${
                canSave
                  ? "hover:bg-[#0077ED] active:bg-[#006EDB] dark:hover:bg-[#2290FF]"
                  : "cursor-not-allowed opacity-55 shadow-none"
              }`}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>

      </div>

    </div>

      <UnsavedChangesModal
        open={showUnsavedChangesModal}
        onClose={handleCancelLeaveWithoutSaving}
        onConfirm={handleConfirmLeaveWithoutSaving}
      />
    </>
  );
}