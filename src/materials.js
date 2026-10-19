import * as THREE from 'three';

// アニメ調のトゥーン陰影（3段階）
let gradient = null;
function gradientMap() {
  if (!gradient) {
    const data = new Uint8Array([155, 215, 255]);
    gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

const cache = new Map();

// 同じ色のマテリアルは使い回す（mapなどを渡したときは毎回新規）
export function toon(color, opts = null) {
  if (!opts && cache.has(color)) return cache.get(color);
  const mat = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...(opts || {}) });
  if (!opts) cache.set(color, mat);
  return mat;
}

export function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 肉球マーク（タップ回数の表示などに使う）
export function drawPaw(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.18, size * 0.32, size * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  const toes = [
    [-0.34, -0.14],
    [-0.12, -0.34],
    [0.12, -0.34],
    [0.34, -0.14],
  ];
  for (const [tx, ty] of toes) {
    ctx.beginPath();
    ctx.ellipse(x + tx * size, y + ty * size, size * 0.12, size * 0.15, tx * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}
