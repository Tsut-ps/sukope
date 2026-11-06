/** スペクトログラムの描画。履歴(リングバッファ)から、いまの表示窓・配色で画素を作る。 */
import { ctx2d } from './dom';
import { state } from './state';
import { hist, firstAfter, phys, timeAt } from './history';
import { levelToDb } from './colormap';
import type { RowMap } from './freqmap';
import { ppsDev } from './viewport';
import { clamp } from './util';

export let specCanvas!: HTMLCanvasElement;
let sctx!: CanvasRenderingContext2D;

export function bindSpectrogram(canvas: HTMLCanvasElement): void {
  specCanvas = canvas;
  sctx = ctx2d(canvas);
}

/** 前後の列がこれより離れていたら、データなし(黒)として扱う */
const GAP_SEC = 0.35;

let rows: RowMap | null = null;
/** 履歴レベル → RGB の表 */
const llut = new Uint8ClampedArray(256 * 3);
/** 同じ表を 1 画素 32bit(RGBA、リトルエンディアン)にしたもの */
const llut32 = new Uint32Array(256);
/** 1 列ぶんのレベル(ピクセル行ごと) */
let colLv = new Uint8Array(0);
let tmp = new Uint8Array(0);
let buf = new ArrayBuffer(0);
/** select() が選んだ列(配列と先頭位置) */
let curSrc: Uint8Array = tmp;
let curOff = 0;

export function setRows(r: RowMap): void {
  rows = r;
}

export function setLevelLut(lut: Uint8ClampedArray): void {
  llut.set(lut);
  for (let q = 0; q < 256; q++) llut32[q] = (255 << 24) | (lut[q * 3 + 2] << 16) | (lut[q * 3 + 1] << 8) | lut[q * 3];
}

export function resizeSpectrogram(w: number, h: number, dpr: number): void {
  state.dpr = dpr;
  state.width = w;
  state.height = h;
  specCanvas.width = w;
  specCanvas.height = h;
}

/** 時刻 t を中心に前後 half 秒にある列を選ぶ。複数あれば最大値、無ければ最も近い列。データが無ければ false */
function select(t: number, half: number): boolean {
  const n = hist.count;
  if (!n) return false;
  const bins = hist.bins;
  const a = firstAfter(t - half);
  const b = firstAfter(t + half);
  if (b - a === 1) {
    curSrc = hist.data;
    curOff = phys(a) * bins;
    return true;
  }
  if (b - a > 1) {
    if (tmp.length !== bins) tmp = new Uint8Array(bins);
    else tmp.fill(0);
    for (let i = a; i < b; i++) {
      const o = phys(i) * bins;
      for (let k = 0; k < bins; k++) if (hist.data[o + k] > tmp[k]) tmp[k] = hist.data[o + k];
    }
    curSrc = tmp;
    curOff = 0;
    return true;
  }
  let best = -1;
  let bd = GAP_SEC;
  if (a - 1 >= 0) {
    const d = t - timeAt(a - 1);
    if (d <= bd) {
      best = a - 1;
      bd = d;
    }
  }
  if (a < n && timeAt(a) - t < bd) best = a;
  if (best < 0) return false;
  curSrc = hist.data;
  curOff = phys(best) * bins;
  return true;
}

/** 選んだ列から、ピクセル行 y のレベル(1〜255)を求める */
function rowLevel(y: number): number {
  const { lo, hi, fr } = rows!;
  const s = curSrc;
  const o = curOff;
  const h = hi[y];
  if (h < 0) {
    const k = lo[y];
    const a = s[o + k];
    const b = s[o + Math.min(k + 1, hist.bins - 1)];
    return (a + (b - a) * fr[y] + 0.5) | 0;
  }
  let m = 0;
  for (let k = lo[y]; k <= h; k++) if (s[o + k] > m) m = s[o + k];
  return m;
}

/** 横位置 [x0, x1) を描く */
function paint(x0: number, x1: number): void {
  const W = state.width;
  const H = state.height;
  const w = x1 - x0;
  if (w <= 0 || !rows || !H) return;
  const need = w * H * 4;
  if (buf.byteLength < need) buf = new ArrayBuffer(need);
  const px32 = new Uint32Array(buf, 0, w * H);
  if (colLv.length !== H) colLv = new Uint8Array(H);
  const pps = ppsDev();
  const half = 0.5 / pps;
  const black = llut32[0];
  // 同じ履歴列を使う横位置が続くときは、行ごとのレベルを使い回す
  let prevKey = -1;
  for (let x = x0; x < x1; x++) {
    const o = x - x0;
    if (!select(state.tEdge - (W - 1 - x) / pps, half)) {
      for (let y = 0; y < H; y++) px32[y * w + o] = black;
      prevKey = -1;
      continue;
    }
    // 複数列の最大値(作業用の配列)は毎回中身が違うので、使い回さない
    const key = curSrc === hist.data ? curOff : -2;
    if (key < 0 || key !== prevKey) for (let y = 0; y < H; y++) colLv[y] = rowLevel(y);
    prevKey = key;
    for (let y = 0; y < H; y++) px32[y * w + o] = llut32[colLv[y]];
  }
  const px = new Uint8ClampedArray(buf, 0, need);
  sctx.putImageData(new ImageData(px, w, H), x0, 0);
}

/** 全体を描き直す */
export function redrawAll(): void {
  if (state.width && state.height) paint(0, state.width);
}

/** 画面を n 列ぶん左へずらして、右端に新しい列を描く(ライブ中の流れる表示) */
export function scrollBy(n: number): void {
  const W = state.width;
  if (n <= 0 || !W) return;
  if (n >= W) {
    paint(0, W);
    return;
  }
  sctx.drawImage(specCanvas, -n, 0);
  paint(W - n, W);
}

/** 画面上の位置 (x, y)(デバイスピクセル)の時刻と dB。データが無ければ db = null */
export function probe(x: number, y: number): { t: number; db: number | null } {
  const W = state.width;
  const H = state.height;
  const pps = ppsDev();
  const t = state.tEdge - (W - 1 - x) / pps;
  if (!rows || !H || !select(t, 0.5 / pps)) return { t, db: null };
  const q = rowLevel(clamp(Math.round(y), 0, H - 1));
  return { t, db: q ? levelToDb(q) : null };
}
