import { Fragment, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Languages,
  Lightbulb,
  Play,
  BookOpen,
  Volume2,
  X,
} from "lucide-react";
import { useIsMobile } from "../hooks/use-mobile";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import ExampleVideoPlayer from "@/components/ExampleVideoPlayer";
import {
  resolveExampleVideoPlayback,
  resolveExampleVideoThumbnail,
} from "@/lib/exampleVideoStorage";
import { playSound } from "../lib/gameState";
import { SFX_EVENTS } from "../lib/sfx";

const EXAMPLES_POINTER_SFX_GUARD_MS = 700;
const MOBILE_EMBED_REOPEN_GUARD_MS = 650;
const MOBILE_EMBED_OPENING_DELAY_MS = 260;
const THUMBNAIL_CAPTURE_TIME_SECONDS = 1;
const THUMBNAIL_END_GUARD_SECONDS = 0.05;
const VIDEO_SWIPE_DISTANCE_PX = 42;
const VIDEO_SWIPE_DIRECTION_RATIO = 1.15;

const VIDEO_FRAME_CLASS =
  "overflow-hidden rounded-lg bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0 [&_video]:absolute [&_video]:inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-contain";

const videoThumbnailCache = new Map();
const thirdPartyThumbnailCache = new Map();

const DESCENDER_CHAR_REGEX = /[gjpqy]/;

const normalizeVideoValue = (value) =>
  typeof value === "string" ? value.trim() : "";

const isLikelyThirdPartyEmbedValue = (value) => {
  const cleanValue = normalizeVideoValue(value);
  if (!cleanValue) return false;

  return (
    /<iframe/i.test(cleanValue) ||
    /\[iframe/i.test(cleanValue) ||
    /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|dai\.ly|tiktok\.com|instagram\.com|facebook\.com\/plugins\/video|player\.twitch\.tv|clip\.cafe|playphrase\.me|yarn\.co/i.test(
      cleanValue
    )
  );
};

const FLASHCARD_MOBILE_MEANING_PALETTE = [
  {
    border: "#CEEBD8",
    background: "#F7FCF9",
    accent: "#2AA55A",
    bullet: "#35B56A",
    tipBackground: "#EEF9F2",
    tipBorder: "#D9F0E1",
    underline: "#2AA55A",
  },
  {
    border: "#D3E5F9",
    background: "#F6FAFE",
    accent: "#2F7FD9",
    bullet: "#3E8EE6",
    tipBackground: "#EEF5FD",
    tipBorder: "#D8E8FA",
    underline: "#2F7FD9",
  },
  {
    border: "#F6DFC4",
    background: "#FFFAF3",
    accent: "#C97A24",
    bullet: "#D88A34",
    tipBackground: "#FFF4E7",
    tipBorder: "#F6E2CA",
    underline: "#C97A24",
  },
  {
    border: "#E3D8F8",
    background: "#FAF8FF",
    accent: "#7A55C3",
    bullet: "#8A67CF",
    tipBackground: "#F4F0FD",
    tipBorder: "#E7DDF9",
    underline: "#7A55C3",
  },
];

const FLASHCARD_MOBILE_MEANING_PALETTE_DARK = [
  {
    border: "#2B4A38",
    background: "#16231D",
    accent: "#52D38A",
    bullet: "#4AC67F",
    tipBackground: "#142920",
    tipBorder: "#2F5945",
    underline: "#52D38A",
  },
  {
    border: "#2D4460",
    background: "#162231",
    accent: "#67B2FF",
    bullet: "#5EA9F9",
    tipBackground: "#15283A",
    tipBorder: "#33597F",
    underline: "#67B2FF",
  },
  {
    border: "#5A4326",
    background: "#271F16",
    accent: "#F3B05A",
    bullet: "#E9A34B",
    tipBackground: "#2A231A",
    tipBorder: "#6F5638",
    underline: "#F3B05A",
  },
  {
    border: "#4C3A67",
    background: "#20192C",
    accent: "#C59CFF",
    bullet: "#B98FFF",
    tipBackground: "#241E31",
    tipBorder: "#5A4779",
    underline: "#C59CFF",
  },
];

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
      <rect
        x="0.75"
        y="0.75"
        width="34.5"
        height="22.5"
        rx="4"
        fill="#229E45"
        stroke="#CEEBD8"
        strokeWidth="1.5"
      />
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

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));

const hexToRgb = (value) => {
  const hex = typeof value === "string" ? value.trim().replace("#", "") : "";
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex;

  if (!/^[\da-fA-F]{6}$/.test(normalized)) return null;

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b]
    .map((channel) => clampByte(channel).toString(16).padStart(2, "0"))
    .join("")}`;

const mixHexColors = (baseHex, targetHex, ratio = 0.5) => {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);

  if (!base || !target) return baseHex;

  const weight = Math.max(0, Math.min(1, ratio));

  return rgbToHex({
    r: base.r + (target.r - base.r) * weight,
    g: base.g + (target.g - base.g) * weight,
    b: base.b + (target.b - base.b) * weight,
  });
};

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeExampleText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizePronunciationValue = (source) => {
  if (!source || typeof source !== "object") return "";

  return normalizeText(
    source?.pronunciation ??
      source?.pronounce ??
      source?.pronuncia ??
      source?.phonetic ??
      source?.phonetics ??
      source?.ipa ??
      source?.pronunciationText ??
      source?.pronunciation_text ??
      source?._pronunciation ??
      source?._wordPronunciation ??
      source?._globalPronunciation ??
      source?.stats?.pronunciation ??
      source?.stats?.pronounce ??
      source?.stats?.phonetic ??
      source?.stats?.ipa ??
      ""
  );
};

const getWordVideoFromMeanings = (meanings) => {
  if (!Array.isArray(meanings)) return "";

  const meaningWithVideo = meanings.find((meaning) =>
    normalizeText(meaning?._wordVideo || meaning?._globalVideo)
  );

  return normalizeText(
    meaningWithVideo?._wordVideo || meaningWithVideo?._globalVideo || ""
  );
};

const getWordThumbnailFromMeanings = (meanings) => {
  if (!Array.isArray(meanings)) return "";

  const meaningWithThumbnail = meanings.find((meaning) =>
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
    getWordVideoFromMeanings(item?.meanings) ??
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
    getWordThumbnailFromMeanings(item?.meanings) ??
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

const getWordVideosFromMeanings = (meanings) => {
  if (!Array.isArray(meanings)) return [];

  const meaningWithVideos = meanings.find((meaning) => {
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

  const singleVideo = getWordVideoFromMeanings(meanings);
  const singleThumbnail = getWordThumbnailFromMeanings(meanings);

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
    ...getWordVideosFromMeanings(item?.meanings),
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

const hasMeaningOrExampleVideo = (meanings) => {
  if (!Array.isArray(meanings)) return false;

  return meanings.some((meaning) => {
    const meaningVideo = normalizeMeaningVideo(meaning);

    if (meaningVideo) return true;

    if (!Array.isArray(meaning?.examples)) return false;

    return meaning.examples.some((example) => normalizeExampleVideo(example));
  });
};

const getMeaningPaletteByIndex = (index, palette) =>
  palette[index % palette.length];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const renderUnderlineSequence = (
  value,
  keyPrefix,
  underlineColor = "#ED9A0A"
) =>
  Array.from(value).map((char, index) => {
    const isDescender = DESCENDER_CHAR_REGEX.test(char);
    const isSpace = char === " ";

    return (
      <span
        key={`${keyPrefix}-${index}`}
        style={{
          display: "inline-block",
          paddingBottom: "0.1em",
          boxShadow: isDescender
            ? "none"
            : `inset 0 -1px 0 ${underlineColor}`,
          lineHeight: "inherit",
          verticalAlign: "baseline",
        }}
      >
        {isSpace ? "\u00A0" : char}
      </span>
    );
  });

const getHighlightTermCandidates = (term) => {
  const cleanTerm =
    typeof term === "string" ? term.trim().replace(/\s+/g, " ") : "";

  if (!cleanTerm) return [];

  const candidates = [cleanTerm];
  const words = cleanTerm.split(/\s+/).filter(Boolean);

  // Mantém o comportamento antigo quando o termo completo aparece na frase.
  // Se não aparecer, tenta destacar o núcleo da expressão.
  // Ex.: "I kind of" também destaca "kind of" em frases como "I'm kind of tired."
  if (words.length > 2) {
    for (let index = 1; index < words.length - 1; index += 1) {
      candidates.push(words.slice(index).join(" "));
    }
  }

  return Array.from(
    new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))
  );
};

const renderHighlightedTerm = (
  text,
  term,
  { underlineColor = "#ED9A0A" } = {}
) => {
  const safeText = typeof text === "string" ? text : "";
  const candidates = getHighlightTermCandidates(term);

  if (!safeText || candidates.length === 0) {
    return safeText;
  }

  for (const candidate of candidates) {
    const pattern = new RegExp(`(${escapeRegExp(candidate)})`, "gi");
    const parts = safeText.split(pattern);

    if (parts.length <= 1) {
      continue;
    }

    return parts.map((part, index) => {
      const isMatch = part.toLowerCase() === candidate.toLowerCase();

      if (!isMatch) {
        return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
      }

      return (
        <Fragment key={`${part}-${index}`}>
          {renderUnderlineSequence(part, `${part}-${index}`, underlineColor)}
        </Fragment>
      );
    });
  }

  return safeText;
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

const getDailymotionVideoId = (value) => {
  const cleanValue = normalizeText(value);

  if (!cleanValue) return "";

  const patterns = [
    /dailymotion\.com\/video\/([a-zA-Z0-9]+)/i,
    /dai\.ly\/([a-zA-Z0-9]+)/i,
    /dailymotion\.com\/embed\/video\/([a-zA-Z0-9]+)/i,
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
    /vimeo\.com\/video\/(\d+)/i,
    /player\.vimeo\.com\/video\/(\d+)/i,
    /vimeo\.com\/(\d+)/i,
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
    /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|dai\.ly|tiktok\.com|instagram\.com|facebook\.com\/plugins\/video|player\.twitch\.tv|clip\.cafe|playphrase\.me|yarn\.co/i.test(
      cleanValue
    )
  );
};

const getPlatformThumbnailCandidates = (value) => {
  const candidates = [];
  const youtubeId = getYouTubeVideoId(value);

  if (youtubeId) {
    candidates.push(`https://i.ytimg.com/vi_webp/${youtubeId}/maxresdefault.webp`);
    candidates.push(`https://i.ytimg.com/vi_webp/${youtubeId}/hqdefault.webp`);
    candidates.push(`https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`);
    candidates.push(`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`);
    candidates.push(`https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`);
  }

  const vimeoId = getVimeoVideoId(value);

  if (vimeoId) {
    candidates.push(`https://vumbnail.com/${vimeoId}.jpg`);
  }

  const dailymotionId = getDailymotionVideoId(value);

  if (dailymotionId) {
    candidates.push(`https://www.dailymotion.com/thumbnail/video/${dailymotionId}`);
  }

  return candidates
    .map((candidate) => normalizeText(candidate))
    .filter(Boolean)
    .filter((candidate, index, list) => list.indexOf(candidate) === index);
};

function ExampleVideoThumbnail({
  video,
  thumbnail,
  onClick,
  onSwipeLeft,
  onSwipeRight,
  title = "VÃ­deo do exemplo",
  isOpen = false,
  isMobile = false,
  className = "h-[84px]",
}) {
  const [thumbnailSrc, setThumbnailSrc] = useState(() => {
    const rawVideo = normalizeText(video);
    const rawThumbnail = normalizeText(thumbnail);

    if (rawThumbnail) return rawThumbnail;
    if (isThirdPartyEmbeddedVideo(rawVideo)) {
      return thirdPartyThumbnailCache.get(rawVideo) || getPlatformThumbnailCandidates(rawVideo)[0] || "";
    }

    return videoThumbnailCache.get(rawVideo) || "";
  });
  const swipePointerRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
  });
  const suppressClickRef = useRef(false);
  const thirdPartyFallbackSourcesRef = useRef([]);

  const isThirdPartyVideo = isThirdPartyEmbeddedVideo(video);
  const shouldUseOwnedPlayVisual = !isThirdPartyVideo;

  useEffect(() => {
    let cancelled = false;
    let previewVideo = null;
    let fallbackTimer = null;
    let captured = false;

    const rawVideo = typeof video === "string" ? video.trim() : "";
    const rawThumbnail =
      typeof thumbnail === "string" ? thumbnail.trim() : "";

    const clearFallbackTimer = () => {
      if (!fallbackTimer) return;
      window.clearTimeout(fallbackTimer);
      fallbackTimer = null;
    };

    const applyFallback = () => {
      if (cancelled || captured) return;
      thirdPartyFallbackSourcesRef.current = [];
      setThumbnailSrc("");
    };

    const applyThumbnailSource = (source, fallbackSources = []) => {
      if (cancelled) return;
      setThumbnailSrc(normalizeText(source));
      thirdPartyFallbackSourcesRef.current = Array.isArray(fallbackSources)
        ? fallbackSources
            .map((fallbackSource) => normalizeText(fallbackSource))
            .filter(Boolean)
        : [];
    };

    const cleanupVideo = () => {
      clearFallbackTimer();

      if (!previewVideo) return;

      try {
        previewVideo.pause();
        previewVideo.removeAttribute("src");
        previewVideo.load?.();

        if (previewVideo.parentNode) {
          previewVideo.parentNode.removeChild(previewVideo);
        }
      } catch {
        // noop
      }

      previewVideo = null;
    };

    const saveThumbnail = (dataUrl) => {
      if (cancelled || !dataUrl) return;

      captured = true;
      clearFallbackTimer();
      applyThumbnailSource(dataUrl);

      if (rawVideo) {
        videoThumbnailCache.set(rawVideo, dataUrl);
      }
    };

    const drawFrame = () => {
      if (cancelled || captured || !previewVideo) return;

      try {
        const width = previewVideo.videoWidth || 320;
        const height = previewVideo.videoHeight || 180;

        if (!width || !height) {
          applyFallback();
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
          applyFallback();
          return;
        }

        context.drawImage(previewVideo, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
        saveThumbnail(dataUrl);
      } catch {
        applyFallback();
      }
    };

    const getThumbnailCaptureTime = () => {
      const duration =
        Number.isFinite(previewVideo?.duration) && previewVideo.duration > 0
          ? previewVideo.duration
          : 0;

      if (!duration) return null;

      const latestSafeTime = Math.max(0, duration - THUMBNAIL_END_GUARD_SECONDS);

      return Math.min(THUMBNAIL_CAPTURE_TIME_SECONDS, latestSafeTime);
    };

    const seekToThumbnailCaptureFrame = () => {
      if (cancelled || captured || !previewVideo) return;

      const targetTime = getThumbnailCaptureTime();

      if (targetTime === null) {
        window.requestAnimationFrame(drawFrame);
        return;
      }

      try {
        previewVideo.currentTime = targetTime;
      } catch {
        window.requestAnimationFrame(drawFrame);
      }
    };

    const generateThumbnail = async () => {
      const initialThumbnailSrc = rawThumbnail ||
        (isThirdPartyEmbeddedVideo(rawVideo)
          ? thirdPartyThumbnailCache.get(rawVideo) || getPlatformThumbnailCandidates(rawVideo)[0] || ""
          : videoThumbnailCache.get(rawVideo) || "");
      setThumbnailSrc(initialThumbnailSrc);
      thirdPartyFallbackSourcesRef.current = [];

      if (!rawVideo || typeof window === "undefined") {
        return;
      }

      if (isThirdPartyEmbeddedVideo(rawVideo)) {
        const cachedThirdPartyThumbnail = thirdPartyThumbnailCache.get(rawVideo);

        if (cachedThirdPartyThumbnail) {
          applyThumbnailSource(cachedThirdPartyThumbnail);
          return;
        }

        const thirdPartyThumbnailCandidates = [
          rawThumbnail,
          ...getPlatformThumbnailCandidates(rawVideo),
        ]
          .map((candidate) => normalizeText(candidate))
          .filter(Boolean)
          .filter((candidate, index, list) => list.indexOf(candidate) === index);

        if (thirdPartyThumbnailCandidates.length > 0) {
          const [firstThumbnail, ...fallbackThumbnails] =
            thirdPartyThumbnailCandidates;
          thirdPartyThumbnailCache.set(rawVideo, firstThumbnail);
          applyThumbnailSource(firstThumbnail, fallbackThumbnails);
          return;
        }

        const resolvedThirdPartyThumbnail = await resolveExampleVideoThumbnail(rawVideo);

        if (cancelled) return;

        if (resolvedThirdPartyThumbnail) {
          thirdPartyThumbnailCache.set(rawVideo, resolvedThirdPartyThumbnail);
          applyThumbnailSource(resolvedThirdPartyThumbnail);
          return;
        }

        applyFallback();
        return;
      }

      if (rawThumbnail) {
        applyThumbnailSource(rawThumbnail);
        return;
      }

      const cachedThumbnail = videoThumbnailCache.get(rawVideo);

      if (cachedThumbnail) {
        applyThumbnailSource(cachedThumbnail);
        return;
      }

      try {
        const playback = await resolveExampleVideoPlayback(rawVideo);

        if (cancelled) return;

        if (!playback || playback.type !== "video" || !playback.src) {
          applyFallback();
          return;
        }

        previewVideo = document.createElement("video");
        previewVideo.crossOrigin = "anonymous";
        previewVideo.preload = "auto";
        previewVideo.muted = true;
        previewVideo.playsInline = true;
        previewVideo.setAttribute("crossorigin", "anonymous");
        previewVideo.setAttribute("playsinline", "true");
        previewVideo.setAttribute("webkit-playsinline", "true");
        previewVideo.src = playback.src;

        previewVideo.style.position = "fixed";
        previewVideo.style.left = "-9999px";
        previewVideo.style.top = "-9999px";
        previewVideo.style.width = "1px";
        previewVideo.style.height = "1px";
        previewVideo.style.opacity = "0";
        previewVideo.style.pointerEvents = "none";

        document.body.appendChild(previewVideo);

        fallbackTimer = window.setTimeout(() => {
          applyFallback();
        }, 8000);

        previewVideo.addEventListener("loadedmetadata", seekToThumbnailCaptureFrame, {
          once: true,
        });

        previewVideo.addEventListener(
          "seeked",
          () => {
            window.requestAnimationFrame(drawFrame);
          },
          { once: true }
        );

        previewVideo.addEventListener(
          "loadeddata",
          () => {
            if (!previewVideo || cancelled || captured) return;

            if (
              !Number.isFinite(previewVideo.duration) ||
              previewVideo.duration <= 0
            ) {
              window.requestAnimationFrame(drawFrame);
            }
          },
          { once: true }
        );

        previewVideo.addEventListener(
          "canplay",
          () => {
            if (!previewVideo || cancelled || captured) return;

            if (previewVideo.readyState >= 2 && previewVideo.currentTime > 0) {
              window.requestAnimationFrame(drawFrame);
            }
          },
          { once: true }
        );

        previewVideo.addEventListener(
          "error",
          () => {
            applyFallback();
          },
          { once: true }
        );

        previewVideo.load();
      } catch {
        applyFallback();
      }
    };

    generateThumbnail();

    return () => {
      cancelled = true;
      cleanupVideo();
    };
  }, [video, thumbnail]);

  const resetSwipePointer = () => {
    swipePointerRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
    };
  };

  const handlePointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    swipePointerRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const handlePointerCancel = () => {
    resetSwipePointer();
  };

  const handlePointerUp = (event) => {
    const swipeState = swipePointerRef.current;

    if (!swipeState.active || swipeState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - swipeState.startX;
    const deltaY = event.clientY - swipeState.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const isHorizontalSwipe =
      absX >= VIDEO_SWIPE_DISTANCE_PX &&
      absX > absY * VIDEO_SWIPE_DIRECTION_RATIO;

    resetSwipePointer();

    if (!isHorizontalSwipe) return;

    if (deltaX < 0) {
      onSwipeLeft?.(event);
    } else {
      onSwipeRight?.(event);
    }

    suppressClickRef.current = true;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(event) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.(event);
        }
      }}
      aria-label={title}
      title={title}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
      className={[
        "group relative w-full touch-pan-y overflow-hidden rounded-lg border",
        "cursor-pointer",
        className,
        isOpen
          ? "border-[#ED9A0A]/80 dark:border-[#ED9A0A]/70"
          : "border-[#D9E2EC] dark:border-border",
        "bg-[#F8FAFC] dark:bg-muted/40",
        "transition-all duration-200",
        "hover:border-[#ED9A0A]/70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED9A0A]/35 focus-visible:ring-offset-2",
      ].join(" ")}
    >
      {thumbnailSrc ? (
        <img
          src={thumbnailSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          draggable={false}
          onLoad={() => {
            const safeVideo = normalizeText(video);
            const safeThumbnail = normalizeText(thumbnailSrc);

            if (!isThirdPartyVideo || !safeVideo || !safeThumbnail) return;
            thirdPartyThumbnailCache.set(safeVideo, safeThumbnail);
          }}
          onError={() => {
            const [nextFallbackThumbnail, ...remainingFallbacks] =
              thirdPartyFallbackSourcesRef.current;
            const safeVideo = normalizeText(video);

            if (nextFallbackThumbnail) {
              thirdPartyFallbackSourcesRef.current = remainingFallbacks;
              if (isThirdPartyVideo && safeVideo) {
                thirdPartyThumbnailCache.set(safeVideo, nextFallbackThumbnail);
              }
              setThumbnailSrc(nextFallbackThumbnail);
              return;
            }

            if (isThirdPartyVideo && safeVideo) {
              thirdPartyThumbnailCache.delete(safeVideo);
            }
            setThumbnailSrc("");
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(237,154,10,0.18),transparent_32%),linear-gradient(135deg,#F8FAFC_0%,#EFF4F8_55%,#E6EDF5_100%)]" />
      )}

      <>
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10" />
        <div className="absolute inset-0 bg-black/10 transition-colors duration-200 group-hover:bg-black/6" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={
              shouldUseOwnedPlayVisual
                ? [
                    "flex h-11 w-11 items-center justify-center rounded-full",
                    "border border-white/55 bg-white/10",
                    "shadow-[0_4px_10px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.22)]",
                    "backdrop-blur-[2px] transition-[transform,background-color,border-color] duration-200 ease-out",
                    isMobile
                      ? ""
                      : "group-hover:scale-[1.15] group-hover:border-white/75 group-hover:bg-white/16",
                  ].join(" ")
                : [
                    "flex h-11 w-11 items-center justify-center rounded-full",
                    "border border-white/70 bg-white/55",
                    "shadow-[0_12px_24px_rgba(15,23,42,0.18),inset_0_1px_1px_rgba(255,255,255,0.75)]",
                    "backdrop-blur-md transition-all duration-200",
                    "group-hover:scale-105 group-hover:bg-white/72",
                  ].join(" ")
            }
          >
            <Play
              className={
                shouldUseOwnedPlayVisual
                  ? "ml-[2px] h-[18px] w-[18px] fill-white text-white stroke-[2]"
                  : "ml-[2px] h-[18px] w-[18px] fill-[#ED9A0A] text-[#ED9A0A] stroke-[2.2]"
              }
            />
          </div>
        </div>
      </>
    </div>
  );
}

export default function ExamplesPanel({
  allMeanings,
  activeMeaning,
  examples,
  meaning,
  titleTerm,
  variant = "default",
  panelScope = "shared",
  onClose,
  wordVideo = "",
  wordThumbnail = "",
  wordVideos = [],
  pronunciation = "",
  item,
  vocabularyItem,
}) {
  const lastClosePointerSfxAtRef = useRef(0);
  const lastMobileVideoCloseAtRef = useRef(0);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [openDesktopVideos, setOpenDesktopVideos] = useState({});
  const [desktopAutoplayByGroup, setDesktopAutoplayByGroup] = useState({});
  const [mobileVideo, setMobileVideo] = useState(null);
  const [videoPlaybackOpenTokens, setVideoPlaybackOpenTokens] = useState({});
  const videoPlaybackOpenTokenRef = useRef(0);
  const [isMobileEmbedOpening, setIsMobileEmbedOpening] = useState(false);
  const [isMobileLandscapeVideoLayout, setIsMobileLandscapeVideoLayout] = useState(false);
  const [mobileVideoViewportSize, setMobileVideoViewportSize] = useState({
    width: 0,
    height: 0,
  });
  const mobileVideoResizeTimerRef = useRef(null);
  const [videoIndexes, setVideoIndexes] = useState({});
  const [expandedMeaningVideoKey, setExpandedMeaningVideoKey] = useState(null);
  const [expandedTipKeys, setExpandedTipKeys] = useState({});
  const [fetchedPronunciation, setFetchedPronunciation] = useState("");
  const expandedVideoSwipeRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
  });

  useEffect(() => {
    if (!isMobile) {
      setIsMobileLandscapeVideoLayout(false);
      setMobileVideoViewportSize({ width: 0, height: 0 });
      return;
    }

    const readViewportSize = () => {
      if (typeof window === "undefined") return;

      const visualViewport = window.visualViewport;
      const viewportWidth = Math.round(
        visualViewport?.width ||
          window.innerWidth ||
          document.documentElement?.clientWidth ||
          0
      );
      const viewportHeight = Math.round(
        visualViewport?.height ||
          window.innerHeight ||
          document.documentElement?.clientHeight ||
          0
      );

      setMobileVideoViewportSize((current) => {
        if (current.width === viewportWidth && current.height === viewportHeight) {
          return current;
        }

        return {
          width: viewportWidth,
          height: viewportHeight,
        };
      });

      setIsMobileLandscapeVideoLayout(Boolean(viewportWidth > viewportHeight));
    };

    const checkMobileLandscapeVideoLayout = () => {
      if (typeof window === "undefined") return;

      window.requestAnimationFrame?.(readViewportSize) || readViewportSize();

      if (mobileVideoResizeTimerRef.current) {
        window.clearTimeout(mobileVideoResizeTimerRef.current);
      }

      // Safari/iOS pode entregar uma medida intermediária durante a rotação.
      // Um único ajuste final suaviza a transição sem remontar o iframe várias vezes.
      mobileVideoResizeTimerRef.current = window.setTimeout(() => {
        readViewportSize();
        mobileVideoResizeTimerRef.current = null;
      }, 180);
    };

    checkMobileLandscapeVideoLayout();
    window.addEventListener("resize", checkMobileLandscapeVideoLayout);
    window.addEventListener("orientationchange", checkMobileLandscapeVideoLayout);
    window.visualViewport?.addEventListener("resize", checkMobileLandscapeVideoLayout);

    return () => {
      if (mobileVideoResizeTimerRef.current) {
        window.clearTimeout(mobileVideoResizeTimerRef.current);
        mobileVideoResizeTimerRef.current = null;
      }

      window.removeEventListener("resize", checkMobileLandscapeVideoLayout);
      window.removeEventListener(
        "orientationchange",
        checkMobileLandscapeVideoLayout
      );
      window.visualViewport?.removeEventListener(
        "resize",
        checkMobileLandscapeVideoLayout
      );
    };
  }, [isMobile]);

  const rawMeanings = allMeanings || (examples ? [{ meaning, examples }] : []);
  const lookupPronunciationTerm = normalizeText(titleTerm);
  const directPronunciation =
    normalizeText(pronunciation) ||
    normalizePronunciationValue(item) ||
    normalizePronunciationValue(vocabularyItem) ||
    rawMeanings.map((entry) => normalizePronunciationValue(entry)).find(Boolean) ||
    "";

  useEffect(() => {
    let cancelled = false;

    setFetchedPronunciation("");

    if (directPronunciation || !user?.id || !lookupPronunciationTerm) {
      return () => {
        cancelled = true;
      };
    }

    const fetchPronunciation = async () => {
      try {
        const { data, error } = await supabase
          .from("vocabulary")
          .select("pronunciation")
          .eq("user_id", user.id)
          .eq("term", lookupPronunciationTerm)
          .limit(1)
          .maybeSingle();

        if (cancelled || error) return;

        setFetchedPronunciation(normalizeText(data?.pronunciation));
      } catch {
        // Mantém o painel funcionando mesmo se a pronúncia não for encontrada.
      }
    };

    fetchPronunciation();

    return () => {
      cancelled = true;
    };
  }, [directPronunciation, lookupPronunciationTerm, user?.id]);

  const sharedPronunciation = directPronunciation || fetchedPronunciation;

  const wordVideoSources = dedupeVideoEntries([
    ...normalizeVideoList(wordVideos, wordThumbnail),
    ...normalizeVideoList(wordVideo, wordThumbnail),
    ...normalizeWordVideos(item),
    ...normalizeWordVideos(vocabularyItem),
    ...getWordVideosFromMeanings(rawMeanings),
  ]);

  const wordVideoSourcesSignature = wordVideoSources
    .map((entry) => `${entry.video}::${entry.thumbnail || ""}`)
    .join("||");


  // VÃ­deo geral tem prioridade visual: se existir vÃ­deo global/geral,
  // ele fica no topo e os vÃ­deos especÃ­ficos dos significados/exemplos
  // nÃ£o sÃ£o renderizados como carrossÃ©is dentro dos blocos.
  const shouldShowGlobalWordVideoOnTop = Boolean(wordVideoSources.length > 0);
  const shouldShowSpecificVideosInsideMeanings = !shouldShowGlobalWordVideoOnTop;

  const normalized = rawMeanings.map((entry, index) => {
    const normalizedMeaningText = normalizeText(entry?.meaning);
    const meaningVideo = normalizeMeaningVideo(entry);
    const meaningThumbnail = normalizeMeaningThumbnail(entry);

    const rawExamples = Array.isArray(entry?.examples) ? entry.examples : [];

    const topVideos = [
      meaningVideo
        ? {
            video: meaningVideo,
            thumbnail: meaningThumbnail,
            key: `${normalizedMeaningText || "meaning"}-${index}-meaning-video`,
            title: normalizedMeaningText || `Significado ${index + 1}`,
            level: "meaning",
          }
        : null,
      ...rawExamples
        .map((example, exampleIndex) => {
          const exampleVideo = normalizeExampleVideo(example);

          if (!exampleVideo) return null;

          return {
            video: exampleVideo,
            thumbnail: normalizeExampleThumbnail(example),
            key: `${
              normalizedMeaningText || "meaning"
            }-${index}-example-${exampleIndex}`,
            level: "example",
            title:
              normalizeExampleText(example?.sentence) ||
              normalizedMeaningText ||
              "VÃ­deo do exemplo",
          };
        })
        .filter(Boolean),
    ].filter(Boolean);

    return {
      meaning: normalizedMeaningText,
      category: normalizeText(entry?.category),
      tip: normalizeText(entry?.tip),
      pronunciation: normalizePronunciationValue(entry) || sharedPronunciation,
      video: meaningVideo,
      thumbnail: meaningThumbnail,
      topVideos,
      examples: rawExamples
        .map((example) => ({
          sentence: normalizeExampleText(example?.sentence),
          translation: normalizeExampleText(example?.translation),
          video: normalizeExampleVideo(example),
          thumbnail: normalizeExampleThumbnail(example),
        }))
        .filter(hasExampleContent),
    };
  });

  const activeMeaningText = normalizeText(activeMeaning);
  const sorted = activeMeaningText
    ? [...normalized].sort((a, b) =>
        a.meaning === activeMeaningText ? -1 : b.meaning === activeMeaningText ? 1 : 0
      )
    : normalized;
  const hasMultipleMeanings = sorted.length > 1;

  const videoMeaningGroupKeys = shouldShowSpecificVideosInsideMeanings
    ? sorted.reduce((accumulator, entry, index) => {
        if (Array.isArray(entry?.topVideos) && entry.topVideos.length > 0) {
          accumulator.push(`meaning-video-group-${entry.meaning}-${index}`);
        }

        return accumulator;
      }, [])
    : [];
  const allMeaningGroupKeys = sorted.map(
    (entry, index) => `meaning-video-group-${entry.meaning}-${index}`
  );
  const activeMeaningGroupKey = activeMeaningText
    ? sorted.reduce((match, entry, index) => {
        if (match) return match;

        if (entry.meaning === activeMeaningText) {
          return `meaning-video-group-${entry.meaning}-${index}`;
        }

        return null;
      }, null)
    : null;
  const collapsibleMeaningGroupKeys = activeMeaningText
    ? allMeaningGroupKeys
    : videoMeaningGroupKeys;

  const shouldUseMeaningVideoCollapse =
    hasMultipleMeanings && collapsibleMeaningGroupKeys.length > 0;
  const firstExpandedMeaningVideoKey = activeMeaningText
    ? activeMeaningGroupKey
    : collapsibleMeaningGroupKeys[0] || null;
  const videoMeaningGroupsSignature = collapsibleMeaningGroupKeys.join("||");

  useEffect(() => {
    setOpenDesktopVideos({});
    setDesktopAutoplayByGroup({});
    setMobileVideo(null);
    setVideoIndexes({});
    setExpandedTipKeys({});
  }, [
    allMeanings,
    activeMeaning,
    wordVideoSourcesSignature,
    shouldShowGlobalWordVideoOnTop,
  ]);

  const hasExpandedTip = Object.values(expandedTipKeys).some(Boolean);

  useEffect(() => {
    if (!hasExpandedTip || typeof document === "undefined") {
      return undefined;
    }

    const handlePointerDownOutsideTip = (event) => {
      const target = event.target;

      if (
        target &&
        typeof target.closest === "function" &&
        target.closest('[data-examples-tip-area="true"]')
      ) {
        return;
      }

      setExpandedTipKeys({});
    };

    document.addEventListener("pointerdown", handlePointerDownOutsideTip, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutsideTip, true);
    };
  }, [hasExpandedTip]);

  useEffect(() => {
    if (!shouldUseMeaningVideoCollapse) {
      setExpandedMeaningVideoKey(null);
      return;
    }

    setExpandedMeaningVideoKey((current) => {
      if (activeMeaningText) {
        return firstExpandedMeaningVideoKey;
      }

      if (current && collapsibleMeaningGroupKeys.includes(current)) {
        return current;
      }

      return firstExpandedMeaningVideoKey;
    });
  }, [
    activeMeaningText,
    shouldUseMeaningVideoCollapse,
    firstExpandedMeaningVideoKey,
    videoMeaningGroupsSignature,
  ]);

  useEffect(() => {
    if (!mobileVideo?.video) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMobileVideo(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileVideo]);

  const isFlashcard = variant === "flashcard";
  const isFlashcardMobileLayout =
    isFlashcard && isMobile && panelScope === "flashcards";
  const { isDark: isDarkTheme } = useTheme();
  const meaningPaletteCollection = isDarkTheme
    ? FLASHCARD_MOBILE_MEANING_PALETTE_DARK
    : FLASHCARD_MOBILE_MEANING_PALETTE;
  const titleValue = titleTerm ? titleTerm.trim() : "Exemplos";
  const highlightTerm = titleTerm ? titleTerm.trim() : "";
  const panelContainerClass = isFlashcard
    ? isFlashcardMobileLayout
      ? "mt-0 bg-transparent p-0 text-foreground"
      : "mt-0 rounded-xl border border-[#EDF0F3] bg-white p-6 text-[#1A1A1A] dark:border-border dark:bg-card dark:text-foreground"
    : "mt-4 rounded-2xl border border-border/70 bg-[#F9FAFB] p-5 animate-in fade-in slide-in-from-top-2 duration-200 dark:bg-card";
  const firstMeaningGroupKey = sorted.length
    ? `meaning-video-group-${sorted[0].meaning}-0`
    : null;
  const foregroundMeaningGroupKey = shouldUseMeaningVideoCollapse
    ? expandedMeaningVideoKey || firstExpandedMeaningVideoKey
    : firstMeaningGroupKey;
  const isFirstMeaningInForeground = Boolean(
    firstMeaningGroupKey && foregroundMeaningGroupKey === firstMeaningGroupKey
  );
  const isLowerMeaningInForeground = Boolean(
    firstMeaningGroupKey &&
      foregroundMeaningGroupKey &&
      foregroundMeaningGroupKey !== firstMeaningGroupKey
  );
  const shouldHidePanelHeaderDivider = shouldShowGlobalWordVideoOnTop
    ? !isLowerMeaningInForeground
    : isFirstMeaningInForeground;
  const panelHeaderDividerClass = shouldHidePanelHeaderDivider
    ? ""
    : isFlashcard
    ? "border-b border-border"
    : "border-b border-border/70";
  const panelHeaderClass = [
    isFlashcard
      ? isFlashcardMobileLayout
        ? shouldUseMeaningVideoCollapse
          ? "mb-0 flex items-center justify-between pb-2.5"
          : "mb-3 flex items-center justify-between pb-2.5"
        : shouldUseMeaningVideoCollapse
        ? "mb-0 flex items-center justify-between pb-2"
        : "mb-4 flex items-center justify-between pb-2"
      : shouldUseMeaningVideoCollapse
      ? "mb-0 flex items-center justify-between gap-3 pb-3"
      : "mb-4 flex items-center justify-between gap-3 pb-3",
    panelHeaderDividerClass,
  ]
    .filter(Boolean)
    .join(" ");
  const isExpandedGlobalWordVideo =
    mobileVideo?.groupKey === "global-word-video-group";
  const currentMobileVideoValue = mobileVideo?.video || "";
  const isCurrentMobileVideoThirdPartyEmbed =
    isLikelyThirdPartyEmbedValue(currentMobileVideoValue) ||
    isThirdPartyEmbeddedVideo(currentMobileVideoValue);
  const shouldUseCenteredEmbeddedMobileLayout =
    isCurrentMobileVideoThirdPartyEmbed && isMobileLandscapeVideoLayout;
  const mobileLandscapeViewportWidth = mobileVideoViewportSize.width || 0;
  const mobileLandscapeViewportHeight = mobileVideoViewportSize.height || 0;
  const mobileLandscapeEmbedWidth =
    mobileLandscapeViewportWidth && mobileLandscapeViewportHeight
      ? Math.min(
          mobileLandscapeViewportWidth,
          Math.round((mobileLandscapeViewportHeight * 16) / 9)
        )
      : 0;
  const mobileLandscapeEmbedHeight =
    mobileLandscapeViewportWidth && mobileLandscapeViewportHeight
      ? Math.min(
          mobileLandscapeViewportHeight,
          Math.round((mobileLandscapeViewportWidth * 9) / 16)
        )
      : 0;
  const mobileLandscapeEmbedFrameStyle =
    shouldUseCenteredEmbeddedMobileLayout &&
    mobileLandscapeEmbedWidth &&
    mobileLandscapeEmbedHeight
      ? {
          width: `${mobileLandscapeEmbedWidth}px`,
          height: `${mobileLandscapeEmbedHeight}px`,
          maxWidth: "100vw",
          maxHeight: "100vh",
          aspectRatio: "16 / 9",
        }
      : undefined;
  const mobileVideoPlayerKey = [
    mobileVideo?.key || "mobile-video",
    currentMobileVideoValue || "video",
    mobileVideo?.openToken || "0",
  ].join("|");
  const mobileVideoSurfaceBackgroundClass =
    isCurrentMobileVideoThirdPartyEmbed && isMobileEmbedOpening
      ? "bg-transparent"
      : "bg-black";

  useEffect(() => {
    if (!isMobile || !mobileVideo?.video || !isCurrentMobileVideoThirdPartyEmbed) {
      setIsMobileEmbedOpening(false);
      return;
    }

    setIsMobileEmbedOpening(true);

    const openingTimer = window.setTimeout(() => {
      setIsMobileEmbedOpening(false);
    }, MOBILE_EMBED_OPENING_DELAY_MS);

    return () => {
      window.clearTimeout(openingTimer);
    };
  }, [isMobile, mobileVideoPlayerKey, isCurrentMobileVideoThirdPartyEmbed]);

  const shouldSkipClickSfxAfterPointer = (event) => {
    if (!event) return false;
    if (event.detail === 0) return false;

    return (
      Date.now() - lastClosePointerSfxAtRef.current <
      EXAMPLES_POINTER_SFX_GUARD_MS
    );
  };

  const handleClose = (event) => {
    if (!shouldSkipClickSfxAfterPointer(event)) {
      playSound(SFX_EVENTS.EXAMPLES_CLOSE);
    }

    onClose?.();
  };

  const handleClosePointerDown = () => {
    lastClosePointerSfxAtRef.current = Date.now();
    playSound(SFX_EVENTS.EXAMPLES_CLOSE);
  };

  const closeMobileVideo = () => {
    lastMobileVideoCloseAtRef.current = Date.now();
    expandedVideoSwipeRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
    };
    setIsMobileEmbedOpening(false);
    setMobileVideo(null);
  };

  const openVideo = ({
    video,
    videoKey,
    videoTitle,
    groupKey,
    videos,
    index,
    autoPlayOnOpen = false,
    desktopAutoPlayOnOpen = false,
  }) => {
    if (!video) return;

    const nextOpenToken = videoPlaybackOpenTokenRef.current + 1;
    videoPlaybackOpenTokenRef.current = nextOpenToken;

    if (isMobile) {
      const isThirdPartyMobileVideo =
        isLikelyThirdPartyEmbedValue(video) || isThirdPartyEmbeddedVideo(video);
      const isInsideCloseReopenGuard =
        Date.now() - lastMobileVideoCloseAtRef.current <
        MOBILE_EMBED_REOPEN_GUARD_MS;

      if (isThirdPartyMobileVideo && isInsideCloseReopenGuard) {
        return;
      }

      setIsMobileEmbedOpening(Boolean(isThirdPartyMobileVideo));

      setMobileVideo({
        video,
        key: videoKey,
        title: videoTitle,
        groupKey,
        videos,
        index,
        autoPlay: Boolean(autoPlayOnOpen),
        openToken: nextOpenToken,
      });
      return;
    }

    setOpenDesktopVideos({
      [groupKey]: true,
    });
    setDesktopAutoplayByGroup({
      [groupKey]: Boolean(desktopAutoPlayOnOpen),
    });
    setVideoPlaybackOpenTokens({
      [groupKey]: nextOpenToken,
    });
  };

  const goToVideoIndex = ({ groupKey, videos, nextIndex }) => {
    if (!Array.isArray(videos) || videos.length === 0) return;

    const safeIndex =
      nextIndex < 0
        ? videos.length - 1
        : nextIndex >= videos.length
        ? 0
        : nextIndex;

    const nextVideo = videos[safeIndex];

    setVideoIndexes((current) => ({
      ...current,
      [groupKey]: safeIndex,
    }));

    if (isMobile && mobileVideo?.groupKey === groupKey) {
      setMobileVideo({
        video: nextVideo.video,
        key: nextVideo.key,
        title: nextVideo.title,
        groupKey,
        videos,
        index: safeIndex,
        autoPlay: false,
        openToken: mobileVideo.openToken || 0,
      });
    }
  };

  const renderVideoControls = ({ groupKey, videos, currentIndex }) => {
    if (!Array.isArray(videos) || videos.length <= 1) return null;

    return (
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            goToVideoIndex({
              groupKey,
              videos,
              nextIndex: currentIndex - 1,
            });
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#D9E2EC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#64748B] shadow-sm transition-colors hover:border-[#ED9A0A]/60 hover:bg-[#FFF8ED] hover:text-[#B86F00] dark:border-border dark:bg-card dark:text-slate-300 dark:hover:bg-[#ED9A0A]/20 dark:hover:text-[#F4BA53]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar
        </button>

        <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-300">
          {currentIndex + 1}/{videos.length}
        </span>

        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            goToVideoIndex({
              groupKey,
              videos,
              nextIndex: currentIndex + 1,
            });
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#D9E2EC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#64748B] shadow-sm transition-colors hover:border-[#ED9A0A]/60 hover:bg-[#FFF8ED] hover:text-[#B86F00] dark:border-border dark:bg-card dark:text-slate-300 dark:hover:bg-[#ED9A0A]/20 dark:hover:text-[#F4BA53]"
        >
          {"Pr\u00f3ximo"}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const renderTopVideoCarousel = ({ videos, groupKey, meaningPalette = null }) => {
    const safeVideos = Array.isArray(videos) ? videos.filter(Boolean) : [];

    if (safeVideos.length === 0) return null;

    const currentIndex = Math.min(
      videoIndexes[groupKey] || 0,
      safeVideos.length - 1
    );

    const currentVideo = safeVideos[currentIndex];
    const currentPlaybackOpenToken = videoPlaybackOpenTokens[groupKey] || 0;

    if (!currentVideo?.video) return null;

    const isCurrentVideoThirdParty = isThirdPartyEmbeddedVideo(
      currentVideo.video
    );
    const shouldRenderThirdPartyInline = !isMobile && isCurrentVideoThirdParty;
    // No mobile, embeds usam o preview original do provider como miniatura,
    // mas esse preview é desmontado/ocultado enquanto o overlay está aberto
    // para evitar tela preta ou iframe travado por trás do player expandido.
    const shouldRenderMobileThirdPartyPreview = isMobile && isCurrentVideoThirdParty;
    const isVideoOpen = Boolean(openDesktopVideos[groupKey]);
    const shouldAutoPlayDesktopVideo =
      isVideoOpen &&
      Boolean(desktopAutoplayByGroup[groupKey]);
    const shouldRenderPlayerDirectly =
      shouldRenderThirdPartyInline ||
      (isMobile && isCurrentVideoThirdParty) ||
      (isVideoOpen && !isMobile);
    const shouldShowAttachedChip = false;
    const attachedChipPalette = meaningPalette
      ? {
          borderColor: meaningPalette.tipBorder,
          backgroundColor: meaningPalette.tipBackground,
          textColor: meaningPalette.accent,
          dotColor: meaningPalette.bullet,
        }
      : {
          borderColor: "#F6DFC4",
          backgroundColor: "#FFF4E7",
          textColor: "#B86F00",
          dotColor: "#ED9A0A",
        };
    const shouldHideSourceThumbnailOnMobile =
      isMobile &&
      Boolean(mobileVideo?.key) &&
      mobileVideo.key === currentVideo.key;
    const videoSurfaceBleedClass = isFlashcardMobileLayout
      ? "-mx-3.5 -mt-3.5 !w-[calc(100%+1.75rem)]"
      : "-mx-4 -mt-3 !w-[calc(100%+2rem)]";

    return (
      <div
        className={
          meaningPalette
            ? isFlashcardMobileLayout
              ? "mb-2.5"
              : "mb-3"
            : isFlashcardMobileLayout
            ? "mb-3"
            : "mb-4"
        }
      >
        {shouldShowAttachedChip ? (
          <div className="mb-2 flex items-center">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none"
              style={{
                borderColor: attachedChipPalette.borderColor,
                backgroundColor: attachedChipPalette.backgroundColor,
                color: attachedChipPalette.textColor,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: attachedChipPalette.dotColor }}
              />
              {"V\u00eddeo anexado"}
            </span>
          </div>
        ) : null}
        {shouldRenderPlayerDirectly ? (
          <div
            className={
              [
                shouldRenderMobileThirdPartyPreview && shouldHideSourceThumbnailOnMobile
                  ? "hidden"
                  : "",
                // Mobile embed preview is only a visual source. The first tap must be
                // captured by our overlay and open the expanded player immediately,
                // instead of being intercepted by the provider iframe/player.
                shouldRenderMobileThirdPartyPreview
                  ? "[&_iframe]:pointer-events-none [&_video]:pointer-events-none"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            <div
              className={[
                "relative overflow-hidden rounded-xl bg-black",
                videoSurfaceBleedClass,
              ].join(" ")}
            >
              <AspectRatio ratio={16 / 9} className={VIDEO_FRAME_CLASS}>
                <ExampleVideoPlayer
                  key={`${currentVideo.key}-${currentVideo.video}-${currentPlaybackOpenToken}`}
                  video={currentVideo.video}
                  title={currentVideo.title}
                  autoPlay={shouldAutoPlayDesktopVideo}
                  resetPlaybackOnMount={Boolean(currentPlaybackOpenToken)}
                />
              </AspectRatio>

              {shouldRenderMobileThirdPartyPreview ? (
                <button
                  type="button"
                  className="absolute inset-0 z-30 touch-manipulation bg-transparent"
                  aria-label={currentVideo.title || "Abrir vídeo"}
                  title={currentVideo.title || "Abrir vídeo"}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openVideo({
                      video: currentVideo.video,
                      videoKey: currentVideo.key,
                      videoTitle: currentVideo.title,
                      groupKey,
                      videos: safeVideos,
                      index: currentIndex,
                      autoPlayOnOpen: true,
                      desktopAutoPlayOnOpen: false,
                    });
                  }}
                />
              ) : null}
            </div>

            {!shouldHideSourceThumbnailOnMobile
              ? renderVideoControls({
                  groupKey,
                  videos: safeVideos,
                  currentIndex,
                })
              : null}
          </div>
        ) : (
          <div>
            <ExampleVideoThumbnail
              video={currentVideo.video}
              thumbnail={currentVideo.thumbnail}
              title={currentVideo.title}
              isOpen={isVideoOpen}
              isMobile={isMobile}
              onSwipeLeft={
                groupKey === "global-word-video-group" && safeVideos.length > 1
                  ? (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      goToVideoIndex({
                        groupKey,
                        videos: safeVideos,
                        nextIndex: currentIndex + 1,
                      });
                    }
                  : undefined
              }
              onSwipeRight={
                groupKey === "global-word-video-group" && safeVideos.length > 1
                  ? (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      goToVideoIndex({
                        groupKey,
                        videos: safeVideos,
                        nextIndex: currentIndex - 1,
                      });
                    }
                  : undefined
              }
              className={[
                "aspect-video h-auto",
                videoSurfaceBleedClass,
                shouldHideSourceThumbnailOnMobile ? "hidden" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() =>
                openVideo({
                  video: currentVideo.video,
                  videoKey: currentVideo.key,
                  videoTitle: currentVideo.title,
                  groupKey,
                  videos: safeVideos,
                  index: currentIndex,
                  autoPlayOnOpen: true,
                  desktopAutoPlayOnOpen: !isCurrentVideoThirdParty,
                })
              }
            />

            {!shouldHideSourceThumbnailOnMobile
              ? renderVideoControls({
                  groupKey,
                  videos: safeVideos,
                  currentIndex,
                })
              : null}
          </div>
        )}
      </div>
    );
  };

  const goMobileVideoToIndex = (nextIndex) => {
    if (!mobileVideo?.videos?.length) return;

    const videos = mobileVideo.videos;
    const safeIndex =
      nextIndex < 0
        ? videos.length - 1
        : nextIndex >= videos.length
        ? 0
        : nextIndex;

    const nextVideo = videos[safeIndex];

    setVideoIndexes((current) => ({
      ...current,
      [mobileVideo.groupKey]: safeIndex,
    }));

    setMobileVideo({
      video: nextVideo.video,
      key: nextVideo.key,
      title: nextVideo.title,
      groupKey: mobileVideo.groupKey,
      videos,
      index: safeIndex,
      autoPlay: false,
      openToken: mobileVideo.openToken || 0,
    });
  };

  const resetExpandedVideoSwipe = () => {
    expandedVideoSwipeRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
    };
  };

  const handleExpandedVideoPointerDown = (event) => {
    if (!isExpandedGlobalWordVideo || !mobileVideo?.videos?.length) return;
    if (mobileVideo.videos.length <= 1) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const interactiveTarget = event.target?.closest?.("button, input, a");
    if (interactiveTarget) return;

    expandedVideoSwipeRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const handleExpandedVideoPointerCancel = () => {
    resetExpandedVideoSwipe();
  };

  const handleExpandedVideoPointerUp = (event) => {
    const swipeState = expandedVideoSwipeRef.current;

    if (!swipeState.active || swipeState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - swipeState.startX;
    const deltaY = event.clientY - swipeState.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const isHorizontalSwipe =
      absX >= VIDEO_SWIPE_DISTANCE_PX &&
      absX > absY * VIDEO_SWIPE_DIRECTION_RATIO;

    resetExpandedVideoSwipe();

    if (!isHorizontalSwipe) return;

    if (deltaX < 0) {
      goMobileVideoToIndex(mobileVideo.index + 1);
    } else {
      goMobileVideoToIndex(mobileVideo.index - 1);
    }

    event.preventDefault();
    event.stopPropagation();
  };

  const getMeaningPreviewMedia = (entry) => {
    const topVideo = Array.isArray(entry?.topVideos) ? entry.topVideos.find(Boolean) : null;
    const firstExampleWithMedia = Array.isArray(entry?.examples)
      ? entry.examples.find((example) => example?.thumbnail || example?.video)
      : null;

    const previewVideo = normalizeText(topVideo?.video || firstExampleWithMedia?.video);
    const previewThumbnail = normalizeText(
      topVideo?.thumbnail ||
        entry?.thumbnail ||
        firstExampleWithMedia?.thumbnail ||
        (previewVideo && isThirdPartyEmbeddedVideo(previewVideo)
          ? getPlatformThumbnailCandidates(previewVideo)[0] || ""
          : "")
    );

    return {
      video: previewVideo,
      thumbnail: previewThumbnail,
    };
  };

  const getMeaningPreviewExamples = (entry) => {
    if (!Array.isArray(entry?.examples)) return [];

    return entry.examples
      .map((example) => normalizeText(example?.translation || ""))
      .filter(Boolean)
      .slice(0, 3);
  };

  const openMeaningPreviewVideoInline = ({ entry, groupKey }) => {
    const safeVideos = Array.isArray(entry?.topVideos)
      ? entry.topVideos.filter(Boolean)
      : [];

    if (safeVideos.length === 0) return false;

    const currentIndex = Math.min(
      videoIndexes[groupKey] || 0,
      safeVideos.length - 1
    );
    const currentVideo = safeVideos[currentIndex];

    if (!currentVideo?.video) return false;

    openVideo({
      video: currentVideo.video,
      videoKey: currentVideo.key,
      videoTitle: currentVideo.title,
      groupKey,
      videos: safeVideos,
      index: currentIndex,
      autoPlayOnOpen: true,
      desktopAutoPlayOnOpen: true,
    });

    return true;
  };

  if (rawMeanings.length === 0) return null;

  return (
    <>
      <div
        className={panelContainerClass}
      >
        <div className={panelHeaderClass}>
          <div className="flex min-w-0 items-center gap-2 text-foreground">
            <UsFlagIcon className={isFlashcard ? "h-[18px] w-[18px] shrink-0" : "h-4 w-4 shrink-0"} />

            <Languages
              className={
                isFlashcard
                  ? "h-[18px] w-[18px] shrink-0 text-primary"
                  : "h-4 w-4 shrink-0 text-primary"
              }
              aria-hidden="true"
            />

            <h3 className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-snug">
              <span className="shrink-0 text-sm font-normal text-[#6A7181] dark:text-slate-400">
                —
              </span>
              <span className="min-w-0 break-words text-base font-bold leading-snug text-[#14181F] dark:text-foreground">
                {titleValue}
              </span>
            </h3>
          </div>

          <button
            type="button"
            onPointerDown={handleClosePointerDown}
            onClick={handleClose}
            className={
              isFlashcard
                ? "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                : "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
            }
            aria-label="Fechar exemplos"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {shouldShowGlobalWordVideoOnTop
          ? renderTopVideoCarousel({
              videos: wordVideoSources.map((entry, index) => ({
                video: entry.video,
                thumbnail: entry.thumbnail,
                key: `global-word-video-${index}`,
                level: "global",
                title:
                  index === 0
                    ? titleValue
                    : `${titleValue} â€” vÃ­deo geral ${index + 1}`,
              })),
              groupKey: "global-word-video-group",
            })
          : null}

        <div
          className={
            shouldUseMeaningVideoCollapse
              ? "space-y-0"
              : isFlashcardMobileLayout
              ? "space-y-3.5"
              : "space-y-4"
          }
        >
          {sorted.map((entry, index) => {
            const visibleExamples = entry.examples.slice(0, 4);
            const groupKey = `meaning-video-group-${entry.meaning}-${index}`;
            const tipKey = `meaning-tip-${entry.meaning}-${index}`;
            const hasMeaningSupportInfo = Boolean(
              entry.pronunciation || entry.category || entry.tip
            );
            const isTipExpanded = Boolean(expandedTipKeys[tipKey]);
            const meaningPalette = getMeaningPaletteByIndex(
              index,
              meaningPaletteCollection
            );
            const hasMeaningVideo =
              shouldShowSpecificVideosInsideMeanings &&
              Array.isArray(entry.topVideos) &&
              entry.topVideos.length > 0;
            const shouldUseMeaningCollapse = activeMeaningText
              ? shouldUseMeaningVideoCollapse
              : shouldUseMeaningVideoCollapse && hasMeaningVideo;
            const isMeaningExpanded =
              !shouldUseMeaningCollapse || expandedMeaningVideoKey === groupKey;
            const isMobileMeaningVideoPlaybackActive = Boolean(
              isMobile &&
                mobileVideo?.video &&
                typeof mobileVideo?.groupKey === "string" &&
                mobileVideo.groupKey.startsWith("meaning-video-group-")
            );
            const shouldHideMeaningDuringMobilePlayback =
              isMobileMeaningVideoPlaybackActive && mobileVideo.groupKey !== groupKey;

            if (shouldHideMeaningDuringMobilePlayback) {
              return null;
            }

            const meaningPreview = getMeaningPreviewMedia(entry);
            const meaningPreviewTitle =
              entry.meaning || `Significado ${index + 1}`;
            const meaningPreviewExamples = getMeaningPreviewExamples(entry);
            const hasMeaningPreviewMedia = Boolean(
              meaningPreview.video || meaningPreview.thumbnail
            );
            const isForegroundMeaning =
              isMeaningExpanded &&
              (index === 0 ||
                (activeMeaningText && entry.meaning === activeMeaningText));
            const meaningPreviewButtonContent = ({ hideThumbnail = false, hideSummary = false } = {}) => {
              const shouldShowMeaningLanguageMarker = hideThumbnail || hideSummary;

              return (
                <div
                  className={[
                    "group/meaning-preview flex w-full min-w-0 items-center text-left transition-colors duration-200",
                    isFlashcardMobileLayout ? "gap-2.5" : "gap-3",
                    isMeaningExpanded
                      ? "py-0"
                      : isFlashcardMobileLayout
                      ? "min-h-[96px] py-3"
                      : "min-h-[112px] py-3",
                  ].join(" ")}
                >
                {!hideThumbnail && hasMeaningPreviewMedia ? (
                  <div
                    className={[
                      "relative shrink-0 self-center overflow-hidden rounded-md border bg-black/10",
                      isFlashcardMobileLayout ? "w-[128px]" : "w-[156px]",
                    ].join(" ")}
                    style={{ borderColor: meaningPalette.border }}
                  >
                    <AspectRatio ratio={16 / 9}>
                      {meaningPreview.thumbnail ? (
                        <img
                          src={meaningPreview.thumbnail}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(237,154,10,0.12),transparent_32%),linear-gradient(135deg,#F8FAFC_0%,#EFF4F8_55%,#E6EDF5_100%)]" />
                      )}

                      <div className="absolute inset-0 bg-black/12 transition-colors duration-200 group-hover/meaning-preview:bg-black/[0.08]" />

                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span
                          className={[
                            "flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-black/40 shadow-[0_8px_20px_rgba(15,23,42,0.22)] backdrop-blur-sm transition-all duration-200",
                            isMobile
                              ? "opacity-100"
                              : "scale-95 opacity-0 group-hover/meaning-preview:scale-100 group-hover/meaning-preview:opacity-100",
                          ].join(" ")}
                        >
                          <Play className="ml-[1.5px] h-3.5 w-3.5 fill-white text-white stroke-[2.2]" />
                        </span>
                      </div>
                    </AspectRatio>
                  </div>
                ) : null}

                <div className="min-w-0 flex-1 self-center py-0">
                  <div
                    className={[
                      "flex min-w-0 flex-col overflow-hidden",
                      !hideThumbnail && !hideSummary && hasMeaningPreviewMedia
                        ? isFlashcardMobileLayout
                          ? "h-[72px]"
                          : "h-[88px]"
                        : "h-full min-h-full",
                      hideSummary ? "justify-start" : "justify-center",
                      hideSummary
                        ? "gap-0"
                        : meaningPreviewExamples.length > 1
                        ? isFlashcardMobileLayout
                          ? "gap-[3px]"
                          : "gap-1"
                        : "gap-1.5",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      {shouldShowMeaningLanguageMarker ? (
                        <span className="inline-flex items-center gap-1">
                          <BrFlagIcon className="h-[clamp(14px,4vw,16px)] w-[clamp(14px,4vw,16px)]" />
                          <span className="shrink-0 text-[12px] font-normal text-[#6A7181] dark:text-slate-400">
                            —
                          </span>
                        </span>
                      ) : null}

                      <p className="min-w-0 truncate text-[13px] font-semibold leading-[1.12] text-[#181818] dark:text-foreground">
                        {meaningPreviewTitle}
                      </p>
                    </div>

                    {!hideSummary ? (
                      meaningPreviewExamples.length > 0 ? (
                        <ul
                          className={
                            meaningPreviewExamples.length > 1 ? "space-y-0.5" : "space-y-1"
                          }
                        >
                          {meaningPreviewExamples.map((previewText, previewIndex) => (
                            <li
                              key={`${groupKey}-preview-${previewIndex}`}
                              className={[
                                "flex items-start gap-1.5 text-[#667085] dark:text-slate-300/90",
                                isFlashcardMobileLayout
                                  ? "text-[10.5px] leading-[1.22]"
                                  : "text-[11px] leading-[1.24]",
                              ].join(" ")}
                            >
                              <span
                                className="mt-[3.5px] h-[3px] w-[3px] shrink-0 rounded-full bg-[#98A2B3] dark:bg-slate-500/90"
                                aria-hidden="true"
                              />
                              <span className="min-w-0 truncate">{previewText}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[10px] leading-[1.32] text-[#667085]/85 dark:text-slate-300/70">
                          Clique para abrir este significado.
                        </p>
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            );
            };

            return (
                <section
                  key={`${entry.meaning}-${index}`}
                  className={[
                    isFlashcardMobileLayout
                      ? shouldUseMeaningCollapse
                        ? isMeaningExpanded
                          ? "relative rounded-2xl border border-[var(--meaning-border)] p-3"
                          : "group/meaning relative overflow-hidden rounded-b-[10px] border-b border-[var(--meaning-border)] px-0 py-0"
                        : "relative rounded-2xl border border-[var(--meaning-border)] p-3"
                      : shouldUseMeaningCollapse
                      ? isMeaningExpanded
                        ? "group/meaning relative rounded-xl border border-[var(--meaning-border)] px-4 py-3"
                        : "group/meaning relative overflow-hidden rounded-b-[10px] border-b border-[var(--meaning-border)] px-0 py-0"
                      : "group/meaning relative rounded-xl border border-[var(--meaning-border)] px-4 py-3",
                    shouldUseMeaningVideoCollapse && isMeaningExpanded
                      ? isFlashcardMobileLayout
                        ? "mt-3.5"
                        : "mt-4"
                      : "",
                    isForegroundMeaning ? "border-t-0" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    backgroundColor:
                      !shouldUseMeaningCollapse || isMeaningExpanded
                        ? meaningPalette.background
                        : "transparent",
                    "--meaning-border": meaningPalette.border,
                  }}
              >
                <div className="min-w-0">
                  {shouldUseMeaningCollapse ? (
                    isMeaningExpanded ? (
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedMeaningVideoKey((current) =>
                            current === groupKey ? null : groupKey
                          );
                        }}
                        className="sr-only"
                        aria-label={`Mostrar significado ${entry.meaning}`}
                        title={`Mostrar significado ${entry.meaning}`}
                      >
                        {`Mostrar significado ${entry.meaning}`}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedMeaningVideoKey(groupKey);

                          if (!isMobile && hasMeaningVideo) {
                            openMeaningPreviewVideoInline({ entry, groupKey });
                          }
                        }}
                        className={[
                          "w-full rounded-md text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CBD5E1]",
                          isFlashcardMobileLayout ? "px-0.5" : "px-2",
                        ].join(" ")}
                        aria-label={`Mostrar significado ${entry.meaning}`}
                        title={`Mostrar significado ${entry.meaning}`}
                      >
                        {meaningPreviewButtonContent()}
                      </button>
                    )
                  ) : null}

                  {isMeaningExpanded ? (
                    <>
                      {shouldShowSpecificVideosInsideMeanings &&
                      entry.topVideos.length > 0
                        ? renderTopVideoCarousel({
                            videos: entry.topVideos,
                            groupKey,
                            meaningPalette,
                          })
                        : null}

                      <div className="mb-3 border-b pb-2 pt-1.5" style={{ borderBottomColor: meaningPalette.border }}>
                        {shouldUseMeaningCollapse ? (
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedMeaningVideoKey((current) =>
                                current === groupKey ? null : groupKey
                              );
                            }}
                            className="w-full text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CBD5E1]"
                            aria-label={`Mostrar significado ${entry.meaning}`}
                            title={`Mostrar significado ${entry.meaning}`}
                          >
                            {meaningPreviewButtonContent({ hideThumbnail: true, hideSummary: true })}
                          </button>
                        ) : (
                          <div>{meaningPreviewButtonContent({ hideThumbnail: true, hideSummary: true })}</div>
                        )}
                      </div>

                      {visibleExamples.length > 0 ? (
                        <div className={isFlashcardMobileLayout ? "space-y-2.5" : "space-y-2"}>
                          <div className={isFlashcardMobileLayout ? "space-y-2.5" : "space-y-2"}>
                            {visibleExamples.map((example, exampleIndex) => {
                              const hasSentence = Boolean(example.sentence);
                              const hasTranslation = Boolean(example.translation);

                              return (
                                <div
                                  key={`${entry.meaning}-${index}-${exampleIndex}`}
                                  className={
                                    isFlashcardMobileLayout
                                      ? "flex items-start gap-2.5 rounded-lg px-0.5 py-0.5"
                                      : "flex items-start gap-2 rounded-md px-0.5 py-0.5"
                                  }
                                >
                                  <span
                                    className={
                                      isFlashcardMobileLayout
                                        ? "mt-[0.44rem] h-[5px] w-[5px] shrink-0 rounded-full"
                                        : "mt-[0.36rem] h-[5px] w-[5px] shrink-0 rounded-full"
                                    }
                                    style={{ backgroundColor: meaningPalette.bullet }}
                                  />

                                  <div
                                    className={
                                      isFlashcardMobileLayout
                                        ? "min-w-0 space-y-1.5"
                                        : "min-w-0 space-y-1"
                                    }
                                  >
                                    {hasTranslation ? (
                                      <p
                                        className={
                                          isFlashcardMobileLayout
                                            ? "text-sm font-medium leading-snug text-[#5D6677] dark:text-slate-200"
                                            : "text-xs font-medium leading-snug text-[#5D6677] dark:text-slate-200"
                                        }
                                      >
                                        {example.translation}
                                      </p>
                                    ) : null}

                                    {hasSentence ? (
                                      <p
                                        className={
                                          isFlashcardMobileLayout
                                            ? "text-[15px] font-semibold leading-snug text-[#101827] dark:text-foreground"
                                            : "text-sm font-semibold leading-snug text-[#101827] dark:text-foreground"
                                        }
                                      >
                                        {renderHighlightedTerm(
                                          example.sentence,
                                          highlightTerm,
                                          {
                                            underlineColor: meaningPalette.underline,
                                          }
                                        )}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p
                          className={
                            isFlashcardMobileLayout
                              ? "text-sm italic text-muted-foreground"
                              : "text-sm italic text-muted-foreground"
                          }
                        >
                          Nenhum exemplo cadastrado.
                        </p>
                      )}
                    </>
                  ) : null}
                </div>

                {isMeaningExpanded && hasMeaningSupportInfo ? (
                  <div className="mt-3" data-examples-tip-area="true">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setExpandedTipKeys((current) => {
                          const isCurrentlyExpanded = Boolean(current[tipKey]);

                          return isCurrentlyExpanded ? {} : { [tipKey]: true };
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold leading-none transition-colors"
                      style={{
                        borderColor: meaningPalette.tipBorder,
                        backgroundColor: meaningPalette.tipBackground,
                        color: meaningPalette.accent,
                      }}
                      aria-expanded={isTipExpanded}
                      aria-label={isTipExpanded ? "Ocultar mais sobre" : "Mostrar mais sobre"}
                      title={isTipExpanded ? "Ocultar mais sobre" : "Mostrar mais sobre"}
                    >
                      <Lightbulb className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span>Mais sobre</span>
                      <ChevronDown
                        className={[
                          "h-3 w-3 shrink-0 scale-x-[1.2] transform-gpu opacity-80 transition-all duration-200 ease-out",
                          isTipExpanded
                            ? "-translate-y-[0.5px] -rotate-180"
                            : "translate-y-0 rotate-0",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                    </button>

                    {isTipExpanded ? (
                      <div
                        className="mt-2 rounded-lg border px-2.5 py-2"
                        style={{
                          borderColor: meaningPalette.tipBorder,
                          backgroundColor: meaningPalette.tipBackground,
                        }}
                      >
                        {entry.pronunciation ? (
                          <div
                            className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium leading-none"
                            style={{ color: meaningPalette.accent }}
                          >
                            <Volume2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span aria-hidden="true">—</span>
                            <span className="min-w-0 truncate">{entry.pronunciation}</span>
                          </div>
                        ) : null}

                        {entry.tip || entry.category ? (
                          <div className="flex items-end gap-2">
                            {entry.tip ? (
                              <p className="min-w-0 flex-1 text-left text-xs leading-relaxed text-[#5E6778] dark:text-slate-200">
                                {entry.tip}
                              </p>
                            ) : (
                              <span className="min-w-0 flex-1" />
                            )}

                            {entry.category ? (
                              <span
                                className="mb-[1px] shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none"
                                style={{
                                  borderColor: meaningPalette.tipBorder,
                                  backgroundColor: meaningPalette.background,
                                  color: meaningPalette.accent,
                                }}
                              >
                                {entry.category}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>

      {mobileVideo?.video ? (
        <div
          className={
            isMobileLandscapeVideoLayout
              ? "fixed inset-0 z-[9999] bg-black"
              : "fixed inset-0 z-[9999] bg-black/80"
          }
          role="dialog"
          aria-modal="true"
          aria-label="VÃ­deo do exemplo"
          onClick={closeMobileVideo}
        >
          <div
            className={
              shouldUseCenteredEmbeddedMobileLayout
                ? "absolute inset-0 flex h-[100dvh] w-[100dvw] items-center justify-center overflow-hidden px-0"
                : isMobileLandscapeVideoLayout
                ? "absolute inset-0 flex h-[100dvh] w-[100dvw] items-center justify-center"
                : "absolute left-0 right-0 top-[calc(env(safe-area-inset-top,0px)+7.55vh)] w-screen max-w-none"
            }
            onClick={(event) => {
              if (!shouldUseCenteredEmbeddedMobileLayout) {
                event.stopPropagation();
              }
            }}
          >
            <div
              className={
                [
                  "relative transform-gpu",
                  shouldUseCenteredEmbeddedMobileLayout
                    ? "touch-pan-y overflow-hidden"
                    : isMobileLandscapeVideoLayout
                    ? "h-[100dvh] w-[100dvw] touch-pan-y overflow-hidden"
                    : "aspect-[5/4] w-full touch-pan-y overflow-hidden",
                  mobileVideoSurfaceBackgroundClass,
                ]
                  .filter(Boolean)
                  .join(" ")
              }
              style={mobileLandscapeEmbedFrameStyle}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={handleExpandedVideoPointerDown}
              onPointerUp={handleExpandedVideoPointerUp}
              onPointerCancel={handleExpandedVideoPointerCancel}
            >
              <div
                className={
                  [
                    "h-full w-full transform-gpu transition-opacity duration-150 ease-out",
                    isCurrentMobileVideoThirdPartyEmbed
                      ? "[&>div]:bg-transparent [&_iframe]:bg-transparent"
                      : "",
                    isCurrentMobileVideoThirdPartyEmbed && isMobileEmbedOpening
                      ? "opacity-0"
                      : "opacity-100",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <ExampleVideoPlayer
                  key={mobileVideoPlayerKey}
                  video={mobileVideo?.video || ""}
                  title={mobileVideo?.title || ""}
                  autoPlay={Boolean(mobileVideo?.autoPlay)}
                  resetPlaybackOnMount={Boolean(mobileVideo?.openToken)}
                  layout={
                    isMobileLandscapeVideoLayout
                      ? "mobileFullscreen"
                      : "mobileMockup"
                  }
                />
              </div>
            </div>

            {false && mobileVideo?.videos?.length > 1 && !isExpandedGlobalWordVideo ? (
              <div className="mt-2 flex items-center justify-between gap-2 px-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    goMobileVideoToIndex(mobileVideo.index - 1);
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/20 bg-white px-3 py-1.5 text-xs font-bold text-[#14181F] shadow-sm dark:border-border dark:bg-card dark:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Voltar
                </button>

                <span className="rounded-full bg-black/40 px-2.5 py-1 text-xs font-bold text-white">
                  {mobileVideo.index + 1}/{mobileVideo.videos.length}
                </span>

                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    goMobileVideoToIndex(mobileVideo.index + 1);
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/20 bg-white px-3 py-1.5 text-xs font-bold text-[#14181F] shadow-sm dark:border-border dark:bg-card dark:text-foreground"
                >
                  {"Pr\u00f3ximo"}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
