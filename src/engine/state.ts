import type { View } from './freqmap';

/** エンジン内部で共有する状態。画面に出すものは runtime.svelte.ts 側に置く。 */
export const state = {
  // --- 音声入力 ---
  ctx: null as AudioContext | null,
  analyser: null as AnalyserNode | null,
  node: null as AudioNode | null,
  stream: null as MediaStream | null,
  url: null as string | null,
  file: null as File | null,
  data: new Float32Array(0),
  /** マイクや画面共有など、音が流れ続けるはずの入力か(無音の案内に使う) */
  live: false,
  silentSince: 0,

  // --- 描画 ---
  /** スペクトログラム領域のサイズ(デバイスピクセル) */
  width: 0,
  height: 0,
  dpr: 1,
  /** スクロール量の端数 */
  acc: 0,
  last: 0,
  peakT: 0,
  hoverY: null as number | null,
};

/** 周波数軸の表示範囲 */
export const view: View = { log: true, fmin: 20, fmax: 20000 };
