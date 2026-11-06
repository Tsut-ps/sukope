/** スペクトログラム上のグリッド線(周波数・時間)と、カーソル位置の表示。 */
import { ctx2d } from './dom';
import { rt } from '../runtime.svelte';
import { panelAt, state, view } from './state';
import { freqAt, tickList, yOf } from './freqmap';
import { fmtClock, fmtHz } from './format';
import { describePitch, isBlack, noteName, noteView, pcOf, midiToHz, yOfMidi } from './notes';
import { isNoteMode, noteLang, settings } from '../settings.svelte';
import { ppsCss, ppsDev, timeAtX } from './viewport';
import { probe } from './spectrogram';
import { labels } from './labels';
import { hist } from './history';

let overlayCanvas!: HTMLCanvasElement;
let octx!: CanvasRenderingContext2D;

export function bindOverlay(canvas: HTMLCanvasElement): void {
  overlayCanvas = canvas;
  octx = ctx2d(canvas);
}

export function resizeOverlay(w: number, h: number): void {
  overlayCanvas.width = w;
  overlayCanvas.height = h;
}

/** 時間目盛りの間隔の候補(秒) */
const TIME_STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800];
/** 時間目盛りどうしの最小間隔(CSS px) */
const TIME_MIN_GAP = 90;

/** 段ごとに、その段の左上を原点にして描く(段の外にはみ出さない) */
function eachPanel(g: CanvasRenderingContext2D, W: number, fn: (p: number, ph: number) => void): void {
  const ph = state.panelH;
  const pitch = ph + state.gap;
  for (let p = 0; p < state.panels; p++) {
    g.save();
    g.translate(0, p * pitch);
    g.beginPath();
    g.rect(0, 0, W, ph);
    g.clip();
    fn(p, ph);
    g.restore();
  }
}

/** 周波数の水平線(音名モードでは音の線) */
function drawFreqLines(g: CanvasRenderingContext2D, W: number, H: number, d: number): void {
  if (isNoteMode()) {
    // 音名モード: ド レ ミ ファ ソ ラ シ の線(Hz の線は引かない)
    const { m0, m1, semi } = noteView(view, H / d);
    const all = semi >= 4;
    g.lineWidth = 1;
    for (let m = m0; m <= m1; m++) {
      if (isBlack(m)) continue;
      const isC = pcOf(m) === 0;
      if (!isC && !all) continue;
      const y = yOfMidi(view, H, m);
      if (y < 0 || y > H) continue;
      g.strokeStyle = isC ? 'rgba(255,159,67,.34)' : 'rgba(255,255,255,.08)';
      g.beginPath();
      g.moveTo(0, Math.round(y) + 0.5);
      g.lineTo(W, Math.round(y) + 0.5);
      g.stroke();
    }
    return;
  }
  g.strokeStyle = 'rgba(255,255,255,.10)';
  g.lineWidth = 1;
  g.beginPath();
  for (const f of tickList(view, H / d)) {
    const y = Math.round(yOf(view, H, f)) + 0.5;
    g.moveTo(0, y);
    g.lineTo(W, y);
  }
  g.stroke();
}

/** 文字を、黒い縁取りつきで描く(スペクトログラムの上でも読めるように) */
function outlined(g: CanvasRenderingContext2D, text: string, x: number, y: number, d: number): void {
  g.lineWidth = 3 * d;
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(0,0,0,.7)';
  g.strokeText(text, x, y);
  g.fillText(text, x, y);
}

/** 流れる音名ラベル。重なるものは新しいほうを優先して省く */
function drawNoteLabels(g: CanvasRenderingContext2D, W: number, ph: number, d: number, ch: number): void {
  const pps = ppsDev();
  const tLeft = timeAtX(0) - 1;
  const lang = noteLang();
  g.font = `bold ${11 * d}px system-ui, sans-serif`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  const boxes: number[][] = [];
  const hgt = 12 * d;
  for (let i = labels.length - 1; i >= 0; i--) {
    const l = labels[i];
    if (l.ch !== ch) continue;
    if (l.t < tLeft) continue;
    if (l.t > state.tEdge + 0.01) continue;
    const f = midiToHz(l.midi);
    if (f < view.fmin || f > view.fmax) continue;
    const x = W - 1 - (state.tEdge - l.t) * pps + 3 * d;
    if (x < -40 * d || x > W) continue;
    const y = yOf(view, ph, f);
    const text = noteName(l.midi, lang);
    const w = g.measureText(text).width + 2 * d;
    if (boxes.some((b) => x < b[2] && x + w > b[0] && y - hgt / 2 < b[3] && y + hgt / 2 > b[1])) continue;
    boxes.push([x, y - hgt / 2, x + w, y + hgt / 2]);
    outlined(g, text, x, y, d);
  }
}

/** 倍音の線。f0 の整数倍を、上限まで引く */
function drawHarmonics(g: CanvasRenderingContext2D, W: number, ph: number, d: number, f0: number, preview: boolean): void {
  if (!(f0 > 0)) return;
  g.font = `${10 * d}px system-ui, sans-serif`;
  g.textAlign = 'right';
  g.textBaseline = 'bottom';
  g.lineWidth = 1;
  // 高い倍音は線が詰まるので、ラベルは間隔があいているものだけ
  let labelY = Infinity;
  for (let n = 1; n <= 32; n++) {
    const f = f0 * n;
    if (f > view.fmax) break;
    if (f < view.fmin) continue;
    const y = Math.round(yOf(view, ph, f)) + 0.5;
    g.setLineDash(n === 1 ? [] : [5 * d, 4 * d]);
    g.strokeStyle = preview ? 'rgba(255,255,255,.35)' : n === 1 ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.7)';
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
    if (!preview && labelY - y >= 13 * d) {
      labelY = y;
      g.setLineDash([]);
      g.fillStyle = '#fff';
      outlined(g, n === 1 ? `${fmtHz(f0)}` : `×${n}`, W - 4 * d, y - 1 * d, d);
    }
  }
  g.setLineDash([]);
}

/** 周波数のグリッドと、時間の目盛り、音名ラベル、倍音マーカーを描く。PNG 保存にも使う(カーソルは含まない) */
export function drawGrid(g: CanvasRenderingContext2D, W: number, H: number, d: number): void {
  eachPanel(g, W, (p, ph) => {
    drawFreqLines(g, W, ph, d);
    if (state.panels > 1) {
      // 段の名前(左右)
      g.font = `bold ${13 * d}px system-ui, sans-serif`;
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillStyle = '#fff';
      outlined(g, p === 0 ? 'L' : 'R', 6 * d, 4 * d, d);
    }
    if (settings.labels) drawNoteLabels(g, W, ph, d, Math.min(p, hist.ch - 1));
    if (settings.harmonics && state.pinF != null) drawHarmonics(g, W, ph, d, state.pinF, false);
  });

  // 時間の目盛り(取り込みを始めてからの経過時間)
  const step = TIME_STEPS.find((s) => s * ppsCss() >= TIME_MIN_GAP) ?? TIME_STEPS[TIME_STEPS.length - 1];
  const pps = ppsDev();
  const tLeft = timeAtX(0);
  const t0 = Math.max(0, Math.ceil(tLeft / step - 1e-9) * step);
  g.strokeStyle = 'rgba(255,255,255,.07)';
  g.font = `${10 * d}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'bottom';
  g.lineWidth = 1;
  for (let t = t0; t <= state.tEdge + 1e-9; t += step) {
    const x = W - 1 - (state.tEdge - t) * pps;
    const px = Math.round(x) + 0.5;
    g.beginPath();
    g.moveTo(px, 0);
    g.lineTo(px, H);
    g.stroke();
    if (x < 18 * d || x > W - 18 * d) continue;
    const label = fmtClock(t, step);
    g.lineWidth = 3 * d;
    g.strokeStyle = 'rgba(0,0,0,.65)';
    g.strokeText(label, x, H - 3 * d);
    g.fillStyle = 'rgba(255,255,255,.72)';
    g.fillText(label, x, H - 3 * d);
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(255,255,255,.07)';
  }
}

let lastKey = '';

export function drawOverlay(): void {
  const d = state.dpr;
  const W = state.width;
  const H = state.height;
  octx.clearRect(0, 0, W, H);
  if (!H) return;
  drawGrid(octx, W, H, d);

  if (state.hoverX == null || state.hoverY == null) {
    if (rt.hover) rt.hover = null;
    lastKey = '';
    return;
  }
  const x = Math.min(Math.max(state.hoverX, 0), W - 1);
  const y = Math.min(Math.max(state.hoverY, 0), H - 1);
  const { p, ly } = panelAt(y);
  const ph = state.panelH;
  const f = freqAt(view, 1 - ly / ph);
  const { t, db } = probe(x, y);
  const ago = Math.max(0, state.vt - t);
  octx.strokeStyle = 'rgba(255,255,255,.55)';
  octx.lineWidth = 1;
  octx.beginPath();
  // 横線は、左右どちらの段にも同じ高さで引く(見比べやすい)
  const pitch = ph + state.gap;
  for (let q = 0; q < state.panels; q++) {
    const yy = Math.round(q * pitch + ly) + 0.5;
    octx.moveTo(0, yy);
    octx.lineTo(W, yy);
  }
  octx.moveTo(Math.round(x) + 0.5, 0);
  octx.lineTo(Math.round(x) + 0.5, H);
  octx.stroke();
  if (settings.harmonics && state.pinF == null) {
    // 基音を選ぶ前は、カーソルの位置を基音としたときの倍音を薄く出す
    eachPanel(octx, W, (_q, h) => drawHarmonics(octx, W, h, d, f, true));
  }

  const noteMode = isNoteMode();
  const note = describePitch(f, noteLang());
  const l1 = noteMode ? `${note}  ${fmtHz(f)}` : `${fmtHz(f)}  ${note}`;
  const l2 = `${state.panels > 1 ? (p === 0 ? 'L  ' : 'R  ') : ''}${db == null ? '—' : db.toFixed(0) + ' dB'}  ·  ${t < 0 ? '' : fmtClock(t, 0.1)}  (${ago.toFixed(1)} 秒前)`;
  octx.font = `${12 * d}px system-ui, sans-serif`;
  const w = Math.max(octx.measureText(l1).width, octx.measureText(l2).width) + 14 * d;
  const h = 38 * d;
  // カーソルの右下に置く。はみ出すときは反対側へ
  let bx = x + 14 * d;
  let by = y + 14 * d;
  if (bx + w > W - 4 * d) bx = x - 14 * d - w;
  if (by + h > H - 4 * d) by = y - 14 * d - h;
  bx = Math.max(4 * d, bx);
  by = Math.max(4 * d, by);
  octx.fillStyle = 'rgba(14,17,22,.88)';
  octx.fillRect(bx, by, w, h);
  octx.textAlign = 'left';
  octx.textBaseline = 'middle';
  octx.fillStyle = '#fff';
  octx.fillText(l1, bx + 7 * d, by + 11 * d);
  octx.fillStyle = '#c3cad6';
  octx.fillText(l2, bx + 7 * d, by + 27 * d);

  // 読み取り値は、変わったときだけ画面側へ渡す
  const key = `${f.toFixed(1)}|${db == null ? '' : db.toFixed(0)}|${ago.toFixed(1)}`;
  if (key !== lastKey) {
    lastKey = key;
    rt.hover = { f, db, t, ago };
  }
}
