import type { View } from './freqmap';

/** 1 つの Analyser と、その出力のうち使う範囲 */
export interface Band {
  an: AnalyserNode;
  /** getFloatFrequencyData の受け皿 */
  tmp: Float32Array<ArrayBuffer>;
  /** どのチャンネルの解析か */
  ch: number;
  k0: number;
  k1: number;
  /** チャンネルのデータの中での書き込み位置 */
  off: number;
  /** この Analyser につないでいる元 */
  src: AudioNode;
}

/** エンジン内部で共有する状態。画面に出すものは runtime.svelte.ts 側に置く。 */
export const state = {
  // --- 音声入力 ---
  ctx: null as AudioContext | null,
  node: null as AudioNode | null,
  /** 入力と Analyser の間に挟んだノード(左右分離のため) */
  chain: [] as AudioNode[],
  bands: [] as Band[],
  /** チャンネルごとの周波数データ(dB)。長さは freqs と同じ */
  data: [new Float32Array(0)] as Float32Array[],
  /** いまの解析の、各ビンの中心周波数(Hz) */
  freqs: new Float32Array(0) as Float32Array,
  /** 音程検出用(時間波形を読む) */
  pitchAn: null as AnalyserNode | null,
  pitchBuf: new Float32Array(0) as Float32Array<ArrayBuffer>,
  stream: null as MediaStream | null,
  url: null as string | null,
  file: null as File | null,
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
  /** 倍音マーカーの基音(Hz)。null = 未選択 */
  pinF: null as number | null,

  // --- 描き直しの要求(次のフレームでまとめて処理する) ---
  dirtyView: false,
  dirtyFull: false,
  dirtyOverlay: true,

  // --- 描画 ---
  /** スペクトログラム領域のサイズ(デバイスピクセル) */
  width: 0,
  height: 0,
  dpr: 1,
  /** 段の数(左右を分けて表示するとき 2)と、1 段の高さ、段の間隔 */
  panels: 1,
  panelH: 0,
  gap: 0,
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

/** 段の配置を、領域の高さと段の数から決める */
export function computePanels(): void {
  state.gap = state.panels > 1 ? Math.max(2, Math.round(2 * state.dpr)) : 0;
  state.panelH = Math.max(1, Math.floor((state.height - state.gap * (state.panels - 1)) / state.panels));
}

/** デバイスピクセルの y が、どの段のどの位置か */
export function panelAt(y: number): { p: number; ly: number } {
  const pitch = state.panelH + state.gap;
  const p = Math.min(state.panels - 1, Math.max(0, Math.floor(y / pitch)));
  return { p, ly: Math.min(state.panelH - 1, Math.max(0, y - p * pitch)) };
}
