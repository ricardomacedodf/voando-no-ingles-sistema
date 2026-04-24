export const SFX_BASE_PATH = "/SFX";
export const AUDIO_FILE_INPUT_ACCEPT = "audio/*,.mp3,.wav,.ogg";

const SFX_OVERRIDES_META_KEY = "voando_sfx_overrides_meta_v1";
const SFX_OVERRIDES_DB_NAME = "voando_sfx_overrides_db";
const SFX_OVERRIDES_DB_VERSION = 1;
const SFX_OVERRIDES_STORE_NAME = "sounds";
const SFX_DUPLICATE_GUARD_MS = 90;
const SFX_FETCH_CACHE_MODE = "force-cache";

const overrideObjectUrlCache = new Map();
const overrideBlobMemoryCache = new Map();
const resolvedAssetCache = new Map();
const decodedBufferCache = new Map();
const preloadPromises = new Map();
const lastPlayAtByEvent = new Map();

let dbPromise = null;
let isSfxInitialized = false;
let isUnlockListenerAttached = false;
let isAudioUnlocked = false;
let audioContextInstance = null;
let masterGainNode = null;

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

const SFX_EVENT_FALLBACK_TO_FILE = Object.freeze({
  [SFX_EVENTS.QUIZ_SUCCESS]: "quiz-success.mp3",
  [SFX_EVENTS.QUIZ_ERROR]: "quiz-error.mp3",
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

function getNow() {
  if (typeof performance !== "undefined" && Number.isFinite(performance.now())) {
    return performance.now();
  }
  return Date.now();
}

function clampVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(Math.max(numeric, 0), 1);
}

function buildUrlAsset(cacheKey, sourceUrl) {
  return {
    cacheKey,
    sourceUrl,
    getArrayBuffer: async () => {
      const response = await fetch(sourceUrl, { cache: SFX_FETCH_CACHE_MODE });
      if (!response.ok) {
        throw new Error(`Falha ao carregar SFX: ${sourceUrl}`);
      }
      return response.arrayBuffer();
    },
  };
}

function getFallbackPathByEvent(event) {
  const fileName = SFX_EVENT_FALLBACK_TO_FILE[event];
  return fileName ? `${SFX_BASE_PATH}/${fileName}` : null;
}

function clearMediaSessionForSfx() {
  if (!isBrowser()) return;
  if (!("mediaSession" in navigator)) return;

  try {
    navigator.mediaSession.metadata = null;
  } catch (_error) {
    // Ignore.
  }

  try {
    navigator.mediaSession.playbackState = "none";
  } catch (_error) {
    // Ignore.
  }
}

function ensureAudioContext() {
  if (!isBrowser()) return null;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!audioContextInstance) {
    try {
      audioContextInstance = new AudioCtx({ latencyHint: "interactive" });
      masterGainNode = audioContextInstance.createGain();
      masterGainNode.gain.value = 1;
      masterGainNode.connect(audioContextInstance.destination);
    } catch (_error) {
      audioContextInstance = null;
      masterGainNode = null;
      return null;
    }
  }

  return audioContextInstance;
}

async function decodeArrayBuffer(context, arrayBuffer) {
  if (!context || !arrayBuffer) return null;
  const data = arrayBuffer.slice(0);

  try {
    const maybePromise = context.decodeAudioData(data);
    if (maybePromise && typeof maybePromise.then === "function") {
      return await maybePromise;
    }
  } catch (_error) {
    // Tenta fallback via callbacks em implementacoes antigas.
  }

  return new Promise((resolve) => {
    try {
      context.decodeAudioData(
        data,
        (decoded) => resolve(decoded || null),
        () => resolve(null)
      );
    } catch (_error) {
      resolve(null);
    }
  });
}

function playDecodedBuffer(buffer, volume = 1) {
  const context = ensureAudioContext();
  if (!context || !buffer) return null;

  try {
    const source = context.createBufferSource();
    source.buffer = buffer;

    const gainNode = context.createGain();
    gainNode.gain.value = clampVolume(volume);

    source.connect(gainNode);
    gainNode.connect(masterGainNode || context.destination);
    source.start(0);

    return source;
  } catch (_error) {
    return null;
  }
}

function warmAudioGraphSilently(context) {
  if (!context) return;

  try {
    const silentBuffer = context.createBuffer(1, 1, context.sampleRate);
    const source = context.createBufferSource();
    source.buffer = silentBuffer;

    const gainNode = context.createGain();
    gainNode.gain.value = 0;

    source.connect(gainNode);
    gainNode.connect(masterGainNode || context.destination);
    source.start(0);
    source.stop(0);
  } catch (_error) {
    // Ignore.
  }
}

function clearPreparedEvent(event) {
  preloadPromises.delete(event);
  resolvedAssetCache.delete(event);
  decodedBufferCache.delete(event);
}

function revokeCachedObjectUrl(event) {
  const url = overrideObjectUrlCache.get(event);
  if (url) {
    URL.revokeObjectURL(url);
    overrideObjectUrlCache.delete(event);
  }
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

function getSfxPathByEvent(event) {
  const fileName = SFX_EVENT_TO_FILE[event];
  return fileName ? `${SFX_BASE_PATH}/${fileName}` : null;
}

async function resolveAssetForEvent(event) {
  if (resolvedAssetCache.has(event)) {
    return resolvedAssetCache.get(event);
  }

  const defaultPath = getSfxPathByEvent(event);
  if (!defaultPath) return null;

  const meta = getRawOverrideMeta();
  let overrideBlob = overrideBlobMemoryCache.get(event) || null;

  if (!overrideBlob && meta[event]) {
    const record = await getOverrideBlobRecord(event);
    overrideBlob = record?.blob || null;
    if (overrideBlob) {
      overrideBlobMemoryCache.set(event, overrideBlob);
    }
  }

  let resolvedAsset = null;

  if (overrideBlob) {
    let objectUrl = overrideObjectUrlCache.get(event);
    if (!objectUrl) {
      objectUrl = URL.createObjectURL(overrideBlob);
      overrideObjectUrlCache.set(event, objectUrl);
    }

    const updatedAt = meta[event]?.updatedAt || 0;
    resolvedAsset = {
      cacheKey: `blob:${event}:${updatedAt}:${overrideBlob.size}`,
      sourceUrl: objectUrl,
      getArrayBuffer: async () => overrideBlob.arrayBuffer(),
    };
  } else {
    resolvedAsset = buildUrlAsset(`url:${defaultPath}`, defaultPath);
  }

  resolvedAssetCache.set(event, resolvedAsset);
  return resolvedAsset;
}

async function decodeResolvedAsset(context, asset) {
  if (!context || !asset) return null;

  try {
    const arrayBuffer = await asset.getArrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) return null;
    return decodeArrayBuffer(context, arrayBuffer);
  } catch (_error) {
    return null;
  }
}

async function preloadSfxEvent(event, options = {}) {
  const { force = false } = options;
  const defaultPath = getSfxPathByEvent(event);
  if (!defaultPath) return null;

  if (force) {
    clearPreparedEvent(event);
  }

  if (preloadPromises.has(event)) {
    return preloadPromises.get(event);
  }

  const preloadPromise = (async () => {
    const context = ensureAudioContext();
    if (!context) return null;

    let activeAsset = await resolveAssetForEvent(event);
    if (!activeAsset) return null;

    const cached = decodedBufferCache.get(event);
    if (cached && cached.cacheKey === activeAsset.cacheKey) {
      return cached.buffer;
    }

    let decodedBuffer = await decodeResolvedAsset(context, activeAsset);

    if (!decodedBuffer) {
      const fallbackPath = getFallbackPathByEvent(event);
      if (fallbackPath && fallbackPath !== activeAsset.sourceUrl) {
        const fallbackAsset = buildUrlAsset(
          `fallback:${event}:${fallbackPath}`,
          fallbackPath
        );
        const fallbackBuffer = await decodeResolvedAsset(context, fallbackAsset);
        if (fallbackBuffer) {
          activeAsset = fallbackAsset;
          decodedBuffer = fallbackBuffer;
          resolvedAssetCache.set(event, fallbackAsset);
        }
      }
    }

    if (!decodedBuffer) return null;

    decodedBufferCache.set(event, {
      cacheKey: activeAsset.cacheKey,
      buffer: decodedBuffer,
    });

    return decodedBuffer;
  })()
    .catch(() => null)
    .finally(() => {
      preloadPromises.delete(event);
    });

  preloadPromises.set(event, preloadPromise);
  return preloadPromise;
}

function unlockSfxAudio() {
  if (!isBrowser() || isAudioUnlocked) return;

  const context = ensureAudioContext();
  if (!context) return;

  const finalizeUnlock = () => {
    isAudioUnlocked = true;
    clearMediaSessionForSfx();
    warmAudioGraphSilently(context);
  };

  if (context.state === "suspended") {
    context.resume().then(finalizeUnlock).catch(() => {});
    return;
  }

  finalizeUnlock();
}

function attachUnlockListener() {
  if (!isBrowser() || isUnlockListenerAttached) return;
  isUnlockListenerAttached = true;

  const detach = () => {
    window.removeEventListener("pointerdown", unlock, { capture: true });
    window.removeEventListener("touchstart", unlock, { capture: true });
    window.removeEventListener("mousedown", unlock, { capture: true });
    window.removeEventListener("keydown", unlock, { capture: true });
    isUnlockListenerAttached = false;
  };

  const unlock = () => {
    detach();
    unlockSfxAudio();
  };

  window.addEventListener("pointerdown", unlock, {
    capture: true,
    once: true,
    passive: true,
  });
  window.addEventListener("touchstart", unlock, {
    capture: true,
    once: true,
    passive: true,
  });
  window.addEventListener("mousedown", unlock, {
    capture: true,
    once: true,
    passive: true,
  });
  window.addEventListener("keydown", unlock, {
    capture: true,
    once: true,
  });
}

export function initSfxSystem() {
  if (!isBrowser()) return;

  attachUnlockListener();
  clearMediaSessionForSfx();

  if (isSfxInitialized) return;
  isSfxInitialized = true;

  ensureAudioContext();

  Object.keys(SFX_EVENT_TO_FILE).forEach((event) => {
    void preloadSfxEvent(event);
  });
}

export { getSfxPathByEvent };

export function getSfxOverridesMeta() {
  return getRawOverrideMeta();
}

export async function saveSfxImports(fileMap = {}) {
  initSfxSystem();

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
    overrideBlobMemoryCache.set(event, file);

    nextMeta[event] = {
      fileName: file.name || baseFileName,
      mimeType: file.type || "audio/mpeg",
      updatedAt: Date.now(),
    };

    clearPreparedEvent(event);
    void preloadSfxEvent(event, { force: true });
  }

  saveRawOverrideMeta(nextMeta);
  return nextMeta;
}

export async function getSfxSourceForEvent(event) {
  initSfxSystem();
  await preloadSfxEvent(event);
  const asset = resolvedAssetCache.get(event) || (await resolveAssetForEvent(event));
  return asset?.sourceUrl || getSfxPathByEvent(event);
}

export async function playSfxPreviewFile(file, options = {}) {
  if (!isBrowser() || !file) return null;
  initSfxSystem();

  const context = ensureAudioContext();
  if (!context) return null;

  if (context.state === "suspended") {
    try {
      await context.resume();
      isAudioUnlocked = true;
    } catch (_error) {
      return null;
    }
  }

  clearMediaSessionForSfx();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const decodedBuffer = await decodeArrayBuffer(context, arrayBuffer);
    if (!decodedBuffer) return null;
    return playDecodedBuffer(decodedBuffer, options.volume ?? 1);
  } catch (_error) {
    return null;
  }
}

export function playSfxEvent(event, options = {}) {
  if (!isBrowser()) return null;
  initSfxSystem();

  const defaultPath = getSfxPathByEvent(event);
  if (!defaultPath) return null;

  const now = getNow();
  const dedupeWindowMs = Number.isFinite(options.dedupeWindowMs)
    ? Math.max(0, Number(options.dedupeWindowMs))
    : SFX_DUPLICATE_GUARD_MS;

  const lastPlayAt = lastPlayAtByEvent.get(event);
  if (
    typeof lastPlayAt === "number" &&
    dedupeWindowMs > 0 &&
    now - lastPlayAt < dedupeWindowMs
  ) {
    return null;
  }
  lastPlayAtByEvent.set(event, now);

  const context = ensureAudioContext();
  if (!context) return null;

  if (context.state === "suspended") {
    context
      .resume()
      .then(() => {
        isAudioUnlocked = true;
      })
      .catch(() => {
        isAudioUnlocked = false;
        attachUnlockListener();
      });
  }

  clearMediaSessionForSfx();

  const cached = decodedBufferCache.get(event);
  if (cached?.buffer) {
    return playDecodedBuffer(cached.buffer, options.volume ?? 1);
  }

  const requestedAt = now;
  void preloadSfxEvent(event).then((decodedBuffer) => {
    if (!decodedBuffer) return;
    if (lastPlayAtByEvent.get(event) !== requestedAt) return;

    const freshContext = ensureAudioContext();
    if (!freshContext) return;

    const playPreparedBuffer = () => playDecodedBuffer(decodedBuffer, options.volume ?? 1);

    if (freshContext.state === "suspended") {
      freshContext
        .resume()
        .then(() => {
          isAudioUnlocked = true;
          playPreparedBuffer();
        })
        .catch(() => {
          isAudioUnlocked = false;
          attachUnlockListener();
        });
      return;
    }

    playPreparedBuffer();
  });
  return null;
}

if (isBrowser()) {
  initSfxSystem();
}
