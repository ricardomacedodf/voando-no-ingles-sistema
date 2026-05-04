import { useEffect, useRef, useState } from "react";
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
  "Ação não permitida: já existe vídeo adicionado em significado ou exemplo. Para adicionar vídeo geral, remova primeiro os vídeos dessas camadas.";
const INTERNAL_VIDEO_CONFLICT_MESSAGE =
  "Ação não permitida: já existe vídeo adicionado no nível geral da palavra/frase. Para adicionar vídeo em significados ou exemplos, remova primeiro o vídeo geral.";

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
  { bar: "#D97706", border: "rgba(217, 119, 6, 0.24)" },
  { bar: "#0F766E", border: "rgba(15, 118, 110, 0.24)" },
  { bar: "#6366F1", border: "rgba(99, 102, 241, 0.24)" },
  { bar: "#059669", border: "rgba(5, 150, 105, 0.24)" },
  { bar: "#334155", border: "rgba(51, 65, 85, 0.24)" },
  { bar: "#2563EB", border: "rgba(37, 99, 235, 0.24)" },
];

const meaningAccentPaletteDark = [
  { bar: "#F59E0B", border: "rgba(245, 158, 11, 0.5)" },
  { bar: "#2DD4BF", border: "rgba(45, 212, 191, 0.5)" },
  { bar: "#A5B4FC", border: "rgba(165, 180, 252, 0.5)" },
  { bar: "#34D399", border: "rgba(52, 211, 153, 0.5)" },
  { bar: "#7DD3FC", border: "rgba(125, 211, 252, 0.5)" },
  { bar: "#60A5FA", border: "rgba(96, 165, 250, 0.5)" },
];

const emptyMeaningAccent = {
  bar: "#B91C1C",
  border: "#FBD2D2",
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
  ]);
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
    <label className="mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-[0.01em] text-[#6A7181] dark:text-slate-300">
      {icon}
      <span>{children}</span>
    </label>
  );
}

function MeaningLanguageLabel() {
  return (
    <label
      className="mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-[0.01em] text-[#6A7181] dark:text-slate-300"
      aria-label="Significado em português"
    >
      <Languages className="h-4 w-4 text-primary" />
      <BrFlagIcon />
      <span>Palavra ou frase em português</span>
      <span className="sr-only">Significado em português</span>
    </label>
  );
}

function ExampleLanguageLabel({ flag, code }) {
  return (
    <label className="mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-[0.01em] text-[#6A7181] dark:text-slate-300">
      {flag}
      <span>Sig.</span>
      <span className="font-normal text-[#6A7181] dark:text-slate-300">—</span>
      <span>{code}</span>
    </label>
  );
}

function VideoAttachedBadge({ className = "" }) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <CheckCircle2 className="h-3 w-3" />
      Vídeo anexado
    </span>
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
          "relative aspect-video overflow-hidden rounded-xl border border-[#D9E2EC] bg-black shadow-[0_10px_22px_rgba(15,23,42,0.12)] dark:border-border dark:shadow-[0_12px_24px_rgba(2,6,23,0.55)]",
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
          "aspect-video overflow-hidden rounded-xl bg-black shadow-[0_10px_22px_rgba(15,23,42,0.12)] dark:shadow-[0_12px_24px_rgba(2,6,23,0.55)]",
          className,
        ].join(" ")}
      >
        <ExampleVideoPlayer
          video={cleanVideo}
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
        "bg-[#F8FAFC] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_18px_rgba(15,23,42,0.06)] dark:border-border dark:bg-muted/40 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_24px_rgba(2,6,23,0.5)]",
        "transition-all duration-200 hover:border-[#ED9A0A]/70 hover:shadow-[0_12px_24px_rgba(15,23,42,0.10)] dark:hover:bg-muted/55 dark:hover:shadow-[0_14px_28px_rgba(2,6,23,0.6)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED9A0A]/35 focus-visible:ring-offset-2",
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(237,154,10,0.18),transparent_32%),linear-gradient(135deg,#F8FAFC_0%,#EFF4F8_55%,#E6EDF5_100%)]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10" />
      <div className="absolute inset-0 bg-black/10 transition-colors duration-200 group-hover:bg-black/6" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-black/40 shadow-[0_8px_20px_rgba(15,23,42,0.22)] backdrop-blur-sm transition-all duration-200 group-hover:scale-105 group-hover:bg-black/50 dark:border-white/40 dark:bg-black/45 dark:shadow-[0_10px_20px_rgba(2,6,23,0.45)] dark:group-hover:bg-black/55">
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
}) {
  const hasVideo = Boolean(video);
  const isInlinePreview = previewVariant === "inline-right";
  const isWideInline = inlineSize === "wide";
  const showRemoveIcon =
    hasVideo &&
    !isEditing &&
    removeButtonMode === "mobile-icon";
  const showRemoveInlineIcon =
    hasVideo &&
    !isEditing &&
    removeButtonMode === "icon";
  const showTextRemoveButton =
    hasVideo &&
    (removeButtonMode === "button" || removeButtonMode === "mobile-icon");
  const removeIconResponsiveClass =
    removeButtonMode === "mobile-icon" ? "lg:hidden" : "";
  const removeTextResponsiveClass =
    removeButtonMode === "mobile-icon" ? "hidden lg:inline-flex" : "";
  const shouldPlaceActionsBelowPreview =
    mobileCompact && hasVideo && !isEditing && showRemoveInlineIcon;

  if (isInlinePreview) {
    return (
      <div
        className={[
          isWideInline
            ? mobileCompact
              ? "min-h-[116px] rounded-xl md:min-h-[146px] md:rounded-2xl"
              : "min-h-[146px] rounded-2xl"
            : mobileCompact
            ? "min-h-[108px] rounded-xl md:min-h-[132px]"
            : "min-h-[132px] rounded-xl",
          mobileCompact
            ? "border border-[#DCE4EE] bg-white px-3 py-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.04)] md:px-3.5 md:py-3 md:shadow-[0_8px_20px_rgba(15,23,42,0.04)] dark:border-border dark:bg-card dark:shadow-[0_10px_24px_rgba(2,6,23,0.45)]"
            : "border border-[#DCE4EE] bg-white px-3.5 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)] dark:border-border dark:bg-card dark:shadow-[0_10px_24px_rgba(2,6,23,0.45)]",
          "relative",
        ].join(" ")}
      >
        {showRemoveIcon ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={isDeleting}
            className={`absolute right-2 top-2 z-10 rounded-lg p-1.5 transition-colors hover:bg-red-50 dark:hover:bg-red-500/20 disabled:opacity-50 ${removeIconResponsiveClass}`}
            aria-label="Remover vídeo"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </button>
        ) : null}

        <div
          className={
            hasVideo && !isEditing
              ? isWideInline
                ? mobileCompact
                  ? "grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_252px] lg:items-center"
                  : "grid min-h-[122px] gap-3 md:grid-cols-[minmax(0,1fr)_252px] md:items-center"
                : mobileCompact
                ? "grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_192px] lg:items-center"
                : "grid min-h-[108px] gap-3 md:grid-cols-[minmax(0,1fr)_192px] md:items-center"
              : isWideInline
              ? mobileCompact
                ? "space-y-0"
                : "min-h-[122px]"
              : mobileCompact
              ? "space-y-0"
              : "min-h-[108px]"
          }
        >
          <div
            className={
              isWideInline
                ? mobileCompact
                  ? "flex min-w-0 flex-col justify-between gap-2 lg:min-h-[122px]"
                  : "flex min-h-[122px] flex-col justify-between"
                : mobileCompact
                ? "flex min-w-0 flex-col justify-between gap-2 lg:min-h-[108px]"
                : "flex min-h-[108px] flex-col justify-between"
            }
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
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
              <p
                title={getExampleVideoDisplayLabel(video)}
                className="mt-2 w-full min-w-0 max-w-full truncate text-[11px] text-muted-foreground"
              >
                {getExampleVideoDisplayLabel(video)}
              </p>
            ) : null}

            {isEditing ? (
              <div className={mobileCompact ? "mt-2.5 space-y-2" : "mt-3 space-y-2"}>
                <textarea
                  value={editorValue}
                  onChange={(e) => onEditorChange(e.target.value)}
                  placeholder="Cole o link do vídeo, iframe/embed completo ou BBCode"
                  rows={mobileCompact ? 3 : 4}
                  spellCheck={false}
                  className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />

                <div
                  className={
                    mobileCompact
                      ? "grid grid-cols-2 gap-2 lg:flex lg:flex-wrap"
                      : "flex flex-wrap gap-2"
                  }
                >
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={!editorValue.trim() || isDeleting}
                    className={`rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 ${
                      mobileCompact ? "w-full text-center lg:w-auto" : ""
                    }`}
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
                    className={`rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50 ${
                      mobileCompact ? "w-full text-center lg:w-auto" : ""
                    }`}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
                <div
                  className={
                    mobileCompact
                      ? showRemoveInlineIcon
                        ? shouldPlaceActionsBelowPreview
                          ? "mt-2.5 hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 lg:mt-3 lg:flex lg:flex-wrap"
                          : "mt-2.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 lg:mt-3 lg:flex lg:flex-wrap"
                        : "mt-2.5 grid grid-cols-2 gap-2 lg:mt-3 lg:flex lg:flex-wrap"
                      : "mt-3 flex flex-wrap gap-2"
                  }
              >
                <button
                  type="button"
                  onClick={onOpenEditor}
                  disabled={isDeleting}
                  className={`rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50 ${
                    mobileCompact ? "w-full text-center lg:w-auto" : ""
                  }`}
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
                  className={`inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50 ${
                    mobileCompact ? "w-full justify-center lg:w-auto" : ""
                  }`}
                >
                  <Upload className="h-3 w-3" />
                  {isUploading ? "Enviando para R2..." : uploadButtonText}
                </button>

                {showRemoveInlineIcon ? (
                  <button
                    type="button"
                    onClick={onRemove}
                    disabled={isDeleting}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/40 text-destructive transition-colors hover:bg-red-50 dark:hover:bg-red-500/20 disabled:opacity-50"
                    aria-label="Remover vídeo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}

                {showTextRemoveButton ? (
                  <button
                    type="button"
                    onClick={onRemove}
                    disabled={isDeleting}
                    className={`rounded-lg border border-destructive/40 px-3 py-1.5 text-[11px] font-bold text-destructive transition-colors hover:bg-red-50 dark:hover:bg-red-500/20 disabled:opacity-50 ${removeTextResponsiveClass} ${
                      mobileCompact
                        ? "w-full text-center lg:w-auto"
                        : ""
                    }`}
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

          {hasVideo && !isEditing ? (
            <div
              className={
                mobileCompact
                  ? "flex w-full justify-center overflow-hidden lg:justify-end lg:pl-1"
                  : "flex w-full justify-end md:pl-1"
              }
            >
              <ExampleVideoPreview
                video={video}
                thumbnail={thumbnail}
                isActive={isPreviewActive}
                onPlay={onPlay}
                className={
                  isWideInline
                    ? mobileCompact
                      ? "mx-auto w-full max-w-[320px] lg:w-[252px] lg:max-w-none"
                      : "w-full md:w-[252px]"
                    : mobileCompact
                    ? "mx-auto w-full max-w-[192px] lg:w-[192px] lg:max-w-none"
                    : "w-full md:w-[192px]"
                }
              />
            </div>
          ) : null}

          {shouldPlaceActionsBelowPreview ? (
            <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 lg:hidden">
              <button
                type="button"
                onClick={onOpenEditor}
                disabled={isDeleting}
                className="w-full rounded-lg border border-border px-3 py-1.5 text-center text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {hasVideo ? "Trocar vídeo" : "Adicionar vídeo"}
              </button>

              <button
                type="button"
                onClick={onTriggerUpload}
                disabled={isUploading || isDeleting}
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <Upload className="h-3 w-3" />
                {isUploading ? "Enviando para R2..." : uploadButtonText}
              </button>

              <button
                type="button"
                onClick={onRemove}
                disabled={isDeleting}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/40 text-destructive transition-colors hover:bg-red-50 dark:hover:bg-red-500/20 disabled:opacity-50"
                aria-label="Remover vídeo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-border bg-card px-3.5 py-3">
      {showRemoveIcon ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={isDeleting}
          className={`absolute right-2 top-2 z-10 rounded-lg p-1.5 transition-colors hover:bg-red-50 dark:hover:bg-red-500/20 disabled:opacity-50 ${removeIconResponsiveClass}`}
          aria-label="Remover vídeo"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </button>
      ) : null}

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

      {hasVideo && !isEditing && showPreview ? (
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

      {hasVideo && !isEditing && !showPreview ? (
        <p className="mt-3 truncate text-[11px] text-muted-foreground">
          {getExampleVideoDisplayLabel(video)}
        </p>
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

        {showTextRemoveButton ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={isDeleting}
            className={`rounded-lg border border-destructive/40 px-3 py-1.5 text-[11px] font-bold text-destructive transition-colors hover:bg-red-50 dark:hover:bg-red-500/20 disabled:opacity-50 ${removeTextResponsiveClass}`}
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
  const { isDark: isDarkTheme } = useTheme();
  const fileInputsRef = useRef({});

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

  const resetActiveVideoPreview = () => {
    setActiveVideoPreviewKey(null);
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
    );
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

      const currentExampleVideos = normalizeExampleVideos(currentExample);
      const nextExamples = [...currentMeaning.examples];

      nextExamples[exampleIndex] = syncExampleVideoFields(currentExample, [
        ...currentExampleVideos,
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

      nextExampleVideos[videoIndex] = {
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

  const addMeaning = () => {
    const nextIndex = meanings.length;
    resetActiveVideoPreview();
    setMeanings([...meanings, { ...emptyMeaning, examples: [] }]);
    setExpandedMeanings((current) => ({ ...current, [nextIndex]: false }));
    setPendingNewMeanings((current) => ({ ...current, [nextIndex]: true }));
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
    if (!canUseVideoLayer(key)) return;

    resetActiveVideoPreview();

    setVideoEditor({
      key,
      value: typeof currentVideo === "string" ? currentVideo : "",
    });
  };

  const closeVideoEditor = () => {
    clearVideoLayerConflictMessages();
    setVideoEditor({ key: null, value: "" });
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
    if (!term.trim() || !hasPendingChanges) return;

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
    } catch (error) {
      console.error("Erro ao salvar item no Supabase:", error);
      alert("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleBackClick = () => {
    if (typeof onBack === "function") {
      onBack();
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    }
  };

  const newWordVideoUploadError = videoUploadErrors[NEW_WORD_VIDEO_KEY] || "";

  return (
    <div className="mx-auto max-w-5xl">
      <button
        type="button"
        onClick={handleBackClick}
        className="mb-4 -ml-2 inline-flex min-h-[44px] touch-manipulation items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 hover:text-primary/80 active:bg-primary/15"
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

          <div className="mt-2 flex items-center gap-1.5 pl-0 text-sm italic text-[#6A7181] dark:text-slate-300">
            <Volume2 className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">Pronúncia:</span>

            <input
              type="text"
              value={pronunciation}
              onChange={(e) => setPronunciation(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm italic text-[#6A7181] placeholder:text-[#6A7181]/60 focus:outline-none focus:ring-0 dark:text-slate-300 dark:placeholder:text-slate-400/70"
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
              const isPendingNewMeaning = Boolean(pendingNewMeanings[mIdx]);
              const shouldUseEmptyMeaningAccent =
                isPendingNewMeaning && isMeaningEmpty;
              const meaningDisplayTitle =
                meaningTitle || "adicionar aqui novo significado";
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

              return (
                <div
                  key={mIdx}
                  className="overflow-hidden rounded-2xl border bg-white shadow-[0_10px_26px_rgba(15,23,42,0.05)] dark:bg-card dark:shadow-[0_12px_28px_rgba(2,6,23,0.45)]"
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
                    className="flex cursor-pointer items-stretch justify-between gap-4 border-b border-border/70 bg-white px-5 py-4 transition-colors hover:bg-[#F8FAFC] dark:bg-card dark:hover:bg-muted/45"
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
                        {shouldUseEmptyMeaningAccent ? (
                          <span
                            className="min-w-0 break-words text-sm font-normal leading-snug"
                            style={{
                              color: emptyMeaningAccent.bar,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {meaningDisplayTitle}
                          </span>
                        ) : (
                          <>
                            <span className="shrink-0 text-sm font-normal text-[#6A7181] dark:text-slate-300">
                              SIG: {mIdx + 1}
                            </span>
                            <span className="shrink-0 text-sm font-normal text-[#6A7181] dark:text-slate-300">
                              —
                            </span>
                            <span
                              className="min-w-0 break-words text-base font-bold leading-snug text-[#14181F] dark:text-foreground"
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

                    <div className="flex shrink-0 items-center gap-2 self-center">
                      {hasAnyVideoInsideMeaning ? <VideoAttachedBadge /> : null}

                      {meanings.length > 1 ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeMeaning(mIdx);
                          }}
                          disabled={deletingVideoKey === `meaning-${mIdx}`}
                          className="rounded-lg p-1.5 transition-colors hover:bg-red-50 dark:hover:bg-red-500/20 disabled:opacity-50"
                          aria-label={`Remover significado ${mIdx + 1}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="space-y-4 p-4">
                      <div className="border-b border-[#D8E1EC] pb-4 dark:border-slate-600">
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
                              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-[#181818] transition-all placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-card dark:text-foreground"
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
                                isPreviewActive={isMeaningPreviewActive}
                                previewVariant="inline-right"
                                removeButtonMode="mobile-icon"
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
                              isPreviewActive={false}
                              previewVariant="inline-right"
                              removeButtonMode="mobile-icon"
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

                              {videoEditor.key === newMeaningVideoKey ? (
                                <div className="rounded-xl border border-[#DCE4EE] bg-white px-3 py-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] dark:border-border dark:bg-card dark:shadow-[0_10px_22px_rgba(2,6,23,0.45)]">
                                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
                                      Adicionar vídeo ao significado
                                    </span>

                                    <span className="text-[10px] font-medium text-muted-foreground">
                                      {meaningVideoEntries.length} vídeo{meaningVideoEntries.length > 1 ? "s" : ""} anexado{meaningVideoEntries.length > 1 ? "s" : ""}
                                    </span>
                                  </div>

                                  <textarea
                                    value={videoEditor.value}
                                    onChange={(event) =>
                                      setVideoEditor((current) => ({
                                        ...current,
                                        value: event.target.value,
                                      }))
                                    }
                                    placeholder="Cole o link do vídeo, iframe/embed completo ou BBCode"
                                    rows={3}
                                    spellCheck={false}
                                    className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                  />

                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
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
                                      disabled={
                                        !videoEditor.value.trim() ||
                                        deletingVideoKey === newMeaningVideoKey
                                      }
                                      className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                                    >
                                      {deletingVideoKey === newMeaningVideoKey
                                        ? "Salvando..."
                                        : "Adicionar vídeo"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        triggerVideoFilePicker(newMeaningVideoKey)
                                      }
                                      disabled={
                                        uploadingVideoKey === newMeaningVideoKey ||
                                        deletingVideoKey === newMeaningVideoKey
                                      }
                                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                    >
                                      <Upload className="h-3 w-3" />
                                      {uploadingVideoKey === newMeaningVideoKey
                                        ? "Enviando para R2..."
                                        : "Enviar arquivo"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={closeVideoEditor}
                                      disabled={deletingVideoKey === newMeaningVideoKey}
                                      className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openVideoEditor(newMeaningVideoKey, "")
                                      }
                                      disabled={deletingVideoKey === newMeaningVideoKey}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-white px-3 py-1.5 text-[11px] font-bold text-foreground shadow-[0_4px_10px_rgba(15,23,42,0.04)] transition-colors hover:bg-muted disabled:opacity-50 dark:border-border dark:bg-card"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Adicionar vídeo
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        triggerVideoFilePicker(newMeaningVideoKey)
                                      }
                                      disabled={
                                        uploadingVideoKey === newMeaningVideoKey ||
                                        deletingVideoKey === newMeaningVideoKey
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-white px-3 py-1.5 text-[11px] font-bold text-foreground shadow-[0_4px_10px_rgba(15,23,42,0.04)] transition-colors hover:bg-muted disabled:opacity-50 dark:border-border dark:bg-card"
                                    >
                                      <Upload className="h-3.5 w-3.5" />
                                      {uploadingVideoKey === newMeaningVideoKey
                                        ? "Enviando..."
                                        : "Enviar arquivo"}
                                    </button>
                                  </div>

                                  <span className="text-[10px] font-medium text-muted-foreground">
                                    + vídeo direto neste significado
                                  </span>
                                </div>
                              )}

                              {newMeaningVideoUploadError ? (
                                <p className="mt-2 px-1 text-[11px] font-medium text-destructive">
                                  {newMeaningVideoUploadError}
                                </p>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-foreground">
                            <svg
                              viewBox="0 0 24 24"
                              className="h-3.5 w-3.5 text-[#ED9A0A]"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <path
                                d="M3.75 5.75C3.75 4.92 4.42 4.25 5.25 4.25H10.5C11.88 4.25 13 5.37 13 6.75V19.75H6.25C4.87 19.75 3.75 18.63 3.75 17.25V5.75Z"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M20.25 5.75C20.25 4.92 19.58 4.25 18.75 4.25H13.5C12.12 4.25 11 5.37 11 6.75V19.75H17.75C19.13 19.75 20.25 18.63 20.25 17.25V5.75Z"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <span>Exemplos</span>
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
                            const isDeletingExample =
                              deletingVideoKey === exampleKey;
                            const exampleSentence = normalizeExampleText(
                              example?.sentence
                            );
                            const exampleTranslation = normalizeExampleText(
                              example?.translation
                            );
                            const exampleTitle =
                              exampleTranslation || exampleSentence || "adicione aqui exemplo";
                            const isExampleEmpty = !exampleTranslation && !exampleSentence;
                            const newExampleVideoKey = getNewExampleVideoKey(
                              mIdx,
                              eIdx
                            );
                            const isNewExampleVideoEditing =
                              videoEditor.key === newExampleVideoKey;
                            const newExampleVideoUploadError =
                              videoUploadErrors[newExampleVideoKey] || "";

                            return (
                              <div
                                key={exampleKey}
                                className="overflow-hidden rounded-xl border border-[#DCE4EE] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)] dark:border-border dark:bg-card dark:shadow-[0_10px_22px_rgba(2,6,23,0.38)]"
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
                                  className="flex cursor-pointer items-stretch justify-between gap-3 border-b border-[#E2E8F0] bg-white px-4 py-3 dark:border-border dark:bg-card"
                                  aria-expanded={isExampleExpanded}
                                >
                                  <div className="min-w-0 flex flex-1 items-center gap-2 text-left">
                                    {isExampleEmpty ? (
                                      <span
                                        className="min-w-0 truncate text-sm font-normal"
                                        style={{ color: emptyMeaningAccent.bar }}
                                        title={exampleTitle}
                                      >
                                        {exampleTitle}
                                      </span>
                                    ) : (
                                      <>
                                        <span className="shrink-0 text-sm font-normal text-[#6A7181] dark:text-slate-300">
                                          EX:
                                        </span>
                                        <span
                                          className="shrink-0 text-sm font-bold"
                                          style={{ color: accent.bar }}
                                        >
                                          {eIdx + 1}
                                        </span>
                                        <span className="shrink-0 text-sm font-normal text-[#6A7181] dark:text-slate-300">
                                          —
                                        </span>
                                        <span
                                          className="min-w-0 truncate text-sm font-bold text-[#14181F] dark:text-foreground"
                                          title={exampleTitle}
                                        >
                                          {exampleTitle}
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  <div className="flex shrink-0 items-center gap-2 self-center">
                                    {hasVideo ? <VideoAttachedBadge /> : null}

                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void removeExample(mIdx, eIdx);
                                      }}
                                      disabled={isDeletingExample}
                                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive dark:hover:bg-red-500/20 disabled:opacity-50"
                                      aria-label={`Remover exemplo ${eIdx + 1}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
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
                                      <div className="border-l-2 border-[#CBD5E1] pl-4 dark:border-slate-600">
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
                                              className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-[#758195] transition-all placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-foreground"
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
                                              placeholder="Tradução em português"
                                              className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-[#758195] transition-all placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:text-foreground"
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
                                            isPreviewActive={isCurrentPreviewActive}
                                            showPreview={false}
                                            removeButtonMode="mobile-icon"
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

                                      {isNewExampleVideoEditing ? (
                                        <div className="rounded-xl border border-[#DCE4EE] bg-white px-3 py-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] dark:border-border dark:bg-card dark:shadow-[0_10px_22px_rgba(2,6,23,0.45)]">
                                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
                                              Adicionar vídeo ao exemplo
                                            </span>

                                            <span className="text-[10px] font-medium text-muted-foreground">
                                              {exampleVideoEntries.length} vídeo{exampleVideoEntries.length === 1 ? "" : "s"} anexado{exampleVideoEntries.length === 1 ? "" : "s"}
                                            </span>
                                          </div>

                                          <textarea
                                            value={videoEditor.value}
                                            onChange={(event) =>
                                              setVideoEditor((current) => ({
                                                ...current,
                                                value: event.target.value,
                                              }))
                                            }
                                            placeholder="Cole o link do vídeo, iframe/embed completo ou BBCode"
                                            rows={3}
                                            spellCheck={false}
                                            className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                          />

                                          <div className="mt-2 flex flex-wrap gap-2">
                                            <button
                                              type="button"
                                              onClick={() =>
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
                                              disabled={
                                                !videoEditor.value.trim() ||
                                                deletingVideoKey === newExampleVideoKey
                                              }
                                              className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                                            >
                                              {deletingVideoKey === newExampleVideoKey
                                                ? "Salvando..."
                                                : "Adicionar vídeo"}
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() =>
                                                triggerVideoFilePicker(
                                                  newExampleVideoKey
                                                )
                                              }
                                              disabled={
                                                uploadingVideoKey ===
                                                  newExampleVideoKey ||
                                                deletingVideoKey === newExampleVideoKey
                                              }
                                              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                            >
                                              <Upload className="h-3 w-3" />
                                              {uploadingVideoKey === newExampleVideoKey
                                                ? "Enviando para R2..."
                                                : "Enviar arquivo"}
                                            </button>

                                            <button
                                              type="button"
                                              onClick={closeVideoEditor}
                                              disabled={
                                                deletingVideoKey === newExampleVideoKey
                                              }
                                              className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                            >
                                              Cancelar
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                openVideoEditor(
                                                  newExampleVideoKey,
                                                  ""
                                                )
                                              }
                                              disabled={
                                                deletingVideoKey ===
                                                newExampleVideoKey
                                              }
                                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-white px-3 py-1.5 text-[11px] font-bold text-foreground shadow-[0_4px_10px_rgba(15,23,42,0.04)] transition-colors hover:bg-muted disabled:opacity-50 dark:border-border dark:bg-card"
                                            >
                                              <Plus className="h-3.5 w-3.5" />
                                              Adicionar vídeo
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() =>
                                                triggerVideoFilePicker(
                                                  newExampleVideoKey
                                                )
                                              }
                                              disabled={
                                                uploadingVideoKey ===
                                                  newExampleVideoKey ||
                                                deletingVideoKey === newExampleVideoKey
                                              }
                                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-white px-3 py-1.5 text-[11px] font-bold text-foreground shadow-[0_4px_10px_rgba(15,23,42,0.04)] transition-colors hover:bg-muted disabled:opacity-50 dark:border-border dark:bg-card"
                                            >
                                              <Upload className="h-3.5 w-3.5" />
                                              {uploadingVideoKey === newExampleVideoKey
                                                ? "Enviando..."
                                                : "Enviar arquivo"}
                                            </button>
                                          </div>

                                          <span className="text-[10px] font-medium text-muted-foreground">
                                            + vídeo direto neste exemplo
                                          </span>
                                        </div>
                                      )}

                                      {newExampleVideoUploadError ? (
                                        <p className="px-1 text-[11px] font-medium text-destructive">
                                          {newExampleVideoUploadError}
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="border-t border-[#E2E8F0] pt-4 dark:border-border">
                        <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
                          <Lightbulb className="h-3.5 w-3.5 text-[#ED9A0A]" />
                          Modo de uso
                        </label>

                        <input
                          type="text"
                          value={meaningItem.tip}
                          onChange={(e) =>
                            updateMeaning(mIdx, "tip", e.target.value)
                          }
                          placeholder="Explique como esse significado é usado no contexto"
                          className="w-full border-0 border-b border-[#D8E1EC] bg-transparent px-0 pb-1 text-xs italic text-[#6A7181] placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-0 dark:border-slate-600 dark:text-slate-300 dark:placeholder:text-slate-400/70"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5 rounded-xl border border-[#DCE4EE] bg-[#F8FAFC] p-3 md:space-y-3 md:rounded-2xl md:p-3.5 dark:border-border dark:bg-card">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
                Vídeos gerais da palavra/frase
              </span>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                Esses vídeos serão usados como padrão quando o exemplo e o significado não tiverem vídeo próprio.
              </p>
            </div>

            <span className="text-[10px] font-semibold text-muted-foreground">
              {wordVideos.length} vídeo{wordVideos.length === 1 ? "" : "s"}
            </span>
          </div>

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

          {videoEditor.key === NEW_WORD_VIDEO_KEY ? (
            <div className="rounded-xl border border-[#DCE4EE] bg-white px-3 py-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] dark:border-border dark:bg-card dark:shadow-[0_10px_22px_rgba(2,6,23,0.45)]">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
                  Adicionar vídeo geral
                </span>

                <span className="text-[10px] font-medium text-muted-foreground">
                  {wordVideos.length} vídeo{wordVideos.length === 1 ? "" : "s"} anexado{wordVideos.length === 1 ? "" : "s"}
                </span>
              </div>

              <textarea
                value={videoEditor.value}
                onChange={(event) =>
                  setVideoEditor((current) => ({
                    ...current,
                    value: event.target.value,
                  }))
                }
                placeholder="Cole o link do vídeo, iframe/embed completo ou BBCode"
                rows={3}
                spellCheck={false}
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void saveVideoFromEditor({
                      key: NEW_WORD_VIDEO_KEY,
                      oldVideo: "",
                      onSuccess: ({ video, thumbnail }) =>
                        appendWordVideo({ video, thumbnail }),
                    })
                  }
                  disabled={
                    !videoEditor.value.trim() ||
                    deletingVideoKey === NEW_WORD_VIDEO_KEY
                  }
                  className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {deletingVideoKey === NEW_WORD_VIDEO_KEY
                    ? "Salvando..."
                    : "Adicionar vídeo"}
                </button>

                <button
                  type="button"
                  onClick={() => triggerVideoFilePicker(NEW_WORD_VIDEO_KEY)}
                  disabled={
                    uploadingVideoKey === NEW_WORD_VIDEO_KEY ||
                    deletingVideoKey === NEW_WORD_VIDEO_KEY
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <Upload className="h-3 w-3" />
                  {uploadingVideoKey === NEW_WORD_VIDEO_KEY
                    ? "Enviando para R2..."
                    : "Enviar arquivo"}
                </button>

                <button
                  type="button"
                  onClick={closeVideoEditor}
                  disabled={deletingVideoKey === NEW_WORD_VIDEO_KEY}
                  className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openVideoEditor(NEW_WORD_VIDEO_KEY, "")}
                  disabled={deletingVideoKey === NEW_WORD_VIDEO_KEY}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-white px-3 py-1.5 text-[11px] font-bold text-foreground shadow-[0_4px_10px_rgba(15,23,42,0.04)] transition-colors hover:bg-muted disabled:opacity-50 dark:border-border dark:bg-card"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar vídeo
                </button>

                <button
                  type="button"
                  onClick={() => triggerVideoFilePicker(NEW_WORD_VIDEO_KEY)}
                  disabled={
                    uploadingVideoKey === NEW_WORD_VIDEO_KEY ||
                    deletingVideoKey === NEW_WORD_VIDEO_KEY
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-white px-3 py-1.5 text-[11px] font-bold text-foreground shadow-[0_4px_10px_rgba(15,23,42,0.04)] transition-colors hover:bg-muted disabled:opacity-50 dark:border-border dark:bg-card"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingVideoKey === NEW_WORD_VIDEO_KEY
                    ? "Enviando..."
                    : "Enviar arquivo"}
                </button>
              </div>

              <span className="text-[10px] font-medium text-muted-foreground">
                + vídeo geral
              </span>
            </div>
          )}

          {newWordVideoUploadError ? (
            <p className="px-1 text-[11px] font-medium text-destructive">
              {newWordVideoUploadError}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={`w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition-all ${
            canSave ? "hover:bg-primary/90" : "opacity-60 cursor-not-allowed"
          }`}
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
