/** 履歴。FFT のビン列を、時刻つきでリングバッファに溜める(1 列 = 1 フレーム)。 */
import { dbToLevel } from './colormap';

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_COLS = 36000;
const MIN_COLS = 600;

export const hist = {
  bins: 0,
  cap: 0,
  count: 0,
  /** 次に書き込む位置 */
  head: 0,
  /** 列優先。levels[物理位置 * bins + ビン] = 1〜255(0 は未使用) */
  data: new Uint8Array(0),
  times: new Float64Array(0),
};

const capFor = (bins: number): number => Math.max(MIN_COLS, Math.min(MAX_COLS, Math.floor(MAX_BYTES / bins)));

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

/** ビン数が変わったとき(FFT サイズの変更)は、いまある履歴も新しいビン数に作り直して残す */
export function ensureBins(bins: number): void {
  if (bins === hist.bins) return;
  const ob = hist.bins;
  const cap = capFor(bins);
  const data = new Uint8Array(cap * bins);
  const times = new Float64Array(cap);
  const keep = ob ? Math.min(hist.count, cap) : 0;
  const first = hist.count - keep;
  for (let i = 0; i < keep; i++) {
    const p = phys(first + i);
    const sp = p * ob;
    const dp = i * bins;
    if (bins >= ob) {
      // 細かくなる: 同じ値を繰り返す
      for (let k = 0; k < bins; k++) data[dp + k] = hist.data[sp + Math.min(ob - 1, Math.floor((k * ob) / bins))];
    } else {
      // 粗くなる: 範囲の最大値(ピークを落とさない)
      for (let k = 0; k < bins; k++) {
        const a = Math.floor((k * ob) / bins);
        const b = Math.max(a + 1, Math.floor(((k + 1) * ob) / bins));
        let m = 0;
        for (let j = a; j < b; j++) if (hist.data[sp + j] > m) m = hist.data[sp + j];
        data[dp + k] = m;
      }
    }
    times[i] = hist.times[p];
  }
  hist.bins = bins;
  hist.cap = cap;
  hist.data = data;
  hist.times = times;
  hist.count = keep;
  hist.head = keep % cap;
}

/** 周波数データ d(dB)を、時刻 t の 1 列として追加する */
export function pushFrame(d: Float32Array, t: number): void {
  const bins = hist.bins;
  if (!bins || d.length !== bins) return;
  const o = hist.head * bins;
  const out = hist.data;
  for (let k = 0; k < bins; k++) out[o + k] = dbToLevel(d[k]);
  hist.times[hist.head] = t;
  hist.head = (hist.head + 1) % hist.cap;
  if (hist.count < hist.cap) hist.count++;
}
