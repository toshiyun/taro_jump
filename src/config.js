// ゲームバランスの調整値。数字を変えるだけで難しさを変えられます。
export const CONFIG = {
  goalCount: 20, // 飛び越えるとゲームクリアになる障害物の数
  maxHits: 3, // ぶつかるとゲームオーバーになる回数

  // ジャンプ（タップ回数ごとの最高到達点。単位はタロ助の足元の高さ）
  gravity: 34,
  jumpPeaks: [1.2, 1.95, 2.95], // 1回 / 2回 / 3回タップ
  hitMargin: 0.08, // 障害物の上端からこれだけ下までは当たり判定をおまけする

  // 障害物（赤白らせんのバーを何本積むか = 必要なタップ回数）
  rowHeight: 0.7, // バー1本ぶんの高さ
  rowGap: 0.04,
  obstacleDepth: 0.36, // 当たり判定の奥行き（バーの太さ）

  // 走るスピード
  baseSpeed: 11,
  speedPerClear: 0.3,
  maxSpeed: 17,

  // コース
  trackWidth: 4.2,
  firstObstacleZ: -32,
  gapMin: 20, // 障害物どうしの間隔（この範囲でランダム）
  gapMax: 36,
  gapAfterHigh: 3, // 3本バーのあとに足す間隔
  spawnAhead: 115,

  // ぶつかった後
  invincibleTime: 1.2,
  hitSlowdown: 0.35,
};

// バーn本の障害物の上端の高さ
export function obstacleTop(rows) {
  return rows * (CONFIG.rowHeight + CONFIG.rowGap) - CONFIG.rowGap;
}
