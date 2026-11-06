/** 画面全体の更新(表示範囲・リサイズ・フレーム描画)をまとめる。 */
import { state, view } from './state';
import { rt } from '../runtime.svelte';
import { isNoteMode, settings } from '../settings.svelte';
import { buildRows, resolveView } from './freqmap';
import { buildLevelLut, getCmap } from './colormap';
import { bindAxis, drawAxis, resizeAxis } from './axis';
import { bindOverlay, drawOverlay, resizeOverlay } from './overlay';
import {
  bindSpectrogram,
  clearHistory,
  pushColumns,
  redrawAll,
  resizeHistory,
  setLevelLut,
  setRows,
} from './spectrogram';
import { clamp } from './util';

const AXIS_FALLBACK_W = 64;
/** これより小さい音しか来ない状態が続いたら「音が流れていない」と案内する */
const SILENT_DB = -110;
const SILENT_MS = 4000;

const levelLut = new Uint8ClampedArray(256 * 3);

let host: HTMLElement | null = null;
let axisCol: HTMLElement | null = null;
let rafId = 0;
let prevView: { log: boolean; fmin: number; fmax: number } | null = null;

export interface EngineElements {
  host: HTMLElement;
  axisCol: HTMLElement;
  spec: HTMLCanvasElement;
  over: HTMLCanvasElement;
  axis: HTMLCanvasElement;
}

/** キャンバスを結びつけて描画を始める。戻り値は後片付け */
export function initEngine(els: EngineElements): () => void {
  host = els.host;
  axisCol = els.axisCol;
  bindSpectrogram(els.spec);
  bindAxis(els.axis);
  const offOverlay = bindOverlay(els.over);
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  rebuildColors();
  resize();
  rafId = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    offOverlay();
    host = axisCol = null;
    prevView = null;
  };
}

/** 1 ピクセル行ごとの FFT ビン対応を作り直す(表示範囲・FFT サイズが変わったとき) */
function rebuildRows(): void {
  if (!state.height) return;
  const bins = state.analyser ? state.analyser.frequencyBinCount : settings.fft / 2;
  setRows(buildRows(view, state.height, bins, rt.sampleRate / 2));
}

/** 設定から表示範囲を決め直して、軸・グリッド・対応表を更新する */
export function updateView(): void {
  if (!host) return;
  Object.assign(
    view,
    resolveView({
      log: settings.scale === 'log',
      noteMode: isNoteMode(),
      fminSel: settings.fmin,
      fmaxSel: settings.fmax,
      nyquist: rt.sampleRate / 2,
    }),
  );
  // 軸の対応が変わると過去の描画と合わなくなるので、履歴を消す
  const changed = !!prevView && (prevView.log !== view.log || prevView.fmin !== view.fmin || prevView.fmax !== view.fmax);
  prevView = { ...view };
  if (changed) clearHistory();
  rebuildRows();
  drawAxis();
  drawOverlay();
  if (changed) redrawAll();
}

/** FFT サイズが変わったとき */
export function applyFft(): void {
  const an = state.analyser;
  if (an) {
    an.fftSize = settings.fft;
    state.data = new Float32Array(an.frequencyBinCount);
  }
  rebuildRows();
}

export function applySmooth(): void {
  if (state.analyser) state.analyser.smoothingTimeConstant = settings.smooth;
}

/** dB 範囲や配色が変わったとき: 履歴全体を新しい色で描き直す */
export function rebuildColors(): void {
  if (!host) return;
  buildLevelLut(getCmap(settings.colormap), settings.dbMin, settings.dbMax, levelLut);
  setLevelLut(levelLut);
  redrawAll();
}

function resize(): void {
  if (!host || !axisCol) return;
  const r = host.getBoundingClientRect();
  const d = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round((r.width - 2) * d));
  const h = Math.max(1, Math.round((r.height - 2) * d));
  if (w === state.width && h === state.height && d === state.dpr) return;
  resizeHistory(w, h, d);
  resizeOverlay(w, h);
  resizeAxis(axisCol.clientWidth || AXIS_FALLBACK_W, h, d);
  rt.widthCss = w / d;
  updateView();
  redrawAll();
}

/** 周波数データのピークを探して、読み取り表示とレベルバーに反映する */
function updatePeak(): void {
  const d = state.data;
  const N = d.length;
  const nyq = rt.sampleRate / 2;
  const k0 = Math.max(1, Math.ceil((view.fmin / nyq) * N));
  const k1 = Math.min(N - 2, Math.floor((view.fmax / nyq) * N));
  let m = -Infinity;
  let mk = -1;
  for (let k = k0; k <= k1; k++) {
    if (d[k] > m) {
      m = d[k];
      mk = k;
    }
  }
  rt.level = mk >= 0 && isFinite(m) ? m : null;
  if (mk < 0 || !(m > settings.dbMin)) {
    rt.peak = null;
    return;
  }
  // 放物線補間で、ビン間隔より細かくピーク周波数を推定する
  let delta = 0;
  const a = d[mk - 1];
  const b = d[mk];
  const e = d[mk + 1];
  if (isFinite(a) && isFinite(e)) {
    const den = a - 2 * b + e;
    if (den) delta = clamp((0.5 * (a - e)) / den, -0.5, 0.5);
  }
  rt.peak = { f: ((mk + delta) * nyq) / N, db: m };
}

/** 全帯域がほぼ無音の状態が続くかを見る(マイク・画面共有のときだけ) */
function checkSilence(ts: number): void {
  if (!state.live) return;
  let m = -Infinity;
  for (let k = 0; k < state.data.length; k++) if (state.data[k] > m) m = state.data[k];
  if (m > SILENT_DB) {
    state.silentSince = ts;
    if (rt.silent) rt.silent = false;
  } else if (!rt.silent && ts - state.silentSince > SILENT_MS) {
    rt.silent = true;
  }
}

function frame(ts: number): void {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min(0.1, (ts - state.last) / 1000);
  state.last = ts;
  const an = state.analyser;
  if (!an) return;
  an.getFloatFrequencyData(state.data);
  if (ts - state.peakT > 100) {
    state.peakT = ts;
    updatePeak();
    checkSilence(ts);
  }
  if (rt.paused) return;
  state.acc += dt * settings.speed * state.dpr;
  const n = Math.min(Math.floor(state.acc), state.width);
  if (n < 1) return;
  state.acc -= Math.floor(state.acc);
  pushColumns(state.data, n);
}
