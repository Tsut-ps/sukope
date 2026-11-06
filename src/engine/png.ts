/** 現在の表示を、軸・目盛り・キャプションつきの PNG として保存する。 */
import { rt } from '../runtime.svelte';
import { settings } from '../settings.svelte';
import { ctx2d } from './dom';
import { state, view } from './state';
import { getAxisCanvas } from './axis';
import { drawGrid } from './overlay';
import { specCanvas } from './spectrogram';
import { fmtHz } from './format';
import { getCmap } from './colormap';
import { windowSec } from './viewport';

export function savePng(): void {
  const W = state.width;
  const H = state.height;
  const d = state.dpr;
  if (!W || !H) return;
  const axis = getAxisCanvas();
  const topH = Math.round(30 * d);
  const pad = Math.round(8 * d);
  const cv = document.createElement('canvas');
  cv.width = axis.width + W + pad;
  cv.height = topH + H + pad;
  const g = ctx2d(cv);
  g.fillStyle = '#0e1116';
  g.fillRect(0, 0, cv.width, cv.height);
  g.drawImage(axis, 0, topH);
  g.drawImage(specCanvas, axis.width, topH);
  g.save();
  g.translate(axis.width, topH);
  drawGrid(g, W, H, d);
  g.restore();

  // キャプション(左)と、色の凡例(右)
  const now = new Date();
  const pad2 = (n: number): string => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const info = [
    'sukope',
    stamp,
    `${fmtHz(view.fmin)}〜${fmtHz(view.fmax)}`,
    `FFT ${settings.fft}`,
    `表示幅 約 ${windowSec().toFixed(1)} 秒`,
  ];
  if (rt.zoomT !== 1 || rt.zoomF > 1.01) info.push(`ズーム 時間×${rt.zoomT.toFixed(1)} 周波数×${rt.zoomF.toFixed(1)}`);
  g.font = `${12 * d}px system-ui, "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillStyle = '#e6e9ef';
  g.fillText(info.join('   '), axis.width, topH / 2);

  const bw = 120 * d;
  const bh = 8 * d;
  const bx = cv.width - pad - bw - 56 * d;
  const by = topH / 2 - bh / 2;
  const cmap = getCmap(settings.colormap);
  for (let i = 0; i < bw; i++) {
    const c = Math.round((i / (bw - 1)) * 255) * 3;
    g.fillStyle = `rgb(${cmap[c]},${cmap[c + 1]},${cmap[c + 2]})`;
    g.fillRect(bx + i, by, 1, bh);
  }
  g.fillStyle = '#8b93a1';
  g.font = `${10 * d}px system-ui, sans-serif`;
  g.textAlign = 'right';
  g.fillText(`${settings.dbMin}`, bx - 4 * d, topH / 2);
  g.textAlign = 'left';
  g.fillText(`${settings.dbMax} dB`, bx + bw + 4 * d, topH / 2);

  cv.toBlob((b) => {
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `sukope-${now.toISOString().replace(/[:.]/g, '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
