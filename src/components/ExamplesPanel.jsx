import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lightbulb, Menu, Play, X } from "lucide-react";
import { useIsMobile } from "../hooks/use-mobile";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import ExampleVideoPlayer from "@/components/ExampleVideoPlayer";
import { resolveExampleVideoPlayback } from "@/lib/exampleVideoStorage";
import { playSound } from "../lib/gameState";
import { SFX_EVENTS } from "../lib/sfx";

const EXAMPLES_POINTER_SFX_GUARD_MS = 700;
const VIDEO_SWIPE_DISTANCE_PX = 42;
const VIDEO_SWIPE_DIRECTION_RATIO = 1.15;

const VIDEO_FRAME_CLASS =
  "overflow-hidden rounded-lg bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0 [&_video]:absolute [&_video]:inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-contain";

const videoThumbnailCache = new Map();

const DESCENDER_CHAR_REGEX = /[gjpqy]/;

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

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeExampleText = (value) =>
  typeof value === "string" ? value.trim() : "";

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

const getMeaningPaletteByIndex = (index) =>
  FLASHCARD_MOBILE_MEANING_PALETTE[
    index % FLASHCARD_MOBILE_MEANING_PALETTE.length
  ];

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

const renderHighlightedTerm = (
  text,
  term,
  { underlineColor = "#ED9A0A" } = {}
) => {
  const safeText = typeof text === "string" ? text : "";
  const safeTerm = typeof term === "string" ? term.trim() : "";

  if (!safeText || !safeTerm) {
    return safeText;
  }

  const pattern = new RegExp(`(${escapeRegExp(safeTerm)})`, "gi");
  const parts = safeText.split(pattern);

  if (parts.length <= 1) {
    return safeText;
  }

  return parts.map((part, index) => {
    const isMatch = part.toLowerCase() === safeTerm.toLowerCase();

    if (!isMatch) {
      return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
    }

    return (
      <Fragment key={`${part}-${index}`}>
        {renderUnderlineSequence(part, `${part}-${index}`, underlineColor)}
      </Fragment>
    );
  });
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
    /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|dai\.ly|tiktok\.com|instagram\.com|facebook\.com\/plugins\/video|player\.twitch\.tv/i.test(
      cleanValue
    )
  );
};

const getPlatformThumbnailUrl = (value) => {
  const youtubeId = getYouTubeVideoId(value);

  if (youtubeId) {
    return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
  }

  const dailymotionId = getDailymotionVideoId(value);

  if (dailymotionId) {
    return `https://www.dailymotion.com/thumbnail/video/${dailymotionId}`;
  }

  return "";
};

const cleanEmbedPreviewSrc = (src) => {
  const cleanSrc = normalizeText(src);

  if (!cleanSrc) return "";

  try {
    const url = new URL(cleanSrc, window.location.origin);

    url.searchParams.delete("autoplay");
    url.searchParams.delete("autoPlay");
    url.searchParams.delete("mute");
    url.searchParams.delete("muted");

    return url.toString();
  } catch {
    return cleanSrc;
  }
};

const getEmbedPreviewSrc = (value, playback) => {
  const cleanValue = normalizeText(value);

  const playbackSrc =
    playback?.embedUrl ||
    playback?.embed_url ||
    playback?.src ||
    playback?.url ||
    "";

  const iframeSrc =
    extractIframeSrc(cleanValue) ||
    extractIframeSrc(playback?.html || "") ||
    extractIframeSrc(playback?.embed || "");

  if (iframeSrc) return cleanEmbedPreviewSrc(iframeSrc);

  if (playbackSrc && playback?.type !== "video") {
    return cleanEmbedPreviewSrc(playbackSrc);
  }

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

  return "";
};

const getWebEmbedPreviewFrameStyle = (embedSrc, isMobile) => {
  if (isMobile) return undefined;

  const safeSrc = normalizeText(embedSrc).toLowerCase();

  if (safeSrc.includes("clip.cafe")) {
    return {
      left: "51%",
      top: "50%",
      width: "107%",
      height: "107%",
      transform: "translate(-50%, -50%) scale(0.95)",
      transformOrigin: "center center",
      clipPath: "inset(0.5px)",
    };
  }

  return undefined;
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
}) {
  const [thumbnailSrc, setThumbnailSrc] = useState("");
  const [embedPreviewSrc, setEmbedPreviewSrc] = useState("");
  const swipePointerRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
  });
  const suppressClickRef = useRef(false);

  const isThirdPartyVideo = isThirdPartyEmbeddedVideo(video);
  const shouldRenderEmbedPreview =
    isThirdPartyVideo && Boolean(embedPreviewSrc);
  const shouldUseDirectEmbed =
    shouldRenderEmbedPreview && !isMobile;
  const webEmbedPreviewFrameStyle = getWebEmbedPreviewFrameStyle(
    embedPreviewSrc,
    isMobile
  );

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
      setThumbnailSrc("");
      setEmbedPreviewSrc("");
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
      setThumbnailSrc(dataUrl);
      setEmbedPreviewSrc("");

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

    const seekToMiddleFrame = () => {
      if (cancelled || captured || !previewVideo) return;

      const duration =
        Number.isFinite(previewVideo.duration) && previewVideo.duration > 0
          ? previewVideo.duration
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
        previewVideo.currentTime = targetTime;
      } catch {
        window.requestAnimationFrame(drawFrame);
      }
    };

    const generateThumbnail = async () => {
      setThumbnailSrc("");
      setEmbedPreviewSrc("");

      if (!rawVideo || typeof window === "undefined") {
        return;
      }

      if (isThirdPartyEmbeddedVideo(rawVideo)) {
        const embedSrc = getEmbedPreviewSrc(rawVideo, null);

        if (embedSrc) {
          setEmbedPreviewSrc(embedSrc);
          setThumbnailSrc("");
          return;
        }

        const platformThumbnail = getPlatformThumbnailUrl(rawVideo);

        if (platformThumbnail) {
          setThumbnailSrc(platformThumbnail);
          setEmbedPreviewSrc("");
          return;
        }

        applyFallback();
        return;
      }

      if (rawThumbnail) {
        setThumbnailSrc(rawThumbnail);
        setEmbedPreviewSrc("");
        return;
      }

      const cachedThumbnail = videoThumbnailCache.get(rawVideo);

      if (cachedThumbnail) {
        setThumbnailSrc(cachedThumbnail);
        setEmbedPreviewSrc("");
        return;
      }

      try {
        const playback = await resolveExampleVideoPlayback(rawVideo);

        if (cancelled) return;

        if (!playback || playback.type !== "video" || !playback.src) {
          const embedSrc = getEmbedPreviewSrc(rawVideo, playback);

          if (embedSrc) {
            setEmbedPreviewSrc(embedSrc);
            setThumbnailSrc("");
            return;
          }

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

        previewVideo.addEventListener("loadedmetadata", seekToMiddleFrame, {
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
  }, [video, thumbnail, isMobile]);

  const resetSwipePointer = () => {
    swipePointerRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
    };
  };

  const handlePointerDown = (event) => {
    if (shouldUseDirectEmbed) return;
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
      role={shouldUseDirectEmbed ? undefined : "button"}
      tabIndex={shouldUseDirectEmbed ? undefined : 0}
      onClick={(event) => {
        if (shouldUseDirectEmbed) return;
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
      onKeyDown={(event) => {
        if (shouldUseDirectEmbed) return;

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
        shouldUseDirectEmbed ? "" : "cursor-pointer",
        className,
        isOpen ? "border-[#ED9A0A]/80" : "border-[#D9E2EC]",
        "bg-[#F8FAFC] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_18px_rgba(15,23,42,0.06)]",
        "transition-all duration-200",
        shouldUseDirectEmbed
          ? ""
          : "hover:border-[#ED9A0A]/70 hover:shadow-[0_12px_24px_rgba(15,23,42,0.10)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED9A0A]/35 focus-visible:ring-offset-2",
      ].join(" ")}
    >
      {shouldRenderEmbedPreview ? (
        <iframe
          src={embedPreviewSrc}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className={[
            "absolute inset-0 h-full w-full border-0",
            isMobile ? "pointer-events-none" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={webEmbedPreviewFrameStyle}
        />
      ) : thumbnailSrc ? (
        <img
          src={thumbnailSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(237,154,10,0.18),transparent_32%),linear-gradient(135deg,#F8FAFC_0%,#EFF4F8_55%,#E6EDF5_100%)]" />
      )}

      {!shouldUseDirectEmbed ? (
        <>
          {shouldRenderEmbedPreview && isMobile ? (
            <button
              type="button"
              onClick={(event) => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  event.preventDefault();
                  event.stopPropagation();
                  return;
                }
                event.stopPropagation();
                onClick?.(event);
              }}
              className="absolute inset-0 z-20 bg-transparent"
              aria-label={title}
              title={title}
            />
          ) : null}

          {!shouldRenderEmbedPreview ? (
            <>
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
            </>
          ) : null}
        </>
      ) : null}
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
  item,
  vocabularyItem,
}) {
  const lastClosePointerSfxAtRef = useRef(0);
  const isMobile = useIsMobile();
  const [openDesktopVideos, setOpenDesktopVideos] = useState({});
  const [mobileVideo, setMobileVideo] = useState(null);
  const [videoIndexes, setVideoIndexes] = useState({});
  const [expandedMeaningVideoKey, setExpandedMeaningVideoKey] = useState(null);
  const expandedVideoSwipeRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
  });

  const rawMeanings = allMeanings || (examples ? [{ meaning, examples }] : []);

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
    const meaningVideo = normalizeMeaningVideo(entry);
    const meaningThumbnail = normalizeMeaningThumbnail(entry);

    const rawExamples = Array.isArray(entry?.examples) ? entry.examples : [];

    const topVideos = [
      meaningVideo
        ? {
            video: meaningVideo,
            thumbnail: meaningThumbnail,
            key: `${entry?.meaning || "meaning"}-${index}-meaning-video`,
            title: entry?.meaning || `Significado ${index + 1}`,
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
              entry?.meaning || "meaning"
            }-${index}-example-${exampleIndex}`,
            title:
              normalizeExampleText(example?.sentence) ||
              entry?.meaning ||
              "Vídeo do exemplo",
          };
        })
        .filter(Boolean),
    ].filter(Boolean);

    return {
      meaning: entry?.meaning || `Significado ${index + 1}`,
      category: entry?.category || "vocabulário",
      tip: entry?.tip || "",
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

  const sorted = activeMeaning
    ? [...normalized].sort((a, b) =>
        a.meaning === activeMeaning ? -1 : b.meaning === activeMeaning ? 1 : 0
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

  const shouldUseMeaningVideoCollapse =
    hasMultipleMeanings && videoMeaningGroupKeys.length > 1;
  const firstExpandedMeaningVideoKey = videoMeaningGroupKeys[0] || null;
  const videoMeaningGroupsSignature = videoMeaningGroupKeys.join("||");

  useEffect(() => {
    setOpenDesktopVideos({});
    setMobileVideo(null);
    setVideoIndexes({});
  }, [
    allMeanings,
    activeMeaning,
    wordVideoSourcesSignature,
    shouldShowGlobalWordVideoOnTop,
  ]);

  useEffect(() => {
    if (!shouldUseMeaningVideoCollapse) {
      setExpandedMeaningVideoKey(null);
      return;
    }

    setExpandedMeaningVideoKey((current) => {
      if (current && videoMeaningGroupKeys.includes(current)) {
        return current;
      }

      return firstExpandedMeaningVideoKey;
    });
  }, [
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
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileVideo]);

  const isFlashcard = variant === "flashcard";
  const isFlashcardMobileLayout =
    isFlashcard && isMobile && panelScope === "flashcards";
  const titleValue = titleTerm ? titleTerm.trim() : "Exemplos";
  const highlightTerm = titleTerm ? titleTerm.trim() : "";
  const panelContainerClass = isFlashcard
    ? isFlashcardMobileLayout
      ? "mt-0 bg-transparent p-0 text-[#1A1A1A]"
      : "mt-0 rounded-xl border border-[#EDF0F3] bg-white p-6 text-[#1A1A1A]"
    : "mt-4 rounded-2xl border border-border/70 bg-[#F9FAFB] p-5 animate-in fade-in slide-in-from-top-2 duration-200";
  const panelHeaderClass = isFlashcard
    ? isFlashcardMobileLayout
      ? "mb-3 flex items-center justify-between border-b border-border pb-2.5"
      : "mb-4 flex items-center justify-between border-b border-border pb-2"
    : "mb-4 flex items-center justify-between gap-3 border-b border-border/70 pb-3";
  const isExpandedGlobalWordVideo =
    mobileVideo?.groupKey === "global-word-video-group";

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
  }) => {
    if (!video) return;

    if (isMobile) {
      setMobileVideo({
        video,
        key: videoKey,
        title: videoTitle,
        groupKey,
        videos,
        index,
        autoPlay: Boolean(autoPlayOnOpen),
      });
      return;
    }

    setOpenDesktopVideos({
      [groupKey]: true,
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
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#D9E2EC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#64748B] shadow-sm transition-colors hover:border-[#ED9A0A]/60 hover:bg-[#FFF8ED] hover:text-[#B86F00]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar
        </button>

        <span className="text-[11px] font-semibold text-[#64748B]">
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
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#D9E2EC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#64748B] shadow-sm transition-colors hover:border-[#ED9A0A]/60 hover:bg-[#FFF8ED] hover:text-[#B86F00]"
        >
          Próximo
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const renderTopVideoCarousel = ({ videos, groupKey }) => {
    const safeVideos = Array.isArray(videos) ? videos.filter(Boolean) : [];

    if (safeVideos.length === 0) return null;

    const currentIndex = Math.min(
      videoIndexes[groupKey] || 0,
      safeVideos.length - 1
    );

    const currentVideo = safeVideos[currentIndex];

    if (!currentVideo?.video) return null;

    const isVideoOpen = Boolean(openDesktopVideos[groupKey]);
    const isGlobalWordVideoGroup = groupKey === "global-word-video-group";
    const shouldHideSourceThumbnailOnMobile =
      isMobile && Boolean(mobileVideo?.key) && mobileVideo.key === currentVideo.key;

    return (
      <div className={isFlashcardMobileLayout ? "mb-3" : "mb-4"}>
        {isVideoOpen && !isMobile ? (
          <div>
            <div className="relative overflow-hidden rounded-xl bg-black shadow-[0_16px_34px_rgba(15,23,42,0.16)]">
              <AspectRatio ratio={16 / 9} className={VIDEO_FRAME_CLASS}>
                <ExampleVideoPlayer
                  key={`${currentVideo.key}-${currentVideo.video}`}
                  video={currentVideo.video}
                  title={currentVideo.title}
                  autoPlay={false}
                />
              </AspectRatio>
            </div>

            {renderVideoControls({
              groupKey,
              videos: safeVideos,
              currentIndex,
            })}
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
                isGlobalWordVideoGroup && safeVideos.length > 1
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
                isGlobalWordVideoGroup && safeVideos.length > 1
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

  if (rawMeanings.length === 0) return null;

  return (
    <>
      <div
        className={panelContainerClass}
      >
        <div className={panelHeaderClass}>
          <div className="flex min-w-0 items-center gap-2 text-foreground">
            <Lightbulb
              className={
                isFlashcard
                  ? "h-[18px] w-[18px] shrink-0 text-[#ED9A0A]"
                  : "h-4 w-4 shrink-0 text-[#ED9A0A]"
              }
            />

            <h3 className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-snug">
              <span className="shrink-0 text-sm font-normal text-[#6A7181]">
                Exemplo
              </span>

              <span className="shrink-0 text-sm font-normal text-[#6A7181]">
                —
              </span>

              <span className="min-w-0 break-words text-base font-bold leading-snug text-[#14181F]">
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
                title:
                  index === 0
                    ? titleValue
                    : `${titleValue} — vídeo geral ${index + 1}`,
              })),
              groupKey: "global-word-video-group",
            })
          : null}

        <div className={isFlashcardMobileLayout ? "space-y-3.5" : "space-y-4"}>
          {sorted.map((entry, index) => {
            const visibleExamples = entry.examples.slice(0, 3);
            const groupKey = `meaning-video-group-${entry.meaning}-${index}`;
            const meaningPalette = getMeaningPaletteByIndex(index);
            const hasMeaningVideo =
              shouldShowSpecificVideosInsideMeanings &&
              Array.isArray(entry.topVideos) &&
              entry.topVideos.length > 0;
            const shouldShowMeaningVideoIndicator =
              isFlashcardMobileLayout &&
              hasMultipleMeanings &&
              hasMeaningVideo;
            const shouldUseMeaningCollapse =
              shouldUseMeaningVideoCollapse && hasMeaningVideo;
            const isMeaningExpanded =
              !shouldUseMeaningCollapse || expandedMeaningVideoKey === groupKey;
            const shouldRenderMeaningVideoIndicator =
              shouldShowMeaningVideoIndicator && !isMeaningExpanded;

            return (
              <section
                key={`${entry.meaning}-${index}`}
                className={
                  isFlashcardMobileLayout
                    ? "relative rounded-2xl border p-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.035)]"
                    : "rounded-xl border border-[#DCE4EE] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.05)]"
                }
                style={
                  isFlashcardMobileLayout
                    ? {
                        borderColor: meaningPalette.border,
                        backgroundColor: meaningPalette.background,
                      }
                    : undefined
                }
              >
                {shouldRenderMeaningVideoIndicator ? (
                  <span
                    className="pointer-events-none absolute right-3.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-white/65 shadow-[0_8px_18px_rgba(17,24,39,0.08)]"
                    style={{
                      borderColor: "rgba(37,177,95,0.35)",
                      color: "rgba(37,177,95,0.85)",
                    }}
                    aria-hidden="true"
                  >
                    <Play className="ml-[1px] h-3.5 w-3.5 stroke-[2.3]" />
                  </span>
                ) : null}

                <div
                  className={[
                    "min-w-0",
                    shouldRenderMeaningVideoIndicator ? "pr-12" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {shouldUseMeaningCollapse ? (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedMeaningVideoKey(groupKey);
                      }}
                      className={[
                        "mb-2 w-full text-left transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2",
                        isFlashcardMobileLayout
                          ? ""
                          : "focus-visible:ring-[#CBD5E1]",
                        isFlashcardMobileLayout ? "" : "active:bg-[#EEF4FA]",
                        isMeaningExpanded
                          ? isFlashcardMobileLayout
                            ? "rounded-lg px-1 py-1.5"
                            : "rounded-md px-1.5 py-1.5 hover:bg-[#F8FAFD]"
                          : "border-[#DEE6EF] bg-[#FAFCFF] hover:border-[#C8D6E6] hover:bg-[#F5F8FC]",
                        !isMeaningExpanded ? "rounded-lg border px-2.5 py-2" : "",
                      ].join(" ")}
                      style={
                        isFlashcardMobileLayout
                          ? {
                              borderColor: isMeaningExpanded
                                ? "transparent"
                                : meaningPalette.border,
                              backgroundColor: isMeaningExpanded
                                ? "transparent"
                                : meaningPalette.tipBackground,
                            }
                          : undefined
                      }
                      aria-label={`Mostrar significado ${entry.meaning}`}
                      title={`Mostrar significado ${entry.meaning}`}
                    >
                      <span
                        className={[
                          "flex justify-between gap-3",
                          isMeaningExpanded ? "items-start" : "items-center",
                        ].join(" ")}
                      >
                        <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
                          <span
                            className={isFlashcard ? "font-semibold" : "font-bold"}
                            style={
                              isFlashcardMobileLayout
                                ? { color: meaningPalette.accent }
                                : undefined
                            }
                          >
                            {index + 1}.
                          </span>

                          <span className="font-bold text-[#181818]">
                            {entry.meaning}
                          </span>

                          {entry.category ? (
                            <span className="rounded-full bg-[#EEF2F7] px-2 py-0.5 text-[10px] font-semibold text-[#64748B]">
                              {entry.category}
                            </span>
                          ) : null}
                        </span>

                        {!isFlashcardMobileLayout ? (
                          <Menu
                            className={[
                              "h-3.5 w-3.5 shrink-0 text-[#98A2B3]",
                              isMeaningExpanded ? "mt-0.5" : "self-center",
                            ].join(" ")}
                          />
                        ) : null}
                      </span>
                    </button>
                  ) : (
                    <div
                      className="mb-2 inline-flex max-w-full flex-wrap items-center gap-2 border-b pb-1.5"
                      style={
                        isFlashcardMobileLayout
                          ? { borderBottomColor: meaningPalette.border }
                          : { borderBottomColor: "#E6EDF5" }
                      }
                    >
                      <span
                        className={isFlashcard ? "font-semibold" : "font-bold"}
                        style={
                          isFlashcardMobileLayout
                            ? { color: meaningPalette.accent }
                            : undefined
                        }
                      >
                        {index + 1}.
                      </span>

                      <span className="font-bold text-[#181818]">
                        {entry.meaning}
                      </span>

                      {entry.category ? (
                        <span className="rounded-full bg-[#EEF2F7] px-2 py-0.5 text-[10px] font-semibold text-[#64748B]">
                          {entry.category}
                        </span>
                      ) : null}
                    </div>
                  )}

                  {isMeaningExpanded ? (
                    <>
                      {shouldShowSpecificVideosInsideMeanings &&
                      entry.topVideos.length > 0
                        ? renderTopVideoCarousel({
                            videos: entry.topVideos,
                            groupKey,
                          })
                        : null}

                      {visibleExamples.length > 0 ? (
                        <div
                          className={
                            isFlashcardMobileLayout ? "space-y-2.5" : "border-l-2 border-[#CBD5E1] pl-4"
                          }
                        >
                          <div className={isFlashcardMobileLayout ? "space-y-2.5" : "space-y-1.5"}>
                            {visibleExamples.map((example, exampleIndex) => {
                              const hasSentence = Boolean(example.sentence);
                              const hasTranslation = Boolean(example.translation);

                              return (
                                <div
                                  key={`${entry.meaning}-${index}-${exampleIndex}`}
                                  className={
                                    isFlashcardMobileLayout
                                      ? "flex items-start gap-2.5 rounded-lg px-0.5 py-0.5"
                                      : "space-y-0.5"
                                  }
                                >
                                  {isFlashcardMobileLayout ? (
                                    <span
                                      className="mt-[0.48rem] h-2.5 w-2.5 shrink-0 rounded-full"
                                      style={{ backgroundColor: meaningPalette.bullet }}
                                    />
                                  ) : null}

                                  <div className={isFlashcardMobileLayout ? "min-w-0 space-y-1.5" : ""}>
                                    {hasTranslation ? (
                                      <p
                                        className={
                                          isFlashcardMobileLayout
                                            ? "text-sm font-medium leading-snug text-[#5D6677]"
                                            : "text-xs font-medium leading-snug text-[#758195]"
                                        }
                                      >
                                        {example.translation}
                                      </p>
                                    ) : null}

                                    {hasSentence ? (
                                      <p
                                        className={
                                          isFlashcardMobileLayout
                                            ? "text-[15px] font-semibold leading-snug text-[#101827]"
                                            : "text-sm font-semibold leading-snug text-[#0b0e14]"
                                        }
                                      >
                                        {renderHighlightedTerm(
                                          example.sentence,
                                          highlightTerm,
                                          {
                                            underlineColor: isFlashcardMobileLayout
                                              ? meaningPalette.underline
                                              : "#ED9A0A",
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
                              : "border-l-2 border-[#CBD5E1] pl-4 text-sm italic text-muted-foreground"
                          }
                        >
                          Nenhum exemplo cadastrado.
                        </p>
                      )}
                    </>
                  ) : null}
                </div>

                {isMeaningExpanded && entry.tip ? (
                  <div className="mt-3">
                    <div
                      className={[
                        "inline-flex max-w-full items-start gap-1.5",
                        isFlashcardMobileLayout ? "w-full rounded-lg border px-2.5 py-2" : "pb-1",
                        shouldUseMeaningCollapse || isFlashcardMobileLayout
                          ? ""
                          : "border-b border-[#E6EDF5]",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={
                        isFlashcardMobileLayout
                          ? {
                              borderColor: meaningPalette.tipBorder,
                              backgroundColor: meaningPalette.tipBackground,
                            }
                          : undefined
                      }
                    >
                      <Lightbulb
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        style={{
                          color: isFlashcardMobileLayout
                            ? meaningPalette.accent
                            : "#ED9A0A",
                        }}
                      />
                      <span
                        className={
                          isFlashcardMobileLayout
                            ? "min-w-0 text-xs italic leading-relaxed text-[#5E6778]"
                            : "min-w-0 text-xs italic leading-relaxed text-muted-foreground"
                        }
                      >
                        {entry.tip}
                      </span>
                    </div>
                  </div>
                ) : null}

                {shouldUseMeaningCollapse &&
                isMeaningExpanded &&
                !isFlashcardMobileLayout ? (
                  <div className="mt-2 border-b border-[#E6EDF5]" />
                ) : null}
              </section>
            );
          })}
        </div>
      </div>

      {mobileVideo?.video ? (
        <div
          className="fixed inset-0 z-[9999] bg-black/80"
          role="dialog"
          aria-modal="true"
          aria-label="Vídeo do exemplo"
          onClick={closeMobileVideo}
        >
          <div
            className="absolute left-0 right-0 top-[calc(env(safe-area-inset-top,0px)+7.55vh)] w-screen max-w-none"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="aspect-[5/4] w-full touch-pan-y overflow-hidden bg-black"
              onPointerDown={handleExpandedVideoPointerDown}
              onPointerUp={handleExpandedVideoPointerUp}
              onPointerCancel={handleExpandedVideoPointerCancel}
            >
              <ExampleVideoPlayer
                key={mobileVideo?.key || "mobile-video"}
                video={mobileVideo?.video || ""}
                title={mobileVideo?.title || ""}
                autoPlay={Boolean(mobileVideo?.autoPlay)}
                layout="mobileMockup"
              />
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
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/20 bg-white px-3 py-1.5 text-xs font-bold text-[#14181F] shadow-sm"
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
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/20 bg-white px-3 py-1.5 text-xs font-bold text-[#14181F] shadow-sm"
                >
                  Próximo
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
