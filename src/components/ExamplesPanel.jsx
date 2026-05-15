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

const MOBILE_EMBED_REOPEN_GUARD_MS = 650;
const MOBILE_EMBED_OPENING_DELAY_MS = 260;
const THUMBNAIL_CAPTURE_TIME_SECONDS = 1;
const THUMBNAIL_END_GUARD_SECONDS = 0.05;
const VIDEO_SWIPE_DISTANCE_PX = 42;
const VIDEO_SWIPE_DIRECTION_RATIO = 1.15;
const MOBILE_VIDEO_EXPERIENCE_MAX_SHORT_SIDE_PX = 767;
const MOBILE_VIDEO_EXPERIENCE_MAX_LONG_SIDE_PX = 1024;
const EMBED_PREVIEW_VISUAL_SCALE = 0.65;
const MOBILE_VIDEO_COLLAPSE_SCROLL_TOP_GAP_PX = 10;
const MOBILE_VIDEO_COLLAPSE_SCROLL_SECOND_PASS_DELAY_MS = 140;
const MOBILE_VIDEO_COLLAPSE_SCROLL_THIRD_PASS_DELAY_MS = 320;

const EXAMPLE_PANEL_VIDEO_FIT_CLASS = "examples-panel-video-fit-shell";
const EXAMPLE_PANEL_VIDEO_FIT_STYLE = `
  .examples-panel-video-fit-shell {
    position: relative;
    overflow: hidden;
    background: #000;
    contain: layout paint;
  }

  .examples-panel-video-fit-shell > div,
  .examples-panel-video-fit-shell .example-video-player-shell {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
  }

  .examples-panel-video-fit-shell iframe {
    position: absolute !important;
    left: calc(50% + var(--examples-panel-embed-offset-x, 0%)) !important;
    top: 50% !important;
    width: var(--examples-panel-embed-render-size, calc(100% + 4px)) !important;
    height: var(--examples-panel-embed-render-size, calc(100% + 4px)) !important;
    min-width: var(--examples-panel-embed-render-size, calc(100% + 4px)) !important;
    min-height: var(--examples-panel-embed-render-size, calc(100% + 4px)) !important;
    border: 0 !important;
    background: #000 !important;
    transform: translate(-50%, -50%) scale(var(--examples-panel-embed-visual-scale, 1.012)) !important;
    transform-origin: center center !important;
    clip-path: inset(1px) !important;
  }

  .examples-panel-video-fit-shell video {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    object-position: center center !important;
    background: #000 !important;
  }
`;

const VIDEO_FRAME_CLASS =
  `${EXAMPLE_PANEL_VIDEO_FIT_CLASS} overflow-hidden bg-black [&_iframe]:absolute [&_iframe]:border-0`;

const videoThumbnailCache = new Map();
const thirdPartyThumbnailCache = new Map();

const DESCENDER_CHAR_REGEX = /[gjpqy]/;

const normalizeVideoValue = (value) =>
  typeof value === "string" ? value.trim() : "";

const extractIframeSrc = (value) => {
  const cleanValue = normalizeVideoValue(value);

  if (!cleanValue) return "";

  const match = cleanValue.match(/<iframe[^>]+src=["']([^"']+)["']/i);

  return normalizeVideoValue(match?.[1] || "");
};

const isLikelyThirdPartyEmbedValue = (value) => {
  const cleanValue = normalizeVideoValue(value);
  if (!cleanValue) return false;

  return (
    /<iframe/i.test(cleanValue) ||
    /\[iframe/i.test(cleanValue) ||
    /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|dai\.ly|tiktok\.com|instagram\.com|facebook\.com\/plugins\/video|player\.twitch\.tv|clip\.cafe|playphrase\.me|yarn\.co|y\.yarn\.co/i.test(
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
    border: "#27342D",
    background: "#0c0d0d",
    accent: "#7EA68F",
    bullet: "#739B85",
    tipBackground: "#171E1B",
    tipBorder: "#2D3A33",
    underline: "#8AB49C",
  },
  {
    border: "#26313B",
    background: "#101213",
    accent: "#7F97AD",
    bullet: "#728BA2",
    tipBackground: "#171C21",
    tipBorder: "#2D3944",
    underline: "#8CA5BB",
  },
  {
    border: "#373028",
    background: "#100f0f",
    accent: "#A48E74",
    bullet: "#98836A",
    tipBackground: "#1B1815",
    tipBorder: "#3F372F",
    underline: "#B29A80",
  },
  {
    border: "#312C39",
    background: "#0a0a0b",
    accent: "#9B8DAF",
    bullet: "#8F83A3",
    tipBackground: "#1C1921",
    tipBorder: "#383242",
    underline: "#A89ABC",
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

const readCurrentViewportSize = () => {
  if (typeof window === "undefined") {
    return { width: 0, height: 0 };
  }

  const visualViewport = window.visualViewport;
  const width = Math.round(
    visualViewport?.width ||
      window.innerWidth ||
      document.documentElement?.clientWidth ||
      0
  );
  const height = Math.round(
    visualViewport?.height ||
      window.innerHeight ||
      document.documentElement?.clientHeight ||
      0
  );

  return { width, height };
};

const isLikelyMobileTouchDevice = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const hasCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  const hasNoHover = window.matchMedia?.("(hover: none)")?.matches;
  const hasTouchPoints = Number(navigator.maxTouchPoints || 0) > 0;

  return Boolean(hasCoarsePointer || hasNoHover || hasTouchPoints);
};

const shouldUseLandscapeMobileVideoExperience = () => {
  if (!isLikelyMobileTouchDevice()) return false;

  const { width, height } = readCurrentViewportSize();

  if (!width || !height) return false;

  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);

  return (
    shortSide <= MOBILE_VIDEO_EXPERIENCE_MAX_SHORT_SIDE_PX &&
    longSide <= MOBILE_VIDEO_EXPERIENCE_MAX_LONG_SIDE_PX
  );
};

const isMeaningVideoGroupKey = (groupKey) =>
  typeof groupKey === "string" && groupKey.startsWith("meaning-video-group-");

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

const normalizeExampleVideos = (example) => {
  const fallbackThumbnail = normalizeExampleThumbnail(example);

  return dedupeVideoEntries([
    ...normalizeVideoList(example?.exampleVideos, fallbackThumbnail),
    ...normalizeVideoList(example?.example_videos, fallbackThumbnail),
    ...normalizeVideoList(normalizeExampleVideo(example), fallbackThumbnail),
  ]);
};

const hasExampleContent = (example) => {
  const sentence = normalizeExampleText(example?.sentence);
  const translation = normalizeExampleText(example?.translation);
  const video = normalizeExampleVideo(example);
  const videos = normalizeExampleVideos(example);

  return Boolean(sentence || translation || video || videos.length > 0);
};

const hasMeaningOrExampleVideo = (meanings) => {
  if (!Array.isArray(meanings)) return false;

  return meanings.some((meaning) => {
    const meaningVideo = normalizeMeaningVideo(meaning);

    if (meaningVideo) return true;

    if (!Array.isArray(meaning?.examples)) return false;

    return meaning.examples.some(
      (example) =>
        normalizeExampleVideo(example) || normalizeExampleVideos(example).length > 0
    );
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

const buildHighlightWordVariants = (word) => {
  const cleanWord = normalizeText(word).toLowerCase();

  if (!cleanWord) return [];

  const variants = new Set([cleanWord]);
  const endsWithConsonantY = /[^aeiou]y$/i.test(cleanWord);
  const endsWithSilentE = /e$/i.test(cleanWord);
  const endsWithCvc =
    cleanWord.length >= 3 &&
    /[^aeiou][aeiou][^aeiouwxy]$/i.test(cleanWord);

  variants.add(`${cleanWord}s`);

  if (endsWithConsonantY) {
    variants.add(`${cleanWord.slice(0, -1)}ies`);
    variants.add(`${cleanWord.slice(0, -1)}ied`);
  } else if (endsWithSilentE) {
    variants.add(`${cleanWord}d`);
  } else if (endsWithCvc) {
    const doubledFinal = `${cleanWord}${cleanWord.slice(-1)}`;
    variants.add(`${doubledFinal}ed`);
    variants.add(`${doubledFinal}ing`);
    variants.add(`${cleanWord}ed`);
  } else {
    variants.add(`${cleanWord}ed`);
  }

  if (endsWithConsonantY) {
    variants.add(`${cleanWord.slice(0, -1)}ying`);
  } else if (endsWithSilentE) {
    variants.add(`${cleanWord.slice(0, -1)}ing`);
  } else if (!endsWithCvc) {
    variants.add(`${cleanWord}ing`);
  }

  variants.add(`${cleanWord}es`);
  variants.add(`${cleanWord}'s`);

  return Array.from(variants).filter(Boolean);
};

const findLooseHighlightRange = (text, term) => {
  const safeText = typeof text === "string" ? text : "";
  const cleanTerm = typeof term === "string" ? term.trim().toLowerCase() : "";
  const termWords = cleanTerm.split(/\s+/).filter(Boolean);

  if (!safeText || termWords.length !== 2) {
    return null;
  }

  const [headWord, tailWord] = termWords;
  const headVariants = new Set(buildHighlightWordVariants(headWord));
  const sentenceWords = Array.from(
    safeText.matchAll(/[A-Za-zÀ-ÿ]+(?:'[A-Za-zÀ-ÿ]+)*/g)
  ).map((match) => ({
    value: match[0],
    lower: match[0].toLowerCase(),
    start: match.index,
    end: match.index + match[0].length,
  }));

  if (sentenceWords.length === 0) {
    return null;
  }

  const maxGapWords = 3;

  for (let startIndex = 0; startIndex < sentenceWords.length; startIndex += 1) {
    const startWord = sentenceWords[startIndex];

    if (!headVariants.has(startWord.lower)) {
      continue;
    }

    for (
      let endIndex = startIndex + 1;
      endIndex < sentenceWords.length && endIndex <= startIndex + maxGapWords + 1;
      endIndex += 1
    ) {
      const endWord = sentenceWords[endIndex];

      if (endWord.lower !== tailWord) {
        continue;
      }

      return {
        start: startWord.start,
        end: endWord.end,
      };
    }
  }

  return null;
};

const renderHighlightRange = (text, range, underlineColor) => {
  if (!range) return text;

  const beforeText = text.slice(0, range.start);
  const matchedText = text.slice(range.start, range.end);
  const afterText = text.slice(range.end);

  return (
    <>
      {beforeText}
      {renderUnderlineSequence(
        matchedText,
        `highlight-range-${range.start}-${range.end}`,
        underlineColor
      )}
      {afterText}
    </>
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

  const looseHighlightRange = findLooseHighlightRange(safeText, term);

  if (looseHighlightRange) {
    return renderHighlightRange(safeText, looseHighlightRange, underlineColor);
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
    /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|dai\.ly|tiktok\.com|instagram\.com|facebook\.com\/plugins\/video|player\.twitch\.tv|clip\.cafe|playphrase\.me|yarn\.co|y\.yarn\.co/i.test(
      cleanValue
    )
  );
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

const getEmbedPreviewTuning = (embedSrc) => {
  const cleanSrc = normalizeText(embedSrc);

  if (!cleanSrc) {
    return {
      visualScale: 1.012,
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
    // Mantém o fallback visual para embeds sem hostname legível.
  }

  return {
    visualScale: 0.82,
    containerOffsetXPercent: 2,
  };
};

const getExamplePanelVideoFitStyle = (video) => {
  const cleanVideo = normalizeText(video);

  if (!cleanVideo || !isThirdPartyEmbeddedVideo(cleanVideo)) return undefined;

  const embedSrc = getThirdPartyEmbedSrc(cleanVideo) || cleanVideo;
  const tuning = getEmbedPreviewTuning(embedSrc);
  const visualScale = Number(tuning.visualScale) || 1.012;
  const renderScale = 1 / visualScale;

  return {
    "--examples-panel-embed-render-size": `${renderScale * 100}%`,
    "--examples-panel-embed-visual-scale": String(visualScale),
    "--examples-panel-embed-offset-x": `${tuning.containerOffsetXPercent || 0}%`,
  };
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
  title = "Vídeo do exemplo",
  isOpen = false,
  isMobile = false,
  className = "h-[84px]",
  style,
  videoSequenceLabel = "",
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
  const shouldShowVideoSequenceLabel =
    typeof videoSequenceLabel === "string" && videoSequenceLabel.trim().length > 0;

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
      style={style}
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

      {shouldShowVideoSequenceLabel ? (
        <div className="pointer-events-none absolute right-2 top-2 z-20">
          <span className="inline-flex items-center rounded-full border border-white/30 bg-black/45 px-2 py-0.5 text-[11px] font-semibold leading-none text-white/95 shadow-[0_6px_18px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            {videoSequenceLabel}
          </span>
        </div>
      ) : null}

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
  wordVideo = "",
  wordThumbnail = "",
  wordVideos = [],
  pronunciation = "",
  item,
  vocabularyItem,
  forceMobileVideoExperience = false,
}) {
  const lastMobileVideoCloseAtRef = useRef(0);
  const isMobile = useIsMobile();
  const [isForcedMobileVideoViewport, setIsForcedMobileVideoViewport] =
    useState(() =>
      forceMobileVideoExperience
        ? shouldUseLandscapeMobileVideoExperience()
        : false
    );
  const shouldUseMobileVideoExperience =
    isMobile || isForcedMobileVideoViewport;
  const shouldUseMobileVideoExperienceRuntime = (() => {
    if (shouldUseMobileVideoExperience) return true;
    if (typeof window === "undefined") return false;

    const shortSide = Math.min(window.innerWidth || 0, window.innerHeight || 0);
    return shortSide > 0 && shortSide <= MOBILE_VIDEO_EXPERIENCE_MAX_SHORT_SIDE_PX;
  })();
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
  const inlinePreviewSwipeRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    groupKey: "",
    suppressClick: false,
  });
  const videoGroupAnchorRefs = useRef(new Map());

  const registerVideoGroupAnchor = (groupKey, node) => {
    if (!groupKey) return;

    if (node) {
      videoGroupAnchorRefs.current.set(groupKey, node);
      return;
    }

    videoGroupAnchorRefs.current.delete(groupKey);
  };

  useEffect(() => {
    if (!forceMobileVideoExperience || typeof window === "undefined") {
      setIsForcedMobileVideoViewport(false);
      return undefined;
    }

    const syncForcedMobileViewport = () => {
      setIsForcedMobileVideoViewport(shouldUseLandscapeMobileVideoExperience());
    };

    syncForcedMobileViewport();
    window.addEventListener("resize", syncForcedMobileViewport);
    window.addEventListener("orientationchange", syncForcedMobileViewport);
    window.visualViewport?.addEventListener("resize", syncForcedMobileViewport);

    return () => {
      window.removeEventListener("resize", syncForcedMobileViewport);
      window.removeEventListener("orientationchange", syncForcedMobileViewport);
      window.visualViewport?.removeEventListener(
        "resize",
        syncForcedMobileViewport
      );
    };
  }, [forceMobileVideoExperience]);

  useEffect(() => {
    if (!shouldUseMobileVideoExperience) {
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
  }, [shouldUseMobileVideoExperience]);

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


  // Vídeo geral tem prioridade visual: se existir vídeo global/geral,
  // ele fica no topo e os vídeos específicos dos significados/exemplos
  // não são renderizados como carrosséis dentro dos blocos.
  const shouldShowGlobalWordVideoOnTop = Boolean(wordVideoSources.length > 0);
  const shouldShowSpecificVideosInsideMeanings = !shouldShowGlobalWordVideoOnTop;

  const normalized = rawMeanings.map((entry, index) => {
    const normalizedMeaningText = normalizeText(entry?.meaning);
    const meaningVideo = normalizeMeaningVideo(entry);
    const meaningThumbnail = normalizeMeaningThumbnail(entry);

    const rawExamples = Array.isArray(entry?.examples) ? entry.examples : [];
    const normalizedExamples = rawExamples
      .map((example) => {
        const exampleVideos = normalizeExampleVideos(example);
        const firstExampleVideo = exampleVideos[0] || {
          video: "",
          thumbnail: "",
        };
        const primaryVideo = normalizeText(firstExampleVideo.video);

        return {
          sentence: normalizeExampleText(example?.sentence),
          translation: normalizeExampleText(example?.translation),
          video: primaryVideo,
          thumbnail: primaryVideo
            ? normalizeText(firstExampleVideo.thumbnail)
            : "",
          exampleVideos,
        };
      })
      .filter(hasExampleContent);

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
      ...normalizedExamples
        .flatMap((example, exampleIndex) => {
          const safeVideos = Array.isArray(example?.exampleVideos)
            ? example.exampleVideos
            : [];

          return safeVideos.map((videoEntry, videoIndex) => {
            const videoValue = normalizeText(videoEntry?.video);

            if (!videoValue) return null;

            const baseTitle =
              normalizeExampleText(example?.sentence) ||
              normalizedMeaningText ||
              "Vídeo do exemplo";
            const hasSequence = safeVideos.length > 1;

            return {
              video: videoValue,
              thumbnail: normalizeText(videoEntry?.thumbnail),
              key: `${
                normalizedMeaningText || "meaning"
              }-${index}-example-${exampleIndex}-video-${videoIndex}`,
              level: "example",
              title: hasSequence
                ? `${baseTitle} (${videoIndex + 1}/${safeVideos.length})`
                : baseTitle,
            };
          });
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
      examples: normalizedExamples,
    };
  });

  const activeMeaningText = normalizeText(activeMeaning);
  const sorted = activeMeaningText
    ? [...normalized].sort((a, b) =>
        a.meaning === activeMeaningText ? -1 : b.meaning === activeMeaningText ? 1 : 0
      )
    : normalized;
  const hasMultipleMeanings = sorted.length > 1;
  const meaningVideoGroups = sorted.reduce((accumulator, entry, index) => {
    const topVideos = Array.isArray(entry?.topVideos)
      ? entry.topVideos.filter((videoEntry) => Boolean(videoEntry?.video))
      : [];

    if (topVideos.length === 0) return accumulator;

    accumulator.push({
      entry,
      index,
      groupKey: `meaning-video-group-${entry.meaning}-${index}`,
      topVideos,
    });

    return accumulator;
  }, []);

  const videoMeaningGroupKeys = shouldShowSpecificVideosInsideMeanings
    ? meaningVideoGroups.map((group) => group.groupKey)
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
    if (!hasExpandedTip || isMobile || typeof document === "undefined") {
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
  }, [hasExpandedTip, isMobile]);

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
  const isQuizPanelLayout = isFlashcard && panelScope === "quiz";
  const isFlashcardMobileLayout = isFlashcard && isMobile;
  const { isDark: isDarkTheme } = useTheme();
  const isMobileDarkMeaningLayout =
    isFlashcardMobileLayout && isDarkTheme;
  const meaningPaletteCollection = isDarkTheme
    ? FLASHCARD_MOBILE_MEANING_PALETTE_DARK
    : FLASHCARD_MOBILE_MEANING_PALETTE;
  const titleValue = titleTerm ? titleTerm.trim() : "Exemplos";
  const highlightTerm = titleTerm ? titleTerm.trim() : "";
  const shouldUseExpandedVideoHeaderSpacing = Boolean(
    shouldShowGlobalWordVideoOnTop ||
      sorted.some(
        (entry) => Array.isArray(entry?.topVideos) && entry.topVideos.length > 0
      )
  );
  const panelContainerClass = isFlashcard
    ? isQuizPanelLayout
      ? shouldUseExpandedVideoHeaderSpacing
        ? "mt-0 overflow-hidden rounded-[18px] border border-[#EDF0F3] bg-white px-1 pb-3 pt-2.5 text-[#1A1A1A] animate-in fade-in-0 slide-in-from-top-1 duration-150 dark:border-border dark:bg-card dark:text-foreground sm:px-6 sm:pb-6 sm:pt-4 md:px-1 md:pb-4 md:pt-3"
        : "mt-0 overflow-hidden rounded-[18px] border border-[#EDF0F3] bg-white p-1 pb-3 pt-2.5 text-[#1A1A1A] animate-in fade-in-0 slide-in-from-top-1 duration-150 dark:border-border dark:bg-card dark:text-foreground sm:p-6 md:p-2"
      : isFlashcardMobileLayout
      ? "mt-0 overflow-hidden rounded-b-[18px] rounded-t-none border border-t-0 border-[#EDF0F3] bg-white px-1 pb-3 pt-2.5 text-[#1A1A1A] animate-in fade-in-0 slide-in-from-top-1 duration-150 dark:border-border dark:bg-card dark:text-foreground"
      : shouldUseExpandedVideoHeaderSpacing
      ? "mt-0 overflow-hidden rounded-b-[18px] rounded-t-none border border-t-0 border-[#EDF0F3] bg-white px-1 pb-4 pt-3 text-[#1A1A1A] animate-in fade-in-0 slide-in-from-top-1 duration-150 dark:border-border dark:bg-card dark:text-foreground"
      : "mt-0 overflow-hidden rounded-b-[18px] rounded-t-none border border-t-0 border-[#EDF0F3] bg-white p-2 text-[#1A1A1A] animate-in fade-in-0 slide-in-from-top-1 duration-150 dark:border-border dark:bg-card dark:text-foreground"
    : shouldUseExpandedVideoHeaderSpacing
    ? "mt-4 rounded-2xl border border-border/70 bg-[#F9FAFB] px-5 pb-5 pt-3 animate-in fade-in slide-in-from-top-2 duration-200 dark:bg-card"
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
  const shouldHidePanelHeaderDivider = shouldUseExpandedVideoHeaderSpacing
    ? true
    : shouldShowGlobalWordVideoOnTop
    ? !isLowerMeaningInForeground
    : isFirstMeaningInForeground;
  const shouldRenderPanelHeaderDivider = !shouldHidePanelHeaderDivider;
  const panelHeaderDividerToneClass = isDarkTheme
    ? "bg-[#3A4352]/55"
    : "bg-[#D6DEE8]/90";
  const panelHeaderClass = [
    isFlashcard
      ? isFlashcardMobileLayout
        ? shouldUseExpandedVideoHeaderSpacing
          ? "mb-0 flex items-center justify-between pb-0"
          : shouldUseMeaningVideoCollapse
          ? "mb-0 flex items-center justify-between pb-0"
          : "mb-3 flex items-center justify-between pb-2.5"
        : shouldUseExpandedVideoHeaderSpacing
        ? "mb-0 flex items-center justify-between pb-0"
        : shouldUseMeaningVideoCollapse
        ? "mb-0 flex items-center justify-between pb-0"
        : "mb-4 flex items-center justify-between pb-2"
      : shouldUseExpandedVideoHeaderSpacing
      ? "mb-0 flex items-center justify-between gap-3 pb-0"
      : shouldUseMeaningVideoCollapse
      ? "mb-0 flex items-center justify-between gap-3 pb-0"
      : "mb-4 flex items-center justify-between gap-3 pb-3",
  ]
    .filter(Boolean)
    .join(" ");
  const panelHeaderOffsetClass = shouldUseExpandedVideoHeaderSpacing
    ? "pt-[2.25px]"
    : shouldUseMeaningVideoCollapse
    ? "pt-[1.5px]"
    : isFlashcardMobileLayout
    ? "pt-1.5"
    : "pt-1.5";
  const panelHeaderInsetClass = isFlashcardMobileLayout ? "px-1" : "px-2";
  const isExpandedGlobalWordVideo =
    mobileVideo?.groupKey === "global-word-video-group";
  const isMobileMeaningVideoGroup = isMeaningVideoGroupKey(mobileVideo?.groupKey);
  const currentMobileVideoIndex = Number.isFinite(mobileVideo?.index)
    ? mobileVideo.index
    : 0;
  const currentMobileVideoCount = Array.isArray(mobileVideo?.videos)
    ? mobileVideo.videos.length
    : 0;
  const currentMobileVideoSequenceLabel =
    currentMobileVideoCount > 1
      ? `${Math.min(currentMobileVideoIndex + 1, currentMobileVideoCount)}/${currentMobileVideoCount}`
      : "";
  const currentMobileVideoValue = mobileVideo?.video || "";
  const isCurrentMobileVideoThirdPartyEmbed =
    isLikelyThirdPartyEmbedValue(currentMobileVideoValue) ||
    isThirdPartyEmbeddedVideo(currentMobileVideoValue);
  const shouldUseMobileOwnMeaningPlayerNavigation = Boolean(
    isMobileMeaningVideoGroup &&
      !isCurrentMobileVideoThirdPartyEmbed &&
      Array.isArray(mobileVideo?.videos) &&
      mobileVideo.videos.length > 1
  );
  const shouldUseMobileExpandedOwnNavigation = Boolean(
    shouldUseMobileOwnMeaningPlayerNavigation
  );
  const currentMobileVideoFitStyle = getExamplePanelVideoFitStyle(
    currentMobileVideoValue
  );
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
    if (
      !shouldUseMobileVideoExperience ||
      !mobileVideo?.video ||
      !isCurrentMobileVideoThirdPartyEmbed
    ) {
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
  }, [
    shouldUseMobileVideoExperience,
    mobileVideoPlayerKey,
    isCurrentMobileVideoThirdPartyEmbed,
  ]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const className = "examples-mobile-video-expanded";
    const shouldSetClass = Boolean(
      shouldUseMobileVideoExperience && mobileVideo?.video
    );

    document.body.classList.toggle(className, shouldSetClass);

    return () => {
      document.body.classList.remove(className);
    };
  }, [shouldUseMobileVideoExperience, mobileVideo?.video]);

  const closeMobileVideo = () => {
    const closingGroupKey =
      typeof mobileVideo?.groupKey === "string" ? mobileVideo.groupKey : "";

    lastMobileVideoCloseAtRef.current = Date.now();
    expandedVideoSwipeRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
    };
    setIsMobileEmbedOpening(false);
    setMobileVideo(null);

    if (
      !closingGroupKey ||
      !shouldUseMobileVideoExperienceRuntime ||
      !isFlashcard ||
      typeof window === "undefined"
    ) {
      return;
    }

    const getTopOffset = () => {
      const safeAreaOffsetTop = Math.max(
        0,
        Math.round(window.visualViewport?.offsetTop || 0)
      );
      return safeAreaOffsetTop + MOBILE_VIDEO_COLLAPSE_SCROLL_TOP_GAP_PX;
    };

    const scrollGroupAnchorNearTop = () => {
      const groupAnchor = videoGroupAnchorRefs.current.get(closingGroupKey);
      if (!groupAnchor) return;

      const rect = groupAnchor.getBoundingClientRect();
      const absoluteTop = window.scrollY + rect.top;
      const targetTop = Math.max(0, absoluteTop - getTopOffset());

      window.scrollTo({
        top: targetTop,
        behavior: "smooth",
      });
    };

    let rafA = 0;
    let rafB = 0;
    let secondPassTimer = 0;
    let thirdPassTimer = 0;

    rafA = window.requestAnimationFrame(() => {
      rafB = window.requestAnimationFrame(scrollGroupAnchorNearTop);
    });
    secondPassTimer = window.setTimeout(
      scrollGroupAnchorNearTop,
      MOBILE_VIDEO_COLLAPSE_SCROLL_SECOND_PASS_DELAY_MS
    );
    thirdPassTimer = window.setTimeout(
      scrollGroupAnchorNearTop,
      MOBILE_VIDEO_COLLAPSE_SCROLL_THIRD_PASS_DELAY_MS
    );

    window.setTimeout(() => {
      if (rafA) window.cancelAnimationFrame(rafA);
      if (rafB) window.cancelAnimationFrame(rafB);
      if (secondPassTimer) window.clearTimeout(secondPassTimer);
      if (thirdPassTimer) window.clearTimeout(thirdPassTimer);
    }, MOBILE_VIDEO_COLLAPSE_SCROLL_THIRD_PASS_DELAY_MS + 260);
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

    if (shouldUseMobileVideoExperienceRuntime) {
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

  const goToVideoIndex = ({
    groupKey,
    videos,
    nextIndex,
    desktopAutoPlayOnNavigate = false,
    preservePlayerSession = false,
  }) => {
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

    if (
      shouldUseMobileVideoExperienceRuntime &&
      mobileVideo?.groupKey === groupKey
    ) {
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
      return;
    }

    if (!shouldUseMobileVideoExperienceRuntime && desktopAutoPlayOnNavigate) {
      if (preservePlayerSession) {
        setOpenDesktopVideos({
          [groupKey]: true,
        });
        setDesktopAutoplayByGroup({
          [groupKey]: Boolean(desktopAutoPlayOnNavigate),
        });
        return;
      }

      const nextOpenToken = videoPlaybackOpenTokenRef.current + 1;
      videoPlaybackOpenTokenRef.current = nextOpenToken;

      setOpenDesktopVideos({
        [groupKey]: true,
      });
      setDesktopAutoplayByGroup({
        [groupKey]: Boolean(desktopAutoPlayOnNavigate),
      });
      setVideoPlaybackOpenTokens({
        [groupKey]: nextOpenToken,
      });
    }
  };

  const resetVideoGroupIndexToStart = (groupKey) => {
    if (!groupKey) return;

    setVideoIndexes((current) => {
      if (current[groupKey] === 0 || current[groupKey] === undefined) {
        return current;
      }

      return {
        ...current,
        [groupKey]: 0,
      };
    });
  };

  const renderVideoControls = ({
    groupKey,
    videos,
    currentIndex,
    isIntegratedSurface = false,
  }) => {
    if (!Array.isArray(videos) || videos.length <= 1) return null;

    return (
      <div
        className={[
          isIntegratedSurface ? "mt-0" : "mt-2",
          isIntegratedSurface
            ? isMobileDarkMeaningLayout
              ? "px-[7px]"
              : isFlashcardMobileLayout
              ? "px-1"
              : "px-3.5"
            : "",
          "flex items-center justify-between gap-2",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            goToVideoIndex({
              groupKey,
              videos,
              nextIndex: currentIndex - 1,
              desktopAutoPlayOnNavigate: true,
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
              desktopAutoPlayOnNavigate: true,
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

  const renderTopVideoCarousel = ({
    videos,
    groupKey,
    meaningPalette = null,
    attachContextBelow = false,
  }) => {
    const safeVideos = Array.isArray(videos) ? videos.filter(Boolean) : [];

    if (safeVideos.length === 0) return null;

    const currentIndex = Math.min(
      videoIndexes[groupKey] || 0,
      safeVideos.length - 1
    );

    const currentVideo = safeVideos[currentIndex];
    const currentPlaybackOpenToken = videoPlaybackOpenTokens[groupKey] || 0;

    if (!currentVideo?.video) return null;

    const isCurrentVideoThirdParty = isThirdPartyEmbeddedVideo(currentVideo.video);
    const currentVideoFitStyle = getExamplePanelVideoFitStyle(currentVideo.video);
    const isMeaningVideoGroup = isMeaningVideoGroupKey(groupKey);
    const shouldForceMobileExpandedMeaningPlayback = Boolean(
      shouldUseMobileVideoExperienceRuntime && isMeaningVideoGroup
    );
    const shouldRenderThirdPartyInline =
      !shouldUseMobileVideoExperienceRuntime && isCurrentVideoThirdParty;
    // No mobile, embeds usam o preview original do provider como miniatura,
    // mas esse preview é desmontado/ocultado enquanto o overlay está aberto
    // para evitar tela preta ou iframe travado por trás do player expandido.
    const shouldRenderMobileThirdPartyPreview =
      shouldUseMobileVideoExperienceRuntime &&
      isCurrentVideoThirdParty &&
      !shouldForceMobileExpandedMeaningPlayback;
    const isVideoOpen = Boolean(openDesktopVideos[groupKey]);
    const shouldAutoPlayDesktopVideo =
      isVideoOpen &&
      Boolean(desktopAutoplayByGroup[groupKey]);
    const shouldRenderInlineOpenedVideo =
      !shouldForceMobileExpandedMeaningPlayback &&
      isVideoOpen &&
      (!shouldUseMobileVideoExperienceRuntime || shouldAutoPlayDesktopVideo);
    const shouldRenderPlayerDirectly =
      shouldRenderThirdPartyInline ||
      shouldRenderMobileThirdPartyPreview ||
      shouldRenderInlineOpenedVideo;
    const canNavigateBetweenVideos = safeVideos.length > 1;
    const videoSequenceLabel = canNavigateBetweenVideos
      ? `${currentIndex + 1}/${safeVideos.length}`
      : "";
    const shouldEnableThumbnailSwipe =
      canNavigateBetweenVideos &&
      (groupKey === "global-word-video-group" || shouldUseMobileVideoExperience);
    const shouldEnableMobileInlineSwipe =
      shouldUseMobileVideoExperienceRuntime && canNavigateBetweenVideos;
    const shouldUseOwnMeaningInlinePlayerNavigation = Boolean(
      isMeaningVideoGroup &&
        canNavigateBetweenVideos &&
        !isCurrentVideoThirdParty
    );
    const shouldShowExternalVideoControls =
      !shouldUseOwnMeaningInlinePlayerNavigation;
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
      shouldUseMobileVideoExperienceRuntime &&
      Boolean(mobileVideo?.key) &&
      mobileVideo.key === currentVideo.key;
    const isIntegratedGlobalSurface =
      attachContextBelow && groupKey === "global-word-video-group";
    const isSpecificExpandedVideoSurface =
      !isIntegratedGlobalSurface && Boolean(meaningPalette);
    const shouldSuppressMobileExpandedVideoOutline = Boolean(
      shouldUseMobileVideoExperienceRuntime &&
        isSpecificExpandedVideoSurface &&
        shouldRenderPlayerDirectly
    );
    const mobileExpandedVideoOutlineResetClass =
      shouldSuppressMobileExpandedVideoOutline
        ? [
            "!outline-none !ring-0 !shadow-none",
            "focus:!outline-none focus:!ring-0 focus-visible:!outline-none focus-visible:!ring-0",
            "[&_*]:!outline-none [&_*]:!ring-0",
            "[&_*]:focus:!outline-none [&_*]:focus:!ring-0",
            "[&_*]:focus-visible:!outline-none [&_*]:focus-visible:!ring-0",
            "[&_*]:[-webkit-tap-highlight-color:transparent]",
          ].join(" ")
        : "";
    const mobileExpandedVideoOutlineResetStyle =
      shouldSuppressMobileExpandedVideoOutline
        ? {
            outline: "none",
            boxShadow: "none",
          }
        : undefined;
    const integratedSurfaceCornerRadius = isFlashcardMobileLayout
      ? "14px"
      : "0.75rem";
    const integratedTopRadiusStyle = isIntegratedGlobalSurface
      ? {
          width: "100%",
          maxWidth: "100%",
          marginLeft: 0,
          marginRight: 0,
          boxSizing: "border-box",
          borderTopLeftRadius: integratedSurfaceCornerRadius,
          borderTopRightRadius: integratedSurfaceCornerRadius,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }
      : undefined;
    const videoSurfaceBleedClass = isIntegratedGlobalSurface
      ? "w-full max-w-full"
      : isSpecificExpandedVideoSurface
      ? isFlashcardMobileLayout
        ? "-mx-1 mt-0 !w-[calc(100%+0.5rem)]"
        : "-mx-4 mt-0 !w-[calc(100%+2rem)]"
      : isFlashcardMobileLayout
      ? "-mx-1 -mt-1 !w-[calc(100%+0.5rem)]"
      : "-mx-4 -mt-3 !w-[calc(100%+2rem)]";
    const integratedSurfaceRadiusClass = isIntegratedGlobalSurface
      ? isFlashcardMobileLayout
        ? "rounded-t-[14px] rounded-b-none"
        : "rounded-t-xl rounded-b-none"
      : "rounded-xl";
    const integratedFrameRadiusClass = isIntegratedGlobalSurface
      ? isFlashcardMobileLayout
        ? "!rounded-[14px]"
        : "!rounded-xl"
      : "";
    const integratedThumbnailRadiusClass = isIntegratedGlobalSurface
      ? isFlashcardMobileLayout
        ? "!rounded-[14px] !border-0"
        : "!rounded-xl !border-0"
      : "";
    const integratedSurfacePalette = isIntegratedGlobalSurface
      ? getMeaningPaletteByIndex(0, meaningPaletteCollection)
      : null;
    const integratedSurfaceBorderClass = isIntegratedGlobalSurface
      ? "w-full max-w-full border border-b-0"
      : "";
    const integratedSurfaceStyle = integratedSurfacePalette
      ? {
          ...integratedTopRadiusStyle,
          borderColor: integratedSurfacePalette.border,
          backgroundColor: integratedSurfacePalette.background,
        }
      : integratedTopRadiusStyle;
    const integratedVideoRadiusStyle = isIntegratedGlobalSurface
      ? {
          ...integratedTopRadiusStyle,
          borderBottomLeftRadius: integratedSurfaceCornerRadius,
          borderBottomRightRadius: integratedSurfaceCornerRadius,
        }
      : undefined;
    const integratedFrameStyle = isIntegratedGlobalSurface
      ? integratedVideoRadiusStyle
      : { borderRadius: "inherit" };
    const integratedThumbnailStyle = isIntegratedGlobalSurface
      ? {
          ...integratedVideoRadiusStyle,
          borderWidth: 0,
        }
      : undefined;
    const navigateMeaningPreviewByDirection = (direction) => {
      if (
        shouldUseMobileVideoExperience ||
        !shouldShowSpecificVideosInsideMeanings
      ) {
        return;
      }

      const currentMeaningGroupIndex = meaningVideoGroups.findIndex(
        (group) => group.groupKey === groupKey
      );

      if (currentMeaningGroupIndex === -1) return;

      const nextMeaningGroup = meaningVideoGroups[currentMeaningGroupIndex + direction];

      if (!nextMeaningGroup) return;

      resetVideoGroupIndexToStart(nextMeaningGroup.groupKey);
      setExpandedMeaningVideoKey(nextMeaningGroup.groupKey);
      openMeaningPreviewVideoInline({
        entry: nextMeaningGroup.entry,
        groupKey: nextMeaningGroup.groupKey,
        startFromFirstVideo: true,
        desktopAutoPlayOnOpen: false,
      });
    };

    return (
      <div
        ref={(node) => registerVideoGroupAnchor(groupKey, node)}
        className={
          attachContextBelow
            ? "mb-0 w-full max-w-full"
            : meaningPalette
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
                "relative overflow-hidden bg-black",
                integratedSurfaceRadiusClass,
                integratedSurfaceBorderClass,
                videoSurfaceBleedClass,
                mobileExpandedVideoOutlineResetClass,
              ]
                .filter(Boolean)
                .join(" ")}
              style={
                mobileExpandedVideoOutlineResetStyle
                  ? {
                      ...(integratedSurfaceStyle || {}),
                      ...mobileExpandedVideoOutlineResetStyle,
                    }
                  : integratedSurfaceStyle
              }
            >
              <AspectRatio
                ratio={16 / 9}
                className={[
                  VIDEO_FRAME_CLASS,
                  integratedFrameRadiusClass,
                  mobileExpandedVideoOutlineResetClass,
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  ...(integratedFrameStyle || {}),
                  ...(currentVideoFitStyle || {}),
                  ...(mobileExpandedVideoOutlineResetStyle || {}),
                }}
              >
                <ExampleVideoPlayer
                  key={`${groupKey}-${currentPlaybackOpenToken}`}
                  video={currentVideo.video}
                  title={currentVideo.title}
                  autoPlay={shouldAutoPlayDesktopVideo}
                  resetPlaybackOnMount={Boolean(currentPlaybackOpenToken)}
                  videoSequenceLabel={videoSequenceLabel}
                  showSideNavigationButtons={
                    shouldUseOwnMeaningInlinePlayerNavigation &&
                    shouldRenderPlayerDirectly
                  }
                  onKeyboardArrowNavigate={
                    canNavigateBetweenVideos && !shouldUseMobileVideoExperience
                      ? (direction, navigationOptions = {}) => {
                          goToVideoIndex({
                            groupKey,
                            videos: safeVideos,
                            nextIndex: currentIndex + direction,
                            desktopAutoPlayOnNavigate: true,
                            preservePlayerSession: Boolean(
                              navigationOptions?.preservePlayerSession
                            ),
                          });
                        }
                      : undefined
                  }
                  onKeyboardArrowUpNavigate={
                    !shouldUseMobileVideoExperience &&
                    shouldShowSpecificVideosInsideMeanings
                      ? () => {
                          navigateMeaningPreviewByDirection(-1);
                        }
                      : undefined
                  }
                  onKeyboardArrowDownNavigate={
                    !shouldUseMobileVideoExperience &&
                    shouldShowSpecificVideosInsideMeanings
                      ? () => {
                          navigateMeaningPreviewByDirection(1);
                        }
                      : undefined
                  }
                  onOwnVideoPlaybackEnded={
                    shouldUseOwnMeaningInlinePlayerNavigation
                      ? (navigationOptions = {}) => {
                          goToVideoIndex({
                            groupKey,
                            videos: safeVideos,
                            nextIndex: currentIndex + 1,
                            desktopAutoPlayOnNavigate: true,
                            preservePlayerSession: Boolean(
                              navigationOptions?.preservePlayerSession
                            ),
                          });
                        }
                      : undefined
                  }
                />
              </AspectRatio>

              {shouldRenderMobileThirdPartyPreview ? (
                <button
                  type="button"
                  className="absolute inset-0 z-30 touch-manipulation bg-transparent"
                  aria-label={currentVideo.title || "Abrir vídeo"}
                  title={currentVideo.title || "Abrir vídeo"}
                  onPointerDown={(event) => {
                    if (!shouldEnableMobileInlineSwipe) return;
                    if (event.pointerType === "mouse" && event.button !== 0) return;

                    inlinePreviewSwipeRef.current = {
                      active: true,
                      pointerId: event.pointerId,
                      startX: event.clientX,
                      startY: event.clientY,
                      groupKey,
                      suppressClick: false,
                    };
                  }}
                  onPointerCancel={() => {
                    inlinePreviewSwipeRef.current = {
                      ...inlinePreviewSwipeRef.current,
                      active: false,
                      pointerId: null,
                    };
                  }}
                  onPointerLeave={() => {
                    inlinePreviewSwipeRef.current = {
                      ...inlinePreviewSwipeRef.current,
                      active: false,
                      pointerId: null,
                    };
                  }}
                  onPointerUp={(event) => {
                    if (!shouldEnableMobileInlineSwipe) return;

                    const swipeState = inlinePreviewSwipeRef.current;

                    if (
                      !swipeState.active ||
                      swipeState.pointerId !== event.pointerId ||
                      swipeState.groupKey !== groupKey
                    ) {
                      return;
                    }

                    const deltaX = event.clientX - swipeState.startX;
                    const deltaY = event.clientY - swipeState.startY;
                    const absX = Math.abs(deltaX);
                    const absY = Math.abs(deltaY);
                    const isHorizontalSwipe =
                      absX >= VIDEO_SWIPE_DISTANCE_PX &&
                      absX > absY * VIDEO_SWIPE_DIRECTION_RATIO;

                    inlinePreviewSwipeRef.current = {
                      ...inlinePreviewSwipeRef.current,
                      active: false,
                      pointerId: null,
                    };

                    if (!isHorizontalSwipe) return;

                    goToVideoIndex({
                      groupKey,
                      videos: safeVideos,
                      nextIndex: deltaX > 0 ? currentIndex + 1 : currentIndex - 1,
                    });

                    inlinePreviewSwipeRef.current = {
                      ...inlinePreviewSwipeRef.current,
                      suppressClick: true,
                    };

                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    if (inlinePreviewSwipeRef.current.suppressClick) {
                      inlinePreviewSwipeRef.current = {
                        ...inlinePreviewSwipeRef.current,
                        suppressClick: false,
                      };
                      event.preventDefault();
                      event.stopPropagation();
                      return;
                    }

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

            {shouldShowExternalVideoControls && !shouldHideSourceThumbnailOnMobile
              ? renderVideoControls({
                  groupKey,
                  videos: safeVideos,
                  currentIndex,
                  isIntegratedSurface: isIntegratedGlobalSurface,
                })
              : null}
          </div>
        ) : (
          <div>
            <div
              className={[
                isIntegratedGlobalSurface
                  ? [
                      "overflow-hidden",
                      integratedSurfaceRadiusClass,
                      integratedSurfaceBorderClass,
                    ].join(" ")
                  : "",
                isIntegratedGlobalSurface ? videoSurfaceBleedClass : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={isIntegratedGlobalSurface ? integratedSurfaceStyle : undefined}
            >
              <ExampleVideoThumbnail
                video={currentVideo.video}
                thumbnail={currentVideo.thumbnail}
                videoSequenceLabel={videoSequenceLabel}
                title={currentVideo.title}
                isOpen={!shouldUseMobileVideoExperience && isVideoOpen}
                isMobile={shouldUseMobileVideoExperience}
                onSwipeLeft={
                  shouldEnableThumbnailSwipe
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
                onSwipeRight={
                  shouldEnableThumbnailSwipe
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
                className={[
                  "aspect-video h-auto",
                  isIntegratedGlobalSurface ? "" : videoSurfaceBleedClass,
                  integratedThumbnailRadiusClass,
                  shouldHideSourceThumbnailOnMobile ? "hidden" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={integratedThumbnailStyle}
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
            </div>

            {shouldShowExternalVideoControls && !shouldHideSourceThumbnailOnMobile
              ? renderVideoControls({
                  groupKey,
                  videos: safeVideos,
                  currentIndex,
                  isIntegratedSurface: isIntegratedGlobalSurface,
                })
              : null}
          </div>
        )}
      </div>
    );
  };

  const goMobileVideoToIndex = (nextIndex, { autoPlay = false } = {}) => {
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
      autoPlay: Boolean(autoPlay),
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

    if (deltaX > 0) {
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

  const openMeaningPreviewVideoInline = ({
    entry,
    groupKey,
    startFromFirstVideo = false,
    desktopAutoPlayOnOpen = false,
    mobileInlinePlaybackOnOpen = false,
    mobileInlineAutoPlayOnOpen = true,
  }) => {
    const safeVideos = Array.isArray(entry?.topVideos)
      ? entry.topVideos.filter(Boolean)
      : [];

    if (safeVideos.length === 0) return false;

    const currentIndex = startFromFirstVideo
      ? 0
      : Math.min(videoIndexes[groupKey] || 0, safeVideos.length - 1);
    const currentVideo = safeVideos[currentIndex];

    if (!currentVideo?.video) return false;

    if (shouldUseMobileVideoExperienceRuntime && mobileInlinePlaybackOnOpen) {
      openVideo({
        video: currentVideo.video,
        videoKey: currentVideo.key,
        videoTitle: currentVideo.title,
        groupKey,
        videos: safeVideos,
        index: currentIndex,
        autoPlayOnOpen: Boolean(mobileInlineAutoPlayOnOpen),
        desktopAutoPlayOnOpen: false,
      });

      return true;
    }

    openVideo({
      video: currentVideo.video,
      videoKey: currentVideo.key,
      videoTitle: currentVideo.title,
      groupKey,
      videos: safeVideos,
      index: currentIndex,
      autoPlayOnOpen: true,
      desktopAutoPlayOnOpen: Boolean(desktopAutoPlayOnOpen),
    });

    return true;
  };

  if (rawMeanings.length === 0) return null;

  return (
    <>
      <style>{EXAMPLE_PANEL_VIDEO_FIT_STYLE}</style>

      <div
        className={`${panelContainerClass} study-ui-controls`}
      >
        <div className={[panelHeaderClass, panelHeaderOffsetClass, panelHeaderInsetClass].join(" ")}>
          <div className="flex w-full items-center rounded-[14px] py-1 text-left">
            <div className="grid min-w-0 grid-cols-[18px_18px_auto] items-center gap-x-2 text-foreground leading-none">
              <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                <UsFlagIcon className="h-[18px] w-[18px] shrink-0" />
              </span>

              <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                <Languages className="h-[18px] w-[18px] shrink-0 text-primary" aria-hidden="true" />
              </span>

              <h3 className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-snug">
                <span className="shrink-0 text-sm font-normal text-[#6A7181] dark:text-slate-400">
                  —
                </span>
                <span className="min-w-0 break-words text-base font-bold leading-snug text-[#14181F] dark:text-foreground">
                  {titleValue}
                </span>
              </h3>
            </div>
          </div>
        </div>
        {shouldRenderPanelHeaderDivider ? (
          <div className={isFlashcardMobileLayout ? "mx-1" : "mx-2"}>
            <div
              className={`${
                isFlashcardMobileLayout ? "" : ""
              }h-px ${panelHeaderDividerToneClass}`}
            />
          </div>
        ) : null}

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
                    : `${titleValue} — vídeo geral ${index + 1}`,
              })),
              groupKey: "global-word-video-group",
              attachContextBelow: true,
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
            const visibleExamples = Array.isArray(entry.examples) ? entry.examples : [];
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
            const shouldAttachMeaningToGlobalVideo =
              shouldShowGlobalWordVideoOnTop && index === 0;
            const shouldRenderMeaningAttachedToGlobalVideo =
              shouldAttachMeaningToGlobalVideo && isMeaningExpanded;
            const isMobileMeaningVideoPlaybackActive = Boolean(
              shouldUseMobileVideoExperience &&
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
            const shouldAlignExpandedSpecificVideoSurface = Boolean(
              isMeaningExpanded &&
                hasMeaningVideo &&
                !shouldRenderMeaningAttachedToGlobalVideo
            );
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
                    role={hasMeaningVideo ? "button" : undefined}
                    tabIndex={hasMeaningVideo ? 0 : undefined}
                    aria-label={
                      hasMeaningVideo
                        ? `Reproduzir vídeo de ${meaningPreviewTitle}`
                        : undefined
                    }
                    title={
                      hasMeaningVideo
                        ? `Reproduzir vídeo de ${meaningPreviewTitle}`
                        : undefined
                    }
                    onClick={
                      hasMeaningVideo
                        ? (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            resetVideoGroupIndexToStart(groupKey);
                            setExpandedMeaningVideoKey(groupKey);
                            openMeaningPreviewVideoInline({
                              entry,
                              groupKey,
                              startFromFirstVideo: true,
                              desktopAutoPlayOnOpen: true,
                              mobileInlinePlaybackOnOpen: false,
                            });
                          }
                        : undefined
                    }
                    onKeyDown={
                      hasMeaningVideo
                        ? (event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            event.stopPropagation();
                            resetVideoGroupIndexToStart(groupKey);
                            setExpandedMeaningVideoKey(groupKey);
                            openMeaningPreviewVideoInline({
                              entry,
                              groupKey,
                              startFromFirstVideo: true,
                              desktopAutoPlayOnOpen: true,
                              mobileInlinePlaybackOnOpen: false,
                            });
                          }
                        : undefined
                    }
                    className={[
                      "relative shrink-0 self-center overflow-hidden rounded-md border bg-black/10",
                      hasMeaningVideo
                        ? "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#ED9A0A]/45 focus-visible:ring-offset-2"
                        : "",
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
                            shouldUseMobileVideoExperience
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
                    <div className="flex min-h-[20px] items-center gap-2 leading-none">
                      {shouldShowMeaningLanguageMarker ? (
                        <span className="inline-flex items-center gap-1.5 leading-none">
                          <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                            <BrFlagIcon className="h-[18px] w-[18px] shrink-0" />
                          </span>
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
                                "flex items-start gap-1.5 text-[#667085] dark:text-[#919191]",
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
                        <p className="text-[10px] leading-[1.32] text-[#667085]/85 dark:text-[#919191]/85">
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
                          ? "relative rounded-2xl border border-[var(--meaning-border)] px-1 pb-3 pt-1"
                          : "group/meaning relative overflow-hidden rounded-b-[10px] border-b border-[var(--meaning-border)] px-0 py-0"
                        : "relative rounded-2xl border border-[var(--meaning-border)] p-1"
                      : shouldUseMeaningCollapse
                      ? isMeaningExpanded
                        ? "group/meaning relative rounded-xl border border-[var(--meaning-border)] px-4 pb-3 pt-1"
                        : "group/meaning relative overflow-hidden rounded-b-[10px] border-b border-[var(--meaning-border)] px-0 py-0"
                      : "group/meaning relative rounded-xl border border-[var(--meaning-border)] px-4 py-3",
                    shouldUseMeaningVideoCollapse &&
                    isMeaningExpanded &&
                    !shouldRenderMeaningAttachedToGlobalVideo
                      ? isFlashcardMobileLayout
                        ? "mt-1"
                        : "mt-1"
                      : "",
                    shouldRenderMeaningAttachedToGlobalVideo
                      ? isFlashcardMobileLayout
                        ? "mt-0 w-full max-w-full overflow-hidden rounded-t-none rounded-b-[14px] border-t-0"
                        : "mt-0 w-full max-w-full overflow-hidden rounded-t-none border-t-0"
                      : "",
                    isForegroundMeaning ? "border-t-0" : "",
                    shouldAlignExpandedSpecificVideoSurface ? "overflow-hidden !pt-0" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    backgroundColor:
                      !shouldUseMeaningCollapse || isMeaningExpanded
                        ? meaningPalette.background
                        : "transparent",
                    "--meaning-border": meaningPalette.border,
                    ...(shouldRenderMeaningAttachedToGlobalVideo
                      ? {
                          width: "100%",
                          maxWidth: "100%",
                          boxSizing: "border-box",
                          borderTopWidth: 0,
                          borderTopLeftRadius: 0,
                          borderTopRightRadius: 0,
                        }
                      : {}),
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
                          resetVideoGroupIndexToStart(groupKey);
                          setExpandedMeaningVideoKey(groupKey);

                          if (hasMeaningVideo) {
                            if (!shouldUseMobileVideoExperienceRuntime) {
                              openMeaningPreviewVideoInline({
                                entry,
                                groupKey,
                                startFromFirstVideo: true,
                                desktopAutoPlayOnOpen: false,
                                mobileInlinePlaybackOnOpen: false,
                                mobileInlineAutoPlayOnOpen: false,
                              });
                            }
                          }
                        }}
                        className={[
                          "w-full rounded-md text-left outline-none transition-colors duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CBD5E1] focus-visible:ring-offset-0 [-webkit-tap-highlight-color:transparent]",
                          isFlashcardMobileLayout ? "px-1" : "px-2",
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

                      <div className={isMobileDarkMeaningLayout ? "px-[3px]" : ""}>
                        <div className="mb-3 border-b pb-2 pt-1.5" style={{ borderBottomColor: meaningPalette.border }}>
                          {shouldUseMeaningCollapse ? (
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedMeaningVideoKey((current) =>
                                  current === groupKey ? null : groupKey
                                );
                              }}
                              className="w-full text-left outline-none transition-colors duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CBD5E1] focus-visible:ring-offset-0 [-webkit-tap-highlight-color:transparent]"
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
                                              ? "text-[clamp(13px,3.25vw,14px)] font-medium leading-snug text-[#5D6677] dark:text-[#919191]"
                                              : "text-xs font-medium leading-snug text-[#5D6677] dark:text-[#919191]"
                                          }
                                        >
                                          {example.translation}
                                        </p>
                                      ) : null}

                                      {hasSentence ? (
                                        <p
                                          className={
                                            isFlashcardMobileLayout
                                              ? "text-[clamp(14px,3.85vw,15px)] font-semibold leading-snug text-[#101827] dark:text-[#a3a3a3]"
                                              : "text-sm font-semibold leading-snug text-[#101827] dark:text-[#a3a3a3]"
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
                      </div>
                    </>
                  ) : null}
                </div>

                {isMeaningExpanded && hasMeaningSupportInfo ? (
                  <div
                    className={[
                      "mt-3",
                      isMobileDarkMeaningLayout ? "px-[3px]" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    data-examples-tip-area="true"
                  >
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
                              <p className="min-w-0 flex-1 text-left text-xs leading-relaxed text-[#5E6778] dark:text-[#919191]">
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
          aria-label="Vídeo do exemplo"
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
              style={{
                ...(mobileLandscapeEmbedFrameStyle || {}),
                ...(currentMobileVideoFitStyle || {}),
              }}
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
                      ? `${EXAMPLE_PANEL_VIDEO_FIT_CLASS} [&>div]:bg-transparent [&_iframe]:bg-transparent`
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
                  videoSequenceLabel={currentMobileVideoSequenceLabel}
                  showSideNavigationButtons={
                    shouldUseMobileExpandedOwnNavigation
                  }
                  onKeyboardArrowNavigate={
                    shouldUseMobileExpandedOwnNavigation
                      ? (direction) => {
                          goMobileVideoToIndex(
                            currentMobileVideoIndex + direction,
                            { autoPlay: true }
                          );
                        }
                      : undefined
                  }
                  onOwnVideoPlaybackEnded={
                    shouldUseMobileOwnMeaningPlayerNavigation
                      ? () => {
                          goMobileVideoToIndex(currentMobileVideoIndex + 1, {
                            autoPlay: true,
                          });
                        }
                      : undefined
                  }
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

