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

  // --- 時間軸 ---
  /** 取り込み中だけ進む時計(秒)。履歴の時刻はこれで付ける */
  vt: 0,
  lastCapT: -1,
  /** 画面の右端に対応する時刻。ライブ中は vt を追いかけ、一時停止中は固定 */
  tEdge: 0,

  // --- 周波数軸 ---
  /** 設定の範囲(ズーム前) */
  base: { log: true, fmin: 20, fmax: 20000 } as View,
  /** ズーム・移動で選んだ表示範囲(Hz)。null = 設定どおり */
  fwin: null as { lo: number; hi: number } | null,

  // --- 描き直しの要求(次のフレームでまとめて処理する) ---
  dirtyView: false,
  dirtyFull: false,
  dirtyOverlay: true,

  // --- 描画 ---
  /** スペクトログラム領域のサイズ(デバイスピクセル) */
  width: 0,
  height: 0,
  dpr: 1,
  /** スクロール量の端数 */
  acc: 0,
  last: 0,
  peakT: 0,
  /** カーソル(またはタップ)位置。デバイスピクセル */
  hoverX: null as number | null,
  hoverY: null as number | null,
  /** タップで固定した表示を消す時刻(performance.now)。0 = 固定していない */
  hoverUntil: 0,
};

/** 周波数軸の表示範囲 */
export const view: View = { log: true, fmin: 20, fmax: 20000 };
