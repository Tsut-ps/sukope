/** 音程の検出(YIN 法)。時間波形から基本周波数を求める。純粋な計算のみ。 */

export interface Pitch {
  /** 基本周波数(Hz) */
  f: number;
  /** 0〜1。1 に近いほど周期がはっきりしている */
  clarity: number;
}

/** これより小さい音(実効値)は無音とみなす */
const RMS_GATE = 0.003;

/**
 * x: 時間波形、sr: サンプルレート。見つからなければ null。
 * 窓の長さ W = N − tauMax を固定して差分関数を計算するので、N は sr/fmin の 2 倍以上あるとよい。
 */
export function detectPitch(x: Float32Array, sr: number, fmin = 60, fmax = 1500, threshold = 0.12): Pitch | null {
  const N = x.length;
  const tauMax = Math.min(Math.floor(sr / fmin), N >> 1);
  const tauMin = Math.max(2, Math.floor(sr / fmax));
  const W = N - tauMax;
  if (W < 64 || tauMax <= tauMin + 2) return null;

  let e = 0;
  for (let i = 0; i < W; i++) e += x[i] * x[i];
  if (Math.sqrt(e / W) < RMS_GATE) return null;

  // 差分関数 d(τ) と、累積平均で正規化した d'(τ)
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) {
      const v = x[i] - x[i + tau];
      s += v * v;
    }
    d[tau] = s;
  }
  const dn = new Float32Array(tauMax + 1);
  dn[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    run += d[tau];
    dn[tau] = run > 0 ? (d[tau] * tau) / run : 1;
  }

  // しきい値を下回る最初の谷。無ければ全体の最小(ただし十分に低いときだけ)
  let tau = -1;
  for (let t = tauMin; t < tauMax; t++) {
    if (dn[t] < threshold) {
      while (t + 1 < tauMax && dn[t + 1] < dn[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    let m = Infinity;
    for (let t = tauMin; t < tauMax; t++) {
      if (dn[t] < m) {
        m = dn[t];
        tau = t;
      }
    }
    if (tau < 0 || m > 0.3) return null;
  }

  // 放物線補間で τ を整数より細かく
  let t = tau;
  if (tau > 1 && tau < tauMax) {
    const a = dn[tau - 1];
    const b = dn[tau];
    const c = dn[tau + 1];
    const den = a - 2 * b + c;
    if (den > 1e-12) t = tau + (0.5 * (a - c)) / den;
  }
  const f = sr / t;
  if (!(f >= fmin && f <= fmax)) return null;
  return { f, clarity: Math.max(0, Math.min(1, 1 - dn[tau])) };
}

/** 直近の検出値の中央値(外れ値でメーターが跳ねないように)。null は無視 */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
