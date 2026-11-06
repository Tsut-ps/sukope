/** 音名ラベル: 鳴っている音のピークを見つけて、時刻と周波数をつけて覚える。描画は overlay 側。 */
import { hzToMidi, midiToHz } from './notes';

export interface NoteLabel {
  t: number;
  ch: number;
  midi: number;
}

const MAX_LABELS = 400;
/** 同じ音を続けて出すときの最小間隔(秒) */
const REPEAT_SEC = 1.2;
/** ピークがこの回数(取り込み間隔ごと)続いたら、音として扱う */
const HOLD_TICKS = 3;
/** 最大のピークからこの dB 以内のピークを拾う */
const WITHIN_DB = 12;
const MAX_PEAKS = 2;
/** ラベルを付ける周波数の範囲 */
export const LABEL_FMIN = 30;
export const LABEL_FMAX = 8000;

export const labels: NoteLabel[] = [];

export interface Peak {
  f: number;
  db: number;
}

/** 周波数データ(dB)から、しきい値を超える局所最大を、強い順に最大 max 個。放物線補間つき */
export function pickPeaks(d: ArrayLike<number>, freqs: ArrayLike<number>, thr: number, max = MAX_PEAKS): Peak[] {
  const out: Peak[] = [];
  const n = Math.min(d.length, freqs.length);
  for (let k = 1; k < n - 1; k++) {
    const f = freqs[k];
    if (f < LABEL_FMIN) continue;
    if (f > LABEL_FMAX) break;
    const b = d[k];
    if (!(b > thr) || !(b >= d[k - 1]) || !(b > d[k + 1])) continue;
    const a = d[k - 1];
    const c = d[k + 1];
    const den = a - 2 * b + c;
    let delta = 0;
    if (isFinite(a) && isFinite(c) && den) delta = Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den));
    const f2 = delta >= 0 ? f + delta * (freqs[k + 1] - f) : f + delta * (f - freqs[k - 1]);
    out.push({ f: f2, db: b });
  }
  out.sort((p, q) => q.db - p.db);
  const top = out.length ? out[0].db : 0;
  const keep: Peak[] = [];
  for (const p of out) {
    if (p.db < top - WITHIN_DB || keep.length >= max) break;
    // 近すぎるもの(同じ山の肩)は 1 つにまとめる
    if (keep.some((q) => Math.abs(hzToMidi(p.f) - hzToMidi(q.f)) < 0.8)) continue;
    keep.push(p);
  }
  return keep;
}

const holds = new Map<number, number>();
const lastAt = new Map<number, number>();

export function clearLabels(): void {
  labels.length = 0;
  holds.clear();
  lastAt.clear();
}

/** 1 回ぶんの解析結果から、ラベルを追加する。時刻 t は履歴の時計 */
export function trackLabels(datas: Float32Array[], freqs: ArrayLike<number>, thr: number, t: number): void {
  for (let ch = 0; ch < datas.length; ch++) {
    const seen = new Set<number>();
    for (const p of pickPeaks(datas[ch], freqs, thr)) {
      const midi = Math.round(hzToMidi(p.f));
      if (midiToHz(midi) < LABEL_FMIN) continue;
      const key = ch * 1000 + midi;
      seen.add(key);
      const n = (holds.get(key) ?? 0) + 1;
      holds.set(key, n);
      if (n < HOLD_TICKS) continue;
      const last = lastAt.get(key);
      if (last !== undefined && t - last < REPEAT_SEC && t >= last) continue;
      lastAt.set(key, t);
      labels.push({ t, ch, midi });
      if (labels.length > MAX_LABELS) labels.shift();
    }
    for (const key of [...holds.keys()]) {
      if (Math.floor(key / 1000) === ch && !seen.has(key)) holds.delete(key);
    }
  }
}
