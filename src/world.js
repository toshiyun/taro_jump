import * as THREE from 'three';
import { CONFIG, obstacleTop } from './config.js';
import { toon, canvasTexture, drawPaw } from './materials.js';

const W = CONFIG.trackWidth;

const SKY_TOP = '#2f9bf0';
const SKY_MID = '#7cc6ff';
const HORIZON = '#e3f4ff';

// 障害物：白い棒に赤い帯がらせん状に巻いたバー
export const POLE_RED = '#e8303c';
// タップ回数ごとの色（ジャンプメーターやキラキラに使う）
export const LEVEL_COLORS = ['#46c99a', '#ffc23a', '#ff6f96'];

export function setupScene(scene) {
  scene.background = canvasTexture(4, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, SKY_TOP);
    g.addColorStop(0.55, SKY_MID);
    g.addColorStop(1, HORIZON);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog(HORIZON, 50, 125);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb6e3a0, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 10, 6);
  scene.add(sun);
}

// ---------- 地面・コース・柵（模様が世界に固定されるよう周期単位でスナップ） ----------
export class Ground {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const grassTex = canvasTexture(64, 96, (ctx, w, h) => {
      ctx.fillStyle = '#74c95c';
      ctx.fillRect(0, 0, w, h / 2);
      ctx.fillStyle = '#68bd51';
      ctx.fillRect(0, h / 2, w, h / 2);
      sprinkleBlades(ctx, w, h, 260, ['#5daf47', '#86d66c', '#9be07f']);
    });
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    this.grassPeriod = 12;
    const grassLen = 288;
    grassTex.repeat.set(1, grassLen / this.grassPeriod);
    this.grass = new THREE.Mesh(
      new THREE.PlaneGeometry(320, grassLen),
      new THREE.MeshLambertMaterial({ map: grassTex }),
    );
    this.grass.rotation.x = -Math.PI / 2;
    this.group.add(this.grass);

    this.trackPeriod = 8;
    const trackLen = 264;
    // 走るレーンは刈りそろえた芝生（しま模様）と白いライン
    const trackTex = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#9ade7c';
      ctx.fillRect(0, 0, w, h / 2);
      ctx.fillStyle = '#8bd56d';
      ctx.fillRect(0, h / 2, w, h / 2);
      sprinkleBlades(ctx, w, h, 700, ['#7cc861', '#a9e68d', '#b6eb9c']);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(8, 0, 12, h);
      ctx.fillRect(w - 20, 0, 12, h);
    });
    trackTex.wrapS = trackTex.wrapT = THREE.RepeatWrapping;
    trackTex.anisotropy = 8;
    trackTex.repeat.set(1, trackLen / this.trackPeriod);
    this.track = new THREE.Mesh(new THREE.PlaneGeometry(W, trackLen), new THREE.MeshLambertMaterial({ map: trackTex }));
    this.track.rotation.x = -Math.PI / 2;
    this.track.position.y = 0.01;
    this.group.add(this.track);

    // 白い柵
    this.fence = new THREE.Group();
    this.fencePeriod = 2;
    const posts = 100;
    const postGeo = new THREE.BoxGeometry(0.14, 0.62, 0.14);
    const postMesh = new THREE.InstancedMesh(postGeo, toon(0xffffff), posts * 2);
    const m = new THREE.Matrix4();
    let i = 0;
    for (const side of [-1, 1]) {
      for (let p = 0; p < posts; p++) {
        m.makeTranslation(side * (W / 2 + 0.6), 0.31, 30 - p * this.fencePeriod);
        postMesh.setMatrixAt(i++, m);
      }
    }
    this.fence.add(postMesh);
    const railLen = posts * this.fencePeriod;
    const railGeo = new THREE.BoxGeometry(0.08, 0.1, railLen);
    for (const side of [-1, 1]) {
      for (const y of [0.25, 0.5]) {
        const rail = new THREE.Mesh(railGeo, toon(0xffffff));
        rail.position.set(side * (W / 2 + 0.6), y, 30 - railLen / 2);
        this.fence.add(rail);
      }
    }
    this.group.add(this.fence);
  }

  update(z) {
    const snap = (p) => Math.round(z / p) * p;
    this.grass.position.z = snap(this.grassPeriod) - 100;
    this.track.position.z = snap(this.trackPeriod) - 100;
    this.fence.position.z = snap(this.fencePeriod);
  }
}

// ---------- 遠景（空の一部としてタロ助と一緒に動く） ----------
export class Backdrop {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const hillColors = [0xa8e89a, 0x9fdcb0, 0xbdf0a4, 0x95d99a];
    const hills = [
      [-120, 60],
      [-55, 45],
      [10, 70],
      [80, 50],
      [140, 65],
    ];
    hills.forEach(([x, r], idx) => {
      const hill = new THREE.Mesh(
        new THREE.SphereGeometry(r, 32, 16),
        new THREE.MeshBasicMaterial({ color: hillColors[idx % hillColors.length], fog: false }),
      );
      hill.position.set(x, -r * 0.62, -235 - (idx % 2) * 20);
      this.group.add(hill);
    });

    // 雲
    this.clouds = [];
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    const puff = new THREE.SphereGeometry(1, 16, 12);
    for (let c = 0; c < 7; c++) {
      const cloud = new THREE.Group();
      const n = 4 + (c % 3);
      for (let k = 0; k < n; k++) {
        const s = new THREE.Mesh(puff, cloudMat);
        const r = 2.4 + Math.random() * 2;
        s.scale.set(r * 1.2, r, r);
        s.position.set((k - n / 2) * 2.8, Math.sin(k * 1.7) * 0.9, Math.random());
        cloud.add(s);
      }
      cloud.position.set(-80 + c * 26 + Math.random() * 12, 24 + Math.random() * 24, -150 - Math.random() * 60);
      cloud.userData.drift = 0.6 + Math.random() * 1.2;
      this.group.add(cloud);
      this.clouds.push(cloud);
    }
  }

  update(dt, z) {
    this.group.position.z = z;
    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.drift * dt;
      if (cloud.position.x > 110) cloud.position.x = -110;
    }
  }
}

// ---------- 道ばたの木や花（後ろに流れたら前へ回す） ----------
export class Scenery {
  constructor(scene) {
    this.items = [];
    this.group = new THREE.Group();
    scene.add(this.group);

    const trunk = toon(0xc28a5c);
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.24, 1.6, 8);
    const crownGeo = new THREE.IcosahedronGeometry(1.2, 1);
    const bushGeo = new THREE.SphereGeometry(0.8, 14, 10);
    const capGeo = new THREE.SphereGeometry(0.55, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const stemGeo = new THREE.CylinderGeometry(0.2, 0.26, 0.55, 10);
    const petalGeo = new THREE.SphereGeometry(0.16, 10, 8);
    const crowns = [0x7ed98a, 0x9be27a, 0xffb3cf, 0x6fcf97];
    const petals = [0xff8fb8, 0xffffff, 0xffd84d, 0xc9a7ff];

    const makers = [
      () => {
        const g = new THREE.Group();
        const tr = new THREE.Mesh(trunkGeo, trunk);
        tr.position.y = 0.8;
        g.add(tr);
        const crown = new THREE.Mesh(crownGeo, toon(crowns[Math.floor(Math.random() * crowns.length)]));
        crown.position.y = 2.2;
        crown.scale.set(1, 1.05, 1);
        g.add(crown);
        return g;
      },
      () => {
        const g = new THREE.Group();
        const mat = toon(crowns[Math.floor(Math.random() * 2)]);
        for (const [x, y, s] of [
          [-0.6, 0.4, 0.8],
          [0.5, 0.35, 0.75],
          [0, 0.6, 1],
        ]) {
          const b = new THREE.Mesh(bushGeo, mat);
          b.position.set(x, y, 0);
          b.scale.setScalar(s);
          g.add(b);
        }
        return g;
      },
      () => {
        const g = new THREE.Group();
        for (let f = 0; f < 3; f++) {
          const flower = new THREE.Group();
          const mat = toon(petals[Math.floor(Math.random() * petals.length)]);
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2;
            const petal = new THREE.Mesh(petalGeo, mat);
            petal.position.set(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17);
            petal.scale.set(1, 0.5, 1);
            flower.add(petal);
          }
          const center = new THREE.Mesh(petalGeo, toon(0xffc93c));
          center.scale.set(0.8, 0.6, 0.8);
          flower.add(center);
          flower.position.set((f - 1) * 0.6, 0.25 + Math.random() * 0.15, Math.random() * 0.6 - 0.3);
          g.add(flower);
        }
        return g;
      },
      () => {
        const g = new THREE.Group();
        const stem = new THREE.Mesh(stemGeo, toon(0xfff3dc));
        stem.position.y = 0.27;
        g.add(stem);
        const cap = new THREE.Mesh(capGeo, toon(0xff6b6b));
        cap.position.y = 0.5;
        cap.scale.set(1, 0.85, 1);
        g.add(cap);
        for (let d = 0; d < 4; d++) {
          const a = d * 1.6;
          const dot = new THREE.Mesh(petalGeo, toon(0xffffff));
          dot.position.set(Math.cos(a) * 0.32, 0.82, Math.sin(a) * 0.32);
          dot.scale.set(0.7, 0.35, 0.7);
          g.add(dot);
        }
        return g;
      },
    ];
    const weights = [0, 0, 0, 0, 1, 1, 2, 2, 2, 3];

    this.spacing = 4.2;
    const count = 48;
    for (let n = 0; n < count; n++) {
      const kind = weights[n % weights.length];
      const obj = makers[kind]();
      obj.userData.kind = kind;
      this.group.add(obj);
      this.items.push(obj);
    }
    this.reset(0);
  }

  place(obj, z) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const near = obj.userData.kind >= 2 ? 1.6 : 2.6;
    obj.position.set(side * (W / 2 + near + Math.random() * 12), 0, z);
    obj.rotation.y = Math.random() * Math.PI * 2;
    obj.scale.setScalar(0.8 + Math.random() * 0.5);
  }

  reset(z) {
    this.frontZ = z + 20;
    for (const obj of this.items) {
      this.place(obj, this.frontZ);
      this.frontZ -= this.spacing * (0.5 + Math.random());
    }
  }

  update(z) {
    for (const obj of this.items) {
      if (obj.position.z > z + 14) {
        this.place(obj, this.frontZ);
        this.frontZ -= this.spacing * (0.5 + Math.random());
      }
    }
  }
}

// ---------- 障害物（赤白らせんのバーを1〜3本） ----------
const POLE_R = 0.16;
const poleGeo = new THREE.CylinderGeometry(POLE_R, POLE_R, W + 0.5, 24, 1);
poleGeo.rotateZ(Math.PI / 2);
const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 12);
const baseGeo = new THREE.CylinderGeometry(0.26, 0.3, 0.12, 16);
const knobGeo = new THREE.SphereGeometry(0.17, 14, 10);
let poleMat = null;
let badgeTextures = null;

function obstacleAssets() {
  if (poleMat) return;
  const spiral = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = POLE_RED;
    const band = 26;
    for (const k of [-w, 0, w]) {
      ctx.beginPath();
      ctx.moveTo(k, 0);
      ctx.lineTo(k + band, 0);
      ctx.lineTo(k + band + w, h);
      ctx.lineTo(k + w, h);
      ctx.closePath();
      ctx.fill();
    }
  });
  spiral.wrapS = spiral.wrapT = THREE.RepeatWrapping;
  spiral.repeat.set(1, (W + 0.5) / 0.55);
  spiral.anisotropy = 4;
  poleMat = toon(0xffffff, { map: spiral });
  badgeTextures = [1, 2, 3].map((n) =>
    canvasTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, 6, 6, w - 12, h - 12, 54);
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = POLE_RED;
      ctx.stroke();
      const size = 56;
      const startX = w / 2 - ((n - 1) * size * 1.05) / 2;
      for (let p = 0; p < n; p++) drawPaw(ctx, startX + p * size * 1.05, h / 2 + 4, size, POLE_RED);
    }),
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function sprinkleBlades(ctx, w, h, count, colors) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[i % colors.length];
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillRect(x, y, 1, 2 + Math.random() * 2);
  }
}

export class Obstacle {
  constructor(scene, rows, z) {
    obstacleAssets();
    this.scene = scene;
    this.rows = rows;
    this.z = z;
    this.top = obstacleTop(rows);
    this.state = 'pending'; // pending | cleared | hit | sinking
    this.age = 0;
    this.stateTime = 0;
    this.dead = false;

    this.group = new THREE.Group();
    this.group.position.z = z;
    this.bars = [];
    for (let r = 0; r < rows; r++) {
      const mesh = new THREE.Mesh(poleGeo, poleMat);
      mesh.position.y = obstacleTop(r + 1) - POLE_R;
      this.group.add(mesh);
      this.bars.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3() });
    }
    const white = toon(0xffffff);
    const red = toon(new THREE.Color(POLE_RED).getHex());
    this.posts = [];
    for (const side of [-1, 1]) {
      const x = side * (W / 2 + 0.38);
      const h = this.top + 0.25;
      const post = new THREE.Mesh(postGeo, white);
      post.scale.y = h;
      post.position.set(x, h / 2, 0);
      const base = new THREE.Mesh(baseGeo, white);
      base.position.set(x, 0.06, 0);
      const knob = new THREE.Mesh(knobGeo, red);
      knob.position.set(x, h + 0.1, 0);
      this.group.add(post, base, knob);
      this.posts.push(post, knob);
    }
    this.badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTextures[rows - 1], transparent: true }));
    this.badgeBaseY = this.top + 0.85;
    this.badge.position.y = this.badgeBaseY;
    this.badge.scale.set(1.5, 0.75, 1);
    this.group.add(this.badge);

    // 出てくるときにぴょこっと
    this.group.scale.set(1, 0.01, 1);
    scene.add(this.group);
  }

  clear() {
    this.state = 'cleared';
    this.stateTime = 0;
  }

  knock() {
    this.state = 'hit';
    this.stateTime = 0;
    for (const b of this.bars) {
      b.vel.set((Math.random() - 0.5) * 4, 4 + Math.random() * 4, -5 - Math.random() * 5);
      b.spin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    }
    this.badge.visible = false;
  }

  sink() {
    if (this.state === 'pending') {
      this.state = 'sinking';
      this.stateTime = 0;
    }
  }

  update(dt, dogZ) {
    this.age += dt;
    this.stateTime += dt;
    const grow = Math.min(1, this.age / 0.45);
    this.group.scale.y = Math.max(0.01, easeOutBack(grow));
    this.badge.position.y = this.badgeBaseY + Math.sin(this.age * 4) * 0.08;

    if (this.state === 'cleared') {
      // 飛びこえたらバッジは消え、バーは地面にしずむ（カメラの前をふさがないように）
      this.badge.visible = false;
      const sinkK = Math.min(1, this.stateTime / 0.25);
      this.group.scale.y = Math.max(0.01, 1 - sinkK * sinkK);
      if (sinkK >= 1) this.dispose();
    } else if (this.state === 'hit') {
      for (const b of this.bars) {
        b.vel.y -= CONFIG.gravity * 0.7 * dt;
        b.mesh.position.addScaledVector(b.vel, dt);
        b.mesh.rotation.x += b.spin.x * dt;
        b.mesh.rotation.y += b.spin.y * dt;
        b.mesh.rotation.z += b.spin.z * dt;
        if (b.mesh.position.y < POLE_R) {
          b.mesh.position.y = POLE_R;
          b.vel.y = Math.abs(b.vel.y) * 0.35;
          b.vel.x *= 0.7;
          b.vel.z *= 0.7;
          b.spin.multiplyScalar(0.6);
        }
      }
      for (const p of this.posts) p.rotation.z += dt * 2 * Math.sign(p.position.x);
    } else if (this.state === 'sinking') {
      this.group.position.y -= dt * 6;
      if (this.group.position.y < -4) this.dispose();
    }

    if (this.group.position.z > dogZ + 16) this.dispose();
  }

  dispose() {
    if (this.dead) return;
    this.dead = true;
    this.scene.remove(this.group);
    this.badge.material.dispose();
  }
}

// ---------- ゴールのゲート ----------
export class GoalGate {
  constructor(scene, z) {
    this.scene = scene;
    this.z = z;
    this.age = 0;
    this.group = new THREE.Group();
    this.group.position.z = z;

    const stripe = canvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffc23a';
      for (let i = -2; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 32, 0);
        ctx.lineTo(i * 32 + 16, 0);
        ctx.lineTo(i * 32 + 48, h);
        ctx.lineTo(i * 32 + 32, h);
        ctx.fill();
      }
    });
    stripe.wrapS = stripe.wrapT = THREE.RepeatWrapping;
    stripe.repeat.set(1, 5);
    const pillarMat = toon(0xffffff, { map: stripe });
    const pillarH = 4.6;
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, pillarH, 14), pillarMat);
      pillar.position.set(side * (W / 2 + 0.55), pillarH / 2, 0);
      this.group.add(pillar);
      const colors = [0xff7aa6, 0xffc23a, 0x46c99a, 0x74c0fc];
      colors.forEach((c, i) => {
        const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), toon(c));
        const a = i * 1.6 + (side > 0 ? 0.8 : 0);
        balloon.position.set(side * (W / 2 + 0.55) + Math.cos(a) * 0.45, pillarH + 0.55 + (i % 2) * 0.35, Math.sin(a) * 0.3);
        balloon.scale.set(1, 1.15, 1);
        this.group.add(balloon);
      });
    }

    const bannerTex = canvasTexture(512, 128, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, 4, 4, w - 8, h - 8, 40);
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#ffc23a';
      ctx.stroke();
      ctx.fillStyle = '#ff5a8a';
      ctx.font = '800 84px "Mochiy Pop One", "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GOAL', w / 2, h / 2 + 4);
    });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.6, (W + 0.6) / 4), toon(0xffffff, { map: bannerTex, side: THREE.DoubleSide }));
    banner.position.set(0, pillarH - 0.45, 0);
    this.group.add(banner);

    const checker = canvasTexture(64, 16, (ctx) => {
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 2; y++) {
          ctx.fillStyle = (x + y) % 2 ? '#5a3442' : '#ffffff';
          ctx.fillRect(x * 8, y * 8, 8, 8);
        }
      }
    });
    checker.magFilter = THREE.NearestFilter;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(W, W / 4), new THREE.MeshLambertMaterial({ map: checker }));
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.03;
    this.group.add(line);

    this.group.scale.set(1, 0.01, 1);
    scene.add(this.group);
  }

  update(dt) {
    this.age += dt;
    const k = Math.min(1, this.age / 0.6);
    this.group.scale.y = Math.max(0.01, easeOutElastic(k));
  }

  dispose() {
    this.scene.remove(this.group);
  }
}

// ---------- キラキラ・紙ふぶき・土ぼこり ----------
export class Particles {
  constructor(scene, max = 260) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial(), max);
    this.mesh.frustumCulled = false;
    this.items = [];
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) {
      this.items.push({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), size: 0.1, gravity: 0 });
      this.mesh.setMatrixAt(i, zero);
      this.mesh.setColorAt(i, new THREE.Color(0xffffff));
    }
    this.cursor = 0;
    this.tmp = new THREE.Matrix4();
    this.quat = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.color = new THREE.Color();
    scene.add(this.mesh);
  }

  emit({ pos, count = 10, colors = ['#ffffff'], speed = 4, up = 3, life = 0.8, size = 0.15, gravity = 12, spread = 0.3, back = 0 }) {
    for (let n = 0; n < count; n++) {
      const p = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % this.max;
      p.life = p.max = life * (0.7 + Math.random() * 0.6);
      p.pos.set(pos.x + (Math.random() - 0.5) * spread, pos.y + (Math.random() - 0.5) * spread, pos.z + (Math.random() - 0.5) * spread);
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      p.vel.set(Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s + back);
      p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      p.spin.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
      p.size = size * (0.7 + Math.random() * 0.6);
      p.gravity = gravity;
      this.color.set(colors[Math.floor(Math.random() * colors.length)]);
      this.mesh.setColorAt(this.cursor === 0 ? this.max - 1 : this.cursor - 1, this.color);
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const p = this.items[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(1 - Math.min(1, dt * 1.5));
      p.pos.addScaledVector(p.vel, dt);
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt;
      const k = Math.max(0, p.life / p.max);
      this.scale.setScalar(p.life > 0 ? p.size * Math.min(1, k * 2.5) : 0);
      this.quat.setFromEuler(p.rot);
      this.tmp.compose(p.pos, this.quat, this.scale);
      this.mesh.setMatrixAt(i, this.tmp);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (const p of this.items) p.life = 0;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, zero);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function easeOutBack(x) {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function easeOutElastic(x) {
  if (x === 0 || x === 1) return x;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}
