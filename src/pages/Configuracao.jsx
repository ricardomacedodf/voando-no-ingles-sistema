import { useRef, useState } from "react";
import { Play, Save, Settings, Upload } from "lucide-react";
import {
  AUDIO_FILE_INPUT_ACCEPT,
  getSfxOverridesMeta,
  playSfxPreviewFile,
  playSfxEvent,
  saveSfxImports,
  SFX_TEST_ITEMS,
} from "../lib/sfx";

function isAcceptedAudioFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith("audio/")) return true;
  return /\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)$/i.test(file.name || "");
}

export default function Configuracao() {
  const [draftFiles, setDraftFiles] = useState({});
  const [savedMeta, setSavedMeta] = useState(() => getSfxOverridesMeta());
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);
  const inputRefs = useRef({});

  const hasPendingChanges = Object.keys(draftFiles).length > 0;

  const handlePlay = (event) => {
    const pendingFile = draftFiles[event];
    if (pendingFile) {
      void playSfxPreviewFile(pendingFile, { volume: 1 });
      return;
    }

    playSfxEvent(event, { volume: 1 });
  };

  const handleSelectFile = (event, nativeEvent) => {
    const input = nativeEvent.target;
    const file = input?.files?.[0];
    input.value = "";

    if (!file) return;

    if (!isAcceptedAudioFile(file)) {
      setSaveFeedback({
        type: "error",
        message: "Formato invalido. Use audio compativel (MP3, WAV, OGG, etc.).",
      });
      return;
    }

    setDraftFiles((previous) => ({
      ...previous,
      [event]: file,
    }));

    setSaveFeedback({
      type: "info",
      message: "Arquivo selecionado. Clique em Salvar definicoes para aplicar.",
    });
  };

  const handleSave = async () => {
    if (!hasPendingChanges || isSaving) return;

    setIsSaving(true);
    setSaveFeedback(null);

    try {
      const nextMeta = await saveSfxImports(draftFiles);
      setSavedMeta(nextMeta);
      setDraftFiles({});
      setSaveFeedback({
        type: "success",
        message: "Definicoes de audio salvas com sucesso.",
      });
    } catch (error) {
      setSaveFeedback({
        type: "error",
        message:
          error?.message || "Nao foi possivel salvar os audios importados.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          <Settings className="h-3.5 w-3.5" />
          Configuracao do Sistema
        </div>
        <h1 className="text-2xl font-bold text-foreground">Configuracao</h1>
        <p className="text-sm text-muted-foreground">
          Teste e substitua os efeitos sonoros carregados por evento.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="space-y-2">
          {SFX_TEST_ITEMS.map((item) => {
            const pendingFile = draftFiles[item.event];
            const importedMeta = savedMeta[item.event];
            const sourceName = pendingFile
              ? pendingFile.name
              : importedMeta?.fileName || item.fileName;
            const sourceStatus = pendingFile
              ? "Pendente de salvamento"
              : importedMeta
              ? "Audio importado"
              : "Audio padrao";

            return (
              <div
                key={item.event}
                className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {item.label}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {sourceName}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground/90">
                    {sourceStatus}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => handlePlay(item.event)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Play className="h-4 w-4" />
                    Reproduzir
                  </button>

                  <button
                    type="button"
                    onClick={() => inputRefs.current[item.event]?.click()}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Upload className="h-4 w-4" />
                    Importar audio
                  </button>

                  <input
                    ref={(element) => {
                      inputRefs.current[item.event] = element;
                    }}
                    type="file"
                    accept={AUDIO_FILE_INPUT_ACCEPT}
                    className="hidden"
                    onChange={(nativeEvent) =>
                      handleSelectFile(item.event, nativeEvent)
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasPendingChanges || isSaving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Salvando..." : "Salvar definicoes"}
          </button>

          {saveFeedback ? (
            <p
              className={`text-xs ${
                saveFeedback.type === "success"
                  ? "text-primary"
                  : saveFeedback.type === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {saveFeedback.message}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
