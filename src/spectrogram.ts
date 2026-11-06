/** スペクトログラムの本体。履歴をレベル値(1〜255)で保持し、色は後から変えられる。 */
import { $, ctx2d } from './dom';
import { state } from './state';
import { dbToLevel } from './colormap';
import type { RowMap } from './freqmap';

export const specCanvas = $<HTMLCanvasElement>('spec');
const sctx = ctx2d(specCanvas);

/** 履歴(列優先: hist[x * 高さ + y])。0 = データなし */
let hist = new Uint8Array(0);
let qcol = new Uint8Array(0);
let colImg: ImageData | null = null;
let full: ImageData | null = null;
let rows: RowMap | null = null;
/** 履歴レベル → RGB の表 */
const llut = new Uint8ClampedArray(256 * 3);

export function setRows(r: RowMap): void {
  rows = r;
}

export function setLevelLut(lut: Uint8ClampedArray): void {
  llut.set(lut);
}

export function clearHistory(): void {
  hist.fill(0);
}

/** サイズ変更。履歴は最近傍で拡縮してコピーする */
export function resizeHistory(w: number, h: number, dpr: number): void {
  const ow = state.width;
  const oh = state.height;
  const old = hist;
  state.dpr = dpr;
  state.width = w;
  state.height = h;
  specCanvas.width = w;
  specCanvas.height = h;
  hist = new Uint8Array(w * h);
  if (ow && oh) {
    for (let x = 0; x < w; x++) {
      const ox = Math.floor((x * ow) / w) * oh;
      for (let y = 0; y < h; y++) hist[x * h + y] = old[ox + Math.floor((y * oh) / h)];
    }
  }
  colImg = sctx.createImageData(1, h);
  qcol = new Uint8Array(h);
  full = null;
}

/** 履歴全体を現在の dB 範囲・配色で描き直す */
export function redrawAll(): void {
  const W = state.width;
  const H = state.height;
  if (!W || !H) return;
  if (!full || full.width !== W || full.height !== H) full = sctx.createImageData(W, H);
  const px = full.data;
  for (let x = 0; x < W; x++) {
    const o = x * H;
    for (let y = 0; y < H; y++) {
      const c = hist[o + y] * 3;
      const p = (y * W + x) * 4;
      px[p] = llut[c];
      px[p + 1] = llut[c + 1];
      px[p + 2] = llut[c + 2];
      px[p + 3] = 255;
    }
  }
  sctx.putImageData(full, 0, 0);
}

/** 周波数データ d から 1 列ぶんを作り、n 列ぶん左へスクロールして右端に足す */
export function pushColumns(d: Float32Array, n: number): void {
  if (!rows || !colImg) return;
  const W = state.width;
  const H = state.height;
  const px = colImg.data;
  const N = d.length;
  const { lo, hi, fr } = rows;
  for (let y = 0; y < H; y++) {
    let db: number;
    if (hi[y] < 0) {
      const k = lo[y];
      const a = Math.max(d[k], -200);
      const b = Math.max(d[Math.min(k + 1, N - 1)], -200);
      db = a + (b - a) * fr[y];
    } else {
      db = -200;
      for (let k = lo[y], e = hi[y]; k <= e; k++) if (d[k] > db) db = d[k];
    }
    const q = dbToLevel(db);
    const o = y * 4;
    const c = q * 3;
    qcol[y] = q;
    px[o] = llut[c];
    px[o + 1] = llut[c + 1];
    px[o + 2] = llut[c + 2];
    px[o + 3] = 255;
  }
  sctx.drawImage(specCanvas, -n, 0);
  hist.copyWithin(0, n * H);
  for (let k = 0; k < n; k++) {
    sctx.putImageData(colImg, W - n + k, 0);
    hist.set(qcol, (W - n + k) * H);
  }
}
