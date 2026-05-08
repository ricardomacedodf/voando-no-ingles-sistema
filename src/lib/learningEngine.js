const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_REVIEW_STAGE = 6;
const MASTERY_CORRECT_STREAK = 10;
const QUIZ_SLOW_RESPONSE_MS = 12000;

export const LEARNING_STATUS = Object.freeze({
  NOVA: "nova",
  APRENDENDO: "aprendendo",
  DOMINADA: "dominada",
  DIFICIL: "dificil",
});

export const REVIEW_PACE = Object.freeze({
  INTENSIVO: "intensivo",
  EQUILIBRADO: "equilibrado",
  LEVE: "leve",
});

export const REVIEW_FOCUS = Object.freeze({
  ALL: "all",
  TODAY: "today",
  OVERDUE: "overdue",
  DIFFICULT: "difficult",
  LEARNING: "learning",
  NEW: "new",
  MASTERED: "mastered",
  ATTENTION: "attention",
});

export const REVIEW_PREFERENCES_STORAGE_KEY = "voando_review_preferences";

const DEFAULT_REVIEW_PREFERENCES = Object.freeze({
  pace: REVIEW_PACE.EQUILIBRADO,
});

const DEFAULT_STATS = Object.freeze({
  correct: 0,
  incorrect: 0,
  total_reviews: 0,
  avg_response_time: 0,
  status: LEARNING_STATUS.NOVA,
  last_reviewed: null,
  next_review_at: null,
  review_interval_days: 0,
  review_stage: 0,
  last_result: null,
  last_review_mode: null,
  correct_streak: 0,
  flashcard_confident_without_reveal: 0,
  flashcard_revealed_before_answer: 0,
  quiz_answered_count: 0,
  quiz_total_response_ms: 0,
  quiz_average_response_ms: 0,
  quiz_slow_response_count: 0,
  quiz_dont_remember_count: 0,
  combinations_rounds: 0,
  combinations_total_attempts: 0,
  combinations_average_attempts: 0,
  combinations_extra_attempts: 0,
  combinations_first_try: 0,
  difficulty_signals: 0,
  confidence_signals: 0,
  mastery_threshold: MASTERY_CORRECT_STREAK,
  mastery_remaining: MASTERY_CORRECT_STREAK,
});

const REVIEW_PACE_CONFIG = Object.freeze({
  [REVIEW_PACE.INTENSIVO]: {
    intervalsByStage: [0, 1, 1, 2, 3, 5, 8],
    retryIntervalDays: 0,
    difficultMaxIntervalDays: 1,
    masteredMinIntervalDays: 5,
    staleMasteredDays: 12,
    overloadDueThreshold: 26,
  },
  [REVIEW_PACE.EQUILIBRADO]: {
    intervalsByStage: [0, 1, 2, 4, 7, 14, 30],
    retryIntervalDays: 0,
    difficultMaxIntervalDays: 2,
    masteredMinIntervalDays: 7,
    staleMasteredDays: 18,
    overloadDueThreshold: 20,
  },
  [REVIEW_PACE.LEVE]: {
    intervalsByStage: [1, 2, 4, 7, 14, 21, 45],
    retryIntervalDays: 1,
    difficultMaxIntervalDays: 3,
    masteredMinIntervalDays: 10,
    staleMasteredDays: 24,
    overloadDueThreshold: 14,
  },
});

function toSafeNonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function toSafeInteger(value, fallback = 0) {
  const safe = toSafeNonNegativeNumber(value, fallback);
  return Math.round(safe);
}

function pickMetric(stats, keys, fallback = 0) {
  for (const key of keys) {
    if (stats && stats[key] !== undefined && stats[key] !== null) {
      return toSafeInteger(stats[key], fallback);
    }
  }

  return fallback;
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function getDifficultySignals(stats) {
  return (
    toSafeInteger(stats.flashcard_revealed_before_answer, 0) +
    toSafeInteger(stats.quiz_slow_response_count, 0) +
    toSafeInteger(stats.quiz_dont_remember_count, 0) +
    toSafeInteger(stats.combinations_extra_attempts, 0)
  );
}

function getConfidenceSignals(stats) {
  return (
    toSafeInteger(stats.flashcard_confident_without_reveal, 0) +
    toSafeInteger(stats.combinations_first_try, 0)
  );
}

function normalizeIsoDate(rawValue) {
  if (!rawValue) return null;
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseIsoDate(rawValue) {
  const normalizedIso = normalizeIsoDate(rawValue);
  if (!normalizedIso) return null;
  return new Date(normalizedIso);
}

function toStartOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function toEndOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDaysToIso(rawDate, days) {
  const baseDate = parseIsoDate(rawDate) || new Date();
  const safeDays = Number.isFinite(Number(days)) ? Number(days) : 0;
  const result = new Date(baseDate.getTime() + safeDays * DAY_IN_MS);
  return result.toISOString();
}

function clampStage(value) {
  return Math.max(0, Math.min(MAX_REVIEW_STAGE, Math.round(value)));
}

function normalizeReviewMode(rawMode) {
  if (!rawMode) return null;
  const value = String(rawMode).trim().toLowerCase();
  return value || null;
}

function normalizeReviewResult(rawResult) {
  if (rawResult === true) return "correct";
  if (rawResult === false) return "incorrect";
  const value = String(rawResult || "")
    .trim()
    .toLowerCase();

  if (["correct", "acerto", "certo", "right", "success"].includes(value)) {
    return "correct";
  }
  if (["incorrect", "erro", "errado", "wrong", "fail"].includes(value)) {
    return "incorrect";
  }
  return null;
}

function normalizeBaseStatus(rawStatus) {
  const value = String(rawStatus || "")
    .trim()
    .toLowerCase();

  if (value === LEARNING_STATUS.DOMINADA) return LEARNING_STATUS.DOMINADA;
  if (value === LEARNING_STATUS.DIFICIL || value === "difícil") {
    return LEARNING_STATUS.DIFICIL;
  }
  return LEARNING_STATUS.NOVA;
}

function normalizeReviewPace(rawPace) {
  const value = String(rawPace || "")
    .trim()
    .toLowerCase();

  if (value === REVIEW_PACE.INTENSIVO) return REVIEW_PACE.INTENSIVO;
  if (value === REVIEW_PACE.LEVE) return REVIEW_PACE.LEVE;
  return REVIEW_PACE.EQUILIBRADO;
}

function getReviewPaceConfig(preferences) {
  const normalized = normalizeReviewPreferences(preferences);
  return REVIEW_PACE_CONFIG[normalized.pace];
}

function inferStageFromStatus(stats) {
  const totalReviews = toSafeInteger(stats.total_reviews, 0);
  const normalizedStatus = calculateStatus(stats);

  if (totalReviews <= 0) return 0;
  if (normalizedStatus === LEARNING_STATUS.DIFICIL) return 1;
  if (normalizedStatus === LEARNING_STATUS.DOMINADA) return 4;
  return 2;
}

function deriveIntervalFromStage(stage, status, config) {
  const safeStage = clampStage(stage);
  const fromStage =
    config.intervalsByStage[safeStage] ??
    config.intervalsByStage[config.intervalsByStage.length - 1] ??
    0;

  if (status === LEARNING_STATUS.DIFICIL) {
    return Math.min(fromStage, config.difficultMaxIntervalDays);
  }
  if (status === LEARNING_STATUS.DOMINADA) {
    return Math.max(fromStage, config.masteredMinIntervalDays);
  }
  return fromStage;
}

function getPriorityScore(derivedItem) {
  const { learningStatus, stats } = derivedItem;
  const accuracyRate = Number.isFinite(derivedItem.accuracyRate)
    ? derivedItem.accuracyRate
    : 0;
  const nextReviewDays = Number.isFinite(derivedItem.daysUntilNextReview)
    ? derivedItem.daysUntilNextReview
    : 0;
  const overdueDays = Number.isFinite(derivedItem.overdueDays)
    ? derivedItem.overdueDays
    : 0;
  const totalReviews = toSafeInteger(stats.total_reviews, 0);
  const difficultySignals = toSafeInteger(stats.difficulty_signals, 0);
  const confidenceSignals = toSafeInteger(stats.confidence_signals, 0);
  const correctStreak = toSafeInteger(stats.correct_streak, 0);

  let score = 0;

  if (learningStatus === LEARNING_STATUS.NOVA) score += 120;
  if (learningStatus === LEARNING_STATUS.DIFICIL) score += 110;
  if (learningStatus === LEARNING_STATUS.APRENDENDO) score += 70;
  if (learningStatus === LEARNING_STATUS.DOMINADA) score -= 25;

  if (derivedItem.isDueToday) score += 75;
  if (derivedItem.isOverdue) score += 90 + Math.min(30, overdueDays * 2);
  if (!derivedItem.isDueToday) score -= Math.max(0, nextReviewDays * 2);

  if (stats.last_result === "incorrect") score += 30;
  if (stats.last_result === "correct") score += 10;

  score += Math.max(0, (100 - accuracyRate) * 0.45);
  score += Math.min(25, totalReviews * 1.2);
  score += Math.min(45, difficultySignals * 4);
  score -= Math.min(20, confidenceSignals * 1.5);
  score -= Math.min(25, correctStreak * 2);

  return Math.round(score);
}

function getSortedByPriority(items) {
  return [...items].sort((a, b) => {
    const scoreDiff = b.reviewPriority - a.reviewPriority;
    if (scoreDiff !== 0) return scoreDiff;

    const nextA = a.nextReviewDate ? a.nextReviewDate.getTime() : Number.POSITIVE_INFINITY;
    const nextB = b.nextReviewDate ? b.nextReviewDate.getTime() : Number.POSITIVE_INFINITY;
    if (nextA !== nextB) return nextA - nextB;

    return String(a.term || "").localeCompare(String(b.term || ""));
  });
}

function getHealthSummary({ accuracyRate, dominatedCount, totalCards, overdueCount, difficultCount }) {
  const dominatedRate = totalCards > 0 ? (dominatedCount / totalCards) * 100 : 0;
  const pressureRate = totalCards > 0 ? (overdueCount / totalCards) * 100 : 0;
  const difficultRate = totalCards > 0 ? (difficultCount / totalCards) * 100 : 0;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(accuracyRate * 0.5 + dominatedRate * 0.3 + (100 - pressureRate) * 0.15 + (100 - difficultRate) * 0.05)
    )
  );

  if (score >= 85) {
    return { score, label: "Memoria forte", description: "Seu vocabulário esta consistente." };
  }
  if (score >= 65) {
    return { score, label: "Memoria estavel", description: "Bom progresso; mantenha revisoes regulares." };
  }
  if (score >= 45) {
    return { score, label: "Precisa de ritmo", description: "A fila de revisoes merece mais atencao." };
  }
  return { score, label: "Risco de esquecimento", description: "Priorize itens atrasados e dificeis agora." };
}

export function normalizeReviewPreferences(rawPreferences) {
  if (!rawPreferences) return { ...DEFAULT_REVIEW_PREFERENCES };

  if (typeof rawPreferences === "string") {
    return { pace: normalizeReviewPace(rawPreferences) };
  }

  return {
    pace: normalizeReviewPace(rawPreferences.pace),
  };
}

export function loadReviewPreferences() {
  if (typeof window === "undefined") {
    return { ...DEFAULT_REVIEW_PREFERENCES };
  }

  try {
    const rawValue = localStorage.getItem(REVIEW_PREFERENCES_STORAGE_KEY);
    if (!rawValue) return { ...DEFAULT_REVIEW_PREFERENCES };
    return normalizeReviewPreferences(JSON.parse(rawValue));
  } catch {
    return { ...DEFAULT_REVIEW_PREFERENCES };
  }
}

export function saveReviewPreferences(preferences) {
  const normalized = normalizeReviewPreferences(preferences);
  if (typeof window !== "undefined") {
    localStorage.setItem(
      REVIEW_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ ...normalized, updated_at: new Date().toISOString() })
    );
  }
  return normalized;
}

export function createInitialStats(overrides = {}, preferences) {
  return normalizeStats(
    {
      ...DEFAULT_STATS,
      ...overrides,
    },
    preferences
  );
}

export function calculateAccuracy(stats) {
  const safeStats = stats || {};
  const correct = toSafeNonNegativeNumber(safeStats.correct, 0);
  const incorrect = toSafeNonNegativeNumber(safeStats.incorrect, 0);
  const totalAttempts = correct + incorrect;
  if (totalAttempts <= 0) return 0;
  return Math.round((correct / totalAttempts) * 100);
}

export function calculateStatus(stats) {
  const safeStats = stats || {};
  const totalReviews = toSafeInteger(safeStats.total_reviews, 0);
  const correctStreak = toSafeInteger(safeStats.correct_streak, 0);
  const difficultySignals = toSafeInteger(safeStats.difficulty_signals, 0);
  const confidenceSignals = toSafeInteger(safeStats.confidence_signals, 0);

  if (correctStreak >= MASTERY_CORRECT_STREAK) {
    return LEARNING_STATUS.DOMINADA;
  }

  if (totalReviews < 3) return LEARNING_STATUS.NOVA;

  const accuracyRate = calculateAccuracy(safeStats);
  const difficultyPressure = difficultySignals > confidenceSignals + 2;
  if (accuracyRate < 50 || difficultyPressure) return LEARNING_STATUS.DIFICIL;
  return LEARNING_STATUS.NOVA;
}

export function calculateLearningStatus(stats) {
  const safeStats = stats || {};
  const totalReviews = toSafeInteger(safeStats.total_reviews, 0);
  if (totalReviews <= 0) return LEARNING_STATUS.NOVA;

  const baseStatus = calculateStatus(safeStats);
  if (baseStatus === LEARNING_STATUS.DOMINADA) return LEARNING_STATUS.DOMINADA;
  if (baseStatus === LEARNING_STATUS.DIFICIL) return LEARNING_STATUS.DIFICIL;
  return LEARNING_STATUS.APRENDENDO;
}

export function normalizeStats(rawStats, preferences) {
  const source = rawStats && typeof rawStats === "object" ? rawStats : {};
  const paceConfig = getReviewPaceConfig(preferences);

  const normalized = {
    ...DEFAULT_STATS,
    ...source,
  };

  normalized.correct = toSafeInteger(normalized.correct, 0);
  normalized.incorrect = toSafeInteger(normalized.incorrect, 0);
  normalized.total_reviews = toSafeInteger(normalized.total_reviews, 0);
  normalized.avg_response_time = toSafeInteger(normalized.avg_response_time, 0);
  normalized.last_reviewed = normalizeIsoDate(normalized.last_reviewed);
  normalized.last_result = normalizeReviewResult(normalized.last_result);
  normalized.last_review_mode = normalizeReviewMode(normalized.last_review_mode);
  normalized.correct_streak = pickMetric(normalized, [
    "correct_streak",
    "consecutive_correct",
    "current_correct_streak",
    "correctStreak",
  ]);
  normalized.flashcard_confident_without_reveal = pickMetric(normalized, [
    "flashcard_confident_without_reveal",
    "flashcard_answered_without_reveal",
  ]);
  normalized.flashcard_revealed_before_answer = pickMetric(normalized, [
    "flashcard_revealed_before_answer",
    "flashcard_revealed_count",
  ]);
  normalized.quiz_answered_count = pickMetric(normalized, [
    "quiz_answered_count",
    "quiz_answer_count",
  ]);
  normalized.quiz_total_response_ms = pickMetric(normalized, [
    "quiz_total_response_ms",
    "quiz_response_total_ms",
  ]);
  normalized.quiz_slow_response_count = pickMetric(normalized, [
    "quiz_slow_response_count",
    "quiz_slow_answers",
  ]);
  normalized.quiz_dont_remember_count = pickMetric(normalized, [
    "quiz_dont_remember_count",
    "quiz_no_remember_count",
    "quiz_did_not_remember_count",
    "quiz_forgotten_count",
  ]);
  normalized.quiz_average_response_ms = normalized.quiz_answered_count
    ? Math.round(normalized.quiz_total_response_ms / normalized.quiz_answered_count)
    : 0;
  normalized.combinations_rounds = pickMetric(normalized, [
    "combinations_rounds",
    "combination_rounds",
  ]);
  normalized.combinations_total_attempts = pickMetric(normalized, [
    "combinations_total_attempts",
    "combination_total_attempts",
  ]);
  normalized.combinations_extra_attempts = pickMetric(normalized, [
    "combinations_extra_attempts",
    "combination_extra_attempts",
  ]);
  normalized.combinations_first_try = pickMetric(normalized, [
    "combinations_first_try",
    "combination_first_try",
  ]);
  normalized.combinations_average_attempts = normalized.combinations_rounds
    ? normalized.combinations_total_attempts / normalized.combinations_rounds
    : 0;
  normalized.difficulty_signals = getDifficultySignals(normalized);
  normalized.confidence_signals = getConfidenceSignals(normalized);
  normalized.mastery_threshold = MASTERY_CORRECT_STREAK;
  normalized.mastery_remaining = Math.max(
    0,
    MASTERY_CORRECT_STREAK - normalized.correct_streak
  );

  const fallbackStatus = normalizeBaseStatus(normalized.status);
  const calculatedStatus = calculateStatus({
    correct: normalized.correct,
    incorrect: normalized.incorrect,
    total_reviews: normalized.total_reviews,
    correct_streak: normalized.correct_streak,
    difficulty_signals: normalized.difficulty_signals,
    confidence_signals: normalized.confidence_signals,
  });

  normalized.status =
    normalized.total_reviews > 0 ? calculatedStatus : fallbackStatus;

  const hasStageValue = Number.isFinite(Number(normalized.review_stage));
  normalized.review_stage = hasStageValue
    ? clampStage(Number(normalized.review_stage))
    : inferStageFromStatus(normalized);

  const hasIntervalValue = Number.isFinite(Number(normalized.review_interval_days));
  normalized.review_interval_days = hasIntervalValue
    ? toSafeInteger(normalized.review_interval_days, 0)
    : deriveIntervalFromStage(normalized.review_stage, calculateLearningStatus(normalized), paceConfig);

  const nextReviewAt = normalizeIsoDate(normalized.next_review_at);
  if (nextReviewAt) {
    normalized.next_review_at = nextReviewAt;
  } else {
    const anchorDate =
      normalized.last_reviewed || new Date().toISOString();
    normalized.next_review_at = addDaysToIso(
      anchorDate,
      normalized.review_interval_days
    );
  }

  return normalized;
}

export function normalizeVocabularyItem(item, preferences) {
  const source = item && typeof item === "object" ? item : {};
  return {
    ...source,
    term: source.term || "",
    pronunciation: source.pronunciation || "",
    meanings: Array.isArray(source.meanings) ? source.meanings : [],
    stats: normalizeStats(source.stats, preferences),
    createdAt: source.createdAt || source.created_at || null,
    updatedAt: source.updatedAt || source.updated_at || null,
  };
}

export function calculateNextReview(stats, preferences, options = {}) {
  const paceConfig = getReviewPaceConfig(preferences);
  const normalized = normalizeStats(stats, preferences);
  const reviewResult = normalizeReviewResult(options.result);
  const reviewedAt = normalizeIsoDate(options.reviewedAt) || new Date().toISOString();
  const learningStatus = calculateLearningStatus(normalized);

  let stage = clampStage(normalized.review_stage);
  if (reviewResult === "correct") {
    stage = clampStage(stage + 1);
  } else if (reviewResult === "incorrect") {
    stage = clampStage(stage - 2);
  }

  if (learningStatus === LEARNING_STATUS.DIFICIL) {
    stage = Math.min(stage, 2);
  }

  if (learningStatus === LEARNING_STATUS.DOMINADA && reviewResult === "correct") {
    stage = Math.max(stage, 3);
  }

  let intervalDays = deriveIntervalFromStage(stage, learningStatus, paceConfig);

  if (reviewResult === "incorrect") {
    intervalDays = paceConfig.retryIntervalDays;
  }

  if (normalized.total_reviews <= 0) {
    intervalDays = 0;
  }

  const nextReviewAt = addDaysToIso(reviewedAt, intervalDays);

  return {
    review_stage: stage,
    review_interval_days: intervalDays,
    next_review_at: nextReviewAt,
    last_result: reviewResult || normalized.last_result,
    last_review_mode:
      normalizeReviewMode(options.mode) || normalized.last_review_mode,
  };
}

export function updateStatsAfterReview(itemOrStats, result, options = {}) {
  const sourceStats = itemOrStats?.stats ?? itemOrStats ?? {};
  const normalized = normalizeStats(sourceStats, options.preferences);
  const reviewResult = normalizeReviewResult(result);
  const isCorrect = reviewResult === "correct";
  const reviewedAt = normalizeIsoDate(options.reviewedAt) || new Date().toISOString();
  const reviewMode = normalizeReviewMode(options.mode);

  const responseTimeRaw = Number(options.responseTimeMs);
  const hasResponseTime = Number.isFinite(responseTimeRaw) && responseTimeRaw > 0;
  const responseTimeMs = hasResponseTime ? Math.round(responseTimeRaw) : null;

  const nextCorrect = normalized.correct + (isCorrect ? 1 : 0);
  const nextIncorrect = normalized.incorrect + (isCorrect ? 0 : 1);
  const nextTotal = normalized.total_reviews + 1;
  const nextCorrectStreak = isCorrect ? normalized.correct_streak + 1 : 0;

  const nextAverageResponse = hasResponseTime
    ? Math.round(
        ((normalized.avg_response_time || 0) * (normalized.total_reviews || 0) +
          responseTimeMs) /
          Math.max(1, nextTotal)
      )
    : normalized.avg_response_time;

  const nextBaseStats = {
    ...normalized,
    correct: nextCorrect,
    incorrect: nextIncorrect,
    total_reviews: nextTotal,
    avg_response_time: nextAverageResponse,
    correct_streak: nextCorrectStreak,
    last_reviewed: reviewedAt,
    last_review_mode: reviewMode || normalized.last_review_mode,
    mastery_threshold: MASTERY_CORRECT_STREAK,
    mastery_remaining: Math.max(0, MASTERY_CORRECT_STREAK - nextCorrectStreak),
  };

  if (reviewMode === "flashcards") {
    if (normalizeBoolean(options.answeredWithoutReveal)) {
      nextBaseStats.flashcard_confident_without_reveal += 1;
    }

    if (normalizeBoolean(options.revealedBeforeAnswer)) {
      nextBaseStats.flashcard_revealed_before_answer += 1;
    }
  }

  if (reviewMode === "quiz" && hasResponseTime) {
    nextBaseStats.quiz_answered_count += 1;
    nextBaseStats.quiz_total_response_ms += responseTimeMs;
    nextBaseStats.quiz_average_response_ms = nextBaseStats.quiz_answered_count
      ? Math.round(nextBaseStats.quiz_total_response_ms / nextBaseStats.quiz_answered_count)
      : 0;

    if (responseTimeMs >= QUIZ_SLOW_RESPONSE_MS) {
      nextBaseStats.quiz_slow_response_count += 1;
    }

    if (
      normalizeBoolean(options.didNotRemember) ||
      normalizeBoolean(options.dontRemember) ||
      normalizeBoolean(options.quizDontRemember)
    ) {
      nextBaseStats.quiz_dont_remember_count += 1;
    }
  }

  if (reviewMode === "combinations" && normalizeBoolean(options.isFinalMatch)) {
    const attempts = Math.max(1, toSafeInteger(options.attempts, 1));
    nextBaseStats.combinations_rounds += 1;
    nextBaseStats.combinations_total_attempts += attempts;
    nextBaseStats.combinations_average_attempts = nextBaseStats.combinations_rounds
      ? nextBaseStats.combinations_total_attempts / nextBaseStats.combinations_rounds
      : 0;
    nextBaseStats.combinations_extra_attempts += Math.max(0, attempts - 1);

    if (attempts === 1) {
      nextBaseStats.combinations_first_try += 1;
    }
  }

  nextBaseStats.difficulty_signals = getDifficultySignals(nextBaseStats);
  nextBaseStats.confidence_signals = getConfidenceSignals(nextBaseStats);
  nextBaseStats.status = calculateStatus(nextBaseStats);

  const nextSchedule = calculateNextReview(nextBaseStats, options.preferences, {
    result: reviewResult,
    reviewedAt,
    mode: reviewMode,
  });

  return normalizeStats(
    {
      ...nextBaseStats,
      ...nextSchedule,
    },
    options.preferences
  );
}

export function getDerivedLearningState(item, preferences, options = {}) {
  const normalizedItem = normalizeVocabularyItem(item, preferences);
  const safeStats = normalizedItem.stats;
  const accuracyRate = calculateAccuracy(safeStats);
  const learningStatus = calculateLearningStatus(safeStats);
  const now = options.now ? new Date(options.now) : new Date();
  const todayStart = toStartOfDay(now);
  const todayEnd = toEndOfDay(now);
  const nextReviewDate = parseIsoDate(safeStats.next_review_at);
  const isNewItem = learningStatus === LEARNING_STATUS.NOVA && safeStats.total_reviews <= 0;

  const isDueToday =
    isNewItem || !nextReviewDate || nextReviewDate.getTime() <= todayEnd.getTime();
  const isDueNow =
    isNewItem || !nextReviewDate || nextReviewDate.getTime() <= now.getTime();
  const isOverdue = Boolean(
    nextReviewDate && nextReviewDate.getTime() < todayStart.getTime()
  );

  const overdueDays = isOverdue
    ? Math.max(1, Math.floor((todayStart.getTime() - nextReviewDate.getTime()) / DAY_IN_MS))
    : 0;
  const daysUntilNextReview = nextReviewDate
    ? Math.ceil((nextReviewDate.getTime() - now.getTime()) / DAY_IN_MS)
    : 0;

  const result = {
    ...normalizedItem,
    accuracyRate,
    learningStatus,
    nextReviewDate,
    isDueToday,
    isDueNow,
    isOverdue,
    overdueDays,
    daysUntilNextReview,
  };

  result.reviewPriority = getPriorityScore(result);
  return result;
}

export function getReviewPriority(item, preferences, options = {}) {
  const derived = getDerivedLearningState(item, preferences, options);
  return derived.reviewPriority;
}

function normalizeReviewFocus(rawFocus) {
  const value = String(rawFocus || "")
    .trim()
    .toLowerCase();

  switch (value) {
    case REVIEW_FOCUS.TODAY:
    case REVIEW_FOCUS.OVERDUE:
    case REVIEW_FOCUS.DIFFICULT:
    case REVIEW_FOCUS.LEARNING:
    case REVIEW_FOCUS.NEW:
    case REVIEW_FOCUS.MASTERED:
    case REVIEW_FOCUS.ATTENTION:
      return value;
    default:
      return REVIEW_FOCUS.ALL;
  }
}

export function getDueItems(items, preferences, options = {}) {
  const list = Array.isArray(items) ? items : [];
  const derivedItems = list.map((item) => getDerivedLearningState(item, preferences, options));
  const sorted = getSortedByPriority(derivedItems);

  const dueToday = sorted.filter((item) => item.isDueToday);
  const overdue = sorted.filter((item) => item.isOverdue);
  const difficult = sorted.filter(
    (item) => item.learningStatus === LEARNING_STATUS.DIFICIL
  );
  const learning = sorted.filter(
    (item) => item.learningStatus === LEARNING_STATUS.APRENDENDO
  );
  const fresh = sorted.filter((item) => item.learningStatus === LEARNING_STATUS.NOVA);
  const dominated = sorted.filter(
    (item) => item.learningStatus === LEARNING_STATUS.DOMINADA
  );
  const needsAttention = sorted.filter(
    (item) =>
      item.learningStatus === LEARNING_STATUS.DIFICIL ||
      item.isOverdue ||
      toSafeInteger(item.stats.difficulty_signals, 0) >
        toSafeInteger(item.stats.confidence_signals, 0) + 1 ||
      (item.learningStatus === LEARNING_STATUS.APRENDENDO && item.accuracyRate < 65)
  );
  const upcoming = sorted
    .filter((item) => !item.isDueToday && item.nextReviewDate)
    .sort((a, b) => a.nextReviewDate.getTime() - b.nextReviewDate.getTime());

  return {
    all: sorted,
    dueToday,
    overdue,
    difficult,
    learning,
    fresh,
    dominated,
    needsAttention,
    upcoming,
  };
}

export function getStudyQueue(items, preferences, focus = REVIEW_FOCUS.ALL, options = {}) {
  const normalizedFocus = normalizeReviewFocus(focus);
  const grouped = getDueItems(items, preferences, options);

  let selected = grouped.all;

  if (normalizedFocus === REVIEW_FOCUS.TODAY) selected = grouped.dueToday;
  if (normalizedFocus === REVIEW_FOCUS.OVERDUE) selected = grouped.overdue;
  if (normalizedFocus === REVIEW_FOCUS.DIFFICULT) selected = grouped.difficult;
  if (normalizedFocus === REVIEW_FOCUS.LEARNING) selected = grouped.learning;
  if (normalizedFocus === REVIEW_FOCUS.NEW) selected = grouped.fresh;
  if (normalizedFocus === REVIEW_FOCUS.MASTERED) selected = grouped.dominated;
  if (normalizedFocus === REVIEW_FOCUS.ATTENTION) selected = grouped.needsAttention;

  const usedFallback = normalizedFocus !== REVIEW_FOCUS.ALL && selected.length === 0;
  const queue = usedFallback ? grouped.all : selected;

  return {
    focus: normalizedFocus,
    usedFallback,
    items: queue.map((item) => ({
      ...item,
      stats: item.stats,
    })),
  };
}

export function getProgressSummary(items, preferences, options = {}) {
  const list = Array.isArray(items) ? items : [];
  const dueGroups = getDueItems(list, preferences, options);
  const paceConfig = getReviewPaceConfig(preferences);

  const totalCards = list.length;
  const fresh = dueGroups.fresh.length;
  const dominated = dueGroups.dominated.length;
  const difficult = dueGroups.difficult.length;
  const learning = dueGroups.learning.length;
  const studied = Math.max(0, totalCards - fresh);

  const totals = dueGroups.all.reduce(
    (acc, item) => {
      acc.correct += toSafeInteger(item.stats.correct, 0);
      acc.incorrect += toSafeInteger(item.stats.incorrect, 0);
      acc.reviews += toSafeInteger(item.stats.total_reviews, 0);
      acc.weightedResponseTime +=
        toSafeInteger(item.stats.avg_response_time, 0) *
        toSafeInteger(item.stats.total_reviews, 0);
      acc.flashcardConfidentWithoutReveal += toSafeInteger(
        item.stats.flashcard_confident_without_reveal,
        0
      );
      acc.flashcardRevealedBeforeAnswer += toSafeInteger(
        item.stats.flashcard_revealed_before_answer,
        0
      );
      acc.quizAnsweredCount += toSafeInteger(item.stats.quiz_answered_count, 0);
      acc.quizTotalResponseMs += toSafeInteger(item.stats.quiz_total_response_ms, 0);
      acc.quizSlowResponseCount += toSafeInteger(item.stats.quiz_slow_response_count, 0);
      acc.quizDontRememberCount += toSafeInteger(item.stats.quiz_dont_remember_count, 0);
      acc.combinationsRounds += toSafeInteger(item.stats.combinations_rounds, 0);
      acc.combinationsTotalAttempts += toSafeInteger(
        item.stats.combinations_total_attempts,
        0
      );
      acc.combinationsExtraAttempts += toSafeInteger(
        item.stats.combinations_extra_attempts,
        0
      );
      acc.combinationsFirstTry += toSafeInteger(item.stats.combinations_first_try, 0);
      acc.difficultySignals += toSafeInteger(item.stats.difficulty_signals, 0);
      acc.confidenceSignals += toSafeInteger(item.stats.confidence_signals, 0);
      return acc;
    },
    {
      correct: 0,
      incorrect: 0,
      reviews: 0,
      weightedResponseTime: 0,
      flashcardConfidentWithoutReveal: 0,
      flashcardRevealedBeforeAnswer: 0,
      quizAnsweredCount: 0,
      quizTotalResponseMs: 0,
      quizSlowResponseCount: 0,
      combinationsRounds: 0,
      combinationsTotalAttempts: 0,
      combinationsExtraAttempts: 0,
      combinationsFirstTry: 0,
      quizDontRememberCount: 0,
      difficultySignals: 0,
      confidenceSignals: 0,
    }
  );

  const totalAttempts = totals.correct + totals.incorrect;
  const accuracyRate =
    totalAttempts > 0 ? Math.round((totals.correct / totalAttempts) * 100) : 0;
  const averageResponseMs =
    totals.reviews > 0
      ? Math.round(totals.weightedResponseTime / totals.reviews)
      : 0;

  const hardestWords = [...dueGroups.all]
    .filter((item) => toSafeInteger(item.stats.incorrect, 0) > 0)
    .sort((a, b) => {
      const errorDiff =
        toSafeInteger(b.stats.incorrect, 0) - toSafeInteger(a.stats.incorrect, 0);
      if (errorDiff !== 0) return errorDiff;
      return b.reviewPriority - a.reviewPriority;
    })
    .slice(0, 6);

  const nearMasteryWords = [...dueGroups.learning]
    .filter(
      (item) =>
        toSafeInteger(item.stats.correct_streak, 0) > 0 &&
        toSafeInteger(item.stats.correct_streak, 0) < MASTERY_CORRECT_STREAK
    )
    .sort(
      (a, b) =>
        toSafeInteger(b.stats.correct_streak, 0) -
        toSafeInteger(a.stats.correct_streak, 0)
    )
    .slice(0, 6);

  const staleDominatedWords = [...dueGroups.dominated]
    .filter((item) => item.overdueDays >= paceConfig.staleMasteredDays)
    .sort((a, b) => b.overdueDays - a.overdueDays)
    .slice(0, 6);

  const health = getHealthSummary({
    accuracyRate,
    dominatedCount: dominated,
    totalCards,
    overdueCount: dueGroups.overdue.length,
    difficultCount: difficult,
  });

  return {
    totalCards,
    studied,
    dominated,
    difficult,
    learning,
    fresh,
    dueToday: dueGroups.dueToday.length,
    overdue: dueGroups.overdue.length,
    needsAttention: dueGroups.needsAttention.length,
    upcoming: dueGroups.upcoming.length,
    totalCorrect: totals.correct,
    totalIncorrect: totals.incorrect,
    totalReviews: totals.reviews,
    accuracyRate,
    averageResponseMs,
    flashcardConfidentWithoutReveal: totals.flashcardConfidentWithoutReveal,
    flashcardRevealedBeforeAnswer: totals.flashcardRevealedBeforeAnswer,
    quizAnsweredCount: totals.quizAnsweredCount,
    quizTotalResponseMs: totals.quizTotalResponseMs,
    quizAverageResponseMs: totals.quizAnsweredCount
      ? Math.round(totals.quizTotalResponseMs / totals.quizAnsweredCount)
      : 0,
    quizSlowResponseCount: totals.quizSlowResponseCount,
    quizDontRememberCount: totals.quizDontRememberCount,
    combinationsRounds: totals.combinationsRounds,
    combinationsTotalAttempts: totals.combinationsTotalAttempts,
    combinationsAverageAttempts: totals.combinationsRounds
      ? totals.combinationsTotalAttempts / totals.combinationsRounds
      : 0,
    combinationsExtraAttempts: totals.combinationsExtraAttempts,
    combinationsFirstTry: totals.combinationsFirstTry,
    difficultySignals: totals.difficultySignals,
    confidenceSignals: totals.confidenceSignals,
    masteryCorrectStreak: MASTERY_CORRECT_STREAK,
    hardestWords,
    dominatedWords: dueGroups.dominated.slice(0, 6),
    learningWords: dueGroups.learning.slice(0, 6),
    newWords: dueGroups.fresh.slice(0, 6),
    dueTodayWords: dueGroups.dueToday.slice(0, 8),
    overdueWords: dueGroups.overdue.slice(0, 8),
    needsAttentionWords: dueGroups.needsAttention.slice(0, 8),
    upcomingWords: dueGroups.upcoming.slice(0, 8),
    nearMasteryWords,
    staleDominatedWords,
    health,
  };
}

export function getInternalNotifications(items, preferences, options = {}) {
  const summary = getProgressSummary(items, preferences, options);
  const paceConfig = getReviewPaceConfig(preferences);
  const notifications = [];

  if (summary.dueToday > 0) {
    notifications.push({
      id: "due-today",
      type: "info",
      count: summary.dueToday,
      title: "Revisoes para hoje",
      message: `Voce tem ${summary.dueToday} palavra(s) para revisar hoje.`,
    });
  }

  if (summary.overdue > 0) {
    notifications.push({
      id: "overdue",
      type: "warning",
      count: summary.overdue,
      title: "Itens atrasados",
      message: `${summary.overdue} palavra(s) estao atrasadas e precisam voltar para fila.`,
    });
  }

  if (summary.difficult > 0) {
    notifications.push({
      id: "difficult",
      type: "warning",
      count: summary.difficult,
      title: "Palavras dificeis",
      message: `${summary.difficult} palavra(s) dificeis precisam de reforco.`,
    });
  }

  if (summary.staleDominatedWords.length > 0) {
    notifications.push({
      id: "stale-mastered",
      type: "info",
      count: summary.staleDominatedWords.length,
      title: "Dominadas sem revisao",
      message: `${summary.staleDominatedWords.length} palavra(s) dominadas estao ha tempo sem revisao.`,
    });
  }

  if (summary.fresh > 0) {
    notifications.push({
      id: "fresh",
      type: "info",
      count: summary.fresh,
      title: "Novas para iniciar",
      message: `${summary.fresh} palavra(s) novas ainda nao foram praticadas.`,
    });
  }

  if (summary.dueToday >= paceConfig.overloadDueThreshold) {
    notifications.push({
      id: "rhythm-overload",
      type: "warning",
      count: summary.dueToday,
      title: "Carga acumulada",
      message: "Seu ritmo atual esta acumulando muitas revisoes. Ajuste o foco da sessao de hoje.",
    });
  }

  if (summary.nearMasteryWords.length > 0) {
    notifications.push({
      id: "near-mastery",
      type: "success",
      count: summary.nearMasteryWords.length,
      title: "Perto de dominar",
      message: `Voce esta perto de dominar ${summary.nearMasteryWords.length} palavra(s).`,
    });
  }

  if (notifications.length === 0) {
    notifications.push({
      id: "all-clear",
      type: "success",
      count: 0,
      title: "Fila em dia",
      message: "Tudo certo por agora. Continue com revisoes leves para manter consistencia.",
    });
  }

  return notifications;
}
