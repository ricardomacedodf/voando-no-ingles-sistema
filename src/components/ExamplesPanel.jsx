import { useEffect, useRef, useState } from "react";
import { Lightbulb, Play, X } from "lucide-react";
import { useIsMobile } from "../hooks/use-mobile";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import ExampleVideoPlayer from "@/components/ExampleVideoPlayer";
import { resolveExampleVideoPlayback } from "@/lib/exampleVideoStorage";
import { playSound } from "../lib/gameState";
import { SFX_EVENTS } from "../lib/sfx";

const EXAMPLES_POINTER_SFX_GUARD_MS = 700;

const VIDEO_FRAME_CLASS =
  "overflow-hidden rounded-lg bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0 [&_video]:absolute [&_video]:inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-contain";

const videoThumbnailCache = new Map();

const normalizeExampleText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeExampleVideo = (example) => {
  const rawVideo =
    example?.video ?? example?.videoUrl ?? example?.video_url ?? "";
  return typeof rawVideo === "string" ? rawVideo.trim() : "";
};

const normalizeExampleThumbnail = (example) => {
  const rawThumbnail =
    example?.thumbnail ??
    example?.thumbnailUrl ??
    example?.thumbnail_url ??
    "";

  return typeof rawThumbnail === "string" ? rawThumbnail.trim() : "";
};

const hasExampleContent = (example) => {
  const sentence = normalizeExampleText(example?.sentence);
  const translation = normalizeExampleText(example?.translation);
  const video = normalizeExampleVideo(example);

  return Boolean(sentence || translation || video);
};

function ExampleVideoThumbnail({
  video,
  thumbnail,
  onClick,
  title = "Vídeo do exemplo",
  isOpen = false,
}) {
  const [thumbnailSrc, setThumbnailSrc] = useState("");

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

      if (rawThumbnail) {
        setThumbnailSrc(rawThumbnail);
        return;
      }

      if (!rawVideo || typeof window === "undefined") {
        return;
      }

      const cachedThumbnail = videoThumbnailCache.get(rawVideo);

      if (cachedThumbnail) {
        setThumbnailSrc(cachedThumbnail);
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
  }, [video, thumbnail]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      title={title}
      className={[
        "group relative h-[84px] w-full overflow-hidden rounded-lg border",
        isOpen ? "border-[#ED9A0A]/80" : "border-[#D9E2EC]",
        "bg-[#F8FAFC] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_18px_rgba(15,23,42,0.06)]",
        "transition-all duration-200",
        "hover:border-[#ED9A0A]/70 hover:shadow-[0_12px_24px_rgba(15,23,42,0.10)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED9A0A]/35 focus-visible:ring-offset-2",
      ].join(" ")}
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
    </button>
  );
}

export default function ExamplesPanel({
  allMeanings,
  activeMeaning,
  examples,
  meaning,
  titleTerm,
  variant = "default",
  onClose,
}) {
  const lastClosePointerSfxAtRef = useRef(0);
  const isMobile = useIsMobile();
  const [openDesktopVideos, setOpenDesktopVideos] = useState({});
  const [mobileVideo, setMobileVideo] = useState(null);

  const meanings = allMeanings || (examples ? [{ meaning, examples }] : []);

  const normalized = meanings.map((item, index) => ({
    meaning: item?.meaning || `Significado ${index + 1}`,
    category: item?.category || "vocabulário",
    tip: item?.tip || "",
    examples: (Array.isArray(item?.examples) ? item.examples : [])
      .map((example) => ({
        sentence: normalizeExampleText(example?.sentence),
        translation: normalizeExampleText(example?.translation),
        video: normalizeExampleVideo(example),
        thumbnail: normalizeExampleThumbnail(example),
      }))
      .filter(hasExampleContent),
  }));

  const sorted = activeMeaning
    ? [...normalized].sort((a, b) =>
        a.meaning === activeMeaning ? -1 : b.meaning === activeMeaning ? 1 : 0
      )
    : normalized;

  useEffect(() => {
    setOpenDesktopVideos({});
    setMobileVideo(null);
  }, [allMeanings, activeMeaning]);

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
  const titleValue = titleTerm ? titleTerm.trim() : "Exemplos";

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

  const closeDesktopVideo = (videoKey) => {
    setOpenDesktopVideos((current) => ({
      ...current,
      [videoKey]: false,
    }));
  };

  const closeMobileVideo = () => {
    setMobileVideo(null);
  };

  const openVideo = (video, videoKey, videoTitle) => {
    if (!video) return;

    if (isMobile) {
      setMobileVideo({ video, key: videoKey, title: videoTitle });
      return;
    }

    setOpenDesktopVideos((current) => {
      const isAlreadyOpen = Boolean(current[videoKey]);

      if (isAlreadyOpen) {
        return {};
      }

      return {
        [videoKey]: true,
      };
    });
  };

  if (meanings.length === 0) return null;

  return (
    <>
      <div
        className={
          isFlashcard
            ? "mt-0 rounded-xl border border-[#EDF0F3] bg-white p-6 text-[#1A1A1A] animate-in slide-in-from-top-4 duration-200"
            : "mt-4 rounded-2xl border border-border/70 bg-[#F9FAFB] p-5 animate-in fade-in slide-in-from-top-2 duration-200"
        }
      >
        <div
          className={
            isFlashcard
              ? "mb-4 flex items-center justify-between border-b border-border pb-2"
              : "mb-4 flex items-center justify-between gap-3 border-b border-border/70 pb-3"
          }
        >
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

        <div className="space-y-4">
          {sorted.map((entry, index) => {
            const visibleExamples = entry.examples.slice(0, 3);

            const videoExamples = visibleExamples
              .map((example, exampleIndex) => ({
                ...example,
                exampleIndex,
                key: `${entry.meaning}-${index}-${exampleIndex}`,
                title: example.sentence || "Vídeo do exemplo",
              }))
              .filter((example) => Boolean(example.video));

            const firstVideoExample = videoExamples[0];

            const isFirstVideoOpen = firstVideoExample
              ? Boolean(openDesktopVideos[firstVideoExample.key])
              : false;

            return (
              <section
                key={`${entry.meaning}-${index}`}
                className={[
                  "rounded-xl border border-[#DCE4EE] bg-white shadow-[0_10px_26px_rgba(15,23,42,0.05)]",
                  isFirstVideoOpen ? "p-3" : "p-4",
                ].join(" ")}
              >
                <div
                  className={
                    firstVideoExample && !isFirstVideoOpen
                      ? "grid gap-4 md:grid-cols-[minmax(0,1fr)_160px] md:items-start"
                      : "grid gap-3"
                  }
                >
                  <div className="min-w-0">
                    <div
                      className={[
                        "flex flex-wrap items-center gap-2",
                        isFirstVideoOpen ? "mb-1.5" : "mb-2",
                      ].join(" ")}
                    >
                      <span
                        className={
                          isFlashcard
                            ? "font-semibold text-[#25B15F]"
                            : "font-bold text-[#26A95C]"
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

                    {visibleExamples.length > 0 ? (
                      <div
                        className={[
                          "border-l-2 border-[#CBD5E1]",
                          isFirstVideoOpen ? "pl-3" : "pl-4",
                        ].join(" ")}
                      >
                        <div className="space-y-1.5">
                          {visibleExamples.map((example, exampleIndex) => {
                            const hasSentence = Boolean(example.sentence);
                            const hasTranslation = Boolean(example.translation);
                            const isLastExample =
                              exampleIndex === visibleExamples.length - 1;

                            return (
                              <div
                                key={`${entry.meaning}-${index}-${exampleIndex}`}
                                className={[
                                  "space-y-0.5",
                                  isFirstVideoOpen && isLastExample
                                    ? "flex items-end justify-between gap-3"
                                    : "",
                                ].join(" ")}
                              >
                                <div className="min-w-0">
                                  {hasSentence ? (
                                    <p className="text-sm font-semibold leading-snug text-[#0b0e14]">
                                      {example.sentence}
                                    </p>
                                  ) : null}

                                  {hasTranslation ? (
                                    <p className="text-xs font-medium leading-snug text-[#758195]">
                                      {example.translation}
                                    </p>
                                  ) : null}
                                </div>

                                {!isMobile &&
                                firstVideoExample &&
                                isFirstVideoOpen &&
                                isLastExample ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      closeDesktopVideo(firstVideoExample.key)
                                    }
                                    className="mb-[1px] inline-flex shrink-0 items-center gap-1 rounded-md border border-[#D9E2EC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#64748B] shadow-sm transition-colors hover:border-[#ED9A0A]/60 hover:bg-[#FFF8ED] hover:text-[#B86F00]"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    Ocultar vídeo
                                  </button>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="border-l-2 border-[#CBD5E1] pl-4 text-sm italic text-muted-foreground">
                        Nenhum exemplo cadastrado.
                      </p>
                    )}
                  </div>

                  {firstVideoExample && !isFirstVideoOpen ? (
                    <div className="w-full">
                      <ExampleVideoThumbnail
                        video={firstVideoExample.video}
                        thumbnail={firstVideoExample.thumbnail}
                        title={firstVideoExample.title}
                        isOpen={isFirstVideoOpen}
                        onClick={() =>
                          openVideo(
                            firstVideoExample.video,
                            firstVideoExample.key,
                            firstVideoExample.title
                          )
                        }
                      />
                    </div>
                  ) : null}
                </div>

                {entry.tip && !isFirstVideoOpen ? (
                  <p className="mt-3 flex items-start gap-1.5 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs italic text-muted-foreground">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ED9A0A]" />
                    <span>{entry.tip}</span>
                  </p>
                ) : null}

                {!isMobile && firstVideoExample && isFirstVideoOpen ? (
                  <div className="mt-2">
                    <div className="relative overflow-hidden rounded-xl bg-black shadow-[0_16px_34px_rgba(15,23,42,0.16)]">
                      <AspectRatio ratio={16 / 9} className={VIDEO_FRAME_CLASS}>
                        <ExampleVideoPlayer
                          key={`${firstVideoExample.key}-${firstVideoExample.video}`}
                          video={firstVideoExample.video}
                          title={firstVideoExample.title}
                          autoPlay
                        />
                      </AspectRatio>
                    </div>
                  </div>
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
            className="absolute left-0 right-0 top-[calc(env(safe-area-inset-top,0px)+7.55vh)] aspect-[5/4] w-screen max-w-none overflow-hidden bg-black"
            onClick={(event) => event.stopPropagation()}
          >
            <ExampleVideoPlayer
              key={mobileVideo?.key || "mobile-video"}
              video={mobileVideo?.video || ""}
              title={mobileVideo?.title || ""}
              autoPlay
              layout="mobileMockup"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}