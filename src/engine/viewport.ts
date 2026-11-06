/** 表示窓(時間と周波数)の計算と操作。ズーム・移動・ライブへの復帰。DOM には触れない。 */
import { rt } from '../runtime.svelte';
import { BASE_PPS, ZOOM_MAX, ZOOM_MIN, settings } from '../settings.svelte';
import { hist, oldestTime } from './history';
import { panelAt, state } from './state';
import type { View } from './freqmap';
import { clamp } from './util';

export const ppsCss = (): number => BASE_PPS * settings.zoom;
/** 1 秒あたりのデバイスピクセル数 */
export const ppsDev = (): number => ppsCss() * state.dpr;
/** 画面に入る時間(秒) */
export const windowSec = (): number => state.width / ppsDev();
/** 横位置 x(デバイスピクセル)の時刻 */
export const timeAtX = (x: number): number => state.tEdge - (state.width - 1 - x) / ppsDev();

export const requestFull = (): void => {
  state.dirtyFull = true;
};
export const requestOverlay = (): void => {
  state.dirtyOverlay = true;
};
export const requestView = (): void => {
  state.dirtyView = true;
};

/** 右端の時刻の許される範囲: 最も古い履歴 〜 最新 */
function clampEdge(): void {
  const hi = state.vt;
  let lo = hist.count ? oldestTime() + 0.25 * windowSec() : hi;
  if (lo > hi) lo = hi;
  state.tEdge = clamp(state.tEdge, lo, hi);
}

/** 表示を止める / ライブに戻す */
export function setPaused(p: boolean): void {
  if (p === rt.paused) return;
  rt.paused = p;
  if (!p) {
    state.tEdge = state.vt;
    state.acc = 0;
    rt.behind = 0;
    requestFull();
  }
  requestOverlay();
}

/** 内容を dx(デバイスピクセル)だけ右へ引っ張る = 過去へ。ライブ中に過去へ動かすと一時停止する */
export function panTime(dx: number): void {
  if (!dx) return;
  const before = state.tEdge;
  const keep = rt.paused;
  state.tEdge -= dx / ppsDev();
  if (!keep) {
    // ライブ中は、実際に過去へ動くときだけ止める
    rt.paused = true;
    clampEdge();
    if (state.tEdge >= before) {
      rt.paused = false;
      state.tEdge = before;
      return;
    }
  } else clampEdge();
  requestFull();
}

/** 画面幅の frac 倍だけ、未来(+)または過去(-)へ動かす */
export function panWindow(frac: number): void {
  panTime(-frac * state.width);
}

/** 時間軸のズーム。ライブ中は右端(いま)、止まっているときは anchorX の位置を基準にする */
export function zoomTime(factor: number, anchorX: number | null): void {
  const z1 = clamp(settings.zoom * factor, ZOOM_MIN, ZOOM_MAX);
  if (z1 === settings.zoom) return;
  const W = state.width;
  const follow = !rt.paused;
  const ax = follow || anchorX == null ? W - 1 : clamp(anchorX, 0, W - 1);
  const tA = timeAtX(ax);
  settings.zoom = z1;
  state.tEdge = tA + (W - 1 - ax) / ppsDev();
  if (!follow) clampEdge();
  requestFull();
}

const axisOf = (v: View, hz: number): number => (v.log ? Math.log(hz) : hz);
const hzOf = (v: View, u: number): number => (v.log ? Math.exp(u) : u);

function setWindow(lo: number, hi: number): void {
  const b = state.base;
  const full = lo <= b.fmin * 1.000001 && hi >= b.fmax * 0.999999;
  state.fwin = full ? null : { lo: Math.max(lo, b.fmin), hi: Math.min(hi, b.fmax) };
  requestView();
}

/** いまの(まだ描画に反映されていないものを含む)周波数の表示窓 */
const currentWindow = (): { lo: number; hi: number } => state.fwin ?? { lo: state.base.fmin, hi: state.base.fmax };

/** 画面上の y(デバイスピクセル)を、その段の中の位置にする */
const localY = (y: number): number => panelAt(y).ly;

/** 周波数軸のズーム。anchorY(デバイスピクセル、上端が 0)の位置が動かないようにする */
export function zoomFreq(factor: number, anchorY: number | null): void {
  const b = state.base;
  const b0 = axisOf(b, b.fmin);
  const b1 = axisOf(b, b.fmax);
  const w = currentWindow();
  const c0 = axisOf(b, w.lo);
  const span = axisOf(b, w.hi) - c0;
  const minSpan = Math.min(b.log ? Math.log(1.2) : 40, b1 - b0);
  const ns = clamp(span / factor, minSpan, b1 - b0);
  if (Math.abs(ns - span) < 1e-9) return;
  const c = anchorY == null || !state.panelH ? 0.5 : 1 - clamp(localY(anchorY) / state.panelH, 0, 1);
  const n0 = clamp(c0 + c * span - c * ns, b0, b1 - ns);
  setWindow(hzOf(b, n0), hzOf(b, n0 + ns));
}

/** 内容を dy(デバイスピクセル)だけ下へ引っ張る = 高い周波数へ */
export function panFreq(dy: number): void {
  if (!state.fwin || !state.panelH) return;
  const b = state.base;
  const b0 = axisOf(b, b.fmin);
  const b1 = axisOf(b, b.fmax);
  const w = currentWindow();
  const c0 = axisOf(b, w.lo);
  const span = axisOf(b, w.hi) - c0;
  const n0 = clamp(c0 + (dy / state.panelH) * span, b0, b1 - span);
  setWindow(hzOf(b, n0), hzOf(b, n0 + span));
}

/** ズームを戻す(時間・周波数とも)。ライブか一時停止かは変えない */
export function resetZoom(): void {
  settings.zoom = 1;
  state.fwin = null;
  if (rt.paused) clampEdge();
  requestView();
  requestFull();
}
