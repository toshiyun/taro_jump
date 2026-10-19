// 効果音はWeb Audioでその場で合成する（音声ファイル不要）
let ctx = null;
let master = null;
let muted = false;

try {
  muted = localStorage.getItem('taroJump.muted') === '1';
} catch {
  muted = false;
}

// iPhoneではタップなどの操作の中で呼ぶ必要がある
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = muted ? 0 : 0.5;
  try {
    localStorage.setItem('taroJump.muted', muted ? '1' : '0');
  } catch {
    // 保存できなくても遊べる
  }
}

function tone({ freq, to = freq, dur = 0.15, type = 'sine', vol = 0.3, delay = 0 }) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function notes(list, { type = 'triangle', vol = 0.25, step = 0.1, dur = 0.14 } = {}) {
  list.forEach((f, i) => f && tone({ freq: f, dur, type, vol, delay: i * step }));
}

export const sfx = {
  jump(level) {
    const base = [420, 560, 720][level - 1] || 420;
    tone({ freq: base, to: base * 1.9, dur: 0.16, type: 'sine', vol: 0.32 });
  },
  clear() {
    notes([988, 1319], { step: 0.07, dur: 0.12, vol: 0.2 });
  },
  hit() {
    tone({ freq: 220, to: 70, dur: 0.3, type: 'square', vol: 0.18 });
    tone({ freq: 160, to: 60, dur: 0.25, type: 'sawtooth', vol: 0.12, delay: 0.03 });
  },
  count() {
    tone({ freq: 660, dur: 0.12, type: 'triangle', vol: 0.25 });
  },
  go() {
    tone({ freq: 990, dur: 0.3, type: 'triangle', vol: 0.3 });
  },
  goal() {
    notes([523, 659, 784, 1047, 0, 784, 1047], { step: 0.11, dur: 0.18, vol: 0.25 });
  },
  gameover() {
    notes([523, 466, 392, 330], { step: 0.18, dur: 0.24, vol: 0.22, type: 'sine' });
  },
  button() {
    tone({ freq: 700, to: 900, dur: 0.08, type: 'triangle', vol: 0.2 });
  },
};
