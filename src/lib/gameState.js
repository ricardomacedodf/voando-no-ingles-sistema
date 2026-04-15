const GAME_STATE_KEY = "voando_game_state";
const SOUND_STATE_KEY = "voando_sound_state";
const VOCAB_STORAGE_KEY = "vocabulary_items";

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
  profile: "minimal_pop",
  interactions: {
    selection: true,
    correct: true,
    incorrect: true,
    advance: true,
    flip: true,
    completion: true,
    import_done: true,
    admin_action: true,
    critical_action: true,
  },
};

function getStoredVocabulary() {
  try {
    const raw = localStorage.getItem(VOCAB_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erro ao ler vocabulary_items:", error);
    return [];
  }
}

function saveStoredVocabulary(items) {
  localStorage.setItem(VOCAB_STORAGE_KEY, JSON.stringify(items));
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

export function syncDominatedCount() {
  const state = getGameState();
  const vocab = getStoredVocabulary();

  const dominatedCount = vocab.filter(
    (item) => item?.stats?.status === "dominada"
  ).length;

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
    const vocab = getStoredVocabulary();

    const cleanedVocab = vocab.map((item) => ({
      ...item,
      stats: {
        correct: 0,
        incorrect: 0,
        total_reviews: 0,
        avg_response_time: 0,
        status: "nova",
      },
      updatedAt: new Date().toISOString(),
    }));

    saveStoredVocabulary(cleanedVocab);

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
  try {
    const stored = localStorage.getItem(SOUND_STATE_KEY);
    if (stored) {
      return { ...defaultSoundState, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Erro ao ler sound state:", error);
  }

  return { ...defaultSoundState };
}

export function saveSoundState(state) {
  localStorage.setItem(SOUND_STATE_KEY, JSON.stringify(state));
}

export function playSound(type) {
  const soundState = getSoundState();
  if (!soundState.enabled) return;
  if (!soundState.interactions[type]) return;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.value = soundState.volume * 0.3;

  const profiles = {
    minimal_pop: {
      correct: { freq: 880, type: "sine", dur: 0.15 },
      incorrect: { freq: 220, type: "triangle", dur: 0.2 },
      selection: { freq: 600, type: "sine", dur: 0.08 },
      advance: { freq: 700, type: "sine", dur: 0.12 },
      flip: { freq: 500, type: "sine", dur: 0.1 },
      completion: { freq: 1000, type: "sine", dur: 0.25 },
      import_done: { freq: 900, type: "sine", dur: 0.2 },
      admin_action: { freq: 650, type: "sine", dur: 0.1 },
      critical_action: { freq: 300, type: "sawtooth", dur: 0.15 },
    },
    soft_glass: {
      correct: { freq: 1200, type: "sine", dur: 0.12 },
      incorrect: { freq: 180, type: "sine", dur: 0.25 },
      selection: { freq: 800, type: "sine", dur: 0.06 },
      advance: { freq: 900, type: "sine", dur: 0.1 },
      flip: { freq: 700, type: "sine", dur: 0.08 },
      completion: { freq: 1400, type: "sine", dur: 0.2 },
      import_done: { freq: 1100, type: "sine", dur: 0.18 },
      admin_action: { freq: 850, type: "sine", dur: 0.08 },
      critical_action: { freq: 250, type: "sine", dur: 0.2 },
    },
    clean_tap: {
      correct: { freq: 1000, type: "square", dur: 0.05 },
      incorrect: { freq: 200, type: "square", dur: 0.08 },
      selection: { freq: 700, type: "square", dur: 0.03 },
      advance: { freq: 800, type: "square", dur: 0.05 },
      flip: { freq: 600, type: "square", dur: 0.04 },
      completion: { freq: 1200, type: "square", dur: 0.1 },
      import_done: { freq: 1000, type: "square", dur: 0.08 },
      admin_action: { freq: 750, type: "square", dur: 0.04 },
      critical_action: { freq: 280, type: "square", dur: 0.06 },
    },
  };

  const profile = profiles[soundState.profile] || profiles.minimal_pop;
  const sound = profile[type] || { freq: 600, type: "sine", dur: 0.1 };

  osc.frequency.value = sound.freq;
  osc.type = sound.type;
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + sound.dur);
  osc.stop(ctx.currentTime + sound.dur + 0.05);
}