/** 画面全体の更新(表示範囲・リサイズ・フレーム描画)をまとめる。 */
import { $ } from './dom';
import { state, view } from './state';
import { readSettings, isNoteMode, noteLang } from './settings';
import { buildRows, resolveView } from './freqmap';
import { buildLevelLut } from './colormap';
import { palette } from './palette';
import { describePitch } from './notes';
import { fmtHz } from './format';
import { drawAxis, resizeAxis } from './axis';
import { drawOverlay, resizeOverlay } from './overlay';
import { drawLevel } from './level';
import { pushColumns, redrawAll, resizeHistory, setLevelLut, setRows } from './spectrogram';
import { clamp } from './util';

const AXIS_FALLBACK_W = 64;
const levelLut = new Uint8ClampedArray(256 * 3);

export function updateTimeInfo(): void {
  const px = state.width / state.dpr;
  $('timeinfo').textContent = px
    ? `← 過去 / 表示幅 約 ${(px / readSettings().speed).toFixed(1)} 秒 / 現在 →`
    : '';
}

/** 1 ピクセル行ごとの FFT ビン対応を作り直す(表示範囲・FFT サイズが変わったとき) */
export function rebuildRows(): void {
  if (!state.height) return;
  const bins = state.analyser ? state.analyser.frequencyBinCount : readSettings().fft / 2;
  setRows(buildRows(view, state.height, bins, state.sampleRate / 2));
}

/** 設定から表示範囲を決め直して、軸・グリッド・対応表を更新する */
export function updateView(): void {
  const s = readSettings();
  const noteMode = isNoteMode();
  $<HTMLSelectElement>('scale').disabled = noteMode; // 音名表示は対数固定
  Object.assign(
    view,
    resolveView({
      log: s.scale === 'log',
      noteMode,
      fminSel: s.fmin,
      fmaxSel: s.fmax,
      nyquist: state.sampleRate / 2,
    }),
  );
  rebuildRows();
  drawAxis();
  drawOverlay();
  updateTimeInfo();
}

/** dB 範囲や配色が変わったとき: 履歴全体を新しい色で描き直す */
export function rebuildColors(): void {
  buildLevelLut(palette.cmap, state.db.min, state.db.max, levelLut);
  setLevelLut(levelLut);
  redrawAll();
  drawLevel();
}

export function resize(): void {
  const r = $('host').getBoundingClientRect();
  const d = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round((r.width - 2) * d));
  const h = Math.max(1, Math.round((r.height - 2) * d));
  if (w === state.width && h === state.height && d === state.dpr) return;
  resizeHistory(w, h, d);
  resizeOverlay(w, h);
  resizeAxis($('axisCol').clientWidth || AXIS_FALLBACK_W, h, d);
  updateView();
  redrawAll();
}

/** 周波数データのピークを探して、読み取り表示とレベルバーに反映する */
function updatePeak(): void {
  const d = state.data;
  const N = d.length;
  const nyq = state.sampleRate / 2;
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
  state.level = mk >= 0 && isFinite(m) ? m : null;
  drawLevel();
  const peak = $('peak');
  if (mk < 0 || !(m > state.db.min)) {
    peak.textContent = 'ピーク: —';
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
  const f = ((mk + delta) * nyq) / N;
  const note = describePitch(f, noteLang());
  peak.innerHTML =
    (isNoteMode() ? `ピーク: <b>${note}</b> ${fmtHz(f)}` : `ピーク: <b>${fmtHz(f)}</b> ${note}`) +
    ` / ${m.toFixed(0)} dB`;
}

export function frame(ts: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (ts - state.last) / 1000);
  state.last = ts;
  const an = state.analyser;
  if (!an) return;
  an.getFloatFrequencyData(state.data);
  if (ts - state.peakT > 100) {
    state.peakT = ts;
    updatePeak();
  }
  if (state.paused) return;
  state.acc += dt * readSettings().speed * state.dpr;
  const n = Math.min(Math.floor(state.acc), state.width);
  if (n < 1) return;
  state.acc -= Math.floor(state.acc);
  pushColumns(state.data, n);
}
