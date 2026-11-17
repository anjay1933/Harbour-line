// Harbour Line — the match. Wires the world, the player, the bots, the
// rifle, the effects, the sounds and the HUD into one loop, and runs the
// round flow: title -> playing -> round end -> ... -> match end -> restart.
// Also exposes window.__harbour for play-testing (state inspection only).

import * as THREE from 'three';
import { CONFIG, ROUND_NAMES } from './config.js';
import { createMatchState, accuracyOf, matchWon, eliminationScore } from './state.js';
import { buildWorld, collideCircle } from './world.js';
import { Player } from './player.js';
import { Bot, botHitChance } from './bots.js';
import { Rifle } from './weapons.js';
import { Effects } from './fx.js';
import { SoundBank } from './audio.js';
import { Hud } from './hud.js';
import { stageShotScene } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const staged = Boolean(shotName); // a ?shot= scene is frozen for its screenshot

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 220);
camera.rotation.order = 'YXZ';
scene.add(camera);

const world = buildWorld(scene);
const effects = new Effects(scene);
const sounds = new SoundBank();
const hud = new Hud();
const player = new Player(camera, world.colliders, world.spawns.player);
const rifle = new Rifle(camera, scene, effects);
const state = createMatchState();

let bots = [];
let botId = 0;
let paused = false;
let firing = false;
let roundBannerShown = false;
let matchOver = false;
let matchEndAt = 0; // when the results screen appeared

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- input: click to deploy / shoot, R reload, P pause -------------------

// The results screen must be readable before a click can skip it: a
// player still holding the trigger when the match ends would otherwise
// restart instantly on the very click that killed the last bot.
function matchEndReady() {
  return state.phase === 'matchEnd' && performance.now() - matchEndAt > 1500;
}

document.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  sounds.ensure();
  if (state.phase === 'title') {
    startMatch();
    return;
  }
  if (state.phase === 'matchEnd') {
    if (matchEndReady()) restartMatch();
    return;
  }
  if (state.phase !== 'playing' || paused) return;
  player.requestLock();
  firing = true;
  tryFire();
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) firing = false;
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') {
    if (state.phase === 'matchEnd') { if (matchEndReady()) restartMatch(); return; }
    if (state.phase === 'title') { startMatch(); return; }
    if (state.phase === 'playing' && !paused) {
      if (rifle.startReload()) sounds.reload();
    }
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state.phase === 'playing') togglePause();
  }
  if (e.code === 'Enter') {
    if (state.phase === 'title') startMatch();
    else if (state.phase === 'matchEnd' && matchEndReady()) restartMatch();
  }
});

// --- match flow ------------------------------------------------------------

function spawnRoundBots() {
  for (const bot of bots) bot.remove();
  bots = [];
  const count = CONFIG.botsForRound(state.round);
  const spots = [...world.spawns.bots];
  for (let i = 0; i < count; i++) {
    const spot = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    bots.push(new Bot(scene, spot, world.waypoints, botId++));
  }
  state.botsLeft = count;
}

function startRound() {
  state.phase = 'playing';
  state.roundTimeLeft = CONFIG.roundTimeSeconds;
  state.roundKills = 0;
  state.streak = 0;
  player.reset();
  rifle.reset();
  effects.clear();
  spawnRoundBots();
  hud.setRound(state.round);
  hud.setScores(state.roundsWon, state.roundsLost);
  hud.setHealth(player.health);
  hud.setAmmo(rifle.mag, rifle.reserve, false);
  hud.setObjective('CLEAR THE YARD');
  hud.showHud(true);
  hud.showMenu(false);
  hud.showResults(false, null);
  hud.showPause(false);
  paused = false;
  roundBannerShown = false;
  hud.banner(`ROUND ${state.round}`, ROUND_NAMES[state.round - 1] ?? '');
  sounds.roundHorn();
  hud.setPrompt('WASD MOVE · CLICK SHOOT · R RELOAD');
  setTimeout(() => { if (state.phase === 'playing') hud.setPrompt(''); }, 5000);
}

function startMatch() {
  Object.assign(state, createMatchState());
  matchOver = false;
  startRound();
}

function restartMatch() {
  startMatch();
}

function endRound(won) {
  state.phase = 'roundEnd';
  if (won) {
    state.roundsWon += 1;
    state.score += CONFIG.scoreRoundWin;
    hud.banner('ROUND WON', `+${CONFIG.scoreRoundWin} — YARD CLEAR`);
    sounds.roundHorn();
    hud.killfeed(`Round ${state.round} cleared — +${CONFIG.scoreRoundWin}`, true);
  } else {
    state.roundsLost += 1;
    state.deaths += 1;
    hud.banner('ROUND LOST', player.alive ? 'TIME UP — CINDER HOLDS THE YARD' : 'YOU WENT DOWN');
    sounds.roundLost();
  }
  hud.setScores(state.roundsWon, state.roundsLost);
  player.releaseLock();
  setTimeout(() => {
    if (state.phase !== 'roundEnd') return;
    if (state.round >= CONFIG.totalRounds) {
      endMatch();
    } else {
      state.round += 1;
      startRound();
    }
  }, 2600);
}

function endMatch() {
  state.phase = 'matchEnd';
  matchOver = true;
  matchEndAt = performance.now();
  hud.showHud(false);
  hud.showResults(true, {
    won: matchWon(state),
    roundsWon: state.roundsWon,
    roundsLost: state.roundsLost,
    eliminations: state.eliminations,
    score: state.score,
    accuracy: accuracyOf(state),
    bestStreak: state.bestStreak,
  });
  if (matchWon(state)) sounds.roundHorn();
  else sounds.roundLost();
}

function togglePause() {
  paused = !paused;
  hud.showPause(paused);
  if (paused) player.releaseLock();
  else player.requestLock();
}

// --- shooting --------------------------------------------------------------

function tryFire() {
  if (state.phase !== 'playing' || paused || !player.alive) return;
  const report = rifle.fire(bots, world.colliders);
  if (!report) {
    if (rifle.mag === 0 && !rifle.reloading && rifle.reserve > 0) {
      if (rifle.startReload()) sounds.reload();
    }
    return;
  }
  state.shotsFired += 1;
  sounds.shot();
  if (report.hit) {
    state.shotsHit += 1;
    hud.flashHitmarker(report.head);
    sounds.hit();
    const damage = report.head ? CONFIG.damageHead : CONFIG.damageBody;
    const killed = report.bot.takeDamage(damage);
    if (killed) onElimination(report.bot, report.head);
  }
}

function onElimination(bot, headshot) {
  state.eliminations += 1;
  state.roundKills += 1;
  state.streak += 1;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  state.botsLeft -= 1;
  const points = eliminationScore(state, headshot);
  state.score += points;
  hud.floater(`+${points}`, headshot);
  hud.killfeed(
    headshot ? `YOU ⌖ CINDER-${bot.id} — HEADSHOT +${points}` : `YOU ✕ CINDER-${bot.id} — +${points}`,
    true,
  );
  hud.setScores(state.roundsWon, state.roundsLost);
  sounds.elimination();
  if (state.botsLeft <= 0) endRound(true);
}

// A bot's shot at the player: tracer, sound, and a rolled hit.
function onBotShot(bot, dist) {
  const muzzle = new THREE.Vector3(bot.position.x, 1.25, bot.position.z)
    .add(new THREE.Vector3(Math.sin(bot.yaw) * 0.4, 0, Math.cos(bot.yaw) * 0.4));
  effects.tracer(muzzle, player.position.clone(), 0xff9a5a);
  effects.muzzleFlash(muzzle);
  sounds.enemyShot();
  const chance = botHitChance(dist, player.isMoving());
  if (Math.random() < chance && player.alive) {
    const damage = dist < 20 ? CONFIG.botDamageNear : CONFIG.botDamageFar;
    const killed = player.takeDamage(damage);
    hud.setHealth(player.health);
    hud.flashDamage();
    sounds.hurt();
    if (killed) {
      state.streak = 0;
      hud.killfeed(`CINDER-${bot.id} ✕ YOU`, false);
      endRound(false);
    }
  }
}

// --- the loop ---------------------------------------------------------------

const clock = new THREE.Clock();
let frames = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  frames += 1;

  if (state.phase === 'playing' && !paused && !staged) {
    player.update(dt);
    rifle.update(dt);
    if (firing && player.alive) tryFire();
    for (const bot of bots) bot.update(dt, player, world.colliders, onBotShot);
    state.roundTimeLeft -= dt;
    hud.setTimer(state.roundTimeLeft);
    hud.setAmmo(rifle.mag, rifle.reserve, rifle.reloading);
    if (state.roundTimeLeft <= 0) {
      if (state.botsLeft > 0) endRound(false);
    }
  }
  effects.update(dt);
  renderer.render(scene, camera);
  if (frames === 2 && shotRefresh) shotRefresh();
  if (frames === 3) window.__shotReady = true;
}

// --- debug handle for the play-test harness (state inspection only) --------
window.__harbour = {
  get state() { return state; },
  get player() { return player; },
  get bots() { return bots; },
  get rifle() { return rifle; },
  get paused() { return paused; },
  // Collision test for the play-test harness: returns the position the
  // player would end up at (identical input = no collision).
  collide: (x, z) => collideCircle({ x, z }, CONFIG.playerRadius, world.colliders),
  startMatch,
  restartMatch,
};

// --- boot: title screen, or a staged screenshot scene ---------------------
let shotRefresh = null;
if (shotName) {
  shotRefresh = stageShotScene({ scene, camera, player, rifle, bots, hud, state, world, effects, sounds });
} else {
  hud.showMenu(true);
  hud.setRound(1);
}
tick();
