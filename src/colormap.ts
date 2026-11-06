/** 配色と、dB → 色の対応。 */

export type ColormapName = 'inferno' | 'magma' | 'viridis' | 'turbo' | 'gray';

const MAPS: Record<ColormapName, string[]> = {
  inferno: ['#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4'],
  magma: ['#000004', '#140e36', '#3b0f70', '#641a80', '#8c2981', '#b73779', '#de4968', '#f7705c', '#fe9f6d', '#fecf92', '#fcfdbf'],
  viridis: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'],
  turbo: ['#30123b', '#4662d7', '#36aaf9', '#1ae4b6', '#72fe5e', '#c7ef34', '#faba39', '#f66b19', '#ca2a04', '#7a0403'],
  gray: ['#000000', '#ffffff'],
};

/** 履歴に保存する dB の固定スケール */
export const DB_LO = -160;
export const DB_HI = 0;

/** 配色を 256 段階の RGB 表(長さ 768)にする */
export function buildColormap(name: ColormapName): Uint8ClampedArray {
  const stops = MAPS[name].map((h) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  });
  const out = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const p = (i / 255) * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(p));
    const f = p - k;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f;
  }
  return out;
}

/** dB を、表示範囲 [dbMin, dbMax] の中で 0〜255 の色番号にする */
export function colorIndex(db: number, dbMin: number, dbMax: number): number {
  const v = (db - dbMin) / (dbMax - dbMin);
  return v <= 0 ? 0 : v >= 1 ? 255 : (v * 255) | 0;
}

/** dB → 履歴用レベル(1〜255)。0 は「データなし」に使う */
export function dbToLevel(db: number): number {
  const t = (db - DB_LO) / (DB_HI - DB_LO);
  return t <= 0 ? 1 : t >= 1 ? 255 : 1 + ((t * 254 + 0.5) | 0);
}

export const levelToDb = (q: number): number => DB_LO + ((q - 1) / 254) * (DB_HI - DB_LO);

/** 履歴レベル(0〜255) → RGB の表。dB 範囲や配色を変えるたびに作り直す */
export function buildLevelLut(cmap: Uint8ClampedArray, dbMin: number, dbMax: number, out: Uint8ClampedArray): void {
  out[0] = out[1] = out[2] = 0;
  for (let q = 1; q < 256; q++) {
    const i = colorIndex(levelToDb(q), dbMin, dbMax);
    out[q * 3] = cmap[i * 3];
    out[q * 3 + 1] = cmap[i * 3 + 1];
    out[q * 3 + 2] = cmap[i * 3 + 2];
  }
}
