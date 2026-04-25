import { useEffect, useMemo, useRef, useState } from "react";
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Repeat,
  Volume2,
  VolumeX,
} from "lucide-react";
import { resolveExampleVideoPlayback } from "@/lib/exampleVideoStorage";

const FALLBACK_MESSAGE = "Este vídeo não permite reprodução direta aqui.";
const FULLSCREEN_CONTROLS_HIDE_DELAY = 1000;

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
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        "relative shrink-0 overflow-hidden rounded-full",
        "border border-white/25",
        "bg-white/10 text-white",
        "shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-14px_28px_rgba(0,0,0,0.18),0_14px_34px_rgba(0,0,0,0.42)]",
        "backdrop-blur-md",
        "transition-all duration-200",
        "hover:bg-white/16 hover:border-white/35 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),inset_0_-14px_28px_rgba(0,0,0,0.2),0_18px_42px_rgba(0,0,0,0.5)]",
        "active:scale-95",
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

function VideoFallback({ layout = "fill" }) {
  const isMobileMockupLayout = layout === "mobileMockup";

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

export default function ExampleVideoPlayer({
  video,
  title = "Vídeo do exemplo",
  autoPlay = false,
  layout = "fill",
}) {
  const isMobileMockupLayout = layout === "mobileMockup";

  const videoRef = useRef(null);
  const wrapperRef = useRef(null);
  const hideFullscreenControlsTimerRef = useRef(null);

  const [playback, setPlayback] = useState(null);
  const [failed, setFailed] = useState(false);

  const [isTouchLike, setIsTouchLike] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mediaSize, setMediaSize] = useState(null);

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

    setPlayback(null);
    setFailed(false);
    setIsPlaying(false);
    setControlsVisible(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLooping(true);
    setMediaSize(null);
    clearFullscreenControlsTimer();

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

    resolveExampleVideoPlayback(normalizedVideo)
      .then((nextPlayback) => {
        if (isMounted) setPlayback(nextPlayback);
      })
      .catch((error) => {
        console.error("Erro ao carregar o vídeo do exemplo:", error);

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
  }, [video]);

  useEffect(() => {
    const player = videoRef.current;

    if (!player) return;

    player.volume = volume;
    player.muted = isMuted;
    player.loop = isLooping;

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
  }, [volume, isMuted, isLooping, playback?.src]);

  useEffect(() => {
    const pauseWhenPageIsHidden = () => {
      const player = videoRef.current;

      if (player && !player.paused) {
        player.pause();
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

      if (nextIsFullscreen && isPlaying) {
        showControlsTemporarilyInFullscreen();
        return;
      }

      if (!nextIsFullscreen) {
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
    if (isFullscreen && isPlaying) {
      showControlsTemporarilyInFullscreen();
      return;
    }

    if (isFullscreen && !isPlaying) {
      clearFullscreenControlsTimer();
      setControlsVisible(true);
      return;
    }

    clearFullscreenControlsTimer();
  }, [isFullscreen, isPlaying]);

  useEffect(() => {
    const player = videoRef.current;

    if (!player) return;

    const handleVideoFullscreenStart = () => {
      setIsFullscreen(true);

      if (isPlaying) {
        showControlsTemporarilyInFullscreen();
      }
    };

    const handleVideoFullscreenEnd = () => {
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

  const progressStyle = {
    background: `linear-gradient(to right, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.92) ${progressPercent}%, rgba(255,255,255,0.26) ${progressPercent}%, rgba(255,255,255,0.26) 100%)`,
  };

  const volumePercent = isMuted ? 0 : Math.round(volume * 100);

  const volumeStyle = {
    background: `linear-gradient(to right, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.92) ${volumePercent}%, rgba(255,255,255,0.22) ${volumePercent}%, rgba(255,255,255,0.22) 100%)`,
  };

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
      const player = videoRef.current;

      if (isFullscreenMode() && player && !player.paused) {
        setControlsVisible(false);
      }
    }, FULLSCREEN_CONTROLS_HIDE_DELAY);
  }

  function showControlsTemporarilyInFullscreen() {
    setControlsVisible(true);

    const player = videoRef.current;

    if (player && !player.paused) {
      scheduleFullscreenControlsHide();
    }
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

  function showControls() {
    setControlsVisible(true);

    if (isFullscreenMode()) {
      showControlsTemporarilyInFullscreen();
    }
  }

  function hideControls() {
    if (isFullscreenMode()) return;

    clearFullscreenControlsTimer();
    setControlsVisible(false);
  }

  function toggleControlsVisibility() {
    setControlsVisible((current) => !current);
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

    hideControls();
  }

  function togglePlay() {
    const player = videoRef.current;

    if (!player) return;

    if (player.paused) {
      player
        .play()
        .then(() => {
          setIsPlaying(true);

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

    player.pause();
    setIsPlaying(false);

    if (isFullscreenMode()) {
      clearFullscreenControlsTimer();
      setControlsVisible(true);
    } else {
      setControlsVisible(false);
    }

    clearSystemMediaSession();
  }

  function handleVideoClick() {
    if (isFullscreenMode()) {
      showControlsTemporarilyInFullscreen();
      return;
    }

    if (isMobileMockupLayout) {
      toggleControlsVisibility();
      return;
    }

    togglePlay();
  }

  function handleSeek(event) {
    const player = videoRef.current;
    const nextTime = Number(event.target.value);

    if (!player || !Number.isFinite(nextTime)) return;

    player.currentTime = nextTime;
    setCurrentTime(nextTime);
    showControls();
  }

  function handleVolumeChange(event) {
    const nextVolume = Number(event.target.value);

    if (!Number.isFinite(nextVolume)) return;

    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
    showControls();
  }

  function toggleMute() {
    setIsMuted((current) => !current);
    showControls();
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
      wrapper.requestFullscreen();
      return;
    }

    if (wrapper.webkitRequestFullscreen) {
      wrapper.webkitRequestFullscreen();
      return;
    }

    if (player?.webkitEnterFullscreen) {
      player.webkitEnterFullscreen();
    }
  }

  if (!playback) {
    return (
      <div
        className={
          isMobileMockupLayout
            ? "flex h-full w-full items-center justify-center bg-black text-xs font-medium text-white"
            : layout === "natural"
            ? "flex min-h-[180px] w-full items-center justify-center rounded-xl bg-black text-xs font-medium text-white"
            : "flex h-full w-full items-center justify-center bg-black text-xs font-medium text-white"
        }
      >
        Carregando vídeo...
      </div>
    );
  }

  if (failed || playback.type === "fallback") {
    return <VideoFallback layout={layout} />;
  }

  if (playback.type === "iframe") {
    return (
      <div
        className={
          isMobileMockupLayout
            ? "relative h-full w-full overflow-hidden bg-black"
            : layout === "natural"
            ? "relative aspect-video w-full overflow-hidden rounded-xl bg-black"
            : "relative h-full w-full overflow-hidden bg-black"
        }
      >
        <iframe
          src={iframeSrc}
          title={title}
          className="absolute inset-0 h-full w-full border-0 bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      style={isMobileMockupLayout ? undefined : naturalFrameStyle}
      className={
        isMobileMockupLayout
          ? "relative h-full w-full overflow-hidden bg-black"
          : layout === "natural"
          ? "relative overflow-hidden rounded-xl bg-black [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none [&:-webkit-full-screen]:h-screen [&:-webkit-full-screen]:w-screen [&:-webkit-full-screen]:rounded-none"
          : "group relative flex h-full w-full items-center justify-center overflow-hidden bg-black [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:-webkit-full-screen]:h-screen [&:-webkit-full-screen]:w-screen"
      }
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
    >
      <video
        ref={videoRef}
        autoPlay={autoPlay}
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
          isMobileMockupLayout
            ? "absolute inset-0 h-full w-full bg-black object-cover object-center"
            : "absolute inset-0 h-full w-full bg-black object-contain"
        }
        onClick={handleVideoClick}
        onLoadedMetadata={(event) => {
          const player = event.currentTarget;

          setDuration(player.duration || 0);
          setMediaSize({
            width: player.videoWidth || 16,
            height: player.videoHeight || 9,
          });

          player.volume = volume;
          player.muted = isMuted;
          player.loop = isLooping;

          player.disablePictureInPicture = true;
          player.disableRemotePlayback = true;
          player.setAttribute("x-webkit-airplay", "deny");
          player.setAttribute("webkit-playsinline", "true");
        }}
        onTimeUpdate={(event) => {
          setCurrentTime(event.currentTarget.currentTime || 0);
        }}
        onPlay={() => {
          setIsPlaying(true);

          if (isFullscreenMode()) {
            showControlsTemporarilyInFullscreen();
            return;
          }

          setControlsVisible(false);
        }}
        onPause={() => {
          setIsPlaying(false);

          clearFullscreenControlsTimer();

          if (isFullscreenMode()) {
            setControlsVisible(true);
          } else {
            setControlsVisible(false);
          }

          clearSystemMediaSession();
        }}
        onEnded={() => {
          setIsPlaying(false);
          setControlsVisible(true);
          clearFullscreenControlsTimer();
          clearSystemMediaSession();
        }}
        onCanPlay={(event) => {
          if (!autoPlay) return;

          event.currentTarget.play().catch(() => {
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

      <div
        className={
          controlsVisible
            ? "absolute bottom-0 left-0 right-0 z-30 translate-y-0 px-3 pb-5 pt-16 text-white opacity-100 transition-all duration-200 md:px-3 md:pb-3 md:pt-12"
            : "pointer-events-none absolute bottom-0 left-0 right-0 z-30 translate-y-5 px-3 pb-5 pt-16 text-white opacity-0 transition-all duration-200 md:px-3 md:pb-3 md:pt-12"
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-slate-950/35 to-transparent" />

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center">
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
              "mb-5 h-1.5 w-[92%] cursor-pointer appearance-none rounded-full bg-transparent outline-none md:mb-3 md:h-1",
              "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent md:[&::-webkit-slider-runnable-track]:h-1",
              "[&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full md:[&::-webkit-slider-thumb]:-mt-1 md:[&::-webkit-slider-thumb]:h-3 md:[&::-webkit-slider-thumb]:w-3",
              "[&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/70 [&::-webkit-slider-thumb]:bg-white",
              "[&::-webkit-slider-thumb]:shadow-[0_0_18px_rgba(255,255,255,0.38),0_7px_18px_rgba(0,0,0,0.38)]",
              "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent md:[&::-moz-range-track]:h-1",
              "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full md:[&::-moz-range-thumb]:h-3 md:[&::-moz-range-thumb]:w-3",
              "[&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-white/70 [&::-moz-range-thumb]:bg-white",
            ].join(" ")}
            aria-label="Progresso do vídeo"
          />

          <div className="flex w-full items-end justify-between gap-3 px-1 md:gap-2 md:px-3">
            <div className="flex items-center justify-start">
              <GlassControlButton
                label={isPlaying ? "Pausar vídeo" : "Reproduzir vídeo"}
                onClick={togglePlay}
                variant="primary"
              >
                {isPlaying ? <Pause /> : <Play className="translate-x-[2px]" />}
              </GlassControlButton>
            </div>

            <div className="flex items-end justify-end gap-2 md:gap-2">
              <GlassControlButton
                label={isLooping ? "Desativar loop" : "Ativar loop"}
                onClick={toggleLoop}
                active={isLooping}
              >
                <Repeat />
              </GlassControlButton>

              <div className="group/volume relative flex items-center">
                <div className="pointer-events-none absolute bottom-[calc(100%+0.7rem)] left-1/2 z-40 flex h-28 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-white/20 bg-black/30 opacity-0 shadow-[0_18px_44px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.22)] backdrop-blur-md transition-opacity duration-200 group-hover/volume:pointer-events-auto group-hover/volume:opacity-100 group-focus-within/volume:pointer-events-auto group-focus-within/volume:opacity-100 md:h-32 md:w-11">
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
                    aria-label="Volume do vídeo"
                  />
                </div>

                <GlassControlButton
                  label={
                    isMuted || volume === 0 ? "Ativar som" : "Silenciar vídeo"
                  }
                  onClick={toggleMute}
                  active={!isMuted && volume > 0}
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