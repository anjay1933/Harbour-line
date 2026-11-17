// Harbour Line — effects. Tracers, muzzle flashes, hit sparks and impact
// puffs: all short-lived scene objects, pooled by creation and removed on a
// timer. Nothing here owns game rules.

import * as THREE from 'three';

let flashTexture = null;

// One shared radial-gradient texture for every muzzle flash.
function muzzleFlashTexture() {
  if (flashTexture) return flashTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 240, 190, 1)');
  grad.addColorStop(0.35, 'rgba(255, 190, 90, 0.9)');
  grad.addColorStop(1, 'rgba(255, 120, 40, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  flashTexture = new THREE.CanvasTexture(canvas);
  return flashTexture;
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tracers = []; // {line, life}
    this.flashes = []; // {mesh, life}
    this.sparkBursts = []; // {points, velocity, life}
  }

  // A bright line from muzzle to target that fades in a tenth of a second.
  // Staged screenshots pass a long life so the tracer is still there when
  // the frame is taken.
  tracer(from, to, colour = 0xffd27a, life = 0.12) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: 0.95 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life, maxLife: life });
  }

  // A camera-facing glow at a gun muzzle, gone in 60 ms. A soft radial
  // gradient, not a solid square: at 0.9 m from the camera a big sprite
  // would cover the whole screen.
  muzzleFlash(position, life = 0.06) {
    const mat = new THREE.SpriteMaterial({
      map: muzzleFlashTexture(), transparent: true, opacity: 1,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.set(0.3, 0.3, 1);
    this.scene.add(sprite);
    this.flashes.push({ mesh: sprite, life, maxLife: life });
  }

  // A burst of sparks where a shot lands: hit or wall.
  sparks(position, colour = 0xffd27a, count = 14) {
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 6,
      ));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: colour, size: 0.09, transparent: true, opacity: 1 });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.sparkBursts.push({ points, velocities, life: 0.35 });
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / t.maxLife) * 0.95;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      f.mesh.material.opacity = Math.max(0, f.life / f.maxLife);
      if (f.life <= 0) {
        this.scene.remove(f.mesh);
        f.mesh.material.dispose();
        this.flashes.splice(i, 1);
      }
    }
    for (let i = this.sparkBursts.length - 1; i >= 0; i--) {
      const s = this.sparkBursts[i];
      s.life -= dt;
      const pos = s.points.geometry.attributes.position;
      for (let j = 0; j < s.velocities.length; j++) {
        s.velocities[j].y -= 9 * dt;
        pos.array[j * 3] += s.velocities[j].x * dt;
        pos.array[j * 3 + 1] += s.velocities[j].y * dt;
        pos.array[j * 3 + 2] += s.velocities[j].z * dt;
      }
      pos.needsUpdate = true;
      s.points.material.opacity = Math.max(0, s.life / 0.35);
      if (s.life <= 0) {
        this.scene.remove(s.points);
        s.points.geometry.dispose();
        s.points.material.dispose();
        this.sparkBursts.splice(i, 1);
      }
    }
  }

  clear() {
    for (const t of this.tracers) this.scene.remove(t.line);
    for (const f of this.flashes) this.scene.remove(f.mesh);
    for (const s of this.sparkBursts) this.scene.remove(s.points);
    this.tracers = [];
    this.flashes = [];
    this.sparkBursts = [];
  }
}
