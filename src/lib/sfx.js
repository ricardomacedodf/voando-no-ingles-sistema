export const SFX_BASE_PATH = "/SFX";
export const AUDIO_FILE_INPUT_ACCEPT = "audio/*,.mp3,.wav,.ogg";

const SFX_OVERRIDES_META_KEY = "voando_sfx_overrides_meta_v1";
const SFX_OVERRIDES_DB_NAME = "voando_sfx_overrides_db";
const SFX_OVERRIDES_DB_VERSION = 1;
const SFX_OVERRIDES_STORE_NAME = "sounds";

const overrideObjectUrlCache = new Map();
let dbPromise = null;

export const SFX_EVENTS = Object.freeze({
  FLASHCARD_FLIP: "flashcard_flip",
  FLASHCARD_DISCARD: "flashcard_discard",
  QUIZ_SUCCESS: "quiz_success",
  QUIZ_ERROR: "quiz_error",
  MATCH_SELECT: "match_select",
  MATCH_SUCCESS: "match_success",
  MATCH_ERROR: "match_error",
  EXAMPLES_OPEN: "examples_open",
  EXAMPLES_CLOSE: "examples_close",
});

export const SFX_EVENT_TO_FILE = Object.freeze({
  [SFX_EVENTS.FLASHCARD_FLIP]: "flashcard-flip.mp3",
  [SFX_EVENTS.FLASHCARD_DISCARD]: "card-discard.mp3",
  [SFX_EVENTS.QUIZ_SUCCESS]: "quiz-success.mp3",
  [SFX_EVENTS.QUIZ_ERROR]: "quiz-error.mp3",
  [SFX_EVENTS.MATCH_SELECT]: "match-select.mp3",
  [SFX_EVENTS.MATCH_SUCCESS]: "match-success.mp3",
  [SFX_EVENTS.MATCH_ERROR]: "match-error.mp3",
  [SFX_EVENTS.EXAMPLES_OPEN]: "examples-open.mp3",
  [SFX_EVENTS.EXAMPLES_CLOSE]: "examples-close.mp3",
});

export const SFX_TEST_ITEMS = Object.freeze([
  {
    label: "Virar cartao no Flashcard",
    event: SFX_EVENTS.FLASHCARD_FLIP,
    fileName: SFX_EVENT_TO_FILE[SFX_EVENTS.FLASHCARD_FLIP],
  },
  {
    label: "Descarte de carta",
    event: SFX_EVENTS.FLASHCARD_DISCARD,
    fileName: SFX_EVENT_TO_FILE[SFX_EVENTS.FLASHCARD_DISCARD],
  },
  {
    label: "Acerto no Quiz",
    event: SFX_EVENTS.QUIZ_SUCCESS,
    fileName: SFX_EVENT_TO_FILE[SFX_EVENTS.QUIZ_SUCCESS],
  },
  {
    label: "Erro no Quiz",
    event: SFX_EVENTS.QUIZ_ERROR,
    fileName: SFX_EVENT_TO_FILE[SFX_EVENTS.QUIZ_ERROR],
  },
  {
    label: "Selecao na Combinacao",
    event: SFX_EVENTS.MATCH_SELECT,
    fileName: SFX_EVENT_TO_FILE[SFX_EVENTS.MATCH_SELECT],
  },
  {
    label: "Acerto na Combinacao",
    event: SFX_EVENTS.MATCH_SUCCESS,
    fileName: SFX_EVENT_TO_FILE[SFX_EVENTS.MATCH_SUCCESS],
  },
  {
    label: "Erro na Combinacao",
    event: SFX_EVENTS.MATCH_ERROR,
    fileName: SFX_EVENT_TO_FILE[SFX_EVENTS.MATCH_ERROR],
  },
  {
    label: "Abrir exemplos",
    event: SFX_EVENTS.EXAMPLES_OPEN,
    fileName: SFX_EVENT_TO_FILE[SFX_EVENTS.EXAMPLES_OPEN],
  },
  {
    label: "Fechar exemplos",
    event: SFX_EVENTS.EXAMPLES_CLOSE,
    fileName: SFX_EVENT_TO_FILE[SFX_EVENTS.EXAMPLES_CLOSE],
  },
]);

function isBrowser() {
  return typeof window !== "undefined";
}

function clampVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(Math.max(numeric, 0), 1);
}

function getRawOverrideMeta() {
  if (!isBrowser()) return {};

  try {
    const raw = localStorage.getItem(SFX_OVERRIDES_META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function saveRawOverrideMeta(meta) {
  if (!isBrowser()) return;
  localStorage.setItem(SFX_OVERRIDES_META_KEY, JSON.stringify(meta || {}));
}

function revokeCachedObjectUrl(event) {
  const url = overrideObjectUrlCache.get(event);
  if (url) {
    URL.revokeObjectURL(url);
    overrideObjectUrlCache.delete(event);
  }
}

function openOverridesDb() {
  if (!isBrowser() || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    const request = window.indexedDB.open(
      SFX_OVERRIDES_DB_NAME,
      SFX_OVERRIDES_DB_VERSION
    );

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SFX_OVERRIDES_STORE_NAME)) {
        db.createObjectStore(SFX_OVERRIDES_STORE_NAME, { keyPath: "event" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

  return dbPromise;
}

async function putOverrideBlob(event, blob, fileName, mimeType) {
  const db = await openOverridesDb();
  if (!db) throw new Error("Armazenamento local de audio indisponivel.");

  const record = {
    event,
    blob,
    fileName,
    mimeType,
    updatedAt: Date.now(),
  };

  await new Promise((resolve, reject) => {
    const tx = db.transaction(SFX_OVERRIDES_STORE_NAME, "readwrite");
    tx.objectStore(SFX_OVERRIDES_STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Falha ao salvar audio."));
    tx.onabort = () => reject(tx.error || new Error("Falha ao salvar audio."));
  });

  return record;
}

async function getOverrideBlobRecord(event) {
  const db = await openOverridesDb();
  if (!db) return null;

  return new Promise((resolve) => {
    const tx = db.transaction(SFX_OVERRIDES_STORE_NAME, "readonly");
    const request = tx.objectStore(SFX_OVERRIDES_STORE_NAME).get(event);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

async function getOverrideObjectUrl(event) {
  if (overrideObjectUrlCache.has(event)) {
    return overrideObjectUrlCache.get(event);
  }

  const meta = getRawOverrideMeta();
  if (!meta[event]) return null;

  const record = await getOverrideBlobRecord(event);
  if (!record?.blob) return null;

  const url = URL.createObjectURL(record.blob);
  overrideObjectUrlCache.set(event, url);
  return url;
}

export function getSfxPathByEvent(event) {
  const fileName = SFX_EVENT_TO_FILE[event];
  return fileName ? `${SFX_BASE_PATH}/${fileName}` : null;
}

export function getSfxOverridesMeta() {
  return getRawOverrideMeta();
}

export async function saveSfxImports(fileMap = {}) {
  const nextMeta = {
    ...getRawOverrideMeta(),
  };

  const entries = Object.entries(fileMap).filter(
    ([event, file]) => !!SFX_EVENT_TO_FILE[event] && !!file
  );

  for (const [event, file] of entries) {
    const baseFileName = SFX_EVENT_TO_FILE[event];
    await putOverrideBlob(
      event,
      file,
      file.name || baseFileName,
      file.type || "audio/mpeg"
    );

    revokeCachedObjectUrl(event);
    nextMeta[event] = {
      fileName: file.name || baseFileName,
      mimeType: file.type || "audio/mpeg",
      updatedAt: Date.now(),
    };
  }

  saveRawOverrideMeta(nextMeta);
  return nextMeta;
}

export async function getSfxSourceForEvent(event) {
  const overrideUrl = await getOverrideObjectUrl(event);
  return overrideUrl || getSfxPathByEvent(event);
}

export async function playSfxEvent(event, options = {}) {
  if (!isBrowser()) return null;

  const defaultPath = getSfxPathByEvent(event);
  if (!defaultPath) return null;

  let source = defaultPath;
  try {
    const resolved = await getSfxSourceForEvent(event);
    if (resolved) source = resolved;
  } catch (_error) {
    source = defaultPath;
  }

  const audio = new Audio(source);
  audio.preload = "auto";
  audio.volume = clampVolume(options.volume ?? 1);

  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }

  return audio;
}
