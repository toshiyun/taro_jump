import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Dog } from './dog.js';
import { setupScene, Ground, Backdrop, Scenery, Obstacle, GoalGate, Particles, POLE_RED, LEVEL_COLORS } from './world.js';
import { sfx, unlockAudio, isMuted, setMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
const ui = {
  app: $('app'),
  canvas: $('game'),
  hud: $('hud'),
  hearts: [...$('hearts').children],
  timer: $('timer'),
  timerBonus: $('timerBonus'),
  mute: $('muteBtn'),
  progressFill: $('progressFill'),
  clearedCount: $('clearedCount'),
  goalCount: $('goalCount'),
  jumpMeter: $('jumpMeter'),
  pips: [...$('jumpMeter').children],
  toast: $('toast'),
  countdown: $('countdown'),
  titleScreen: $('titleScreen'),
  resultScreen: $('resultScreen'),
  pauseScreen: $('pauseScreen'),
  errorScreen: $('errorScreen'),
  startBtn: $('startBtn'),
  retryBtn: $('retryBtn'),
  homeBtn: $('homeBtn'),
  resumeBtn: $('resumeBtn'),
  bestTitle: $('bestTitle'),
  ruleCounts: $('ruleCounts'),
  resultEyebrow: $('resultEyebrow'),
  resultTitle: $('resultTitle'),
  resultTime: $('resultTime'),
  resultBadge: $('resultBadge'),
  resultBonus: $('resultBonus'),
  resultCleared: $('resultCleared'),
  resultHits: $('resultHits'),
  resultBest: $('resultBest'),
};

// ---------- 描画の準備 ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  ui.titleScreen.hidden = true;
  ui.errorScreen.hidden = false;
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
setupScene(scene);
const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 420);

const ground = new Ground(scene);
const backdrop = new Backdrop(scene);
const scenery = new Scenery(scene);
const particles = new Particles(scene);
const dog = new Dog();
scene.add(dog.root, dog.shadow);

// ---------- ゲームの状態 ----------
const game = {
  state: 'title', // title | countdown | playing | paused | goal | over | result
  pausedFrom: null,
  stateTime: 0,
  time: 0,
  finalTime: 0,
  cleared: 0,
  hits: 0,
  bonusCount: 0,
  spawned: 0,
  spawning: false,
  nextZ: 0,
  z: 0,
  y: 0,
  vy: 0,
  speed: 0,
  airborne: false,
  level: 0,
  speedFactor: 1,
  invincible: 0,
  shake: 0,
  dustTimer: 0,
  obstacles: [],
  goal: null,
  seenRows: new Set(),
  countStep: -1,
  newBest: false,
};

const BEST_KEY = 'taroJump.bestTime';
function loadBest() {
  try {
    const v = parseFloat(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
function saveBest(v) {
  try {
    localStorage.setItem(BEST_KEY, String(v));
  } catch {
    // 保存できない環境でも遊べる
  }
}

function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

// ---------- 画面表示 ----------
ui.goalCount.textContent = `/${CONFIG.goalCount}`;
ui.ruleCounts.textContent = `${CONFIG.goalCount}こ飛びこえたらゴール。${CONFIG.maxHits}回ぶつかるとおしまい。`;

function refreshBest() {
  const best = loadBest();
  ui.bestTitle.textContent = best != null ? `ベストタイム ${formatTime(best)}` : '';
}

function refreshMute() {
  ui.mute.classList.toggle('muted', isMuted());
  ui.mute.setAttribute('aria-label', isMuted() ? '音を出す' : '音を消す');
}

function refreshHud() {
  ui.timer.textContent = formatTime(game.time);
  ui.clearedCount.textContent = String(game.cleared);
  ui.progressFill.style.width = `${(game.cleared / CONFIG.goalCount) * 100}%`;
  ui.hearts.forEach((h, i) => h.classList.toggle('lost', i >= CONFIG.maxHits - game.hits));
}

function refreshMeter() {
  ui.pips.forEach((p, i) => p.classList.toggle('on', i < game.level));
}

let toastTimer = 0;
function toast(text, small = false, bonus = false) {
  ui.toast.textContent = text;
  ui.toast.classList.toggle('small', small);
  ui.toast.classList.toggle('bonus', bonus);
  ui.toast.classList.remove('show');
  void ui.toast.offsetWidth;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 950);
}

function showCount(text) {
  ui.countdown.textContent = text;
  ui.countdown.classList.remove('tick');
  void ui.countdown.offsetWidth;
  ui.countdown.classList.add('tick');
}

// ---------- 障害物の出し方（高さも間隔もランダム） ----------
function spawnAhead() {
  while (game.spawning && game.nextZ > game.z - CONFIG.spawnAhead) {
    const rows = 1 + Math.floor(Math.random() * 3);
    game.obstacles.push(new Obstacle(scene, rows, game.nextZ));
    game.spawned++;
    // 3本バーは跳んでいる時間が長いので、次までの間隔を少し足す
    const gap = CONFIG.gapMin + Math.random() * (CONFIG.gapMax - CONFIG.gapMin) + (rows === 3 ? CONFIG.gapAfterHigh : 0);
    game.nextZ -= gap;
  }
}

// ---------- 進行 ----------
function resetRun() {
  for (const o of game.obstacles) o.dispose();
  game.obstacles = [];
  if (game.goal) game.goal.dispose();
  game.goal = null;
  particles.clear();
  dog.reset();
  Object.assign(game, {
    time: 0,
    finalTime: 0,
    cleared: 0,
    hits: 0,
    bonusCount: 0,
    spawned: 0,
    spawning: true,
    nextZ: CONFIG.firstObstacleZ,
    z: 0,
    y: 0,
    vy: 0,
    speed: 0,
    airborne: false,
    level: 0,
    speedFactor: 1,
    invincible: 0,
    shake: 0,
    countStep: -1,
    newBest: false,
  });
  game.seenRows = new Set();
  scenery.reset(0);
  refreshHud();
  refreshMeter();
}

function setState(state) {
  game.state = state;
  game.stateTime = 0;
}

function startCountdown() {
  unlockAudio();
  sfx.button();
  resetRun();
  spawnAhead();
  ui.titleScreen.hidden = true;
  ui.resultScreen.hidden = true;
  ui.hud.hidden = false;
  ui.jumpMeter.hidden = false;
  setState('countdown');
}

function goTitle() {
  sfx.button();
  resetRun();
  game.spawning = false;
  ui.resultScreen.hidden = true;
  ui.hud.hidden = true;
  ui.jumpMeter.hidden = true;
  ui.titleScreen.hidden = false;
  refreshBest();
  setState('title');
}

function jump() {
  const g = CONFIG.gravity;
  if (!game.airborne) {
    game.airborne = true;
    game.level = 1;
    game.vy = Math.sqrt(2 * g * CONFIG.jumpPeaks[0]);
  } else if (game.level < CONFIG.jumpPeaks.length) {
    game.level++;
    const target = CONFIG.jumpPeaks[game.level - 1];
    if (target > game.y) game.vy = Math.sqrt(2 * g * (target - game.y));
    particles.emit({
      pos: { x: 0, y: game.y + 0.2, z: game.z + 0.2 },
      count: 8,
      colors: ['#ffffff', LEVEL_COLORS[game.level - 1]],
      speed: 3,
      up: -1,
      life: 0.45,
      size: 0.16,
      gravity: 2,
    });
  } else {
    return;
  }
  sfx.jump(game.level);
  refreshMeter();
}

const PRAISE = ['ナイス！', 'いいね！', 'すごい！', 'ぴょーん！', 'その調子！'];

// ジャンプの頂点で、いちばん近いバーの真上にいたら「ナイス、わん！」の候補にする
function checkApex() {
  let nearest = null;
  for (const o of game.obstacles) {
    if (o.state !== 'pending') continue;
    if (!nearest || Math.abs(game.z - o.z) < Math.abs(game.z - nearest.z)) nearest = o;
  }
  if (nearest && Math.abs(game.z - nearest.z) <= CONFIG.bonusWindow && game.level === nearest.rows) {
    nearest.apexBonus = true;
  }
}

function showTimerBonus() {
  ui.timerBonus.textContent = `−${CONFIG.bonusTime}秒`;
  ui.timerBonus.classList.remove('show');
  ui.timer.classList.remove('flash');
  void ui.timerBonus.offsetWidth;
  ui.timerBonus.classList.add('show');
  ui.timer.classList.add('flash');
}

function onClear(o) {
  o.clear();
  game.cleared++;
  const bonus = !!o.apexBonus;
  if (bonus) {
    game.time = Math.max(0, game.time - CONFIG.bonusTime);
    game.bonusCount++;
    sfx.bonus();
    showTimerBonus();
    particles.emit({
      pos: { x: 0, y: game.y + 1.2, z: game.z },
      count: 26,
      colors: ['#ff6f96', '#ffb3c9', '#ffffff'],
      speed: 6,
      up: 4,
      life: 0.9,
      size: 0.24,
      spread: 1.5,
    });
  } else {
    sfx.clear();
  }
  particles.emit({
    pos: { x: 0, y: o.top + 0.3, z: o.z },
    count: 18,
    colors: [POLE_RED, '#ffffff', '#ffe066'],
    speed: 5,
    up: 4,
    life: 0.8,
    size: 0.2,
    spread: 2,
  });
  refreshHud();
  const remaining = CONFIG.goalCount - game.cleared;
  if (remaining <= 0) startGoal(o);
  if (bonus) {
    toast('ナイス、わん！', false, true);
  } else if (remaining <= 0) {
    // ゴールの案内は startGoal で出している
  } else if (remaining <= 3) {
    toast(`あと${remaining}こ！`);
  } else {
    toast(PRAISE[game.cleared % PRAISE.length], true);
  }
}

function onHit(o) {
  game.hits++;
  o.knock();
  dog.hit();
  sfx.hit();
  game.shake = 0.4;
  game.speedFactor = CONFIG.hitSlowdown;
  game.invincible = CONFIG.invincibleTime;
  if (game.airborne) {
    game.vy = Math.max(game.vy, 3);
    game.level = CONFIG.jumpPeaks.length;
  }
  particles.emit({
    pos: { x: 0, y: game.y + 0.8, z: game.z - 0.5 },
    count: 16,
    colors: ['#ffffff', '#ffe066', POLE_RED],
    speed: 6,
    up: 3,
    life: 0.6,
    size: 0.22,
  });
  refreshHud();
  refreshMeter();
  if (game.hits >= CONFIG.maxHits) {
    gameOver();
  } else {
    const left = CONFIG.maxHits - game.hits;
    toast(`いたっ！ のこり${left}`, true);
  }
}

function startGoal(lastObstacle) {
  game.spawning = false;
  for (const o of game.obstacles) o.sink();
  game.goal = new GoalGate(scene, lastObstacle.z - 14);
  toast('ゴールへGO！');
}

function finish() {
  game.finalTime = game.time;
  const best = loadBest();
  game.newBest = best == null || game.finalTime < best;
  if (game.newBest) saveBest(game.finalTime);
  sfx.goal();
  burstConfetti();
  ui.jumpMeter.hidden = true;
  toast('ゴール！');
  setState('goal');
}

function gameOver() {
  game.finalTime = game.time;
  sfx.gameover();
  ui.jumpMeter.hidden = true;
  toast('ゲームオーバー');
  setState('over');
}

function burstConfetti() {
  particles.emit({
    pos: { x: 0, y: 4.5, z: game.z - 3 },
    count: 70,
    colors: ['#ff7aa6', '#ffc23a', '#46c99a', '#74c0fc', '#ffffff', '#b197fc'],
    speed: 7,
    up: 5,
    life: 2.2,
    size: 0.22,
    gravity: 5,
    spread: 4,
  });
}

function showResult(win) {
  setState('result');
  ui.hud.hidden = true;
  ui.resultScreen.hidden = false;
  ui.resultScreen.classList.toggle('lose', !win);
  const best = loadBest();
  ui.resultEyebrow.textContent = win ? 'クリアタイム' : `あと${CONFIG.goalCount - game.cleared}こだったよ`;
  ui.resultTitle.textContent = win ? 'ゴール！' : 'ゲームオーバー';
  ui.resultTime.textContent = formatTime(game.finalTime);
  ui.resultBadge.hidden = !(win && game.newBest);
  ui.resultBonus.hidden = game.bonusCount === 0;
  ui.resultBonus.textContent = `ナイス、わん！ ×${game.bonusCount}（−${(game.bonusCount * CONFIG.bonusTime).toFixed(1)}秒）`;
  ui.resultCleared.textContent = `${game.cleared}こ`;
  ui.resultHits.textContent = `${game.hits}回`;
  ui.resultBest.textContent = best != null ? formatTime(best) : '--';
  ui.retryBtn.focus({ preventScroll: true });
}

function pause() {
  if (game.state !== 'playing' && game.state !== 'countdown') return;
  game.pausedFrom = game.state;
  game.state = 'paused';
  ui.pauseScreen.hidden = false;
}

function resume() {
  unlockAudio();
  sfx.button();
  ui.pauseScreen.hidden = true;
  game.state = game.pausedFrom || 'playing';
  lastFrame = performance.now();
}

// ---------- 毎フレームの処理 ----------
function updateRun(dt) {
  const g = CONFIG.gravity;
  if (game.state === 'playing') {
    game.time += dt;
    const top = Math.min(CONFIG.maxSpeed, CONFIG.baseSpeed + game.cleared * CONFIG.speedPerClear);
    game.speedFactor = Math.min(1, game.speedFactor + dt * 0.55);
    game.speed = top * game.speedFactor;
  } else {
    // ゴール後・ゲームオーバー後はだんだん止まる
    game.speed *= Math.exp(-dt * (game.state === 'over' ? 3.5 : 2));
  }
  game.z -= game.speed * dt;

  if (game.airborne) {
    const rising = game.vy > 0;
    game.vy -= g * dt;
    game.y += game.vy * dt;
    if (rising && game.vy <= 0 && game.state === 'playing') checkApex();
    if (game.y <= 0) {
      game.y = 0;
      game.vy = 0;
      game.airborne = false;
      game.level = 0;
      dog.land();
      refreshMeter();
      particles.emit({
        pos: { x: 0, y: 0.1, z: game.z },
        count: 8,
        colors: ['#ffffff', '#ffe9d6'],
        speed: 3,
        up: 1.5,
        life: 0.45,
        size: 0.16,
        gravity: 4,
      });
    }
  }

  if (game.invincible > 0) {
    game.invincible -= dt;
    dog.root.visible = game.invincible <= 0 || Math.floor(game.invincible * 12) % 2 === 0;
  } else {
    dog.root.visible = true;
  }

  if (game.state === 'playing') {
    const half = 0.5;
    const depth = CONFIG.obstacleDepth / 2;
    for (const o of game.obstacles) {
      if (o.state !== 'pending') continue;
      const front = o.z + depth;
      const back = o.z - depth;
      if (game.z + half < back) {
        onClear(o);
        if (game.state !== 'playing') break;
        continue;
      }
      if (game.z - half < front && game.y < o.top - CONFIG.hitMargin) {
        if (game.invincible > 0) o.knock();
        else onHit(o);
        if (game.state !== 'playing') break;
      }
    }

    // はじめて見る高さのときはタップ回数を教える
    const next = game.obstacles.find((o) => o.state === 'pending');
    if (next && !game.seenRows.has(next.rows) && game.z - next.z < 19) {
      game.seenRows.add(next.rows);
      toast(`${next.rows}回タップ！`);
    }

    if (game.goal && game.z - 0.4 < game.goal.z) finish();
    spawnAhead();
  }

  // 走るときの土ぼこり
  if (!game.airborne && game.speed > 2) {
    game.dustTimer -= dt;
    if (game.dustTimer <= 0) {
      game.dustTimer = 0.07;
      particles.emit({
        pos: { x: (Math.random() - 0.5) * 0.5, y: 0.08, z: game.z + 0.45 },
        count: 1,
        colors: ['#ffffff', '#ffe3d3'],
        speed: 0.8,
        up: 1.2,
        life: 0.4,
        size: 0.13,
        gravity: 3,
      });
    }
  }

  if (game.state === 'playing') dog.mode = game.airborne ? 'air' : 'run';
  else if (game.state === 'goal') dog.mode = game.airborne ? 'air' : game.speed > 1.5 ? 'run' : 'celebrate';
  else if (game.state === 'over') dog.mode = game.airborne ? 'air' : 'down';
}

// カメラ：タイトルでは正面から、走っている間は後ろ上から
const cam = { theta: 0.35, r: 4.6, h: 1.5, ahead: 0, lookY: 0.15 };
const camTarget = { ...cam };
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();

function updateCamera(dt, t) {
  if (game.state === 'title') {
    Object.assign(camTarget, { theta: Math.sin(t * 0.45) * 0.55, r: 4.6, h: 1.5, ahead: 0, lookY: 0.15 });
  } else if (game.state === 'goal' || game.state === 'over' || (game.state === 'result' && game.cleared >= CONFIG.goalCount)) {
    const near = game.state === 'over' || game.state === 'result' ? 0.9 : Math.min(1, game.stateTime / 1.2);
    Object.assign(camTarget, { theta: Math.PI, r: 7.4 - near * 2.4, h: 3.7 - near * 1.5, ahead: 7 - near * 7, lookY: 1.0 - near * 0.2 });
  } else {
    Object.assign(camTarget, { theta: Math.PI, r: 7.4, h: 3.7, ahead: 7, lookY: 1.0 });
  }
  const k = 1 - Math.exp(-dt * (game.state === 'countdown' ? 2.6 : 3.2));
  for (const key of Object.keys(cam)) cam[key] += (camTarget[key] - cam[key]) * k;

  const chase = game.state === 'title' ? 0 : 1;
  camPos.set(Math.sin(cam.theta) * cam.r, cam.h + game.y * 0.35 * chase, game.z - Math.cos(cam.theta) * cam.r);
  camLook.set(0, cam.lookY + game.y * 0.3 * chase, game.z - cam.ahead);
  if (game.shake > 0) {
    game.shake = Math.max(0, game.shake - dt);
    const s = game.shake * 0.5;
    camPos.x += (Math.random() - 0.5) * s;
    camPos.y += (Math.random() - 0.5) * s;
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

let lastFrame = performance.now();
let clock = 0;

function frame(now) {
  const realDt = Math.min((now - lastFrame) / 1000, 0.25);
  lastFrame = now;
  const dt = Math.min(realDt, 0.05);

  if (game.state !== 'paused') {
    clock += dt;
    game.stateTime += dt;

    if (game.state === 'countdown') {
      const steps = [
        [0.35, '3'],
        [1.05, '2'],
        [1.75, '1'],
        [2.45, 'GO!'],
      ];
      while (game.countStep + 1 < steps.length && game.stateTime >= steps[game.countStep + 1][0]) {
        game.countStep++;
        const [, label] = steps[game.countStep];
        showCount(label);
        if (label === 'GO!') {
          sfx.go();
          setState('playing');
        } else {
          sfx.count();
        }
      }
    } else if (game.state === 'playing' || game.state === 'goal' || game.state === 'over') {
      updateRun(dt);
      if (game.state === 'goal') {
        if (game.stateTime > 0.8 && game.stateTime - dt <= 0.8) burstConfetti();
        if (game.stateTime > 2.6) showResult(true);
      } else if (game.state === 'over' && game.stateTime > 2.0) {
        showResult(false);
      }
    }

    if (game.state === 'title' || game.state === 'countdown') dog.mode = 'idle';
    dog.root.position.set(0, game.y, game.z);
    dog.update(dt, { speed: game.speed, vy: game.vy });

    for (const o of game.obstacles) o.update(dt, game.z);
    game.obstacles = game.obstacles.filter((o) => !o.dead);
    if (game.goal) game.goal.update(dt);

    ground.update(game.z);
    backdrop.update(dt, game.z);
    scenery.update(game.z);
    particles.update(dt);
    updateCamera(dt, clock);
    if (game.state === 'playing') ui.timer.textContent = formatTime(game.time);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- 画面サイズ ----------
function resize() {
  const w = ui.app.clientWidth || window.innerWidth;
  const h = ui.app.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // 縦長の画面でもコースの幅が見えるように視野角を調整する
  const fov = THREE.MathUtils.radToDeg(2 * Math.atan(0.34 / camera.aspect));
  camera.fov = THREE.MathUtils.clamp(fov, 50, 75);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

// ---------- 操作 ----------
ui.app.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, .card, .title-foot, .title-head')) return;
  unlockAudio();
  if (game.state === 'playing') {
    e.preventDefault();
    jump();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' && e.code !== 'ArrowUp' && e.code !== 'Enter') return;
  if (e.target instanceof HTMLButtonElement && e.code !== 'ArrowUp') return;
  e.preventDefault();
  if (e.repeat) return;
  if (game.state === 'playing') jump();
  else if (game.state === 'title' || game.state === 'result') startCountdown();
  else if (game.state === 'paused') resume();
});

// iPhoneでのダブルタップ拡大・ピンチ・長押しメニューを防ぐ
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
ui.canvas.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
ui.app.addEventListener('contextmenu', (e) => e.preventDefault());

ui.startBtn.addEventListener('click', startCountdown);
ui.retryBtn.addEventListener('click', startCountdown);
ui.homeBtn.addEventListener('click', goTitle);
ui.resumeBtn.addEventListener('click', resume);
ui.mute.addEventListener('click', () => {
  unlockAudio();
  setMuted(!isMuted());
  refreshMute();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('pagehide', pause);

// テストやデバッグ用（ゲームには影響しない）
window.taroJump = { game, jump, start: startCountdown };

resize();
refreshBest();
refreshMute();
resetRun();
game.spawning = false;
requestAnimationFrame(frame);
