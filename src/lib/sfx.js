export const SFX_BASE_PATH = "/SFX";
export const AUDIO_FILE_INPUT_ACCEPT = "audio/*,.mp3,.wav,.ogg";

const SFX_DUPLICATE_GUARD_MS = 90;
const SFX_FETCH_CACHE_MODE = "no-store";

const resolvedAssetCache = new Map();
const decodedBufferCache = new Map();
const preloadPromises = new Map();
const lastPlayAtByEvent = new Map();

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
    // Fallback for legacy implementations.
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

export function getSfxPathByEvent(event) {
  const fileName = SFX_EVENT_TO_FILE[event];
  return fileName ? `${SFX_BASE_PATH}/${fileName}` : null;
}

function buildOfficialAsset(event) {
  const sourceUrl = getSfxPathByEvent(event);
  if (!sourceUrl) return null;

  return {
    cacheKey: `official:${sourceUrl}`,
    sourceUrl,
    getArrayBuffer: async () => {
      const response = await fetch(sourceUrl, { cache: SFX_FETCH_CACHE_MODE });
      if (!response.ok) {
        throw new Error(`Falha ao carregar SFX oficial: ${sourceUrl}`);
      }
      return response.arrayBuffer();
    },
  };
}

async function resolveAssetForEvent(event) {
  if (resolvedAssetCache.has(event)) {
    return resolvedAssetCache.get(event);
  }

  const resolvedAsset = buildOfficialAsset(event);
  if (!resolvedAsset) return null;

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

    const activeAsset = await resolveAssetForEvent(event);
    if (!activeAsset) return null;

    const cached = decodedBufferCache.get(event);
    if (cached && cached.cacheKey === activeAsset.cacheKey) {
      return cached.buffer;
    }

    const decodedBuffer = await decodeResolvedAsset(context, activeAsset);
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

export function getSfxOverridesMeta() {
  return {};
}

export async function saveSfxImports(_fileMap = {}) {
  // Manual SFX import disabled. Official fixed files are always used.
  return {};
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
