// Harbour Line — the player. A first-person controller: pointer-lock mouse
// look (arrow keys turn as a fallback, which is how the game stays playable
// without a locked pointer), WASD movement with sprint and jump, box
// collision, health and damage.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { collideCircle } from './world.js';

export class Player {
  constructor(camera, colliders, spawn) {
    this.camera = camera;
    this.colliders = colliders;
    this.spawn = spawn;
    this.reset();

    this.keys = new Set();
    this.yaw = spawn.yaw;
    this.pitch = 0;
    this.velocityY = 0;
    this.onGround = true;
    this.locked = false;

    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    };
    this._onPointerLock = () => {
      this.locked = document.pointerLockElement === document.body;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLock);
  }

  reset() {
    this.position = new THREE.Vector3(this.spawn.x, CONFIG.eyeHeight, this.spawn.z);
    this.health = CONFIG.playerHealth;
    this.alive = true;
    this.yaw = this.spawn.yaw;
    this.pitch = 0;
    this.velocityY = 0;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onPointerLock);
  }

  requestLock() {
    if (document.pointerLockElement !== document.body) {
      document.body.requestPointerLock?.();
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  // Forward direction on the ground plane, from the yaw.
  forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  right() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  isMoving() {
    return this.keys.has('KeyW') || this.keys.has('KeyA') ||
      this.keys.has('KeyS') || this.keys.has('KeyD') ||
      this.keys.has('ArrowUp') || this.keys.has('ArrowDown') ||
      this.keys.has('ArrowLeft') || this.keys.has('ArrowRight');
  }

  isSprinting() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  update(dt) {
    // Arrow-key look (fallback when the pointer is not locked).
    const turn = 2.4 * dt;
    if (this.keys.has('ArrowLeft')) this.yaw += turn;
    if (this.keys.has('ArrowRight')) this.yaw -= turn;
    if (this.keys.has('ArrowUp')) this.pitch = Math.min(1.45, this.pitch + turn * 0.7);
    if (this.keys.has('ArrowDown')) this.pitch = Math.max(-1.45, this.pitch - turn * 0.7);

    const move = new THREE.Vector3();
    if (this.keys.has('KeyW')) move.add(this.forward());
    if (this.keys.has('KeyS')) move.sub(this.forward());
    if (this.keys.has('KeyD')) move.add(this.right());
    if (this.keys.has('KeyA')) move.sub(this.right());
    if (move.lengthSq() > 0) {
      move.normalize();
      const speed = CONFIG.playerSpeed * (this.isSprinting() ? CONFIG.sprintMultiplier : 1);
      const next = {
        x: this.position.x + move.x * speed * dt,
        z: this.position.z + move.z * speed * dt,
      };
      const fixed = collideCircle(next, CONFIG.playerRadius, this.colliders);
      this.position.x = fixed.x;
      this.position.z = fixed.z;
    }

    // Jump + gravity, landing back on the concrete.
    if (this.keys.has('Space') && this.onGround) {
      this.velocityY = CONFIG.jumpSpeed;
      this.onGround = false;
    }
    if (!this.onGround) {
      this.velocityY -= CONFIG.gravity * dt;
      this.position.y += this.velocityY * dt;
      if (this.position.y <= CONFIG.eyeHeight) {
        this.position.y = CONFIG.eyeHeight;
        this.velocityY = 0;
        this.onGround = true;
      }
    }

    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  // Damage from a bot shot. Returns true if this hit killed the player.
  takeDamage(amount) {
    if (!this.alive) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      return true;
    }
    return false;
  }
}
