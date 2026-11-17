// Harbour Line — the rifle. A hitscan weapon: one ray from the camera, the
// nearest thing it meets (bot head, bot chest, or a wall) decides the hit.
// Owns ammo, fire rate, reload and the view-model gun you see at the bottom
// of the screen.

import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Rifle {
  constructor(camera, scene, effects) {
    this.camera = camera;
    this.scene = scene;
    this.effects = effects;
    this.mag = CONFIG.magSize;
    this.reserve = CONFIG.reserveAmmo;
    this.cooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.kick = 0; // view-model recoil, decays to zero
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = CONFIG.rangeMetres;

    // View-model: a simple rifle built from boxes, parented to the camera.
    this.viewModel = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x1f1c1a });
    const mid = new THREE.MeshLambertMaterial({ color: 0x4a4440 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.62), dark);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.34), mid);
    barrel.position.set(0, 0.03, -0.46);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.1), dark);
    grip.position.set(0, -0.13, 0.1);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.1), mid);
    sight.position.set(0, 0.1, -0.1);
    for (const part of [body, barrel, grip, sight]) this.viewModel.add(part);
    this.viewModel.position.set(0.28, -0.26, -0.55);
    this.viewModel.rotation.y = 0.06;
    this.camera.add(this.viewModel);
  }

  reset() {
    this.mag = CONFIG.magSize;
    this.reserve = CONFIG.reserveAmmo;
    this.cooldown = 0;
    this.reloading = false;
    this.kick = 0;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.kick = Math.max(0, this.kick - dt * 6);
    this.viewModel.position.z = -0.55 + this.kick * 0.09;
    this.viewModel.rotation.x = this.kick * 0.12;
    if (this.reloading) {
      this.reloadTimer -= dt;
      this.viewModel.rotation.x = -0.35 * Math.sin((Math.PI * (CONFIG.reloadSeconds - this.reloadTimer)) / CONFIG.reloadSeconds);
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        const needed = CONFIG.magSize - this.mag;
        const taken = Math.min(needed, this.reserve);
        this.mag += taken;
        this.reserve -= taken;
        this.viewModel.rotation.x = 0;
      }
    }
  }

  canFire() {
    return this.cooldown <= 0 && !this.reloading && this.mag > 0;
  }

  startReload() {
    if (this.reloading || this.mag === CONFIG.magSize || this.reserve <= 0) return false;
    this.reloading = true;
    this.reloadTimer = CONFIG.reloadSeconds;
    return true;
  }

  // Where the muzzle sits in the world, for the flash and the tracer.
  muzzlePoint() {
    const point = new THREE.Vector3(0.28, -0.2, -0.9);
    return this.camera.localToWorld(point);
  }

  // Fire one round. Returns a hit report the game loop scores, or null when
  // the shot cannot fire (cooling down, reloading, empty).
  fire(bots, colliders) {
    if (!this.canFire()) return null;
    this.cooldown = CONFIG.fireIntervalSeconds;
    this.mag -= 1;
    this.kick = 1;

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    // A little spread so long shots are not laser-perfect.
    dir.x += (Math.random() - 0.5) * CONFIG.spreadRadians * 2;
    dir.y += (Math.random() - 0.5) * CONFIG.spreadRadians * 2;
    dir.z += (Math.random() - 0.5) * CONFIG.spreadRadians * 2;
    dir.normalize();

    this.raycaster.set(this.camera.position, dir);
    this.raycaster.far = CONFIG.rangeMetres;

    // Test bots first: head spheres, then chest spheres, nearest wins.
    let best = null; // {bot, head, distance, point}
    for (const bot of bots) {
      if (!bot.alive) continue;
      const headHit = this.rayHitSphere(bot.headPoint(), 0.3);
      const chestHit = this.rayHitSphere(bot.chestPoint(), 0.55);
      for (const [hit, head] of [[headHit, true], [chestHit, false]]) {
        if (hit && (!best || hit.distance < best.distance)) {
          best = { bot, head, distance: hit.distance, point: hit.point };
        }
      }
    }

    // Walls stop a shot: the nearest collider face along the ray.
    const wallDist = this.rayHitWalls(colliders);
    if (best && wallDist !== null && wallDist < best.distance) best = null;

    const muzzle = this.muzzlePoint();
    const end = best ? best.point : this.camera.position.clone().addScaledVector(dir, wallDist ?? CONFIG.rangeMetres);
    this.effects.tracer(muzzle, end);
    this.effects.muzzleFlash(muzzle);

    if (best) {
      this.effects.sparks(best.point, 0xff6a3d, 16);
      return { hit: true, bot: best.bot, head: best.head, point: best.point };
    }
    if (wallDist !== null) this.effects.sparks(end, 0xcfc4a8, 8);
    return { hit: false, point: end };
  }

  rayHitSphere(centre, radius) {
    const origin = this.raycaster.ray.origin;
    const dir = this.raycaster.ray.direction;
    const oc = new THREE.Vector3().subVectors(origin, centre);
    const b = oc.dot(dir);
    const c = oc.lengthSq() - radius * radius;
    const disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    if (t < 0 || t > CONFIG.rangeMetres) return null;
    return { distance: t, point: origin.clone().addScaledVector(dir, t) };
  }

  // Ray vs the map's box colliders (slab test, XZ + height).
  rayHitWalls(colliders) {
    const o = this.raycaster.ray.origin;
    const d = this.raycaster.ray.direction;
    let nearest = null;
    for (const c of colliders) {
      let tmin = 0;
      let tmax = CONFIG.rangeMetres;
      let ok = true;
      for (const [origin, direction, min, max] of [
        [o.x, d.x, c.minX, c.maxX],
        [o.y, d.y, 0, c.height],
        [o.z, d.z, c.minZ, c.maxZ],
      ]) {
        if (Math.abs(direction) < 1e-8) {
          if (origin < min || origin > max) { ok = false; break; }
        } else {
          let t1 = (min - origin) / direction;
          let t2 = (max - origin) / direction;
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) { ok = false; break; }
        }
      }
      if (ok && (nearest === null || tmin < nearest)) nearest = tmin;
    }
    return nearest;
  }
}
