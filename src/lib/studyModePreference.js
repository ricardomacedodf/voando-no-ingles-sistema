const STUDY_MODE_PREFERENCE_KEY = "vni:study-mode-preference";
const DEFAULT_STUDY_MODE = "en_pt";
const VALID_STUDY_MODES = new Set(["en_pt", "pt_en", "random"]);

function normalizeStudyMode(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return VALID_STUDY_MODES.has(normalized) ? normalized : null;
}

export function getPreferredStudyMode(fallback = DEFAULT_STUDY_MODE) {
  const normalizedFallback = normalizeStudyMode(fallback) || DEFAULT_STUDY_MODE;

  if (typeof window === "undefined") {
    return normalizedFallback;
  }

  try {
    const storedValue = window.localStorage.getItem(STUDY_MODE_PREFERENCE_KEY);
    return normalizeStudyMode(storedValue) || normalizedFallback;
  } catch {
    return normalizedFallback;
  }
}

export function setPreferredStudyMode(mode) {
  const normalizedMode = normalizeStudyMode(mode);
  if (!normalizedMode || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STUDY_MODE_PREFERENCE_KEY, normalizedMode);
  } catch {
    // Ignore storage permission and quota errors.
  }
}
