/** レベルバー。ハンドルをドラッグして、色に割り当てる dB の下限・上限を設定する。 */
import { ctx2d } from './dom';
import { rt } from '../runtime.svelte';
import { DB_GAP, DEFAULTS, settings } from '../settings.svelte';
import { colorIndex, DB_HI, DB_LO, getCmap } from './colormap';
import { clamp } from './util';

type Handle = 'min' | 'max';

let lvl!: HTMLCanvasElement;
let g!: CanvasRenderingContext2D;
let bound = false;

let LW = 360; // CSS px。画面幅に追従する
let LX1 = LW - 36;
const LH = 52;
const LX0 = 36;
const LB0 = 20; // バーの上端
const LB1 = 32; // バーの下端

const dbToX = (db: number): number => LX0 + ((db - DB_LO) / (DB_HI - DB_LO)) * (LX1 - LX0);
const xToDb = (x: number): number => DB_LO + ((x - LX0) / (LX1 - LX0)) * (DB_HI - DB_LO);

let active: Handle = 'min';

export function drawLevel(): void {
  if (!bound) return;
  const d = window.devicePixelRatio || 1;
  LW = Math.max(220, lvl.clientWidth || 360);
  LX1 = LW - 36;
  if (lvl.width !== Math.round(LW * d) || lvl.height !== Math.round(LH * d)) {
    lvl.width = Math.round(LW * d);
    lvl.height = Math.round(LH * d);
  }
  g.setTransform(d, 0, 0, d, 0, 0);
  g.clearRect(0, 0, LW, LH);
  const min = settings.dbMin;
  const max = settings.dbMax;
  const cmap = getCmap(settings.colormap);
  const w = LX1 - LX0;
  for (let px = 0; px < w; px++) {
    // 実際のスペクトログラムと同じ対応で塗る
    const i = colorIndex(xToDb(LX0 + px + 0.5), min, max);
    g.fillStyle = `rgb(${cmap[i * 3]},${cmap[i * 3 + 1]},${cmap[i * 3 + 2]})`;
    g.fillRect(LX0 + px, LB0, 1, LB1 - LB0);
  }
  g.strokeStyle = '#2a313c';
  g.lineWidth = 1;
  g.strokeRect(LX0 - 0.5, LB0 - 0.5, w + 1, LB1 - LB0 + 1);
  g.font = '10px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  for (let db = DB_LO; db <= DB_HI; db += 20) {
    // 目盛り
    const x = Math.round(dbToX(db)) + 0.5;
    g.strokeStyle = '#4a5566';
    g.beginPath();
    g.moveTo(x, LB1 + 1);
    g.lineTo(x, LB1 + 4);
    g.stroke();
    if (db % 40 === 0) {
      g.fillStyle = '#8b93a1';
      g.fillText(String(db), x, LB1 + 6);
    }
  }
  if (rt.level != null) {
    // 現在のピークレベル
    const x = Math.round(dbToX(clamp(rt.level, DB_LO, DB_HI)));
    g.fillStyle = 'rgba(0,0,0,.7)';
    g.fillRect(x - 2, LB0 - 2, 4, LB1 - LB0 + 4);
    g.fillStyle = '#fff';
    g.fillRect(x - 1, LB0 - 1, 2, LB1 - LB0 + 2);
  }
  g.font = '11px system-ui, sans-serif';
  g.textBaseline = 'top';
  for (const k of ['min', 'max'] as const) {
    // ハンドル
    const db = k === 'min' ? settings.dbMin : settings.dbMax;
    const x = Math.round(dbToX(db)) + 0.5;
    const col = k === active ? '#ff9f43' : '#e6e9ef';
    g.fillStyle = col;
    g.strokeStyle = col;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, LB0 - 5);
    g.lineTo(x, LB1 + 3);
    g.stroke();
    g.beginPath();
    g.moveTo(x - 5, LB0 - 8);
    g.lineTo(x + 5, LB0 - 8);
    g.lineTo(x, LB0 - 1);
    g.closePath();
    g.fill();
    g.textAlign = k === 'min' ? 'right' : 'left';
    g.fillText(`${db} dB`, x + (k === 'min' ? 5 : -5), 0);
  }
}

const getDb = (k: Handle): number => (k === 'min' ? settings.dbMin : settings.dbMax);

function setDb(k: Handle, v: number): void {
  const r = Math.round(v);
  if (k === 'min') settings.dbMin = clamp(r, DB_LO, settings.dbMax - DB_GAP);
  else settings.dbMax = clamp(r, settings.dbMin + DB_GAP, DB_HI);
}

const pointerDb = (e: PointerEvent): number => {
  const r = lvl.getBoundingClientRect();
  return xToDb(((e.clientX - r.left) * LW) / r.width);
};

/** キャンバスを結びつけ、ドラッグ・キー操作を受け付ける。戻り値は後片付け */
export function initLevel(canvas: HTMLCanvasElement): () => void {
  lvl = canvas;
  g = ctx2d(canvas);
  bound = true;
  const ac = new AbortController();
  const { signal } = ac;
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      const db = pointerDb(e);
      const dm = Math.abs(db - settings.dbMin);
      const dM = Math.abs(db - settings.dbMax);
      active = dm < dM || (dm === dM && db < settings.dbMin) ? 'min' : 'max';
      canvas.setPointerCapture(e.pointerId);
      canvas.focus({ preventScroll: true });
      setDb(active, db);
      drawLevel();
      e.preventDefault();
    },
    { signal },
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (canvas.hasPointerCapture(e.pointerId)) setDb(active, pointerDb(e));
    },
    { signal },
  );
  canvas.addEventListener(
    'dblclick',
    () => {
      settings.dbMin = DEFAULTS.dbMin;
      settings.dbMax = DEFAULTS.dbMax;
    },
    { signal },
  );
  canvas.addEventListener(
    'keydown',
    (e) => {
      const step = e.shiftKey ? 5 : 1;
      if (e.key === 'ArrowLeft') setDb(active, getDb(active) - step);
      else if (e.key === 'ArrowRight') setDb(active, getDb(active) + step);
      else if (e.key === 'ArrowUp') {
        active = 'max';
        drawLevel();
      } else if (e.key === 'ArrowDown') {
        active = 'min';
        drawLevel();
      } else return;
      e.preventDefault();
    },
    { signal },
  );
  const ro = new ResizeObserver(() => drawLevel());
  ro.observe(canvas);
  drawLevel();
  return () => {
    ac.abort();
    ro.disconnect();
    bound = false;
  };
}
