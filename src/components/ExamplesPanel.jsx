import { useEffect, useRef, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { useIsMobile } from "../hooks/use-mobile";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ExampleVideoPlayer from "@/components/ExampleVideoPlayer";
import { playSound } from "../lib/gameState";
import { SFX_EVENTS } from "../lib/sfx";

const EXAMPLES_POINTER_SFX_GUARD_MS = 700;

const normalizeExampleText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeExampleVideo = (example) => {
  const rawVideo =
    example?.video ?? example?.videoUrl ?? example?.video_url ?? "";
  return typeof rawVideo === "string" ? rawVideo.trim() : "";
};

const hasExampleContent = (example) => {
  const sentence = normalizeExampleText(example?.sentence);
  const translation = normalizeExampleText(example?.translation);
  const video = normalizeExampleVideo(example);

  return Boolean(sentence || translation || video);
};

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

  const isFlashcard = variant === "flashcard";
  const title = titleTerm ? `Exemplos - ${titleTerm}` : "Exemplos";

  const shouldSkipClickSfxAfterPointer = (event) => {
    if (!event) return false;
    if (event.detail === 0) return false;

    return (
      Date.now() - lastClosePointerSfxAtRef.current < EXAMPLES_POINTER_SFX_GUARD_MS
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

  const toggleDesktopVideo = (videoKey) => {
    setOpenDesktopVideos((current) => ({
      ...current,
      [videoKey]: !current[videoKey],
    }));
  };

  const closeDesktopVideo = (videoKey) => {
    setOpenDesktopVideos((current) => ({
      ...current,
      [videoKey]: false,
    }));
  };

  const openVideo = (video, videoKey, videoTitle) => {
    if (!video) return;

    if (isMobile) {
      setMobileVideo({ video, key: videoKey, title: videoTitle });
      return;
    }

    toggleDesktopVideo(videoKey);
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
          <div className="flex items-center gap-2 text-foreground">
            <Lightbulb
              className={
                isFlashcard
                  ? "h-[18px] w-[18px] text-[#ED9A0A]"
                  : "h-4 w-4 text-[#ED9A0A]"
              }
            />

            <h3
              className={
                isFlashcard
                  ? "text-base font-bold"
                  : "text-2xl font-semibold leading-none"
              }
            >
              {title}
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

        <div className={isFlashcard ? "space-y-6" : "space-y-5"}>
          {sorted.map((entry, index) => (
            <section
              key={`${entry.meaning}-${index}`}
              className={isFlashcard ? "space-y-3" : "space-y-3"}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    isFlashcard
                      ? "font-semibold text-[#25B15F]"
                      : "font-bold text-[#26A95C]"
                  }
                >
                  {index + 1}.
                </span>

                <span
                  className={
                    isFlashcard
                      ? "font-medium text-foreground"
                      : "font-semibold text-foreground"
                  }
                >
                  {entry.meaning}
                </span>

                {entry.category ? (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {entry.category}
                  </span>
                ) : null}
              </div>

              {entry.tip ? (
                <p
                  className={
                    isFlashcard
                      ? "pl-6 text-xs italic text-muted-foreground"
                      : "flex items-start gap-1.5 text-sm italic text-muted-foreground"
                  }
                >
                  {isFlashcard ? (
                    "💡 "
                  ) : (
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 text-[#ED9A0A]" />
                  )}
                  <span>{entry.tip}</span>
                </p>
              ) : null}

              <div className={isFlashcard ? "space-y-2" : "space-y-2.5"}>
                {entry.examples.slice(0, 3).map((example, exampleIndex) => {
                  const exampleVideoKey = `${entry.meaning}-${index}-${exampleIndex}`;
                  const isDesktopVideoOpen = Boolean(
                    openDesktopVideos[exampleVideoKey]
                  );
                  const hasSentence = Boolean(example.sentence);
                  const hasTranslation = Boolean(example.translation);
                  const hasVideo = Boolean(example.video);
                  const videoTitle = example.sentence || "Vídeo do exemplo";

                  return (
                    <article
                      key={exampleVideoKey}
                      className={
                        isFlashcard
                          ? "space-y-1.5 border-l-2 border-[#64748B]/30 pl-6"
                          : "space-y-1.5 border-l-2 border-[#F3D7A8] pl-3"
                      }
                    >
                      {hasSentence ? (
                        <p
                          className={
                            isFlashcard
                              ? "font-medium text-foreground"
                              : "text-xl font-semibold leading-snug text-foreground"
                          }
                        >
                          {example.sentence}
                        </p>
                      ) : null}

                      {hasTranslation ? (
                        <p
                          className={
                            isFlashcard
                              ? "text-sm text-muted-foreground"
                              : "text-lg leading-snug text-muted-foreground"
                          }
                        >
                          {example.translation}
                        </p>
                      ) : null}

                      {hasVideo ? (
                        <div
                          className={
                            hasSentence || hasTranslation ? "pt-0.5" : ""
                          }
                        >
                          <button
                            type="button"
                            onClick={() =>
                              openVideo(example.video, exampleVideoKey, videoTitle)
                            }
                            className="inline-flex items-center rounded-md border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                          >
                            {isMobile || !isDesktopVideoOpen
                              ? "▶ Ver vídeo"
                              : "Ocultar vídeo"}
                          </button>
                        </div>
                      ) : null}

                      {!isMobile && hasVideo && isDesktopVideoOpen ? (
                        <div className="relative mt-2 rounded-xl border border-border/80 bg-background/70 p-2.5">
                          <button
                            type="button"
                            onClick={() => closeDesktopVideo(exampleVideoKey)}
                            className="absolute right-3 top-3 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/80 bg-white/90 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Fechar vídeo"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>

                          <AspectRatio
                            ratio={1}
                            className="overflow-hidden rounded-lg bg-black"
                          >
                            <ExampleVideoPlayer
                              key={`${exampleVideoKey}-${example.video}`}
                              video={example.video}
                              title={videoTitle}
                            />
                          </AspectRatio>
                        </div>
                      ) : null}
                    </article>
                  );
                })}

                {entry.examples.length === 0 ? (
                  <p
                    className={
                      isFlashcard
                        ? "border-l-2 border-[#64748B]/30 pl-6 text-sm italic text-muted-foreground"
                        : "border-l-2 border-[#F3D7A8] pl-3 text-sm italic text-muted-foreground"
                    }
                  >
                    Nenhum exemplo cadastrado.
                  </p>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>

      <Sheet
        open={Boolean(mobileVideo?.video)}
        onOpenChange={(open) => {
          if (!open) setMobileVideo(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-border bg-background px-0 pb-5 pt-0"
        >
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle className="text-base font-semibold text-foreground">
              Vídeo do exemplo
            </SheetTitle>
          </SheetHeader>

          <div className="px-4 pt-4">
            <AspectRatio ratio={1} className="overflow-hidden rounded-xl bg-black">
              <ExampleVideoPlayer
                key={mobileVideo?.key || "mobile-video"}
                video={mobileVideo?.video || ""}
                title={mobileVideo?.title || "Vídeo do exemplo"}
              />
            </AspectRatio>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}