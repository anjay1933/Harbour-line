// Harbour Line — match state. A plain object the loop, the HUD and the
// screenshot stager all read; nothing here touches the DOM or Three.js.

import { CONFIG } from './config.js';

// Phases: 'title' -> 'playing' -> 'roundEnd' -> 'playing' ... -> 'matchEnd'
export function createMatchState() {
  return {
    phase: 'title',
    round: 1,
    roundTimeLeft: CONFIG.roundTimeSeconds,
    roundsWon: 0,
    roundsLost: 0,
    score: 0,
    eliminations: 0,
    shotsFired: 0,
    shotsHit: 0,
    headshots: 0,
    streak: 0,
    bestStreak: 0,
    deaths: 0,
    // per-round bookkeeping, reset by startRound()
    roundKills: 0,
    botsLeft: 0,
  };
}

export function accuracyOf(state) {
  if (state.shotsFired === 0) return 0;
  return Math.round((100 * state.shotsHit) / state.shotsFired);
}

export function matchWon(state) {
  return state.roundsWon >= CONFIG.roundsToWinMatch;
}

// Score for one elimination, with headshot and streak bonuses.
export function eliminationScore(state, headshot) {
  let points = CONFIG.scoreElimination;
  if (headshot) points += CONFIG.scoreHeadshotBonus;
  const streakBonus = Math.min(
    state.streak * CONFIG.scoreStreakStep,
    CONFIG.scoreStreakCap,
  );
  return points + streakBonus;
}
