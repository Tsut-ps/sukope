/** 周波数軸(縦)の対応づけ。DOM に依存しない純粋な計算だけを置く。 */
import { clamp } from './util';

export interface View {
  /** 対数軸か */
  log: boolean;
  fmin: number;
  fmax: number;
}

/** t(0=下端〜1=上端)に対応する周波数 */
export const freqAt = (v: View, t: number): number =>
  v.log ? v.fmin * Math.pow(v.fmax / v.fmin, t) : v.fmin + (v.fmax - v.fmin) * t;

/** 周波数に対応する y 座標(上端が 0、下端が height) */
export const yOf = (v: View, height: number, f: number): number =>
  height * (1 - (v.log
    ? Math.log(f / v.fmin) / Math.log(v.fmax / v.fmin)
    : (f - v.fmin) / (v.fmax - v.fmin)));

export interface ViewInput {
  log: boolean;
  noteMode: boolean;
  fminSel: number;
  /** 'nyq' またはHz */
  fmaxSel: string;
  nyquist: number;
}

/** 設定値から実際に使う表示範囲を決める(音名表示は対数固定) */
export function resolveView(o: ViewInput): View {
  const log = o.log || o.noteMode;
  const fmax = Math.min(o.fmaxSel === 'nyq' ? o.nyquist : +o.fmaxSel, o.nyquist);
  let fmin = log ? Math.max(o.fminSel, 20) : o.fminSel;
  if (fmin >= fmax) fmin = log ? 20 : 0;
  return { log, fmin, fmax };
}

/** 1 ピクセル行ごとの、FFT ビンの参照方法 */
export interface RowMap {
  /** 参照する先頭ビン */
  lo: Int32Array;
  /** 参照する末尾ビン。-1 のときは lo と lo+1 を fr で線形補間 */
  hi: Int32Array;
  fr: Float32Array;
}

export function buildRows(v: View, height: number, bins: number, nyquist: number): RowMap {
  const lo = new Int32Array(height);
  const hi = new Int32Array(height);
  const fr = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    const ba = (freqAt(v, 1 - (y + 1) / height) / nyquist) * bins;
    const bb = (freqAt(v, 1 - y / height) / nyquist) * bins;
    if (bb - ba > 1) {
      // 1 行が複数ビンにまたがる → 最大値を取る
      lo[y] = clamp(Math.round(ba), 0, bins - 1);
      hi[y] = clamp(Math.round(bb), 0, bins - 1);
    } else {
      // 行がビンより細かい → 線形補間
      const c = clamp((ba + bb) / 2, 0, bins - 1);
      const l = Math.min(Math.floor(c), bins - 1);
      lo[y] = l;
      hi[y] = -1;
      fr[y] = l >= bins - 1 ? 0 : c - l;
    }
  }
  return { lo, hi, fr };
}

const LOG_TICKS = [20, 30, 50, 70, 100, 150, 200, 300, 500, 700, 1000, 1500, 2000, 3000, 5000, 7000, 10000, 15000, 20000];
const LIN_STEPS = [10, 20, 50, 100, 200, 500, 1000, 2000, 2500, 5000, 10000];

/** 軸に描く目盛り(Hz)。対数軸は重ならない間隔だけ採用する */
export function tickList(v: View, cssHeight: number): number[] {
  const out: number[] = [];
  if (v.log) {
    const perLn = cssHeight / Math.log(v.fmax / v.fmin);
    let prev = -Infinity;
    for (const f of LOG_TICKS) {
      if (f < v.fmin || f > v.fmax) continue;
      const pos = Math.log(f) * perLn;
      if (pos - prev >= 34) {
        out.push(f);
        prev = pos;
      }
    }
  } else {
    const span = v.fmax - v.fmin;
    const step = LIN_STEPS.find((s) => span / s <= 10) ?? 10000;
    for (let f = Math.ceil(v.fmin / step) * step; f <= v.fmax; f += step) out.push(f);
  }
  return out;
}
