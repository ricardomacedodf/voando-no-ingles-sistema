const MEMORY_CACHE = new Map();
const STORAGE_PREFIX = "vni:vocabulary-cache:";

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

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
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

export function setCachedVocabularyRows(userId, rows) {
  const normalizedUserId = normalizeUserId(userId);
  const storageKey = getStorageKey(userId);

  if (!normalizedUserId || !storageKey) {
    return;
  }

  const normalizedRows = Array.isArray(rows) ? rows : [];
  MEMORY_CACHE.set(normalizedUserId, normalizedRows);

  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(normalizedRows));
  } catch {
    // Ignore storage quota and privacy mode errors.
  }
}

export function clearCachedVocabularyRows(userId) {
  const normalizedUserId = normalizeUserId(userId);
  const storageKey = getStorageKey(userId);

  if (!normalizedUserId || !storageKey) {
    return;
  }

  MEMORY_CACHE.delete(normalizedUserId);

  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage errors.
  }
}
