/** 画面全体の更新(表示範囲・リサイズ・フレーム描画)をまとめる。 */
import { computePanels, state, view } from './state';
import { rt } from '../runtime.svelte';
import { isNoteMode, settings } from '../settings.svelte';
import { buildRows, resolveView } from './freqmap';
import { buildLevelLut, getCmap } from './colormap';
import { bindAxis, drawAxis, resizeAxis } from './axis';
import { bindOverlay, drawOverlay, resizeOverlay } from './overlay';
import { bindSpectrogram, redrawAll, resizeSpectrogram, scrollBy, setLevelLut, setRows } from './spectrogram';
import { bindGestures } from './gesture';
import { hist, pushFrame } from './history';
import { buildGraph } from './audio';
import { clearLabels, trackLabels } from './labels';
import { detectPitch, median } from './pitch';
import { hzToMidi, setReferencePitch } from './notes';
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
let labelT = 0;
/** 音名ラベルとチューナーの更新間隔(ms) */
const LABEL_MS = 50;

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

/** 1 ピクセル行ごとの FFT ビン対応を作り直す(表示範囲・解析の並びが変わったとき) */
function rebuildRows(): void {
  if (!state.panelH) return;
  // 履歴があれば履歴の並びで描く(解析を切り替えた直後に履歴を作り直すまでの間も整合する)
  setRows(buildRows(view, state.panelH, hist.bins ? hist.freqs : state.freqs));
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

/** 解析の方式・FFT サイズ・チャンネルの分け方が変わったとき */
export function applyAnalysis(): void {
  state.panels = settings.channels === 'lr' ? 2 : 1;
  computePanels();
  if (!host) return;
  // 取り込み中だけ解析のつなぎと履歴を作り直す(止まっているときは、次の開始で反映する)
  if (state.node) buildGraph();
  rebuildRows();
  drawAxis();
  requestOverlay();
  requestFull();
}

export function applySmooth(): void {
  for (const b of state.bands) b.an.smoothingTimeConstant = settings.smooth;
}

/** 基準ピッチ(A4)が変わったとき */
export function applyReferencePitch(): void {
  setReferencePitch(settings.a4);
  drawAxis();
  requestOverlay();
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

/** 周波数データのピークを探して、読み取り表示とレベルバーに反映する(左右を分けているときは両方から) */
function updatePeak(): void {
  const fr = state.freqs;
  const N = fr.length;
  let m = -Infinity;
  let mk = -1;
  let mc = 0;
  for (let c = 0; c < state.data.length; c++) {
    const d = state.data[c];
    for (let k = 1; k < N - 1; k++) {
      if (fr[k] < view.fmin) continue;
      if (fr[k] > view.fmax) break;
      if (d[k] > m) {
        m = d[k];
        mk = k;
        mc = c;
      }
    }
  }
  rt.level = mk >= 0 && isFinite(m) ? m : null;
  if (mk < 0 || !(m > settings.dbMin)) {
    rt.peak = null;
    return;
  }
  // 放物線補間で、ビン間隔より細かくピーク周波数を推定する
  const d = state.data[mc];
  let f = fr[mk];
  const a = d[mk - 1];
  const e = d[mk + 1];
  if (isFinite(a) && isFinite(e)) {
    const den = a - 2 * m + e;
    if (den) {
      const delta = clamp((0.5 * (a - e)) / den, -0.5, 0.5);
      f += delta >= 0 ? delta * (fr[mk + 1] - f) : delta * (f - fr[mk - 1]);
    }
  }
  rt.peak = { f, db: m };
}

/** 全帯域がほぼ無音の状態が続くかを見る(マイク・画面共有のときだけ) */
function checkSilence(ts: number): void {
  if (!state.live) return;
  let m = -Infinity;
  for (const d of state.data) for (let k = 0; k < d.length; k++) if (d[k] > m) m = d[k];
  if (m > SILENT_DB) {
    state.silentSince = ts;
    if (rt.silent) rt.silent = false;
  } else if (!rt.silent && ts - state.silentSince > SILENT_MS) {
    rt.silent = true;
  }
}

/** チューナー: 時間波形から音程を求める。直近の中央値で安定させる */
const pitchRecent: number[] = [];
function tickPitch(): void {
  const an = state.pitchAn;
  if (!an || !settings.tuner) {
    if (rt.pitch) rt.pitch = null;
    pitchRecent.length = 0;
    return;
  }
  an.getFloatTimeDomainData(state.pitchBuf);
  const p = detectPitch(state.pitchBuf, rt.sampleRate);
  if (!p) {
    pitchRecent.shift();
    if (!pitchRecent.length && rt.pitch) rt.pitch = null;
    else if (pitchRecent.length) showPitch(p);
    return;
  }
  pitchRecent.push(p.f);
  if (pitchRecent.length > 5) pitchRecent.shift();
  showPitch(p);
}
function showPitch(p: { clarity: number } | null): void {
  const f = median(pitchRecent);
  if (f == null) return;
  const m = hzToMidi(f);
  const r = Math.round(m);
  rt.pitch = { f, midi: r, cents: (m - r) * 100, clarity: p ? p.clarity : (rt.pitch?.clarity ?? 0) };
}

/** 音名ラベルのしきい値(dB)。表示の dB 範囲に合わせる */
const labelThreshold = (): number => settings.dbMin + 0.55 * (settings.dbMax - settings.dbMin);

/** 履歴を空にして取り込みを最初からやり直すときに呼ぶ(音名ラベルも消す) */
export function resetTracking(): void {
  clearLabels();
  pitchRecent.length = 0;
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

  if (state.bands.length) {
    for (const b of state.bands) {
      b.an.getFloatFrequencyData(b.tmp);
      state.data[b.ch].set(b.tmp.subarray(b.k0, b.k1), b.off);
    }
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
    if (ts - labelT > LABEL_MS) {
      labelT = ts;
      if (settings.labels && !rt.paused) trackLabels(state.data, state.freqs, labelThreshold(), state.vt);
      tickPitch();
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
