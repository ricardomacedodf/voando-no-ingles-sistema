const MEMORY_CACHE = new Map();
const PENDING_STORAGE_WRITES = new Map();
const STORAGE_PREFIX = "vni:vocabulary-cache:";
const FORCE_REFRESH_PREFIX = "vni:vocabulary-force-refresh:";

function normalizeUserId(userId) {
  if (typeof userId === "string") {
    const trimmed = userId.trim();
    return trimmed || null;
  }

  return null;
}

function getStorageKey(userId) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return null;
  return `${STORAGE_PREFIX}${normalizedUserId}`;
}

function getForceRefreshKey(userId) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return null;
  return `${FORCE_REFRESH_PREFIX}${normalizedUserId}`;
}

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function writeRowsToSessionStorage(storageKey, rows) {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(rows));
  } catch {
    // Ignore storage quota and privacy mode errors.
  }
}

function cancelPendingStorageWrite(normalizedUserId) {
  if (!normalizedUserId || typeof window === "undefined") return;

  const pendingWrite = PENDING_STORAGE_WRITES.get(normalizedUserId);
  if (!pendingWrite) return;

  if (
    pendingWrite.kind === "idle" &&
    typeof window.cancelIdleCallback === "function"
  ) {
    window.cancelIdleCallback(pendingWrite.handle);
  } else {
    window.clearTimeout(pendingWrite.handle);
  }

  PENDING_STORAGE_WRITES.delete(normalizedUserId);
}

function scheduleStorageWrite(normalizedUserId, storageKey, rows) {
  if (!normalizedUserId || !storageKey || typeof window === "undefined") return;

  cancelPendingStorageWrite(normalizedUserId);

  const commit = () => {
    PENDING_STORAGE_WRITES.delete(normalizedUserId);
    writeRowsToSessionStorage(storageKey, rows);
  };

  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(commit, { timeout: 750 });
    PENDING_STORAGE_WRITES.set(normalizedUserId, { kind: "idle", handle });
    return;
  }

  const handle = window.setTimeout(commit, 32);
  PENDING_STORAGE_WRITES.set(normalizedUserId, { kind: "timeout", handle });
}

export function getCachedVocabularyRows(userId) {
  const normalizedUserId = normalizeUserId(userId);
  const storageKey = getStorageKey(userId);

  if (!normalizedUserId || !storageKey) {
    return null;
  }

  if (MEMORY_CACHE.has(normalizedUserId)) {
    return MEMORY_CACHE.get(normalizedUserId);
  }

  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    const serialized = window.sessionStorage.getItem(storageKey);
    if (!serialized) return null;

    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return null;

    MEMORY_CACHE.set(normalizedUserId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedVocabularyRows(userId, rows, options = {}) {
  const normalizedUserId = normalizeUserId(userId);
  const storageKey = getStorageKey(userId);
  const { persistToSession = true, deferPersist = false } = options;

  if (!normalizedUserId || !storageKey) {
    return;
  }

  const normalizedRows = Array.isArray(rows) ? rows : [];
  MEMORY_CACHE.set(normalizedUserId, normalizedRows);
  cancelPendingStorageWrite(normalizedUserId);

  if (!persistToSession || !canUseSessionStorage()) {
    return;
  }

  if (deferPersist) {
    scheduleStorageWrite(normalizedUserId, storageKey, normalizedRows);
    return;
  }

  writeRowsToSessionStorage(storageKey, normalizedRows);
}

export function clearCachedVocabularyRows(userId) {
  const normalizedUserId = normalizeUserId(userId);
  const storageKey = getStorageKey(userId);

  if (!normalizedUserId || !storageKey) {
    return;
  }

  MEMORY_CACHE.delete(normalizedUserId);
  cancelPendingStorageWrite(normalizedUserId);

  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage errors.
  }
}

export function markVocabularyCacheForRefresh(userId) {
  const refreshKey = getForceRefreshKey(userId);
  if (!refreshKey || !canUseSessionStorage()) return;

  try {
    window.sessionStorage.setItem(refreshKey, String(Date.now()));
  } catch {
    // Ignore storage errors.
  }
}

export function consumeVocabularyCacheRefreshFlag(userId) {
  const refreshKey = getForceRefreshKey(userId);
  if (!refreshKey || !canUseSessionStorage()) return false;

  try {
    const hasFlag = Boolean(window.sessionStorage.getItem(refreshKey));
    if (hasFlag) {
      window.sessionStorage.removeItem(refreshKey);
    }
    return hasFlag;
  } catch {
    return false;
  }
}
