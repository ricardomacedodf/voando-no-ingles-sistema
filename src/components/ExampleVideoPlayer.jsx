import { useEffect, useMemo, useRef, useState } from "react";
import { resolveExampleVideoPlayback } from "@/lib/exampleVideoStorage";

const FALLBACK_MESSAGE = "Este vídeo não permite reprodução direta aqui.";

function VideoFallback() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-black p-4 text-center text-xs font-medium text-white">
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

function formatTime(value) {
  if (!Number.isFinite(value) || value <= 0) return "0:00";

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function ExampleVideoPlayer({
  video,
  title = "Vídeo do exemplo",
  autoPlay = false,
}) {
  const videoRef = useRef(null);
  const wrapperRef = useRef(null);

  const [playback, setPlayback] = useState(null);
  const [failed, setFailed] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const normalizedVideo = typeof video === "string" ? video.trim() : "";

    setPlayback(null);
    setFailed(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

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
    };
  }, [video]);

  useEffect(() => {
    const player = videoRef.current;

    if (!player) return;

    player.volume = volume;
    player.muted = isMuted;
  }, [volume, isMuted, playback?.src]);

  const iframeSrc = useMemo(() => {
    if (!playback?.src) return "";
    return autoPlay ? addAutoplayToUrl(playback.src) : playback.src;
  }, [playback?.src, autoPlay]);

  function togglePlay() {
    const player = videoRef.current;

    if (!player) return;

    if (player.paused) {
      player.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      player.pause();
    }
  }

  function handleSeek(event) {
    const player = videoRef.current;
    const nextTime = Number(event.target.value);

    if (!player || !Number.isFinite(nextTime)) return;

    player.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function handleVolumeChange(event) {
    const nextVolume = Number(event.target.value);

    if (!Number.isFinite(nextVolume)) return;

    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
  }

  function toggleMute() {
    setIsMuted((current) => !current);
  }

  function handleFullscreen() {
    const wrapper = wrapperRef.current;

    if (!wrapper) return;

    if (wrapper.requestFullscreen) {
      wrapper.requestFullscreen();
      return;
    }

    if (wrapper.webkitRequestFullscreen) {
      wrapper.webkitRequestFullscreen();
    }
  }

  if (!playback) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-xs font-medium text-white">
        Carregando vídeo...
      </div>
    );
  }

  if (failed || playback.type === "fallback") {
    return <VideoFallback />;
  }

  if (playback.type === "iframe") {
    return (
      <div className="relative h-full w-full overflow-hidden bg-black">
        <iframe
          src={iframeSrc}
          title={title}
          className="h-full w-full border-0 bg-black"
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
      className="group relative h-full w-full overflow-hidden bg-black"
    >
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        playsInline
        preload="auto"
        src={playback.src}
        className="h-full w-full bg-black object-contain"
        onClick={togglePlay}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0);
          event.currentTarget.volume = volume;
          event.currentTarget.muted = isMuted;
        }}
        onTimeUpdate={(event) => {
          setCurrentTime(event.currentTarget.currentTime || 0);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onCanPlay={(event) => {
          if (!autoPlay) return;

          event.currentTarget.play().catch(() => {
            setIsPlaying(false);
          });
        }}
        onError={() => setFailed(true)}
      />

      <button
        type="button"
        onClick={togglePlay}
        className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-xl font-bold text-white opacity-100 shadow-lg transition-opacity group-hover:opacity-100"
        aria-label={isPlaying ? "Pausar vídeo" : "Reproduzir vídeo"}
      >
        {isPlaying ? "❚❚" : "▶"}
      </button>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-3 pt-8 text-white">
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="mb-2 h-1 w-full cursor-pointer accent-white"
          aria-label="Progresso do vídeo"
        />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white transition-colors hover:bg-white/25"
              aria-label={isPlaying ? "Pausar vídeo" : "Reproduzir vídeo"}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>

            <span className="text-[11px] font-medium text-white/90">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white transition-colors hover:bg-white/25"
              aria-label={isMuted ? "Ativar som" : "Silenciar vídeo"}
            >
              {isMuted || volume === 0 ? "🔇" : "🔊"}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="hidden h-1 w-16 cursor-pointer accent-white sm:block"
              aria-label="Volume do vídeo"
            />

            <button
              type="button"
              onClick={handleFullscreen}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white transition-colors hover:bg-white/25"
              aria-label="Tela cheia"
            >
              ⛶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}