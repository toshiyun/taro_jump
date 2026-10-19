import * as THREE from 'three';
import { toon, canvasTexture } from './materials.js';

// 黒柴のタロ助。前は -Z 方向。原点は足元の中心。
const COLORS = {
  fur: 0x3a3236, // 黒い毛
  tan: 0xd0803f, // 茶色のまろ眉・ほっぺ
  cream: 0xfff3e4, // 白いマズル・胸・くつした
  dark: 0x150e10, // 目・鼻
  pink: 0xff9db5,
  innerEar: 0xffd6cc,
  collar: 0xe8303c, // 赤い首輪
  bell: 0xffd23f,
};

function ball(r, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

export class Dog {
  constructor() {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);

    const fur = toon(COLORS.fur);
    const cream = toon(COLORS.cream);
    const dark = toon(COLORS.dark);
    const tan = toon(COLORS.tan);
    const pink = toon(COLORS.pink);
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // 胴体
    this.body.add(ball(0.5, fur, 0, 0.68, 0.05, 0.78, 0.7, 1.12));
    this.body.add(ball(0.36, cream, 0, 0.6, -0.3, 0.92, 0.92, 0.8)); // 胸
    this.body.add(ball(0.24, cream, 0, 0.56, 0.52, 1, 0.85, 0.5)); // おしり

    // 首輪と鈴
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.06, 10, 28), toon(COLORS.collar));
    collar.position.set(0, 0.92, -0.4);
    collar.rotation.x = Math.PI / 2 - 0.55;
    this.body.add(collar);
    this.body.add(ball(0.075, toon(COLORS.bell), 0, 0.76, -0.66));

    // 頭
    this.head = new THREE.Group();
    this.head.position.set(0, 1.12, -0.5);
    this.body.add(this.head);
    this.head.add(ball(0.42, fur, 0, 0, 0, 1.08, 0.95, 0.98));
    this.head.add(ball(0.22, cream, 0, -0.13, -0.31, 1.15, 0.85, 1)); // マズル
    this.head.add(ball(0.14, tan, -0.23, -0.06, -0.2, 1, 0.9, 0.8)); // 茶色のほっぺ
    this.head.add(ball(0.14, tan, 0.23, -0.06, -0.2, 1, 0.9, 0.8));
    this.head.add(ball(0.16, cream, -0.17, -0.17, -0.26, 1, 0.85, 0.9)); // 白いほっぺ
    this.head.add(ball(0.16, cream, 0.17, -0.17, -0.26, 1, 0.85, 0.9));
    this.head.add(ball(0.07, dark, 0, -0.06, -0.53, 1.25, 0.85, 0.9)); // 鼻
    this.head.add(ball(0.06, pink, 0, -0.26, -0.4, 1, 0.55, 1.2)); // 舌
    this.head.add(ball(0.06, pink, -0.29, -0.05, -0.27, 1, 0.7, 0.45)); // ほっぺの赤み
    this.head.add(ball(0.06, pink, 0.29, -0.05, -0.27, 1, 0.7, 0.45));
    this.head.add(ball(0.05, tan, -0.15, 0.2, -0.37, 1.3, 0.8, 0.5)); // まろ眉
    this.head.add(ball(0.05, tan, 0.15, 0.2, -0.37, 1.3, 0.8, 0.5));

    this.eyes = new THREE.Group();
    this.head.add(this.eyes);
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(0.17 * side, 0.06, -0.35);
      eye.add(ball(0.072, dark, 0, 0, 0, 0.9, 1.1, 0.6));
      eye.add(ball(0.026, white, -0.022 * side, 0.032, -0.04));
      eye.add(ball(0.012, white, 0.02 * side, -0.025, -0.04));
      this.eyes.add(eye);
    }

    // 耳
    this.ears = [];
    for (const side of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(0.22 * side, 0.3, 0.02);
      ear.rotation.z = -0.32 * side;
      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 16), fur);
      outer.position.y = 0.12;
      ear.add(outer);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.2, 16), toon(COLORS.innerEar));
      inner.position.set(0, 0.09, -0.07);
      ear.add(inner);
      this.head.add(ear);
      this.ears.push(ear);
    }

    // くるんとしたしっぽ（後ろから見ると丸く見える）
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.98, 0.5);
    const curl = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.075, 10, 24, Math.PI * 1.5), fur);
    curl.rotation.z = -Math.PI / 2;
    curl.position.set(0, 0.16, 0.04);
    this.tail.add(curl);
    this.tail.add(ball(0.085, cream, -0.16, 0.16, 0.04));
    this.body.add(this.tail);

    // 足（付け根で回転させる）
    this.legs = [];
    const legGeo = new THREE.CapsuleGeometry(0.1, 0.2, 4, 10);
    for (const [x, z, front] of [
      [-0.2, -0.3, true],
      [0.2, -0.3, true],
      [-0.2, 0.36, false],
      [0.2, 0.36, false],
    ]) {
      const hip = new THREE.Group();
      hip.position.set(x, 0.42, z);
      const leg = new THREE.Mesh(legGeo, fur);
      leg.position.y = -0.17;
      hip.add(leg);
      hip.add(ball(0.115, cream, 0, -0.34, -0.03, 1, 0.75, 1.2));
      hip.userData = { front, side: x < 0 ? 0 : 1 };
      this.body.add(hip);
      this.legs.push(hip);
    }

    // 足元の影
    const shadowTex = canvasTexture(64, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(90,60,80,0.55)');
      g.addColorStop(0.6, 'rgba(90,60,80,0.3)');
      g.addColorStop(1, 'rgba(90,60,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.7),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;

    this.mode = 'idle'; // idle | run | air | celebrate | down
    this.time = 0;
    this.phase = 0;
    this.squash = 0;
    this.hitTime = -1;
    this.blink = 2;
    this.facing = 0;
    this.downAmount = 0;
  }

  reset() {
    this.mode = 'idle';
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.root.visible = true;
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.body.scale.set(1, 1, 1);
    this.facing = 0;
    this.hitTime = -1;
    this.downAmount = 0;
    this.squash = 0;
  }

  land() {
    this.squash = 1;
  }

  hit() {
    this.hitTime = 0;
  }

  update(dt, { speed = 0, vy = 0 } = {}) {
    this.time += dt;
    const t = this.time;
    const body = this.body;
    let bob = 0;
    let pitch = 0;
    let roll = 0;

    // まばたき
    this.blink -= dt;
    let eyeScale = 1;
    if (this.blink < 0.12) eyeScale = 0.15;
    if (this.blink < 0) this.blink = 1.8 + Math.random() * 2.5;
    if (this.mode === 'down') eyeScale = 0.15;
    this.eyes.children.forEach((e) => (e.scale.y = eyeScale));

    let tailSpeed = 10;
    let tailAmp = 0.22;

    if (this.mode === 'run') {
      this.phase += dt * (6 + speed * 0.75);
      const p = this.phase;
      for (const leg of this.legs) {
        const off = leg.userData.front ? 0 : Math.PI;
        leg.rotation.x = Math.sin(p + off + leg.userData.side * 0.5) * 0.85;
      }
      bob = Math.abs(Math.sin(p)) * 0.08;
      pitch = Math.sin(p * 2) * 0.04;
      this.head.rotation.x = Math.sin(p * 2) * 0.06;
      this.ears.forEach((ear, i) => (ear.rotation.x = Math.sin(p * 2 + i) * 0.12));
      tailSpeed = 16;
    } else if (this.mode === 'air') {
      for (const leg of this.legs) {
        const target = leg.userData.front ? 0.95 : -0.85;
        leg.rotation.x += (target - leg.rotation.x) * Math.min(1, dt * 14);
      }
      pitch = THREE.MathUtils.clamp(vy * 0.035, -0.35, 0.4);
      this.ears.forEach((ear) => (ear.rotation.x += (0.35 - ear.rotation.x) * Math.min(1, dt * 10)));
      tailSpeed = 22;
      tailAmp = 0.3;
    } else if (this.mode === 'celebrate') {
      this.phase += dt * 9;
      bob = Math.abs(Math.sin(this.phase)) * 0.55;
      for (const leg of this.legs) {
        leg.rotation.x = Math.sin(this.phase * 2 + (leg.userData.front ? 0 : 1.5)) * 0.4;
      }
      this.head.rotation.z = Math.sin(this.phase) * 0.15;
      tailSpeed = 26;
      tailAmp = 0.4;
    } else if (this.mode === 'down') {
      this.downAmount = Math.min(1, this.downAmount + dt * 3);
      roll = (Math.PI / 2) * 0.92 * easeOutBack(this.downAmount);
      bob = -0.05 * this.downAmount;
      for (const leg of this.legs) leg.rotation.x *= 0.9;
      tailSpeed = 3;
      tailAmp = 0.1;
    } else {
      // idle
      for (const leg of this.legs) leg.rotation.x *= 0.85;
      bob = Math.sin(t * 2.2) * 0.015;
      this.head.rotation.z = Math.sin(t * 1.3) * 0.12;
      this.head.rotation.x = Math.sin(t * 0.9) * 0.05;
      this.ears.forEach((ear, i) => (ear.rotation.x = Math.sin(t * 3 + i) * 0.05));
    }

    if (this.mode !== 'celebrate' && this.mode !== 'idle') {
      this.head.rotation.z *= 0.9;
    }

    this.tail.rotation.z = Math.sin(t * tailSpeed) * tailAmp;

    // 着地のぷにっ
    this.squash = Math.max(0, this.squash - dt * 6);
    const s = Math.sin(this.squash * Math.PI) * 0.18;
    body.scale.set(1 + s * 0.6, 1 - s, 1 + s * 0.6);

    // ぶつかったときのくるくる
    let spin = 0;
    if (this.hitTime >= 0) {
      this.hitTime += dt;
      const k = Math.min(1, this.hitTime / 0.55);
      spin = easeOutCubic(k) * Math.PI * 2;
      roll += Math.sin(k * Math.PI) * 0.5;
      if (k >= 1) this.hitTime = -1;
    }

    const facingTarget = this.mode === 'celebrate' ? Math.PI : 0;
    this.facing += (facingTarget - this.facing) * Math.min(1, dt * 5);

    body.position.y = bob;
    body.rotation.set(pitch, this.facing + spin, roll);

    // 影：高く跳ぶほど小さく薄く
    const h = this.root.position.y;
    const k = 1 / (1 + h * 0.35);
    this.shadow.position.set(this.root.position.x, 0.02, this.root.position.z + 0.05);
    this.shadow.scale.setScalar(k);
    this.shadow.material.opacity = 0.35 + 0.65 * k;
  }
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
