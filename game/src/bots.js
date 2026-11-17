// Harbour Line — the bots. Blocky tactical soldiers in CINDER orange that
// patrol the yard on waypoints, take cover, and shoot back when they can see
// you. Each bot is a small state machine: patrol -> react -> engage -> dead.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { collideCircle, hasLineOfSight } from './world.js';

const C = CONFIG.colours;

function soldierMesh() {
  const group = new THREE.Group();
  const orange = new THREE.MeshLambertMaterial({
    color: 0xff8a3d, emissive: 0x3a1a00, emissiveIntensity: 1.0,
  });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2320 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.26), dark);
  legs.position.y = 0.35;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.32), orange);
  torso.position.y = 1.0;
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.36), dark);
  vest.position.y = 1.02;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.32), skin);
  head.position.y = 1.5;
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.38), dark);
  helmet.position.y = 1.68;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.72), dark);
  gun.position.set(0.2, 1.12, 0.42);

  for (const part of [legs, torso, vest, head, helmet, gun]) {
    part.castShadow = true;
    group.add(part);
  }
  group.userData.gunTip = gun;
  return group;
}

export class Bot {
  constructor(scene, spawn, waypoints, id) {
    this.id = id;
    this.scene = scene;
    this.waypoints = waypoints;
    this.mesh = soldierMesh();
    this.mesh.position.set(spawn.x, 0, spawn.z);
    scene.add(this.mesh);

    this.health = CONFIG.botHealth;
    this.alive = true;
    this.state = 'patrol'; // patrol | react | engage
    this.target = this.pickWaypoint();
    this.position = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.yaw = Math.random() * Math.PI * 2;
    this.reactTimer = 0;
    this.burstLeft = 0;
    this.shotTimer = 0;
    this.pauseTimer = 0;
    this.strafeDir = 1;
    this.strafeTimer = 0;
    this.walkPhase = Math.random() * 10;
  }

  pickWaypoint() {
    return this.waypoints[Math.floor(Math.random() * this.waypoints.length)];
  }

  // Where a shot aimed at this bot should test: chest, and head for crits.
  chestPoint() {
    return new THREE.Vector3(this.position.x, 1.05, this.position.z);
  }

  headPoint() {
    return new THREE.Vector3(this.position.x, 1.52, this.position.z);
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.fall();
      return true;
    }
    return false;
  }

  fall() {
    // Tip over and sink slightly: a readable death in one frame.
    this.mesh.rotation.z = Math.PI / 2;
    this.mesh.position.y = 0.25;
  }

  remove() {
    this.scene.remove(this.mesh);
  }

  // Distance to the player, and whether the bot can see them.
  sense(player, colliders) {
    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    const seen = dist < CONFIG.botSightRange &&
      hasLineOfSight(this.position, player.position, colliders);
    return { dist, seen };
  }

  update(dt, player, colliders, onBotShot) {
    if (!this.alive) return;
    this.walkPhase += dt * 8;

    const { dist, seen } = this.sense(player, colliders);

    if (this.state === 'patrol') {
      if (seen && player.alive) {
        this.state = 'react';
        this.reactTimer = CONFIG.botReactSeconds;
      } else {
        this.walkToward(this.target, dt, colliders);
        if (this.atTarget()) {
          this.target = this.pickWaypoint();
          this.pauseTimer = 0.4 + Math.random() * 0.8;
        }
      }
    } else if (this.state === 'react') {
      this.face(player.position);
      this.reactTimer -= dt;
      if (this.reactTimer <= 0) this.state = 'engage';
      if (!seen) this.state = 'patrol';
    } else if (this.state === 'engage') {
      if (!seen || !player.alive) {
        this.state = 'patrol';
        this.target = this.pickWaypoint();
      } else {
        this.face(player.position);
        // Strafe sideways so the bot is a moving target, not a turret.
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
          this.strafeDir = Math.random() < 0.5 ? -1 : 1;
          this.strafeTimer = 0.7 + Math.random() * 0.9;
        }
        const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        const next = {
          x: this.position.x + side.x * this.strafeDir * CONFIG.botSpeed * 0.55 * dt,
          z: this.position.z + side.z * this.strafeDir * CONFIG.botSpeed * 0.55 * dt,
        };
        const fixed = collideCircle(next, 0.4, colliders);
        this.position.x = fixed.x;
        this.position.z = fixed.z;
        // Close the distance a little when far away.
        if (dist > 26) this.walkToward(player.position, dt, colliders, 0.7);
        this.fireAtPlayer(dt, dist, player, onBotShot);
      }
    }

    this.mesh.position.set(this.position.x, this.mesh.position.y, this.position.z);
    this.mesh.rotation.y = this.yaw;
    // Simple walk bob so patrol reads as movement, not sliding.
    if (this.state === 'patrol') {
      this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.05;
    }
  }

  atTarget() {
    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    return dx * dx + dz * dz < 0.6;
  }

  walkToward(point, dt, colliders, speedScale = 1) {
    const dx = point.x - this.position.x;
    const dz = point.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return;
    this.yaw = Math.atan2(dx, dz);
    const step = (CONFIG.botSpeed * speedScale * dt) / dist;
    const next = {
      x: this.position.x + dx * step,
      z: this.position.z + dz * step,
    };
    const fixed = collideCircle(next, 0.4, colliders);
    this.position.x = fixed.x;
    this.position.z = fixed.z;
  }

  face(point) {
    this.yaw = Math.atan2(point.x - this.position.x, point.z - this.position.z);
  }

  fireAtPlayer(dt, dist, player, onBotShot) {
    this.shotTimer -= dt;
    if (this.burstLeft > 0) {
      if (this.shotTimer <= 0) {
        this.shotTimer = CONFIG.botBurstInterval;
        this.burstLeft -= 1;
        onBotShot(this, dist);
      }
    } else if (this.shotTimer <= 0) {
      this.burstLeft = CONFIG.botBurstShots;
      this.shotTimer = CONFIG.botBurstPause;
    }
  }
}

// Hit chance for one bot shot: nearer and slower targets are easier.
export function botHitChance(dist, playerMoving) {
  let chance;
  if (dist < 15) chance = CONFIG.botHitChanceNear;
  else if (dist > 30) chance = CONFIG.botHitChanceFar;
  else {
    const t = (dist - 15) / 15;
    chance = CONFIG.botHitChanceNear + (CONFIG.botHitChanceFar - CONFIG.botHitChanceNear) * t;
  }
  if (playerMoving) chance *= 0.75;
  return chance;
}
