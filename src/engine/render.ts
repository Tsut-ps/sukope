/** 画面全体の更新(表示範囲・リサイズ・フレーム描画)をまとめる。 */
import { state, view } from './state';
import { rt } from '../runtime.svelte';
import { isNoteMode, settings } from '../settings.svelte';
import { buildRows, resolveView } from './freqmap';
import { buildLevelLut, getCmap } from './colormap';
import { bindAxis, drawAxis, resizeAxis } from './axis';
import { bindOverlay, drawOverlay, resizeOverlay } from './overlay';
import { bindSpectrogram, redrawAll, resizeSpectrogram, scrollBy, setLevelLut, setRows } from './spectrogram';
import { bindGestures } from './gesture';
import { ensureBins, hist, pushFrame } from './history';
import { ppsDev, requestFull, requestOverlay } from './viewport';
import { clamp } from './util';

const AXIS_FALLBACK_W = 64;
/** これより小さい音しか来ない状態が続いたら「音が流れていない」と案内する */
const SILENT_DB = -110;
const SILENT_MS = 4000;
/** 履歴に溜める列の間隔(秒)。60 フレーム/秒より速い画面では間引く */
const CAPTURE_SEC = 1 / 60 - 0.001;

const levelLut = new Uint8ClampedArray(256 * 3);

let host: HTMLElement | null = null;
let axisCol: HTMLElement | null = null;
let rafId = 0;
let behindT = 0;

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
  bindOverlay(els.over);
  const offGesture = bindGestures(els.over);
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  rebuildColors();
  resize();
  rafId = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    offGesture();
    host = axisCol = null;
  };
}

/** 1 ピクセル行ごとの FFT ビン対応を作り直す(表示範囲・FFT サイズが変わったとき) */
function rebuildRows(): void {
  if (!state.height) return;
  const bins = hist.bins || settings.fft / 2;
  setRows(buildRows(view, state.height, bins, rt.sampleRate / 2));
}

const spanOf = (v: { log: boolean; fmin: number; fmax: number }): number =>
  v.log ? Math.log(v.fmax / v.fmin) : v.fmax - v.fmin;

/** 設定とズームから表示範囲を決め直して、軸・グリッド・対応表を更新する */
export function updateView(): void {
  if (!host) return;
  const base = resolveView({
    log: settings.scale === 'log',
    noteMode: isNoteMode(),
    fminSel: settings.fmin,
    fmaxSel: settings.fmax,
    nyquist: rt.sampleRate / 2,
  });
  state.base = base;
  const w = state.fwin;
  const next = w
    ? { log: base.log, fmin: clamp(w.lo, base.fmin, base.fmax), fmax: clamp(w.hi, base.fmin, base.fmax) }
    : base;
  if (w && next.fmax <= next.fmin * 1.0001) state.fwin = null;
  Object.assign(view, state.fwin ? next : base);
  rt.zoomF = spanOf(base) / spanOf(view);
  rebuildRows();
  drawAxis();
  requestOverlay();
  requestFull();
}

/** 設定の範囲が変わったとき: ズームをやめて、設定どおりの範囲にする */
export function resetFreqWindow(): void {
  state.fwin = null;
  updateView();
}

/** FFT サイズが変わったとき */
export function applyFft(): void {
  const an = state.analyser;
  if (an) {
    an.fftSize = settings.fft;
    state.data = new Float32Array(an.frequencyBinCount);
    ensureBins(an.frequencyBinCount);
  }
  rebuildRows();
  requestFull();
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
  resizeSpectrogram(w, h, d);
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

  // 操作や設定変更による描き直しを、フレームごとに1回にまとめる
  if (state.dirtyView) {
    state.dirtyView = false;
    updateView();
  }
  if (state.dirtyFull) {
    state.dirtyFull = false;
    redrawAll();
    state.dirtyOverlay = true;
  }

  const an = state.analyser;
  if (an) {
    an.getFloatFrequencyData(state.data);
    state.vt += dt;
    if (state.vt - state.lastCapT >= CAPTURE_SEC) {
      state.lastCapT = state.vt;
      pushFrame(state.data, state.vt);
    }
    if (ts - state.peakT > 100) {
      state.peakT = ts;
      updatePeak();
      checkSilence(ts);
    }
    if (!rt.paused) {
      // ライブ: 経過時間ぶんだけ流す
      const pps = ppsDev();
      state.acc += dt * pps;
      const n = Math.min(Math.floor(state.acc), state.width);
      if (n >= 1) {
        state.acc -= Math.floor(state.acc);
        state.tEdge += n / pps;
        scrollBy(n);
        state.dirtyOverlay = true;
      }
    }
  }

  // 一時停止中: ライブから何秒前を見ているか
  if (rt.paused) {
    if (ts - behindT > 200) {
      behindT = ts;
      const b = Math.round(Math.max(0, state.vt - state.tEdge) * 10) / 10;
      if (b !== rt.behind) rt.behind = b;
    }
  } else if (rt.behind) rt.behind = 0;

  // タップで固定した読み取りは、しばらくしたら消す
  if (state.hoverUntil && ts > state.hoverUntil) {
    state.hoverUntil = 0;
    state.hoverX = state.hoverY = null;
    state.dirtyOverlay = true;
  }
  if (state.dirtyOverlay) {
    state.dirtyOverlay = false;
    drawOverlay();
  }
}
