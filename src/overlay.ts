/** スペクトログラム上のグリッド線、カーソル位置の表示。 */
import { $, ctx2d } from './dom';
import { state, view } from './state';
import { freqAt, tickList, yOf } from './freqmap';
import { fmtHz } from './format';
import { describePitch, isBlack, noteView, pcOf, yOfMidi } from './notes';
import { isNoteMode, noteLang } from './settings';

export const overlayCanvas = $<HTMLCanvasElement>('over');
const octx = ctx2d(overlayCanvas);

export function resizeOverlay(w: number, h: number): void {
  overlayCanvas.width = w;
  overlayCanvas.height = h;
}

export function initOverlay(): void {
  overlayCanvas.addEventListener('pointermove', (e) => {
    const r = overlayCanvas.getBoundingClientRect();
    state.hoverY = (e.clientY - r.top) * state.dpr;
    drawOverlay();
  });
  overlayCanvas.addEventListener('pointerleave', () => {
    state.hoverY = null;
    drawOverlay();
  });
}

export function drawOverlay(): void {
  const d = state.dpr;
  const W = state.width;
  const H = state.height;
  octx.clearRect(0, 0, W, H);
  if (!H) return;
  const noteMode = isNoteMode();
  const lang = noteLang();

  if (noteMode) {
    // 音名モード: ド レ ミ ファ ソ ラ シ の線(Hz の線は引かない)
    const { m0, m1, semi } = noteView(view, H / d);
    const all = semi >= 4;
    octx.lineWidth = 1;
    for (let m = m0; m <= m1; m++) {
      if (isBlack(m)) continue;
      const isC = pcOf(m) === 0;
      if (!isC && !all) continue;
      const y = yOfMidi(view, H, m);
      if (y < 0 || y > H) continue;
      octx.strokeStyle = isC ? 'rgba(255,159,67,.34)' : 'rgba(255,255,255,.08)';
      octx.beginPath();
      octx.moveTo(0, Math.round(y) + 0.5);
      octx.lineTo(W, Math.round(y) + 0.5);
      octx.stroke();
    }
  } else {
    octx.strokeStyle = 'rgba(255,255,255,.10)';
    octx.lineWidth = 1;
    octx.beginPath();
    for (const f of tickList(view, H / d)) {
      const y = Math.round(yOf(view, H, f)) + 0.5;
      octx.moveTo(0, y);
      octx.lineTo(W, y);
    }
    octx.stroke();
  }

  const hover = $('hover');
  if (state.hoverY == null) {
    hover.textContent = '';
    return;
  }
  const y = Math.min(Math.max(state.hoverY, 0), H - 1);
  const f = freqAt(view, 1 - y / H);
  octx.strokeStyle = 'rgba(255,255,255,.55)';
  octx.beginPath();
  octx.moveTo(0, Math.round(y) + 0.5);
  octx.lineTo(W, Math.round(y) + 0.5);
  octx.stroke();
  const note = describePitch(f, lang);
  const txt = noteMode ? `${note}  ${fmtHz(f)}` : `${fmtHz(f)}  ${note}`;
  octx.font = `${12 * d}px system-ui, sans-serif`;
  octx.textBaseline = 'middle';
  octx.textAlign = 'right';
  const w = octx.measureText(txt).width + 12 * d;
  const ty = Math.min(Math.max(y - 14 * d, 10 * d), H - 10 * d);
  octx.fillStyle = 'rgba(14,17,22,.82)';
  octx.fillRect(W - w - 6 * d, ty - 9 * d, w, 18 * d);
  octx.fillStyle = '#fff';
  octx.fillText(txt, W - 12 * d, ty);
  hover.innerHTML = noteMode
    ? `カーソル: <b>${note}</b> ${fmtHz(f)}`
    : `カーソル: <b>${fmtHz(f)}</b> ${note}`;
}
