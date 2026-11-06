import type { View } from './freqmap';

/** アプリ全体で共有する実行時の状態 */
export const state = {
  // --- 音声入力 ---
  ctx: null as AudioContext | null,
  analyser: null as AnalyserNode | null,
  node: null as AudioNode | null,
  stream: null as MediaStream | null,
  player: null as HTMLAudioElement | null,
  url: null as string | null,
  file: null as File | null,
  data: new Float32Array(0),
  running: false,
  paused: false,
  sampleRate: 48000,

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

  // --- 表示範囲 ---
  /** 色に割り当てる dB の範囲 */
  db: { min: -100, max: -30 },
  /** 現在のピークレベル(dB)。無音のときは null */
  level: null as number | null,
};

/** 周波数軸の表示範囲 */
export const view: View = { log: true, fmin: 20, fmax: 20000 };
