// Harbour Line — tuning constants. One place for every number a designer
// would want to change: rounds, bots, damage, timings, colours.

export const CONFIG = {
  // Match structure
  totalRounds: 8,
  roundTimeSeconds: 90,
  roundsToWinMatch: 5,

  // Bots per round: round 1 fields 4, growing to 8 by round 6.
  botsForRound: (round) => Math.min(3 + round, 8),

  // Player
  playerHealth: 100,
  playerSpeed: 5.2, // metres per second walking
  sprintMultiplier: 1.45,
  playerRadius: 0.4,
  eyeHeight: 1.7,
  jumpSpeed: 5.0,
  gravity: 12.0,

  // Rifle (player)
  magSize: 24,
  reserveAmmo: 120,
  fireIntervalSeconds: 0.11,
  reloadSeconds: 1.6,
  damageBody: 34,
  damageHead: 100,
  spreadRadians: 0.011,
  rangeMetres: 120,

  // Bots
  botHealth: 100,
  botSpeed: 3.1,
  botSightRange: 42,
  botBurstShots: 3,
  botBurstInterval: 0.13,
  botBurstPause: 0.9,
  botDamageNear: 8,
  botDamageFar: 5,
  botHitChanceNear: 0.42, // at under 15 m, standing still
  botHitChanceFar: 0.22, // past 30 m
  botReactSeconds: 0.45, // delay before a bot that spots you fires

  // Scoring
  scoreElimination: 100,
  scoreHeadshotBonus: 50,
  scoreRoundWin: 250,
  scoreStreakStep: 25, // extra per kill in a streak, capped below
  scoreStreakCap: 150,

  // Colours (teams and dusk palette)
  colours: {
    you: 0x3fa7ff,
    youCss: '#3fa7ff',
    cinder: 0xff7a2f,
    cinderCss: '#ff7a2f',
    skyTop: '#241a33',
    skyHorizon: '#e8703a',
    fog: 0x2e2138,
    ground: 0x4a4238,
    containerA: 0xb3402e,
    containerB: 0x2e6f8e,
    containerC: 0x7a7d33,
    crate: 0x8a6b42,
    lighthouseRed: 0xc23b2a,
    lighthouseWhite: 0xe8e2d4,
  },
};

// Named rounds, shown on the banner so each round feels distinct.
export const ROUND_NAMES = [
  'FIRST LIGHT',
  'LOW TIDE',
  'CRANE YARD',
  'FOG ROLL',
  'HIGH STAKES',
  'NIGHT SHIFT',
  'LAST LIGHT',
  'FINAL CALL',
];
