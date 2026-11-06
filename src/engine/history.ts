/** 履歴。解析のビン列を、時刻つきでリングバッファに溜める(1 列 = 1 フレーム)。 */
import { dbToLevel } from './colormap';

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_COLS = 36000;
const MIN_COLS = 600;

export const hist = {
  /** 1 チャンネルのビン数 */
  bins: 0,
  ch: 1,
  /** 1 列の長さ = bins * ch(チャンネルごとにビン列を並べる) */
  stride: 0,
  /** 各ビンの中心周波数(Hz) */
  freqs: new Float32Array(0),
  cap: 0,
  count: 0,
  /** 次に書き込む位置 */
  head: 0,
  /** 列優先。data[物理位置 * stride + チャンネル * bins + ビン] = 1〜255(0 は未使用) */
  data: new Uint8Array(0),
  times: new Float64Array(0),
};

const capFor = (stride: number): number => Math.max(MIN_COLS, Math.min(MAX_COLS, Math.floor(MAX_BYTES / stride)));

/** 古い順に数えた i 番目の列の、物理位置 */
export const phys = (i: number): number => {
  const p = hist.head - hist.count + i;
  return p >= 0 ? p : p + hist.cap;
};

export const timeAt = (i: number): number => hist.times[phys(i)];

/** 時刻 t より後になる最初の列(古い順の番号)。無ければ count */
export function firstAfter(t: number): number {
  let lo = 0;
  let hi = hist.count;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (timeAt(mid) <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export const oldestTime = (): number => (hist.count ? timeAt(0) : NaN);

export function clearHistory(): void {
  hist.count = 0;
  hist.head = 0;
}

/** 昇順の配列 a で、x 以上になる最初の位置 */
function lowerBound(a: ArrayLike<number>, x: number): number {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** 新しいビン j ごとに、対応する古いビンの範囲 [lo, hi] を求める(周波数で対応づける) */
export function remapRanges(oldF: ArrayLike<number>, newF: ArrayLike<number>): { lo: Int32Array; hi: Int32Array } {
  const n = newF.length;
  const lo = new Int32Array(n);
  const hi = new Int32Array(n);
  for (let j = 0; j < n; j++) {
    const below = j > 0 ? (newF[j - 1] + newF[j]) / 2 : newF[j] - ((newF[Math.min(1, n - 1)] - newF[0]) || 1) / 2;
    const above = j + 1 < n ? (newF[j] + newF[j + 1]) / 2 : newF[j] + ((newF[n - 1] - newF[Math.max(0, n - 2)]) || 1) / 2;
    let a = lowerBound(oldF, below);
    let b = lowerBound(oldF, above) - 1;
    if (b < a) {
      // 新しいビンのほうが細かい: 最も近い古いビンを使う
      const i = lowerBound(oldF, newF[j]);
      const c = i > 0 && (i >= oldF.length || newF[j] - oldF[i - 1] <= oldF[i] - newF[j]) ? i - 1 : i;
      a = b = Math.min(oldF.length - 1, c);
    }
    lo[j] = a;
    hi[j] = b;
  }
  return { lo, hi };
}

const sameFreqs = (a: ArrayLike<number>, b: ArrayLike<number>): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

/**
 * 解析の並び(周波数表・チャンネル数)を設定する。変わったときは、いまある履歴も新しい並びに作り直して残す
 * (周波数で対応づけ、粗くなるときは範囲の最大値、細かくなるときは最も近い値)。
 */
export function ensureLayout(freqs: Float32Array, ch: number): void {
  const nb = freqs.length;
  if (hist.bins === nb && hist.ch === ch && sameFreqs(hist.freqs, freqs)) return;
  const ob = hist.bins;
  const och = hist.ch;
  const ostride = hist.stride;
  const stride = nb * ch;
  const cap = capFor(stride);
  const data = new Uint8Array(cap * stride);
  const times = new Float64Array(cap);
  const keep = ob ? Math.min(hist.count, cap) : 0;
  const first = hist.count - keep;
  if (keep) {
    const { lo, hi } = remapRanges(hist.freqs, freqs);
    for (let i = 0; i < keep; i++) {
      const p = phys(first + i);
      for (let c = 0; c < ch; c++) {
        const so = p * ostride + Math.min(c, och - 1) * ob;
        const dp = i * stride + c * nb;
        for (let j = 0; j < nb; j++) {
          let m = 0;
          for (let k = lo[j], e = hi[j]; k <= e; k++) if (hist.data[so + k] > m) m = hist.data[so + k];
          data[dp + j] = m;
        }
      }
      times[i] = hist.times[p];
    }
  }
  hist.bins = nb;
  hist.ch = ch;
  hist.stride = stride;
  hist.freqs = Float32Array.from(freqs);
  hist.cap = cap;
  hist.data = data;
  hist.times = times;
  hist.count = keep;
  hist.head = keep % cap;
}

/** チャンネルごとの周波数データ(dB)を、時刻 t の 1 列として追加する */
export function pushFrame(datas: Float32Array[], t: number): void {
  const bins = hist.bins;
  if (!bins || !datas.length) return;
  const base = hist.head * hist.stride;
  const out = hist.data;
  for (let c = 0; c < hist.ch; c++) {
    const d = datas[Math.min(c, datas.length - 1)];
    if (d.length !== bins) return;
    const o = base + c * bins;
    for (let k = 0; k < bins; k++) out[o + k] = dbToLevel(d[k]);
  }
  hist.times[hist.head] = t;
  hist.head = (hist.head + 1) % hist.cap;
  if (hist.count < hist.cap) hist.count++;
}
