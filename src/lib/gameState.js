import { initSfxSystem, playSfxEvent, SFX_EVENTS } from "./sfx";

const GAME_STATE_KEY = "voando_game_state";
export const GAME_STATE_UPDATED_EVENT = "voando:game-state-updated";
let cachedSoundState = null;

const defaultGameState = {
  xp: 0,
  level: 1,
  streak: 0,
  lastStudyDate: null,
  consecutiveCorrect: 0,
  maxConsecutiveCorrect: 0,
  totalStudySessions: 0,
  medals: [],
  dominatedCount: 0,
};

const defaultSoundState = {
  enabled: true,
  volume: 0.5,
  interactions: {
    [SFX_EVENTS.FLASHCARD_FLIP]: true,
    [SFX_EVENTS.FLASHCARD_DISCARD]: true,
    [SFX_EVENTS.QUIZ_SUCCESS]: true,
    [SFX_EVENTS.QUIZ_ERROR]: true,
    [SFX_EVENTS.MATCH_SELECT]: true,
    [SFX_EVENTS.MATCH_SUCCESS]: true,
    [SFX_EVENTS.MATCH_ERROR]: true,
    [SFX_EVENTS.EXAMPLES_OPEN]: true,
    [SFX_EVENTS.EXAMPLES_CLOSE]: true,
  },
};

function cloneSoundState(state) {
  return {
    ...state,
    interactions: { ...state.interactions },
  };
}

function normalizeSoundState(state) {
  return {
    ...defaultSoundState,
    ...(state || {}),
    interactions: {
      ...defaultSoundState.interactions,
      ...((state && state.interactions) || {}),
    },
    volume: clampVolume(state?.volume ?? defaultSoundState.volume),
  };
}

function clampVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.5;
  return Math.min(Math.max(numeric, 0), 1);
}

export function getDefaultGameState() {
  return { ...defaultGameState };
}

export function getGameState() {
  try {
    const stored = localStorage.getItem(GAME_STATE_KEY);
    if (stored) {
      return { ...defaultGameState, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Erro ao ler game state:", error);
  }
  return { ...defaultGameState };
}

export function saveGameState(state) {
  localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(GAME_STATE_UPDATED_EVENT, {
        detail: { state: { ...state } },
      })
    );
  }
}

export function addXP(amount) {
  const state = getGameState();
  state.xp += amount;

  if (state.xp < 0) state.xp = 0;

  const newLevel = Math.floor(state.xp / 100) + 1;
  const leveledUp = newLevel > state.level;
  state.level = newLevel;

  saveGameState(state);
  return { ...state, leveledUp };
}

export function updateStreak() {
  const state = getGameState();
  const today = new Date().toDateString();

  if (state.lastStudyDate === today) {
    return state;
  }

  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (state.lastStudyDate === yesterday) {
    state.streak += 1;
  } else {
    state.streak = 1;
  }

  state.lastStudyDate = today;
  saveGameState(state);
  return state;
}

export function recordStudySession() {
  const state = getGameState();
  state.totalStudySessions += 1;
  saveGameState(state);
  return state;
}

export function syncDominatedCount(value = 0) {
  const state = getGameState();

  let dominatedCount = state.dominatedCount || 0;

  if (Array.isArray(value)) {
    dominatedCount = value.filter(
      (item) => item?.stats?.status === "dominada"
    ).length;
  } else if (typeof value === "number") {
    dominatedCount = value;
  }

  state.dominatedCount = dominatedCount;
  saveGameState(state);
  return state;
}

export function recordCorrect() {
  const state = getGameState();
  state.consecutiveCorrect += 1;

  if (state.consecutiveCorrect > state.maxConsecutiveCorrect) {
    state.maxConsecutiveCorrect = state.consecutiveCorrect;
  }

  if (state.consecutiveCorrect === 10 && !state.medals.includes("streak_10")) {
    state.medals.push("streak_10");
  }

  saveGameState(state);
  return state;
}

export function recordIncorrect() {
  const state = getGameState();
  state.consecutiveCorrect = 0;
  saveGameState(state);
  return state;
}

export function checkDominatedMilestone(count) {
  const state = getGameState();

  if (count >= 100 && !state.medals.includes("crown_100")) {
    state.medals.push("crown_100");
    state.xp += 50;
    state.level = Math.floor(state.xp / 100) + 1;
    saveGameState(state);
    return { milestone: true, bonus: 50 };
  }

  return { milestone: false, bonus: 0 };
}

export function checkStreakMedals() {
  const state = getGameState();
  const medals = [];

  if (state.streak >= 3 && !state.medals.includes("streak_3")) {
    state.medals.push("streak_3");
    medals.push("streak_3");
  }

  if (state.streak >= 7 && !state.medals.includes("streak_7")) {
    state.medals.push("streak_7");
    medals.push("streak_7");
  }

  if (state.streak >= 30 && !state.medals.includes("streak_30")) {
    state.medals.push("streak_30");
    medals.push("streak_30");
  }

  if (medals.length > 0) {
    saveGameState(state);
  }

  return medals;
}

export function resetStudyHistory() {
  try {
    const resetState = {
      ...defaultGameState,
    };

    saveGameState(resetState);
    return { success: true };
  } catch (error) {
    console.error("Erro ao resetar histórico de estudo:", error);
    return { success: false, error };
  }
}

export function getSoundState() {
  if (!cachedSoundState) {
    cachedSoundState = normalizeSoundState();
  }

  return cloneSoundState(cachedSoundState);
}

export function saveSoundState(state) {
  cachedSoundState = normalizeSoundState(state);
}

export function playSound(type) {
  if (typeof window === "undefined") return;
  initSfxSystem();

  const soundState = getSoundState();
  if (!soundState.enabled) return;
  if (soundState.interactions?.[type] === false) return;
  playSfxEvent(type, { volume: clampVolume(soundState.volume) });
}

if (typeof window !== "undefined") {
  initSfxSystem();
}
