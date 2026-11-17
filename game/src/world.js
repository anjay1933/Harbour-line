// Harbour Line — the yard. Builds the whole map from boxes, cylinders and
// canvas-painted textures: no fetched models, no fetched images. Also owns
// the colliders (axis-aligned boxes in the XZ plane), the bot waypoints and
// the spawn points the rounds use.

import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = CONFIG.colours;

// --- small procedural textures, painted on offscreen canvases ------------

function canvasTexture(size, painter) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  painter(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function groundTexture() {
  return canvasTexture(512, (g, s) => {
    g.fillStyle = '#4a4238';
    g.fillRect(0, 0, s, s);
    // concrete speckle
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#544c40' : '#40382e';
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    // expansion-joint grid
    g.strokeStyle = '#332d25';
    g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo((i * s) / 4, 0); g.lineTo((i * s) / 4, s); g.stroke();
      g.beginPath(); g.moveTo(0, (i * s) / 4); g.lineTo(s, (i * s) / 4); g.stroke();
    }
    // faded yellow lane paint
    g.fillStyle = 'rgba(214, 178, 60, 0.55)';
    g.fillRect(s * 0.46, 0, 10, s);
    g.fillStyle = 'rgba(214, 178, 60, 0.28)';
    for (let y = 0; y < s; y += 64) g.fillRect(s * 0.46, y + 8, 10, 34);
  });
}

function containerTexture(base, label) {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    // corrugation
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let x = 0; x < s; x += 16) g.fillRect(x, 0, 6, s);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    for (let x = 8; x < s; x += 16) g.fillRect(x, 0, 3, s);
    // stencil label
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.font = 'bold 34px monospace';
    g.textAlign = 'center';
    g.fillText(label, s / 2, s / 2 + 12);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, s - 26, s, 26);
  });
}

function crateTexture() {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#8a6b42';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#6b4f2c';
    g.lineWidth = 5;
    g.strokeRect(6, 6, s - 12, s - 12);
    g.beginPath(); g.moveTo(6, 6); g.lineTo(s - 6, s - 6); g.stroke();
    g.beginPath(); g.moveTo(s - 6, 6); g.lineTo(6, s - 6); g.stroke();
    for (let y = 0; y < s; y += 42) {
      g.fillStyle = 'rgba(0,0,0,0.14)';
      g.fillRect(0, y, s, 3);
    }
  });
}

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#171226');
  grad.addColorStop(0.45, '#3a2340');
  grad.addColorStop(0.68, '#8a4636');
  grad.addColorStop(0.82, '#e8703a');
  grad.addColorStop(1.0, '#5a3a2e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// --- the map --------------------------------------------------------------

export function buildWorld(scene) {
  const colliders = []; // {minX, maxX, minZ, maxZ, height}
  const waypoints = []; // open-ground points bots patrol between
  const spawns = {
    player: { x: 0, z: 24, yaw: 0 }, // south gate, facing north (yaw 0 = -z)
    bots: [], // filled below, north half of the yard
  };

  const groundTex = groundTexture();
  groundTex.repeat.set(8, 8);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshLambertMaterial({ map: groundTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const crateTex = crateTexture();
  const containerMats = {
    a: new THREE.MeshLambertMaterial({ map: containerTexture('#b3402e', 'HL-04') }),
    b: new THREE.MeshLambertMaterial({ map: containerTexture('#2e6f8e', 'HL-17') }),
    c: new THREE.MeshLambertMaterial({ map: containerTexture('#7a7d33', 'HL-23') }),
  };
  const crateMat = new THREE.MeshLambertMaterial({ map: crateTex });
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x6e6258 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x3a3230 });

  function addBox(w, h, d, x, y, z, mat, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (collide) {
      colliders.push({
        minX: x - w / 2, maxX: x + w / 2,
        minZ: z - d / 2, maxZ: z + d / 2,
        height: y + h,
      });
    }
    return mesh;
  }

  // Perimeter walls (the yard is 64 x 56, centred on 0,0).
  addBox(66, 5, 1, 0, 0, -29, wallMat);
  addBox(66, 5, 1, 0, 0, 29, wallMat);
  addBox(1, 5, 58, -33, 0, 0, wallMat);
  addBox(1, 5, 58, 33, 0, 0, wallMat);

  // Shipping containers — the cover the whole game is played around.
  addBox(6, 2.6, 2.6, -18, 0, -14, containerMats.a);
  addBox(6, 2.6, 2.6, -18, 2.6, -14, containerMats.b); // stacked pair
  addBox(6, 2.6, 2.6, -8, 0, -20, containerMats.c);
  addBox(6, 2.6, 2.6, 4, 0, -18, containerMats.b);
  addBox(6, 2.6, 2.6, 14, 0, -12, containerMats.a);
  addBox(6, 2.6, 2.6, 22, 0, -20, containerMats.c);
  addBox(6, 2.6, 2.6, -24, 0, 2, containerMats.c);
  addBox(6, 2.6, 2.6, -14, 0, 8, containerMats.b);
  addBox(6, 2.6, 2.6, 10, 0, 4, containerMats.a);
  addBox(6, 2.6, 2.6, 20, 0, 10, containerMats.b);
  addBox(6, 2.6, 2.6, 26, 0, -2, containerMats.a);
  addBox(6, 2.6, 2.6, 2, 0, 14, containerMats.c);

  // Crates and barrels — low cover you can vault sight over, not through.
  const crateSpots = [
    [-12, -8], [-4, -10], [8, -8], [18, -4], [-20, -6], [0, -2],
    [-8, 16], [14, 18], [-18, 18], [24, 16], [6, 22], [-26, 12],
  ];
  for (const [x, z] of crateSpots) addBox(1.4, 1.4, 1.4, x, 0, z, crateMat);
  addBox(2.8, 1.4, 1.4, -2, 0, -24, crateMat);
  addBox(1.4, 1.4, 2.8, 16, 0, -24, crateMat);

  // The lighthouse — the landmark. Striped cylinder, north-east corner.
  const stripeRed = new THREE.MeshLambertMaterial({ color: C.lighthouseRed });
  const stripeWhite = new THREE.MeshLambertMaterial({ color: C.lighthouseWhite });
  const tower = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(2.0 - i * 0.12, 2.2 - i * 0.12, 2.6, 12),
      i % 2 === 0 ? stripeWhite : stripeRed,
    );
    seg.position.y = 1.3 + i * 2.6;
    seg.castShadow = true;
    tower.add(seg);
  }
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.3, 1.6, 10),
    new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0xffc861, emissiveIntensity: 1.4 }),
  );
  lamp.position.y = 14.2;
  tower.add(lamp);
  tower.position.set(28, 0, -24);
  scene.add(tower);
  colliders.push({ minX: 25.8, maxX: 30.2, minZ: -26.2, maxZ: -21.8, height: 15 });

  // A silo on the west side, for silhouette variety.
  const silo = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 9, 14),
    new THREE.MeshLambertMaterial({ color: 0x7d7468 }),
  );
  silo.position.set(-28, 4.5, -22);
  silo.castShadow = true;
  scene.add(silo);
  colliders.push({ minX: -30.4, maxX: -25.6, minZ: -24.4, maxZ: -19.6, height: 9 });

  // Lamp posts — warm pools of light down the middle lane.
  const lampGlow = new THREE.MeshLambertMaterial({
    color: 0x332211, emissive: 0xffb85e, emissiveIntensity: 2.0,
  });
  for (const [x, z] of [[-6, -4], [6, 8], [-6, 18], [6, -14]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.4, 6), darkMat);
    post.position.set(x, 2.2, z);
    scene.add(post);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), lampGlow);
    bulb.position.set(x, 4.5, z);
    scene.add(bulb);
    const light = new THREE.PointLight(0xffa04a, 22, 16, 1.8);
    light.position.set(x, 4.4, z);
    scene.add(light);
  }

  // Dusk sky, fog and the low sun.
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0x352642, 30, 95);
  const sun = new THREE.DirectionalLight(0xff9a52, 2.8);
  sun.position.set(-30, 18, -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8a6a9a, 0x2a2018, 1.15));

  // Bot waypoints: open lanes between the cover, kept clear of colliders.
  const waypointSpots = [
    [-24, -10], [-12, -16], [0, -12], [12, -16], [24, -8],
    [-26, 6], [-16, -2], [-4, 2], [8, -2], [18, 2], [28, 8],
    [-20, 14], [-8, 10], [2, 6], [14, 12], [24, 20], [0, 20],
  ];
  for (const [x, z] of waypointSpots) waypoints.push({ x, z });

  // Bot spawns: north half, behind the container line.
  spawns.bots = [
    { x: -22, z: -18 }, { x: -8, z: -24 }, { x: 6, z: -24 },
    { x: 18, z: -18 }, { x: 26, z: -10 }, { x: -26, z: -8 },
    { x: 0, z: -16 }, { x: 12, z: -22 },
  ];

  return { colliders, waypoints, spawns };
}

// Circle (player/bot) vs box colliders, resolved in the XZ plane. Returns a
// corrected position; call once per axis for clean sliding along walls.
export function collideCircle(pos, radius, colliders) {
  const out = { x: pos.x, z: pos.z };
  for (const c of colliders) {
    const nearestX = Math.max(c.minX, Math.min(out.x, c.maxX));
    const nearestZ = Math.max(c.minZ, Math.min(out.z, c.maxZ));
    const dx = out.x - nearestX;
    const dz = out.z - nearestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        out.x = nearestX + (dx / dist) * radius;
        out.z = nearestZ + (dz / dist) * radius;
      } else {
        // centre inside the box: push out along the smallest penetration.
        const pushLeft = out.x - c.minX + radius;
        const pushRight = c.maxX - out.x + radius;
        const pushUp = out.z - c.minZ + radius;
        const pushDown = c.maxZ - out.z + radius;
        const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (min === pushLeft) out.x = c.minX - radius;
        else if (min === pushRight) out.x = c.maxX + radius;
        else if (min === pushUp) out.z = c.minZ - radius;
        else out.z = c.maxZ + radius;
      }
    }
  }
  // Stay inside the yard.
  out.x = Math.max(-32 + radius, Math.min(32 - radius, out.x));
  out.z = Math.max(-28 + radius, Math.min(28 - radius, out.z));
  return out;
}

// Line of sight between two points at eye height, blocked by any collider
// taller than the eye line. Sampled in small steps — cheap and robust.
export function hasLineOfSight(a, b, colliders) {
  const steps = 24;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    for (const c of colliders) {
      if (c.height > 1.4 && x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) {
        return false;
      }
    }
  }
  return true;
}
