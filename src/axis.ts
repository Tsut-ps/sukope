/** 左軸。Hz の目盛り、または音名のときは鍵盤を描く。 */
import { $, ctx2d } from './dom';
import { state, view } from './state';
import { tickList, yOf } from './freqmap';
import { fmtTick } from './format';
import { isBlack, noteName, noteView, pcName, pcOf, yOfMidi } from './notes';
import { isNoteMode, noteLang } from './settings';

const axisCanvas = $<HTMLCanvasElement>('axis');
const actx = ctx2d(axisCanvas);

export function resizeAxis(cssWidth: number, h: number, dpr: number): void {
  axisCanvas.width = Math.round(cssWidth * dpr);
  axisCanvas.height = h;
}

export function drawAxis(): void {
  const d = state.dpr;
  const H = state.height;
  const A = axisCanvas.width;
  actx.clearRect(0, 0, A, axisCanvas.height);
  if (!H) return;
  if (isNoteMode()) {
    drawKeys();
    return;
  }
  actx.font = `${11 * d}px system-ui, sans-serif`;
  actx.fillStyle = '#8b93a1';
  actx.strokeStyle = '#4a5566';
  actx.lineWidth = 1;
  actx.textAlign = 'right';
  actx.textBaseline = 'middle';
  for (const f of tickList(view, H / d)) {
    const y = yOf(view, H, f);
    actx.fillText(fmtTick(f), A - 9 * d, Math.min(Math.max(y, 7 * d), H - 7 * d));
    actx.beginPath();
    actx.moveTo(A - 5 * d, Math.round(y) + 0.5);
    actx.lineTo(A, Math.round(y) + 0.5);
    actx.stroke();
  }
  if (A / d >= 60) {
    // 狭い画面では目盛りと重なるので省略
    actx.textAlign = 'left';
    actx.textBaseline = 'top';
    actx.fillStyle = '#5d6676';
    actx.fillText('Hz', 6 * d, 3 * d);
  }
}

/** 左軸を鍵盤にする(低音が下) */
function drawKeys(): void {
  const d = state.dpr;
  const H = state.height;
  const A = axisCanvas.width;
  const lang = noteLang();
  const { m0, m1, semi } = noteView(view, H / d);
  const yM = (m: number) => yOfMidi(view, H, m);
  const x0 = 3 * d;
  const bx = x0 + (A - x0) * 0.5; // 黒鍵の右端
  const labelAll = semi * 1.5 >= 11; // 白鍵が十分高ければ全部にラベル、低ければ C だけ
  actx.save();
  actx.beginPath();
  actx.rect(0, 0, A, H);
  actx.clip();
  actx.fillStyle = '#0b0d11';
  actx.fillRect(x0, 0, A - x0, H);
  actx.textAlign = 'right';
  actx.textBaseline = 'middle';
  let prevCY = Infinity;
  for (let m = m0; m <= m1; m++) {
    // 白鍵
    if (isBlack(m)) continue;
    const yt = yM(isBlack(m + 1) ? m + 1 : m + 0.5);
    const yb = yM(isBlack(m - 1) ? m - 1 : m - 0.5);
    actx.fillStyle = '#d9dde4';
    actx.fillRect(x0, yt + 0.5 * d, A - x0, Math.max(1, yb - yt - d));
    const y = yM(m);
    const isC = pcOf(m) === 0;
    if (y < 5 * d || y > H - 5 * d) continue;
    if (isC && (labelAll || prevCY - y >= 14 * d)) {
      prevCY = y;
      actx.fillStyle = '#9a3412';
      actx.font = `bold ${11 * d}px system-ui, sans-serif`;
      actx.fillText(noteName(m, lang), A - 4 * d, y);
    } else if (!isC && labelAll) {
      actx.fillStyle = '#3b4350';
      actx.font = `${10 * d}px system-ui, sans-serif`;
      actx.fillText(pcName(m, lang), A - 4 * d, y);
    }
  }
  actx.fillStyle = '#1b2029';
  for (let m = m0; m <= m1; m++) {
    // 黒鍵
    if (!isBlack(m)) continue;
    const yt = yM(m + 0.5);
    const yb = yM(m - 0.5);
    actx.fillRect(x0, yt + 0.5 * d, bx - x0, Math.max(1, yb - yt - d));
  }
  actx.restore();
}
