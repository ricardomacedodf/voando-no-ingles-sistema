import { useEffect, useMemo, useRef, useState } from "react";
import {
  Gauge,
  Maximize,
  Minimize,
  Pause,
  Play,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { resolveExampleVideoPlayback } from "@/lib/exampleVideoStorage";

const FALLBACK_MESSAGE = "Este vÃ­deo nÃ£o permite reproduÃ§Ã£o direta aqui.";
const FULLSCREEN_CONTROLS_HIDE_DELAY = 1000;
const PLAYBACK_SPEED_OPTIONS = [0.3, 0.5, 0.8, 1];
const MIN_PLAYBACK_SPEED = 0.3;
const MAX_PLAYBACK_SPEED = 1;
const PLAYBACK_SPEED_STEP = 0.01;
const TIMELINE_KEYBOARD_STEP_SECONDS = 5;
const videoPlaybackStateCache = new Map();

function GlassControlButton({
  label,
  onClick,
  children,
  active = false,
  variant = "normal",
}) {
  const sizeClass =
    variant === "primary"
      ? "h-[clamp(3.4rem,16vw,5rem)] w-[clamp(3.4rem,16vw,5rem)] md:h-[2.875rem] md:w-[2.875rem]"
      : variant === "fullscreen"
      ? "h-[clamp(2.6rem,12vw,3.5rem)] w-[clamp(2.6rem,12vw,3.5rem)] md:h-[2.15rem] md:w-[2.15rem]"
      : "h-[clamp(2.6rem,12vw,3.5rem)] w-[clamp(2.6rem,12vw,3.5rem)] md:h-8 md:w-8";

  const iconClass =
    variant === "primary"
      ? "relative z-10 flex h-full w-full items-center justify-center [&_svg]:h-[clamp(1.45rem,6vw,2.35rem)] [&_svg]:w-[clamp(1.45rem,6vw,2.35rem)] [&_svg]:stroke-[1.8] md:[&_svg]:h-[1.35rem] md:[&_svg]:w-[1.35rem]"
      : variant === "fullscreen"
      ? "relative z-10 flex h-full w-full items-center justify-center [&_svg]:h-[clamp(1.05rem,4.6vw,1.75rem)] [&_svg]:w-[clamp(1.05rem,4.6vw,1.75rem)] [&_svg]:stroke-[1.9] md:[&_svg]:h-[1.05rem] md:[&_svg]:w-[1.05rem]"
      : "relative z-10 flex h-full w-full items-center justify-center [&_svg]:h-[clamp(1.05rem,4.6vw,1.75rem)] [&_svg]:w-[clamp(1.05rem,4.6vw,1.75rem)] [&_svg]:stroke-[1.9] md:[&_svg]:h-4 md:[&_svg]:w-4";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.currentTarget.blur();
        onClick?.(event);
      }}
      onMouseDown={(event) => {
        if (event.button === 0) event.preventDefault();
      }}
      onPointerUp={(event) => event.currentTarget.blur()}
      onTouchEnd={(event) => event.currentTarget.blur()}
      aria-label={label}
      title={label}
      className={[
        "example-video-player-control-button relative shrink-0 overflow-hidden rounded-full",
        "border border-white/25",
        "bg-white/10 text-white",
        "shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-14px_28px_rgba(0,0,0,0.18),0_14px_34px_rgba(0,0,0,0.42)]",
        "backdrop-blur-md",
        "transition-all duration-200",
        "hover:bg-white/16 hover:border-white/35 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),inset_0_-14px_28px_rgba(0,0,0,0.2),0_18px_42px_rgba(0,0,0,0.5)]",
        "active:bg-white/[0.14] active:border-white/35",
        "outline-none ring-0 ring-offset-0",
        "focus:!outline-none focus-visible:!outline-none focus:!ring-0 focus-visible:!ring-0 focus:!ring-offset-0 focus-visible:!ring-offset-0",
        active ? "bg-white/20 border-white/45" : "",
        variant === "primary"
          ? "shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),inset_0_-18px_34px_rgba(0,0,0,0.22),0_18px_48px_rgba(0,0,0,0.52),0_0_24px_rgba(255,255,255,0.12)]"
          : "",
        sizeClass,
      ].join(" ")}
    >
      <span className="pointer-events-none absolute inset-x-[18%] top-[12%] h-[26%] rounded-full bg-white/20 blur-[10px]" />
      <span className={iconClass}>{children}</span>
    </button>
  );
}

function LoopPowerIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M7.25 5.2H3.95v3.35"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.35 8.1A8.25 8.25 0 1 0 12 3.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpeedFeedbackDirectionIcon({ direction = 1, className = "" }) {
  const isDecrease = direction < 0;

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {isDecrease ? (
        <>
          <path
            d="M11.1 6.35 4.9 12l6.2 5.65V6.35Z"
            fill="currentColor"
          />
          <path
            d="M19.1 6.35 12.9 12l6.2 5.65V6.35Z"
            fill="currentColor"
          />
        </>
      ) : (
        <>
          <path
            d="M4.9 6.35 11.1 12l-6.2 5.65V6.35Z"
            fill="currentColor"
          />
          <path
            d="M12.9 6.35 19.1 12l-6.2 5.65V6.35Z"
            fill="currentColor"
          />
        </>
      )}
    </svg>
  );
}

function VideoFallback({ layout = "fill" }) {
  const isMobileMockupLayout = layout === "mobileMockup" || layout === "mobileFullscreen";

  return (
    <div
      className={
        isMobileMockupLayout
          ? "flex h-full w-full flex-col items-center justify-center bg-black p-4 text-center text-xs font-medium text-white"
          : layout === "natural"
          ? "flex min-h-[180px] w-full flex-col items-center justify-center rounded-xl bg-black p-4 text-center text-xs font-medium text-white"
          : "flex h-full w-full flex-col items-center justify-center bg-black p-4 text-center text-xs font-medium text-white"
      }
    >
      <p>{FALLBACK_MESSAGE}</p>
    </div>
  );
}

function addAutoplayToUrl(src) {
  if (!src || typeof src !== "string") return src;

  try {
    const url = new URL(src, window.location.origin);
    url.searchParams.set("autoplay", "1");
    return url.toString();
  } catch {
    return src;
  }
}

const normalizeVideoValue = (value) =>
  typeof value === "string" ? value.trim() : "";

const formatPlaybackRateLabel = (rate) => {
  const safeRate = Number(rate);

  if (!Number.isFinite(safeRate)) return "1x";

  return `${Number.isInteger(safeRate) ? safeRate : safeRate.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}x`;
};

const getVideoPlaybackStateKey = (value) => normalizeVideoValue(value);

const extractIframeSrcFromValue = (value) => {
  const cleanValue = normalizeVideoValue(value);
  if (!cleanValue) return "";

  const match = cleanValue.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return normalizeVideoValue(match?.[1] || "");
};

const extractFirstUrlFromValue = (value) => {
  const cleanValue = normalizeVideoValue(value);
  if (!cleanValue) return "";

  const match = cleanValue.match(/https?:\/\/[^\s"'<>[\]]+/i);
  return normalizeVideoValue(match?.[0] || "");
};

const getYouTubeVideoIdFromValue = (value) => {
  const cleanValue = normalizeVideoValue(value);
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

const getVimeoVideoIdFromValue = (value) => {
  const cleanValue = normalizeVideoValue(value);
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

const getDailymotionVideoIdFromValue = (value) => {
  const cleanValue = normalizeVideoValue(value);
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

const cleanEmbedSourceUrl = (value) => {
  const cleanValue = normalizeVideoValue(value);
  if (!cleanValue) return "";

  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "https://local";
    const url = new URL(cleanValue, base);

    url.searchParams.delete("autoplay");
    url.searchParams.delete("autoPlay");
    url.searchParams.delete("mute");
    url.searchParams.delete("muted");

    return url.toString();
  } catch {
    return cleanValue;
  }
};

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

const getImmediateEmbedPlayback = (value) => {
  const cleanValue = normalizeVideoValue(value);
  if (!isLikelyThirdPartyEmbedValue(cleanValue)) return null;

  const iframeSrc = extractIframeSrcFromValue(cleanValue);
  if (iframeSrc) {
    const safeSrc = cleanEmbedSourceUrl(iframeSrc);
    return {
      type: "iframe",
      src: safeSrc,
      originalUrl: cleanValue,
      openUrl: safeSrc,
    };
  }

  const youtubeId = getYouTubeVideoIdFromValue(cleanValue);
  if (youtubeId) {
    const src = `https://www.youtube.com/embed/${youtubeId}`;
    return {
      type: "iframe",
      src,
      originalUrl: cleanValue,
      openUrl: src,
    };
  }

  const vimeoId = getVimeoVideoIdFromValue(cleanValue);
  if (vimeoId) {
    const src = `https://player.vimeo.com/video/${vimeoId}`;
    return {
      type: "iframe",
      src,
      originalUrl: cleanValue,
      openUrl: src,
    };
  }

  const dailymotionId = getDailymotionVideoIdFromValue(cleanValue);
  if (dailymotionId) {
    const src = `https://www.dailymotion.com/embed/video/${dailymotionId}`;
    return {
      type: "iframe",
      src,
      originalUrl: cleanValue,
      openUrl: src,
    };
  }

  const firstUrl = extractFirstUrlFromValue(cleanValue);
  if (firstUrl) {
    const safeSrc = cleanEmbedSourceUrl(firstUrl);
    return {
      type: "iframe",
      src: safeSrc,
      originalUrl: cleanValue,
      openUrl: safeSrc,
    };
  }

  return null;
};

const isClipCafeEmbed = (value) =>
  normalizeVideoValue(value).toLowerCase().includes("clip.cafe");

const getClipCafeFrameStyle = ({ isMobileLayout }) => {
  // No mobile o iframe precisa obedecer exatamente o tamanho do wrapper.
  // Usar transform/medidas em dvw/dvh aqui fazia o ClipCafe manter o layout
  // interno antigo em alguns navegadores, principalmente Safari, gerando corte.
  if (isMobileLayout) return undefined;

  return {
    left: "51%",
    top: "50%",
    width: "107%",
    height: "107%",
    transform: "translate(-50%, -50%) scale(0.95)",
    transformOrigin: "center center",
    clipPath: "inset(0.5px)",
  };
};

const getEmbedFrameStyle = ({ embedSrc, isMobileLayout, isMobileLandscape }) => {
  if (isClipCafeEmbed(embedSrc)) {
    return getClipCafeFrameStyle({ isMobileLayout, isMobileLandscape });
  }

  return undefined;
};

export default function ExampleVideoPlayer({
  video,
  title = "VÃ­deo do exemplo",
  autoPlay = false,
  layout = "fill",
  controlsMode = "full",
  resetPlaybackOnMount = false,
}) {
  const isMobileMockupLayout = layout === "mobileMockup";
  const isMobileFullscreenLayout = layout === "mobileFullscreen";
  const isCompactControlsMode = controlsMode === "compact";
  const isCompactLayout = layout === "compact";

  const videoRef = useRef(null);
  const wrapperRef = useRef(null);
  const volumeControlRef = useRef(null);
  const speedControlRef = useRef(null);
  const speedFeedbackTimerRef = useRef(null);
  const playbackControlFeedbackTimerRef = useRef(null);
  const hideFullscreenControlsTimerRef = useRef(null);
  const restorePlaybackTimerRef = useRef(null);
  const hasConsumedAutoPlayRef = useRef(false);
  const hasRestoredPlaybackRef = useRef(false);
  const orientationLockRequestedRef = useRef(false);
  const playbackStateRef = useRef({
    key: "",
    currentTime: 0,
    duration: 0,
    wasPlaying: false,
  });

  const [playback, setPlayback] = useState(null);
  const [failed, setFailed] = useState(false);

  const [isTouchLike, setIsTouchLike] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isVolumeControlOpen, setIsVolumeControlOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [playbackRateFeedback, setPlaybackRateFeedback] = useState(null);
  const [playbackControlFeedback, setPlaybackControlFeedback] = useState(null);
  const [isLooping, setIsLooping] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mediaSize, setMediaSize] = useState(null);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  const playbackStateKey = useMemo(() => getVideoPlaybackStateKey(video), [video]);
  const shouldResetPlaybackOnMount = Boolean(resetPlaybackOnMount);
  const savedOwnVideoPlaybackState =
    playbackStateKey &&
    !shouldResetPlaybackOnMount &&
    !isLikelyThirdPartyEmbedValue(playbackStateKey)
      ? videoPlaybackStateCache.get(playbackStateKey)
      : null;
  const shouldUseNativeVideoAutoPlay = Boolean(
    autoPlay &&
      (shouldResetPlaybackOnMount ||
        !savedOwnVideoPlaybackState ||
        !Number.isFinite(savedOwnVideoPlaybackState.currentTime) ||
        savedOwnVideoPlaybackState.currentTime <= 0.2)
  );

  useEffect(() => {
    const checkMobileLandscape = () => {
      if (typeof window === "undefined") return;

      const viewportWidth = window.innerWidth || 0;
      const viewportHeight = window.innerHeight || 0;

      setIsMobileLandscape(
        Boolean(
          (isMobileMockupLayout || isMobileFullscreenLayout) &&
            viewportWidth > viewportHeight
        )
      );
    };

    checkMobileLandscape();
    window.addEventListener("resize", checkMobileLandscape);
    window.addEventListener("orientationchange", checkMobileLandscape);

    return () => {
      window.removeEventListener("resize", checkMobileLandscape);
      window.removeEventListener("orientationchange", checkMobileLandscape);
    };
  }, [isMobileMockupLayout, isMobileFullscreenLayout]);

  useEffect(() => {
    const checkTouchLike = () => {
      const hasTouch =
        window.matchMedia?.("(hover: none), (pointer: coarse)")?.matches ||
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0;

      setIsTouchLike(Boolean(hasTouch));
    };

    checkTouchLike();
    window.addEventListener("resize", checkTouchLike);

    return () => {
      window.removeEventListener("resize", checkTouchLike);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const normalizedVideo = typeof video === "string" ? video.trim() : "";
    const immediateEmbedPlayback = getImmediateEmbedPlayback(normalizedVideo);
    const normalizedPlaybackStateKey = getVideoPlaybackStateKey(normalizedVideo);
    const shouldResetThisPlayback =
      Boolean(resetPlaybackOnMount) &&
      normalizedPlaybackStateKey &&
      !isLikelyThirdPartyEmbedValue(normalizedPlaybackStateKey);
    const savedPlaybackState = shouldResetThisPlayback
      ? null
      : videoPlaybackStateCache.get(normalizedPlaybackStateKey);

    if (shouldResetThisPlayback) {
      videoPlaybackStateCache.delete(normalizedPlaybackStateKey);
      playbackStateRef.current = {
        key: normalizedPlaybackStateKey,
        currentTime: 0,
        duration: 0,
        wasPlaying: false,
      };
    }

    hasConsumedAutoPlayRef.current = false;
    hasRestoredPlaybackRef.current = shouldResetThisPlayback;

    setPlayback(immediateEmbedPlayback || null);
    setFailed(false);
    setIsPlaying(shouldResetThisPlayback ? false : Boolean(savedPlaybackState?.wasPlaying));
    setControlsVisible(false);
    setIsVolumeControlOpen(false);
    setIsSpeedMenuOpen(false);
    setCurrentTime(shouldResetThisPlayback ? 0 : savedPlaybackState?.currentTime || 0);
    setDuration(shouldResetThisPlayback ? 0 : savedPlaybackState?.duration || 0);
    setBufferedTime(0);
    setIsLooping(true);
    setMediaSize(null);
    clearFullscreenControlsTimer();

    if (restorePlaybackTimerRef.current) {
      window.clearTimeout(restorePlaybackTimerRef.current);
      restorePlaybackTimerRef.current = null;
    }

    if (!normalizedVideo) {
      setPlayback({
        type: "fallback",
        originalUrl: "",
        openUrl: "",
      });

      return () => {
        isMounted = false;
      };
    }

    if (immediateEmbedPlayback) {
      return () => {
        isMounted = false;
        clearFullscreenControlsTimer();
      };
    }

    resolveExampleVideoPlayback(normalizedVideo)
      .then((nextPlayback) => {
        if (isMounted) setPlayback(nextPlayback);
      })
      .catch((error) => {
        console.error("Erro ao carregar o vÃ­deo do exemplo:", error);

        if (isMounted) {
          setPlayback({
            type: "fallback",
            originalUrl: normalizedVideo,
            openUrl: "",
          });
        }
      });

    return () => {
      isMounted = false;
      clearFullscreenControlsTimer();
    };
  }, [video, resetPlaybackOnMount]);

  useEffect(() => {
    return () => {
      saveOwnVideoPlaybackState();

      if (restorePlaybackTimerRef.current) {
        window.clearTimeout(restorePlaybackTimerRef.current);
        restorePlaybackTimerRef.current = null;
      }
    };
  }, [playbackStateKey]);

  useEffect(() => {
    const player = videoRef.current;

    if (!player) return;

    player.volume = volume;
    player.muted = isMuted;
    player.loop = isLooping;
    player.playbackRate = playbackRate;

    player.disablePictureInPicture = true;
    player.disableRemotePlayback = true;

    player.setAttribute("disablepictureinpicture", "");
    player.setAttribute("disableremoteplayback", "");
    player.setAttribute(
      "controlsList",
      "nodownload nofullscreen noremoteplayback"
    );
    player.setAttribute("x-webkit-airplay", "deny");
    player.setAttribute("webkit-playsinline", "true");
  }, [volume, isMuted, isLooping, playbackRate, playback?.src]);

  useEffect(() => {
    if (!isVolumeControlOpen && !isSpeedMenuOpen) return;

    const handlePointerDown = (event) => {
      const target = event.target;

      if (
        volumeControlRef.current?.contains(target) ||
        speedControlRef.current?.contains(target)
      ) {
        return;
      }

      setIsVolumeControlOpen(false);
      setIsSpeedMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isVolumeControlOpen, isSpeedMenuOpen]);

  useEffect(() => {
    const pauseWhenPageIsHidden = () => {
      const player = videoRef.current;

      if (player) {
        saveOwnVideoPlaybackState({
          wasPlaying: !player.paused && !player.ended,
        });

        if (!player.paused) {
          player.pause();
        }
      }

      clearFullscreenControlsTimer();
      setIsPlaying(false);
      setControlsVisible(true);
      clearSystemMediaSession();
    };

    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState !== "visible") {
        pauseWhenPageIsHidden();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", pauseWhenPageIsHidden);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", pauseWhenPageIsHidden);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      clearSystemMediaSession();
    }
  }, [isPlaying]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement =
        document.fullscreenElement || document.webkitFullscreenElement;

      const nextIsFullscreen = Boolean(fullscreenElement);

      setIsFullscreen(nextIsFullscreen);

      if (nextIsFullscreen) {
        showControlsTemporarilyInFullscreen();
        return;
      }

      if (!nextIsFullscreen) {
        unlockMobileFullscreenLandscape();
        clearFullscreenControlsTimer();
        setControlsVisible(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
    };
  }, [isPlaying]);

  useEffect(() => {
    if (isFullscreen) {
      showControlsTemporarilyInFullscreen();
      return;
    }

    clearFullscreenControlsTimer();
  }, [isFullscreen, isPlaying]);

  useEffect(() => {
    const player = videoRef.current;

    if (!player) return;

    const handleVideoFullscreenStart = () => {
      setIsFullscreen(true);
      showControlsTemporarilyInFullscreen();
    };

    const handleVideoFullscreenEnd = () => {
      unlockMobileFullscreenLandscape();
      setIsFullscreen(false);
      clearFullscreenControlsTimer();
      setControlsVisible(false);
    };

    player.addEventListener("webkitbeginfullscreen", handleVideoFullscreenStart);
    player.addEventListener("webkitendfullscreen", handleVideoFullscreenEnd);

    return () => {
      player.removeEventListener(
        "webkitbeginfullscreen",
        handleVideoFullscreenStart
      );
      player.removeEventListener(
        "webkitendfullscreen",
        handleVideoFullscreenEnd
      );
    };
  }, [playback?.src, isPlaying]);

  useEffect(() => {
    if (!playback || playback.type === "fallback") return;

    const isNativeVideoPlayback = playback.type === "video";

    const handlePlayerKeyboardShortcut = (event) => {
      const activeElement = document.activeElement;
      const isEditingText =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable);

      if (isEditingText) return;

      const key = event.key;
      const normalizedKey = typeof key === "string" ? key.toLowerCase() : "";

      if (
        isNativeVideoPlayback &&
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        (key === "ArrowLeft" || event.code === "ArrowLeft")
      ) {
        event.preventDefault();
        stepVolume(-1, { preserveControlsAutoHide: true });
        return;
      }

      if (
        isNativeVideoPlayback &&
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        (key === "ArrowRight" || event.code === "ArrowRight")
      ) {
        event.preventDefault();
        stepVolume(1, { preserveControlsAutoHide: true });
        return;
      }

      if (
        isNativeVideoPlayback &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        (key === "ArrowLeft" || event.code === "ArrowLeft")
      ) {
        event.preventDefault();
        seekTimelineByKeyboardStep(-1);
        return;
      }

      if (
        isNativeVideoPlayback &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        (key === "ArrowRight" || event.code === "ArrowRight")
      ) {
        event.preventDefault();
        seekTimelineByKeyboardStep(1);
        return;
      }

      if (isNativeVideoPlayback && event.shiftKey) {
        if (key === "[" || key === "{" || key === "<" || key === ",") {
          event.preventDefault();
          stepPlaybackRate(-1, { showFeedback: true, preserveControlsAutoHide: true });
          return;
        }

        if (key === "]" || key === "}" || key === ">" || key === ".") {
          event.preventDefault();
          stepPlaybackRate(1, { showFeedback: true, preserveControlsAutoHide: true });
          return;
        }
      }

      if (
        isNativeVideoPlayback &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        (key === "0" || event.code === "Digit0" || event.code === "Numpad0")
      ) {
        event.preventDefault();

        if (event.repeat) return;

        seekToBeginningFromKeyboard();
        return;
      }

      if (
        isNativeVideoPlayback &&
        (key === " " || key === "Spacebar" || event.code === "Space")
      ) {
        event.preventDefault();

        if (event.repeat) return;

        togglePlay({ showFeedback: true });
        return;
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && normalizedKey === "f") {
        event.preventDefault();

        if (event.repeat) return;

        toggleFullscreen();
        return;
      }

      if (
        isNativeVideoPlayback &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        normalizedKey === "m"
      ) {
        event.preventDefault();

        if (event.repeat) return;

        toggleMute({ preserveControlsAutoHide: true });
      }
    };

    document.addEventListener("keydown", handlePlayerKeyboardShortcut);

    return () => {
      document.removeEventListener("keydown", handlePlayerKeyboardShortcut);
    };
  }, [playback, playbackRate, isMuted, isFullscreen, isPlaying, currentTime, duration]);

  useEffect(() => {
    return () => {
      if (speedFeedbackTimerRef.current) {
        window.clearTimeout(speedFeedbackTimerRef.current);
        speedFeedbackTimerRef.current = null;
      }

      if (playbackControlFeedbackTimerRef.current) {
        window.clearTimeout(playbackControlFeedbackTimerRef.current);
        playbackControlFeedbackTimerRef.current = null;
      }
    };
  }, []);

  const iframeSrc = useMemo(() => {
    if (!playback?.src) return "";
    return autoPlay ? addAutoplayToUrl(playback.src) : playback.src;
  }, [playback?.src, autoPlay]);

  const mediaAspect =
    mediaSize?.width && mediaSize?.height
      ? mediaSize.width / mediaSize.height
      : null;

  const progressPercent =
    duration > 0
      ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
      : 0;

  const bufferedPercent =
    duration > 0
      ? Math.min(
          100,
          Math.max(
            progressPercent,
            (Math.min(duration, Math.max(0, bufferedTime)) / duration) * 100
          )
        )
      : progressPercent;

  const progressStyle = {
    background: `linear-gradient(to right, #ff1744 0%, #ff1744 ${progressPercent}%, rgba(255,255,255,0.58) ${progressPercent}%, rgba(255,255,255,0.58) ${bufferedPercent}%, rgba(255,255,255,0.28) ${bufferedPercent}%, rgba(255,255,255,0.28) 100%)`,
  };

  const volumePercent = isMuted ? 0 : Math.round(volume * 100);

  const volumeStyle = {
    background: `linear-gradient(to right, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.92) ${volumePercent}%, rgba(255,255,255,0.22) ${volumePercent}%, rgba(255,255,255,0.22) 100%)`,
  };

  const playbackRatePercent = Math.min(
    100,
    Math.max(
      0,
      ((playbackRate - MIN_PLAYBACK_SPEED) /
        (MAX_PLAYBACK_SPEED - MIN_PLAYBACK_SPEED)) *
        100
    )
  );

  const playbackRateStyle = {
    background: `linear-gradient(to right, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.92) ${playbackRatePercent}%, rgba(255,255,255,0.22) ${playbackRatePercent}%, rgba(255,255,255,0.22) 100%)`,
  };

  const isWebOwnPlayerControls = !isTouchLike && !isMobileMockupLayout;
  const shouldShowVolumeControl = isWebOwnPlayerControls && isVolumeControlOpen;
  const playbackRateLabel = formatPlaybackRateLabel(playbackRate);

  const naturalFrameStyle =
    layout === "natural"
      ? mediaAspect
        ? {
            width:
              mediaAspect >= 1
                ? "100%"
                : `${Math.max(32, Math.min(86 * mediaAspect, 92))}dvh`,
            maxWidth: mediaAspect >= 1 ? "920px" : "100%",
            maxHeight: "86dvh",
            aspectRatio: `${mediaSize.width} / ${mediaSize.height}`,
          }
        : {
            width: "100%",
            maxWidth: "920px",
            maxHeight: "86dvh",
            aspectRatio: "16 / 9",
          }
      : undefined;

  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement;
  }

  function isFullscreenMode() {
    return Boolean(getFullscreenElement()) || isFullscreen;
  }

  function clearFullscreenControlsTimer() {
    if (hideFullscreenControlsTimerRef.current) {
      clearTimeout(hideFullscreenControlsTimerRef.current);
      hideFullscreenControlsTimerRef.current = null;
    }
  }

  function scheduleFullscreenControlsHide() {
    clearFullscreenControlsTimer();

    hideFullscreenControlsTimerRef.current = setTimeout(() => {
      if (isFullscreenMode() && !isVolumeControlOpen && !isSpeedMenuOpen) {
        setControlsVisible(false);
      }
    }, FULLSCREEN_CONTROLS_HIDE_DELAY);
  }

  function showControlsTemporarilyInFullscreen() {
    setControlsVisible(true);
    scheduleFullscreenControlsHide();
  }

  function clearSystemMediaSession() {
    if (!("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
    } catch {
      // Alguns navegadores iOS ignoram parte da Media Session API.
    }
  }

  function getSavedOwnVideoPlaybackState() {
    if (
      !playbackStateKey ||
      shouldResetPlaybackOnMount ||
      isLikelyThirdPartyEmbedValue(playbackStateKey)
    ) {
      return null;
    }

    return videoPlaybackStateCache.get(playbackStateKey) || null;
  }

  function saveOwnVideoPlaybackState(overrides = {}) {
    if (!playbackStateKey || isLikelyThirdPartyEmbedValue(playbackStateKey)) {
      return;
    }

    const player = videoRef.current;
    const playerCurrentTime = Number.isFinite(player?.currentTime)
      ? player.currentTime
      : playbackStateRef.current.currentTime || 0;
    const playerDuration = Number.isFinite(player?.duration)
      ? player.duration
      : playbackStateRef.current.duration || 0;
    const nextState = {
      ...playbackStateRef.current,
      key: playbackStateKey,
      currentTime: Math.max(0, playerCurrentTime),
      duration: Math.max(0, playerDuration),
      wasPlaying:
        typeof overrides.wasPlaying === "boolean"
          ? overrides.wasPlaying
          : player
          ? !player.paused && !player.ended
          : Boolean(playbackStateRef.current.wasPlaying),
      ...overrides,
    };

    playbackStateRef.current = nextState;
    videoPlaybackStateCache.set(playbackStateKey, nextState);
  }

  function restoreOwnVideoPlaybackState(player) {
    if (!player || hasRestoredPlaybackRef.current) return;

    const savedPlaybackState = getSavedOwnVideoPlaybackState();
    const savedTime = savedPlaybackState?.currentTime || 0;

    if (!savedPlaybackState || savedTime <= 0.2) {
      hasRestoredPlaybackRef.current = true;
      return;
    }

    const safeDuration = Number.isFinite(player.duration) && player.duration > 0
      ? player.duration
      : savedPlaybackState.duration || 0;
    const safeTime = safeDuration > 0
      ? Math.min(savedTime, Math.max(0, safeDuration - 0.25))
      : savedTime;

    try {
      player.currentTime = safeTime;
      setCurrentTime(safeTime);
      hasRestoredPlaybackRef.current = true;
    } catch {
      restorePlaybackTimerRef.current = window.setTimeout(() => {
        try {
          player.currentTime = safeTime;
          setCurrentTime(safeTime);
          hasRestoredPlaybackRef.current = true;
        } catch {
          hasRestoredPlaybackRef.current = true;
        }
      }, 120);
    }
  }

  function shouldResumeOwnVideoPlayback() {
    const savedPlaybackState = getSavedOwnVideoPlaybackState();

    if (savedPlaybackState) {
      return Boolean(savedPlaybackState.wasPlaying);
    }

    return Boolean(autoPlay);
  }

  function lockMobileFullscreenLandscape() {
    if (!isMobileMockupLayout) return;
    if (typeof window === "undefined") return;

    const orientation = window.screen?.orientation;

    if (!orientation?.lock) return;

    orientation
      .lock("landscape")
      .then(() => {
        orientationLockRequestedRef.current = true;
      })
      .catch(() => {
        // Nem todo navegador permite travar a orientaÃ§Ã£o.
        // Quando nÃ£o permitir, o player continua proporcional sem cortar.
      });
  }

  function unlockMobileFullscreenLandscape() {
    if (!orientationLockRequestedRef.current) return;
    if (typeof window === "undefined") return;

    try {
      window.screen?.orientation?.unlock?.();
    } catch {
      // noop
    }

    orientationLockRequestedRef.current = false;
  }

  function showControls() {
    setControlsVisible(true);

    if (isFullscreenMode()) {
      showControlsTemporarilyInFullscreen();
    }
  }

  function hideControls() {
    if (isFullscreenMode()) return;

    clearFullscreenControlsTimer();
    setIsVolumeControlOpen(false);
    setIsSpeedMenuOpen(false);
    setControlsVisible(false);
  }

  function toggleControlsVisibility() {
    setControlsVisible((current) => !current);
  }

  function getControlButtonFromEvent(event) {
    const target = event?.target;
    if (!target?.closest) return null;

    const button = target.closest("button");
    if (!button || !wrapperRef.current?.contains(button)) return null;

    return button;
  }

  function preventControlButtonFocus(event) {
    const button = getControlButtonFromEvent(event);
    if (!button) return;

    if (typeof event.button === "number" && event.button !== 0) return;

    event.preventDefault();
  }

  function blurControlButtonAfterInteraction(event) {
    const button = getControlButtonFromEvent(event);
    if (!button) return;

    window.requestAnimationFrame(() => {
      button.blur();
    });
  }

  function handleMouseEnter() {
    if (isFullscreenMode()) {
      showControlsTemporarilyInFullscreen();
      return;
    }

    if (isTouchLike || isMobileMockupLayout) return;

    showControls();
  }

  function handleMouseMove() {
    if (isFullscreenMode()) {
      showControlsTemporarilyInFullscreen();
      return;
    }

    if (isTouchLike || isMobileMockupLayout) return;

    showControls();
  }

  function handleTouchStart() {
    if (isFullscreenMode()) {
      showControlsTemporarilyInFullscreen();
    }
  }

  function handleMouseLeave() {
    if (isFullscreenMode()) return;
    if (isTouchLike || isMobileMockupLayout) return;

    if (isVolumeControlOpen || isSpeedMenuOpen) {
      setControlsVisible(true);
      return;
    }

    if (isCompactControlsMode && !isPlaying) {
      setControlsVisible(true);
      return;
    }

    hideControls();
  }

  function showPlaybackControlFeedback(action) {
    if (playbackControlFeedbackTimerRef.current) {
      window.clearTimeout(playbackControlFeedbackTimerRef.current);
      playbackControlFeedbackTimerRef.current = null;
    }

    setPlaybackControlFeedback(action);

    playbackControlFeedbackTimerRef.current = window.setTimeout(() => {
      setPlaybackControlFeedback(null);
      playbackControlFeedbackTimerRef.current = null;
    }, 500);
  }

  function togglePlay(options = {}) {
    const player = videoRef.current;

    if (!player) return;

    if (player.paused) {
      player
        .play()
        .then(() => {
          saveOwnVideoPlaybackState({ wasPlaying: true });
          setIsPlaying(true);

          if (options?.showFeedback) {
            showPlaybackControlFeedback("play");
          }

          if (isFullscreenMode()) {
            showControlsTemporarilyInFullscreen();
            return;
          }

          setControlsVisible(false);
        })
        .catch(() => {
          setIsPlaying(false);
          setControlsVisible(true);
          clearSystemMediaSession();
        });

      return;
    }

    saveOwnVideoPlaybackState({ wasPlaying: false });
    player.pause();
    setIsPlaying(false);

    if (isFullscreenMode()) {
      showControlsTemporarilyInFullscreen();
    } else if (isCompactControlsMode) {
      setControlsVisible(true);
    } else {
      setControlsVisible(false);
    }

    if (options?.showFeedback) {
      showPlaybackControlFeedback("pause");
    }

    clearSystemMediaSession();
  }

  function restartFromBeginning() {
    const player = videoRef.current;
    if (!player) return;

    hasConsumedAutoPlayRef.current = true;
    player.pause();

    try {
      player.currentTime = 0;
    } catch {
      return;
    }

    saveOwnVideoPlaybackState({ currentTime: 0, wasPlaying: false });
    setCurrentTime(0);
    setIsPlaying(false);
    showControls();
    clearSystemMediaSession();
  }

  function seekTimelineByKeyboardStep(direction) {
    const player = videoRef.current;
    if (!player) return;

    const safeDirection = direction < 0 ? -1 : 1;
    const safeDuration =
      Number.isFinite(player.duration) && player.duration > 0
        ? player.duration
        : duration;
    const baseTime = Number.isFinite(player.currentTime)
      ? player.currentTime
      : currentTime || 0;
    const maxTime = safeDuration > 0 ? safeDuration : Number.MAX_SAFE_INTEGER;
    const nextTime = Math.min(
      maxTime,
      Math.max(0, baseTime + safeDirection * TIMELINE_KEYBOARD_STEP_SECONDS)
    );

    try {
      player.currentTime = nextTime;
    } catch {
      return;
    }

    setCurrentTime(nextTime);
    updateBufferedProgress(player);
    saveOwnVideoPlaybackState({
      currentTime: nextTime,
      duration: safeDuration || duration || 0,
      wasPlaying: !player.paused && !player.ended,
    });

    if (isFullscreenMode()) {
      showControlsTemporarilyInFullscreen();
    } else {
      showControls();
    }
  }

  function seekToBeginningFromKeyboard() {
    const player = videoRef.current;
    if (!player) return;

    const shouldKeepPlaying = !player.paused && !player.ended;

    hasConsumedAutoPlayRef.current = true;

    try {
      player.currentTime = 0;
    } catch {
      return;
    }

    setCurrentTime(0);

    if (shouldKeepPlaying) {
      saveOwnVideoPlaybackState({ currentTime: 0, wasPlaying: true });
      setIsPlaying(true);

      if (player.paused) {
        player.play().catch(() => {
          saveOwnVideoPlaybackState({ currentTime: 0, wasPlaying: false });
          setIsPlaying(false);
          clearSystemMediaSession();
        });
      }

      return;
    }

    player.pause();
    saveOwnVideoPlaybackState({ currentTime: 0, wasPlaying: false });
    setIsPlaying(false);

    window.requestAnimationFrame?.(() => {
      const currentPlayer = videoRef.current;
      if (!currentPlayer) return;

      try {
        currentPlayer.pause();
        currentPlayer.currentTime = 0;
      } catch {
        // Mantém o estado pausado mesmo se o navegador bloquear o seek final.
      }

      saveOwnVideoPlaybackState({ currentTime: 0, wasPlaying: false });
      setCurrentTime(0);
      setIsPlaying(false);
      clearSystemMediaSession();
    });
  }

  function handleVideoClick() {
    if (isFullscreenMode()) {
      togglePlay({ showFeedback: true });
      return;
    }

    if (isMobileMockupLayout) {
      toggleControlsVisibility();
      return;
    }

    togglePlay();
  }

  function updateBufferedProgress(player) {
    if (!player) return;

    const safeDuration = Number.isFinite(player.duration)
      ? player.duration
      : duration;

    if (!safeDuration || safeDuration <= 0 || !player.buffered?.length) {
      setBufferedTime(0);
      return;
    }

    let nextBufferedTime = 0;

    for (let index = 0; index < player.buffered.length; index += 1) {
      const rangeEnd = player.buffered.end(index);

      if (Number.isFinite(rangeEnd)) {
        nextBufferedTime = Math.max(nextBufferedTime, rangeEnd);
      }
    }

    setBufferedTime(Math.min(safeDuration, nextBufferedTime));
  }

  function handleSeek(event) {
    const player = videoRef.current;
    const nextTime = Number(event.target.value);

    if (!player || !Number.isFinite(nextTime)) return;

    player.currentTime = nextTime;
    setCurrentTime(nextTime);
    updateBufferedProgress(player);
    saveOwnVideoPlaybackState({ currentTime: nextTime });
    showControls();
  }

  function handleVolumeChange(event) {
    const nextVolume = Number(event.target.value);

    if (!Number.isFinite(nextVolume)) return;

    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
    setIsVolumeControlOpen(true);
    showControls();
  }

  function handleVolumeMouseEnter() {
    if (!isWebOwnPlayerControls) return;

    showControls();
  }

  function handleVolumeButtonClick() {
    if (!isWebOwnPlayerControls) {
      toggleMute();
      return;
    }

    setIsSpeedMenuOpen(false);
    setIsVolumeControlOpen((current) => !current);
    showControls();
  }

  function toggleMute(options = {}) {
    setIsMuted((current) => !current);

    if (options?.preserveControlsAutoHide) {
      setIsVolumeControlOpen(false);
      setIsSpeedMenuOpen(false);
      return;
    }

    showControls();
  }

  function stepVolume(direction, options = {}) {
    const safeDirection = direction < 0 ? -1 : 1;
    const volumeStep = 0.05;

    setVolume((currentVolume) => {
      const baseVolume = isMuted
        ? 0
        : Number.isFinite(currentVolume)
        ? currentVolume
        : 0;
      const nextVolume = Math.min(
        1,
        Math.max(0, Number((baseVolume + safeDirection * volumeStep).toFixed(2)))
      );
      const player = videoRef.current;

      if (player) {
        player.volume = nextVolume;
        player.muted = nextVolume === 0;
      }

      setIsMuted(nextVolume === 0);
      setIsVolumeControlOpen(false);
      setIsSpeedMenuOpen(false);

      if (!options?.preserveControlsAutoHide) {
        showControls();
      }

      return nextVolume;
    });
  }

  function handleSpeedButtonClick() {
    if (!isWebOwnPlayerControls) return;

    setIsVolumeControlOpen(false);
    setIsSpeedMenuOpen((current) => !current);
    showControls();
  }

  function normalizePlaybackRate(nextRate) {
    const safeRate = Number(nextRate);

    if (!Number.isFinite(safeRate)) return null;

    const clampedRate = Math.min(
      MAX_PLAYBACK_SPEED,
      Math.max(MIN_PLAYBACK_SPEED, safeRate)
    );

    return PLAYBACK_SPEED_OPTIONS.reduce((closest, option) =>
      Math.abs(option - clampedRate) < Math.abs(closest - clampedRate)
        ? option
        : closest
    );
  }

  function showPlaybackRateFeedback(nextRate, direction = 0) {
    const safeRate = normalizePlaybackRate(nextRate);

    if (safeRate === null) return;

    if (speedFeedbackTimerRef.current) {
      window.clearTimeout(speedFeedbackTimerRef.current);
      speedFeedbackTimerRef.current = null;
    }

    setPlaybackRateFeedback({
      label: formatPlaybackRateLabel(safeRate),
      direction,
    });

    speedFeedbackTimerRef.current = window.setTimeout(() => {
      setPlaybackRateFeedback(null);
      speedFeedbackTimerRef.current = null;
    }, 500);
  }

  function handlePlaybackRateChange(nextRate, options = {}) {
    const safeRate = normalizePlaybackRate(nextRate);
    const player = videoRef.current;

    if (safeRate === null) return;

    setPlaybackRate(safeRate);

    if (player) {
      player.playbackRate = safeRate;
    }

    if (!options?.preserveControlsAutoHide) {
      showControls();
    }
  }

  function stepPlaybackRate(direction, options = {}) {
    const currentIndex = PLAYBACK_SPEED_OPTIONS.findIndex(
      (option) => option === normalizePlaybackRate(playbackRate)
    );
    const defaultPlaybackRateIndex = PLAYBACK_SPEED_OPTIONS.indexOf(1);
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : defaultPlaybackRateIndex;
    const nextIndex = Math.min(
      PLAYBACK_SPEED_OPTIONS.length - 1,
      Math.max(0, safeCurrentIndex + direction)
    );
    const nextRate = PLAYBACK_SPEED_OPTIONS[nextIndex];

    handlePlaybackRateChange(nextRate, {
      preserveControlsAutoHide: options?.preserveControlsAutoHide,
    });
    setIsVolumeControlOpen(false);
    setIsSpeedMenuOpen(false);

    if (options.showFeedback) {
      showPlaybackRateFeedback(nextRate, direction);
    }
  }

  function toggleLoop() {
    setIsLooping((current) => !current);
    showControls();
  }

  function toggleFullscreen() {
    const wrapper = wrapperRef.current;
    const player = videoRef.current;

    if (!wrapper) return;

    const fullscreenElement = getFullscreenElement();

    if (fullscreenElement) {
      clearFullscreenControlsTimer();

      if (document.exitFullscreen) {
        document.exitFullscreen();
        return;
      }

      if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }

      return;
    }

    if (wrapper.requestFullscreen) {
      const fullscreenRequest = wrapper.requestFullscreen();
      Promise.resolve(fullscreenRequest)
        .then(lockMobileFullscreenLandscape)
        .catch(() => {
          // Se o navegador bloquear a tela cheia, mantÃ©m o player normal.
        });
      return;
    }

    if (wrapper.webkitRequestFullscreen) {
      const fullscreenRequest = wrapper.webkitRequestFullscreen();
      Promise.resolve(fullscreenRequest)
        .then(lockMobileFullscreenLandscape)
        .catch(() => {
          // Se o navegador bloquear a tela cheia, mantÃ©m o player normal.
        });
      return;
    }

    if (player?.webkitEnterFullscreen) {
      try {
        player.webkitEnterFullscreen();
        lockMobileFullscreenLandscape();
      } catch {
        // noop
      }
    }
  }

  if (!playback) {
    return (
      <div
        className={
          isMobileMockupLayout || isMobileFullscreenLayout
            ? "flex h-full w-full items-center justify-center bg-black text-xs font-medium text-white"
            : layout === "natural"
            ? "flex min-h-[180px] w-full items-center justify-center rounded-xl bg-black text-xs font-medium text-white"
            : "flex h-full w-full items-center justify-center bg-black text-xs font-medium text-white"
        }
      >
        Carregando vÃ­deo...
      </div>
    );
  }

  if (failed || playback.type === "fallback") {
    return <VideoFallback layout={layout} />;
  }

  if (playback.type === "iframe") {
    const isMobilePlayerLayout = isMobileMockupLayout || isMobileFullscreenLayout;
    const embedFrameStyle = getEmbedFrameStyle({
      embedSrc: iframeSrc,
      isMobileLayout: isMobilePlayerLayout,
      isMobileLandscape,
    });
    return (
      <div
        ref={wrapperRef}
        className={[
          isMobilePlayerLayout
            ? "relative h-full w-full overflow-hidden bg-black"
            : layout === "natural"
            ? "relative aspect-video w-full overflow-hidden rounded-xl bg-black"
            : "relative h-full w-full overflow-hidden bg-black",
          "example-video-player-shell",
          "[&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none [&:-webkit-full-screen]:h-screen [&:-webkit-full-screen]:w-screen [&:-webkit-full-screen]:rounded-none",
        ].join(" ")}
      >
        <iframe
          src={iframeSrc}
          title={title}
          className={[
            "absolute border-0 bg-black",
            "inset-0 h-full w-full",
          ].join(" ")}
          style={embedFrameStyle}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          scrolling="no"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  const playerInteractionResetClass =
    "[&_button]:outline-none [&_button]:ring-0 [&_button]:ring-offset-0 [&_button]:focus:!outline-none [&_button]:focus-visible:!outline-none [&_button]:focus:!ring-0 [&_button]:focus-visible:!ring-0 [&_button]:focus:!ring-offset-0 [&_button]:focus-visible:!ring-offset-0 [&_button:active]:bg-white/[0.14] [&_input]:focus:outline-none [&_input]:focus-visible:outline-none [&_input]:focus:ring-0 [&_input]:focus-visible:ring-0";
  const shouldHideFullscreenCursor = isFullscreen && !controlsVisible;
  const fullscreenCursorClass = shouldHideFullscreenCursor
    ? "example-video-player-shell--cursor-hidden cursor-none"
    : "cursor-auto";

  return (
    <div
      ref={wrapperRef}
      style={isMobileMockupLayout || isMobileFullscreenLayout ? undefined : naturalFrameStyle}
      className={[
        isMobileMockupLayout
          ? "relative flex h-full w-full items-center justify-center overflow-hidden bg-black [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none [&:-webkit-full-screen]:h-screen [&:-webkit-full-screen]:w-screen [&:-webkit-full-screen]:rounded-none"
          : layout === "natural"
          ? "relative overflow-hidden rounded-xl bg-black [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none [&:-webkit-full-screen]:h-screen [&:-webkit-full-screen]:w-screen [&:-webkit-full-screen]:rounded-none"
          : isCompactLayout
          ? "group relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-black [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none [&:-webkit-full-screen]:h-screen [&:-webkit-full-screen]:w-screen [&:-webkit-full-screen]:rounded-none"
          : "group relative flex h-full w-full items-center justify-center overflow-hidden bg-black [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:-webkit-full-screen]:h-screen [&:-webkit-full-screen]:w-screen",
        "example-video-player-shell",
        fullscreenCursorClass,
        playerInteractionResetClass,
      ].join(" ")}
      onMouseEnter={handleMouseEnter}
      onMouseDownCapture={preventControlButtonFocus}
      onClickCapture={blurControlButtonAfterInteraction}
      onMouseUpCapture={blurControlButtonAfterInteraction}
      onTouchEndCapture={blurControlButtonAfterInteraction}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
    >
      <style>{`
        .example-video-player-shell.example-video-player-shell--cursor-hidden,
        .example-video-player-shell.example-video-player-shell--cursor-hidden * {
          cursor: none !important;
        }

        .example-video-player-shell button,
        .example-video-player-shell button:focus,
        .example-video-player-shell button:focus-visible,
        .example-video-player-shell button:active {
          outline: none !important;
          --tw-ring-color: transparent !important;
          --tw-ring-offset-width: 0px !important;
          --tw-ring-offset-color: transparent !important;
          --tw-ring-shadow: 0 0 #0000 !important;
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>

      <video
        ref={videoRef}
        autoPlay={shouldUseNativeVideoAutoPlay}
        loop={isLooping}
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload nofullscreen noremoteplayback"
        x-webkit-airplay="deny"
        webkit-playsinline="true"
        preload="metadata"
        src={playback.src}
        className={
          isMobileFullscreenLayout || isFullscreen
            ? "absolute inset-0 h-full w-full bg-black object-contain object-center"
            : isMobileMockupLayout || isCompactLayout
            ? "absolute inset-0 h-full w-full bg-black object-cover object-center"
            : "absolute inset-0 h-full w-full bg-black object-contain object-center"
        }
        onClick={handleVideoClick}
        onLoadedMetadata={(event) => {
          const player = event.currentTarget;

          setDuration(player.duration || 0);
          updateBufferedProgress(player);
          setMediaSize({
            width: player.videoWidth || 16,
            height: player.videoHeight || 9,
          });

          player.volume = volume;
          player.muted = isMuted;
          player.loop = isLooping;
          player.playbackRate = playbackRate;

          player.disablePictureInPicture = true;
          player.disableRemotePlayback = true;
          player.setAttribute("x-webkit-airplay", "deny");
          player.setAttribute("webkit-playsinline", "true");

          restoreOwnVideoPlaybackState(player);
        }}
        onTimeUpdate={(event) => {
          const player = event.currentTarget;
          const nextTime = player.currentTime || 0;
          setCurrentTime(nextTime);
          updateBufferedProgress(player);
          saveOwnVideoPlaybackState({
            currentTime: nextTime,
            duration: player.duration || duration || 0,
            wasPlaying: !player.paused && !player.ended,
          });
        }}
        onProgress={(event) => {
          updateBufferedProgress(event.currentTarget);
        }}
        onLoadedData={(event) => {
          updateBufferedProgress(event.currentTarget);
        }}
        onPlay={() => {
          saveOwnVideoPlaybackState({ wasPlaying: true });
          setIsPlaying(true);

          if (isFullscreenMode()) {
            showControlsTemporarilyInFullscreen();
            return;
          }

          setControlsVisible(false);
        }}
        onPause={() => {
          saveOwnVideoPlaybackState({ wasPlaying: false });
          setIsPlaying(false);

          if (isFullscreenMode()) {
            showControlsTemporarilyInFullscreen();
          } else if (isCompactControlsMode) {
            setControlsVisible(true);
          } else {
            clearFullscreenControlsTimer();
            setControlsVisible(false);
          }

          clearSystemMediaSession();
        }}
        onEnded={() => {
          saveOwnVideoPlaybackState({ currentTime: 0, wasPlaying: false });
          setIsPlaying(false);
          setControlsVisible(true);
          clearFullscreenControlsTimer();
          clearSystemMediaSession();
        }}
        onCanPlay={(event) => {
          const player = event.currentTarget;
          restoreOwnVideoPlaybackState(player);

          if (!shouldResumeOwnVideoPlayback() || hasConsumedAutoPlayRef.current) {
            return;
          }

          hasConsumedAutoPlayRef.current = true;

          player.play().catch(() => {
            setIsPlaying(false);
            setControlsVisible(true);
            clearSystemMediaSession();
          });
        }}
        onError={() => {
          setFailed(true);
          clearFullscreenControlsTimer();
          clearSystemMediaSession();
        }}
      />

      {isCompactControlsMode && !isFullscreenMode() ? (
        <div
          className={
            controlsVisible || !isPlaying
              ? "absolute inset-0 z-30 text-white opacity-100 transition-opacity duration-150"
              : "pointer-events-none absolute inset-0 z-30 text-white opacity-0 transition-opacity duration-150"
          }
        >
          <div className="absolute inset-0 bg-black/0" />

          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              onClick={togglePlay}
              className={[
                "pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full",
                "border border-white/55 bg-white/10 text-white",
                "shadow-[0_4px_10px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.22)]",
                "backdrop-blur-[2px] transition-[background-color,border-color,opacity] duration-200 ease-out",
                "outline-none ring-0 ring-offset-0 focus:!outline-none focus-visible:!outline-none focus:!ring-0 focus-visible:!ring-0 focus:!ring-offset-0 focus-visible:!ring-offset-0",
                "active:bg-white/[0.16]",
                isTouchLike || isMobileMockupLayout
                  ? ""
                  : "hover:scale-[1.15] hover:border-white/75 hover:bg-white/16",
              ].join(" ")}
              aria-label={isPlaying ? "Pausar vÃ­deo" : "Reproduzir vÃ­deo"}
              title={isPlaying ? "Pausar vÃ­deo" : "Reproduzir vÃ­deo"}
            >
              {isPlaying ? (
                <Pause className="h-[17px] w-[17px] fill-white text-white stroke-[2]" />
              ) : (
                <Play className="ml-[2px] h-[17px] w-[17px] fill-white text-white stroke-[2]" />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className={[
              "pointer-events-auto absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full",
              "border border-white/55 bg-black/35 text-white shadow-sm backdrop-blur-md",
              "transition-all duration-200 hover:bg-black/55 active:bg-white/[0.14] outline-none ring-0 ring-offset-0 focus:!outline-none focus-visible:!outline-none focus:!ring-0 focus-visible:!ring-0 focus:!ring-offset-0 focus-visible:!ring-offset-0",
            ].join(" ")}
            aria-label="Expandir vÃ­deo"
            title="Expandir vÃ­deo"
          >
            <Maximize className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {playbackRateFeedback ? (
        <div className="pointer-events-none absolute left-1/2 top-[16%] z-40 flex -translate-x-1/2 flex-col items-center gap-2 text-white transition-opacity duration-150">
          <div className="rounded-lg bg-black/58 px-3.5 py-1.5 text-base font-semibold leading-none shadow-[0_10px_26px_rgba(0,0,0,0.35)] backdrop-blur-md md:text-lg">
            {playbackRateFeedback.label}
          </div>

          {playbackRateFeedback.direction !== 0 ? (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/42 text-white shadow-[0_12px_30px_rgba(0,0,0,0.38)] backdrop-blur-md md:h-16 md:w-16">
              <SpeedFeedbackDirectionIcon
                direction={playbackRateFeedback.direction}
                className="h-8 w-8 md:h-9 md:w-9"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {playbackControlFeedback ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-40 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/52 text-white shadow-[0_18px_44px_rgba(0,0,0,0.42)] backdrop-blur-md transition-opacity duration-150 md:h-24 md:w-24">
          {playbackControlFeedback === "pause" ? (
            <Pause className="h-10 w-10 fill-white text-white stroke-[2.2] md:h-12 md:w-12" />
          ) : (
            <Play className="ml-1 h-10 w-10 fill-white text-white stroke-[2.2] md:h-12 md:w-12" />
          )}
        </div>
      ) : null}

      <div
        className={
          isCompactControlsMode && !isFullscreenMode()
            ? "hidden"
            : controlsVisible
            ? "absolute bottom-0 left-0 right-0 z-30 translate-y-0 px-3 pb-5 pt-16 text-white opacity-100 transition-all duration-200 md:px-3 md:pb-3 md:pt-12"
            : "pointer-events-none absolute bottom-0 left-0 right-0 z-30 translate-y-5 px-3 pb-5 pt-16 text-white opacity-0 transition-all duration-200 md:px-3 md:pb-3 md:pt-12"
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-slate-950/35 to-transparent" />

        <div className="relative z-10 mx-auto flex w-full max-w-none flex-col items-center">
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            onMouseDown={showControls}
            onTouchStart={showControls}
            style={progressStyle}
            className={[
              "mb-5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-transparent outline-none md:mb-3 md:h-1",
              "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent md:[&::-webkit-slider-runnable-track]:h-1",
              "[&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full md:[&::-webkit-slider-thumb]:-mt-1 md:[&::-webkit-slider-thumb]:h-3 md:[&::-webkit-slider-thumb]:w-3",
              "[&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/80 [&::-webkit-slider-thumb]:bg-[#ff1744]",
              "[&::-webkit-slider-thumb]:shadow-[0_0_18px_rgba(255,23,68,0.52),0_7px_18px_rgba(0,0,0,0.38)]",
              "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent md:[&::-moz-range-track]:h-1",
              "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full md:[&::-moz-range-thumb]:h-3 md:[&::-moz-range-thumb]:w-3",
              "[&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-white/80 [&::-moz-range-thumb]:bg-[#ff1744]",
            ].join(" ")}
            aria-label="Progresso do vÃ­deo"
          />

          <div className="flex w-full items-end justify-between gap-3 px-0 md:gap-2 md:px-0">
            <div className="flex items-center justify-start gap-2">
              <GlassControlButton
                label={isPlaying ? "Pausar vÃ­deo" : "Reproduzir vÃ­deo"}
                onClick={togglePlay}
                variant="primary"
              >
                {isPlaying ? <Pause /> : <Play className="translate-x-[2px]" />}
              </GlassControlButton>
              {!isTouchLike && !isMobileMockupLayout ? (
                <>
                  <GlassControlButton
                    label="Voltar ao início"
                    onClick={restartFromBeginning}
                  >
                    <Square />
                  </GlassControlButton>

                  <div
                    ref={speedControlRef}
                    className="relative flex select-none items-center"
                    style={{
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      MozUserSelect: "none",
                      msUserSelect: "none",
                    }}
                  >
                    <div
                      className={[
                        "absolute bottom-[calc(100%+0.7rem)] left-0 z-40 w-[min(17.5rem,calc(100vw-2rem))] translate-x-0 select-none rounded-2xl border border-white/20 bg-black/40 p-3 text-white shadow-[0_18px_44px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.22)] backdrop-blur-md transition-opacity duration-200",
                        isSpeedMenuOpen
                          ? "pointer-events-auto opacity-100"
                          : "pointer-events-none opacity-0",
                      ].join(" ")}
                    >
                      <div className="mb-3 flex select-none items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10">
                            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                          <span className="select-none truncate text-[12px] font-semibold leading-none">
                            Velocidade de reprodução
                          </span>
                        </div>

                        <span className="select-none shrink-0 rounded-full bg-white/16 px-2 py-1 text-[11px] font-bold leading-none">
                          {playbackRateLabel}
                        </span>
                      </div>

                      <div className="px-1 pb-2">
                        <input
                          type="range"
                          min={MIN_PLAYBACK_SPEED}
                          max={MAX_PLAYBACK_SPEED}
                          step={PLAYBACK_SPEED_STEP}
                          value={playbackRate}
                          onChange={(event) =>
                            handlePlaybackRateChange(event.target.value)
                          }
                          onMouseDown={showControls}
                          onTouchStart={showControls}
                          style={playbackRateStyle}
                          className={[
                            "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-transparent outline-none",
                            "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent",
                            "[&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
                            "[&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/70 [&::-webkit-slider-thumb]:bg-white",
                            "[&::-webkit-slider-thumb]:shadow-[0_0_14px_rgba(255,255,255,0.32),0_6px_14px_rgba(0,0,0,0.36)]",
                            "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent",
                            "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full",
                            "[&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-white/70 [&::-moz-range-thumb]:bg-white",
                          ].join(" ")}
                          aria-label="Velocidade de reprodução"
                        />

                        <div className="mt-2 flex select-none items-center justify-between text-[9px] font-semibold text-white/55">
                          <span>{formatPlaybackRateLabel(MIN_PLAYBACK_SPEED)}</span>
                          <span>{formatPlaybackRateLabel(MAX_PLAYBACK_SPEED)}</span>
                        </div>
                      </div>

                      <div className="mt-1 flex select-none flex-wrap items-center justify-center gap-1.5">
                        {PLAYBACK_SPEED_OPTIONS.map((speedOption) => (
                          <button
                            key={speedOption}
                            type="button"
                            onClick={() => handlePlaybackRateChange(speedOption)}
                            className={[
                              "select-none rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none text-white transition-colors outline-none ring-0 focus:!outline-none focus-visible:!outline-none focus:!ring-0 focus-visible:!ring-0",
                              playbackRate === speedOption
                                ? "bg-white/24"
                                : "bg-white/8 hover:bg-white/14",
                            ].join(" ")}
                          >
                            {formatPlaybackRateLabel(speedOption)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <GlassControlButton
                      label={`Velocidade: ${playbackRateLabel}`}
                      onClick={handleSpeedButtonClick}
                      active={isSpeedMenuOpen || playbackRate !== 1}
                    >
                      <Gauge />
                    </GlassControlButton>
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex items-end justify-end gap-2 md:gap-2">
              <GlassControlButton
                label={isLooping ? "Desativar loop" : "Ativar loop"}
                onClick={toggleLoop}
                active={isLooping}
              >
                <LoopPowerIcon />
              </GlassControlButton>

              <div
                ref={volumeControlRef}
                className="relative flex items-center"
              >
                <div
                  className={[
                    "absolute bottom-[calc(100%+0.7rem)] left-1/2 z-40 flex h-28 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-white/20 bg-black/30 shadow-[0_18px_44px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.22)] backdrop-blur-md transition-opacity duration-200 md:h-32 md:w-11",
                    shouldShowVolumeControl
                      ? "pointer-events-auto opacity-100"
                      : "pointer-events-none opacity-0",
                  ].join(" ")}
                >
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    onMouseDown={showControls}
                    onTouchStart={showControls}
                    style={volumeStyle}
                    className={[
                      "h-1.5 w-24 -rotate-90 cursor-pointer appearance-none rounded-full bg-transparent outline-none md:w-28",
                      "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent",
                      "[&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full md:[&::-webkit-slider-thumb]:-mt-[5px]",
                      "[&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/70 [&::-webkit-slider-thumb]:bg-white",
                      "[&::-webkit-slider-thumb]:shadow-[0_0_14px_rgba(255,255,255,0.32),0_6px_14px_rgba(0,0,0,0.36)]",
                      "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent",
                      "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full",
                      "[&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-white/70 [&::-moz-range-thumb]:bg-white",
                    ].join(" ")}
                    aria-label="Volume do vÃ­deo"
                  />
                </div>

                <GlassControlButton
                  label="Volume"
                  onClick={handleVolumeButtonClick}
                  active={shouldShowVolumeControl || (!isMuted && volume > 0)}
                >
                  {isMuted || volume === 0 ? <VolumeX /> : <Volume2 />}
                </GlassControlButton>
              </div>

              <GlassControlButton
                label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                onClick={toggleFullscreen}
                variant="fullscreen"
              >
                {isFullscreen ? <Minimize /> : <Maximize />}
              </GlassControlButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
