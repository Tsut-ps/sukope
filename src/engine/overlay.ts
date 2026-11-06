/** スペクトログラム上のグリッド線(周波数・時間)と、カーソル位置の表示。 */
import { ctx2d } from './dom';
import { rt } from '../runtime.svelte';
import { state, view } from './state';
import { freqAt, tickList, yOf } from './freqmap';
import { fmtClock, fmtHz } from './format';
import { describePitch, isBlack, noteView, pcOf, yOfMidi } from './notes';
import { isNoteMode, noteLang } from '../settings.svelte';
import { ppsCss, ppsDev, timeAtX } from './viewport';
import { probe } from './spectrogram';

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

/** 周波数のグリッドと、時間の目盛りを描く。PNG 保存にも使う(カーソルは含まない) */
export function drawGrid(g: CanvasRenderingContext2D, W: number, H: number, d: number): void {
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
  } else {
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
  const f = freqAt(view, 1 - y / H);
  const { t, db } = probe(x, y);
  const ago = Math.max(0, state.vt - t);
  octx.strokeStyle = 'rgba(255,255,255,.55)';
  octx.lineWidth = 1;
  octx.beginPath();
  octx.moveTo(0, Math.round(y) + 0.5);
  octx.lineTo(W, Math.round(y) + 0.5);
  octx.moveTo(Math.round(x) + 0.5, 0);
  octx.lineTo(Math.round(x) + 0.5, H);
  octx.stroke();

  const noteMode = isNoteMode();
  const note = describePitch(f, noteLang());
  const l1 = noteMode ? `${note}  ${fmtHz(f)}` : `${fmtHz(f)}  ${note}`;
  const l2 = `${db == null ? '—' : db.toFixed(0) + ' dB'}  ·  ${t < 0 ? '' : fmtClock(t, 0.1)}  (${ago.toFixed(1)} 秒前)`;
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
