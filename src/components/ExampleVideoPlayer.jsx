import { useEffect, useState } from "react";
import { resolveExampleVideoPlayback } from "@/lib/exampleVideoStorage";

const FALLBACK_MESSAGE = "Este vídeo não permite reprodução direta aqui.";

function VideoFallback() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black p-4 text-center text-xs font-medium text-white">
      <p>{FALLBACK_MESSAGE}</p>
    </div>
  );
}

export default function ExampleVideoPlayer({
  video,
  title = "Vídeo do exemplo",
}) {
  const [playback, setPlayback] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const normalizedVideo = typeof video === "string" ? video.trim() : "";

    setPlayback(null);
    setFailed(false);

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
          src={playback.src}
          title={title}
          className="h-full w-full border-0 bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video
        controls
        playsInline
        preload="metadata"
        src={playback.src}
        className="h-full w-full bg-black object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}