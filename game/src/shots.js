// Harbour Line — screenshot scenes. Each ?shot=<name> stages one frozen
// frame of the real game: real world, real bots, real HUD, fixed camera.
// The main loop skips gameplay updates while a scene is staged, so the
// frame a screenshot takes is exactly the frame staged here.

import * as THREE from 'three';
import { Bot } from './bots.js';

function aimCameraAt(player, target) {
  const dx = target.x - player.position.x;
  const dz = target.z - player.position.z;
  player.yaw = Math.atan2(-dx, -dz);
  const dy = (target.y ?? 1.2) - 1.7;
  const dist = Math.hypot(dx, dz);
  player.pitch = Math.atan2(dy, dist);
  player.camera.position.copy(player.position);
  player.camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
}

function placeBots(ctx, spots) {
  const { bots, world, scene } = ctx;
  let id = 100;
  for (const spot of spots) {
    const bot = new Bot(scene, spot, world.waypoints, id++);
    bot.yaw = Math.atan2(ctx.player.position.x - spot.x, ctx.player.position.z - spot.z);
    bot.mesh.rotation.y = bot.yaw;
    bots.push(bot);
  }
  return bots;
}

function setHud(ctx, { round, you, cinder, seconds, health, mag, reserve, objective }) {
  const { hud, state } = ctx;
  state.round = round;
  state.roundsWon = you;
  state.roundsLost = cinder;
  state.roundTimeLeft = seconds;
  hud.setRound(round);
  hud.setScores(you, cinder);
  hud.setTimer(seconds);
  hud.setHealth(health);
  hud.setAmmo(mag, reserve, false);
  hud.setObjective(objective);
  hud.showHud(true);
  hud.showMenu(false);
  hud.showResults(false, null);
  hud.setPrompt('');
}

export function stageShotScene(ctx) {
  const params = new URLSearchParams(location.search);
  const name = params.get('shot');
  const { scene, camera, player, rifle, hud, state, world, effects } = ctx;

  if (name === 'title') {
    // Title screen: the yard behind the menu, bots patrolling mid-yard.
    state.phase = 'title';
    player.position.set(0, 1.7, 24);
    aimCameraAt(player, { x: -4, y: 2, z: -14 });
    placeBots(ctx, [
      { x: -6, z: 2 }, { x: 6, z: -2 }, { x: 0, z: -8 },
    ]);
    hud.showHud(false);
    hud.showMenu(true);
    return null;
  }

  if (name === 'fight') {
    // Mid-firefight, round 3: the player is trading shots with a squad
    // across the container lane, tracer and muzzle flash frozen mid-frame.
    state.phase = 'playing';
    player.position.set(-2, 1.7, 6);
    player.health = 82;
    const bots = placeBots(ctx, [
      { x: 4, z: -2 }, { x: -8, z: 0 }, { x: 12, z: -6 }, { x: -14, z: 6 }, { x: 8, z: 4 },
    ]);
    aimCameraAt(player, { x: 4, y: 1.1, z: -2 });
    setHud(ctx, {
      round: 3, you: 2, cinder: 1, seconds: 72,
      health: 82, mag: 17, reserve: 96, objective: 'CLEAR THE YARD',
    });
    rifle.mag = 17;
    rifle.reserve = 96;
    // Frozen action: our tracer to the bot in the crosshair, its muzzle
    // flash, sparks on the container behind it, and a fresh killfeed.
    const muzzle = rifle.muzzlePoint();
    const target = bots[0].chestPoint();
    effects.tracer(muzzle, target, 0xffd27a, 30);
    effects.muzzleFlash(muzzle, 30);
    effects.sparks(new THREE.Vector3(4, 1.4, -3), 0xffd27a, 12);
    hud.killfeed('YOU ✕ CINDER-101 — +100', true);
    hud.killfeed('YOU ⌖ CINDER-104 — HEADSHOT +150', true);
    // The floater and hitmarker animate on timers, so refresh them on the
    // frame just before the screenshot is taken (main.js calls this at
    // frame 2; __shotReady fires at frame 3). 'still' holds them visible.
    return () => {
      hud.floater('+100', false, true);
      hud.flashHitmarker(false, true);
    };
  }

  if (name === 'elim') {
    // The elimination moment, round 5: a bot just dropped in front of the
    // player, headshot floater and killfeed up, two more bots in view.
    state.phase = 'playing';
    player.position.set(4, 1.7, 2);
    player.health = 64;
    const bots = placeBots(ctx, [
      { x: 2, z: -3 }, { x: -10, z: -2 }, { x: 14, z: -8 },
    ]);
    bots[0].takeDamage(999); // the fallen one, tipped over at our feet
    aimCameraAt(player, { x: 2, y: 0.6, z: -3 });
    setHud(ctx, {
      round: 5, you: 3, cinder: 2, seconds: 48,
      health: 64, mag: 21, reserve: 72, objective: 'CLEAR THE YARD',
    });
    rifle.mag = 21;
    rifle.reserve = 72;
    hud.killfeed('YOU ⌖ CINDER-100 — HEADSHOT +150', true);
    return () => {
      hud.floater('+150', true, true);
      hud.flashHitmarker(true, true);
    };
  }

  if (name === 'end') {
    // Match end, high score: VICTORY, 6 rounds won, 34 eliminations.
    state.phase = 'matchEnd';
    player.position.set(0, 1.7, 24);
    aimCameraAt(player, { x: -4, y: 2, z: -14 });
    hud.showHud(false);
    hud.showMenu(false);
    hud.showResults(true, {
      won: true,
      roundsWon: 6,
      roundsLost: 2,
      eliminations: 34,
      score: 4850,
      accuracy: 62,
      bestStreak: 6,
    });
    return null;
  }

  // Unknown ?shot=: fall back to the title screen.
  state.phase = 'title';
  hud.showMenu(true);
  return null;
}
