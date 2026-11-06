/** スペクトログラム上の操作: カーソル/タップの読み取り、ズーム、移動、ピンチ。 */
import { rt } from '../runtime.svelte';
import { settings } from '../settings.svelte';
import { panelAt, state, view } from './state';
import { freqAt, yOf } from './freqmap';
import { panFreq, panTime, requestOverlay, resetZoom, zoomFreq, zoomTime } from './viewport';

/** この距離(CSS px)動かすまでは、タップとして扱う */
const DRAG_START = 4;
const TAP_MS = 400;
const DOUBLE_TAP_MS = 350;
const PIN_SHOW_MS = 5000;
/** ピンチで、指の間隔が小さすぎるときの下駄(CSS px)。縦だけ・横だけ動かしたときに片方が暴れないように */
const PINCH_FLOOR = 40;

export function bindGestures(canvas: HTMLCanvasElement): () => void {
  const ac = new AbortController();
  const { signal } = ac;
  const pts = new Map<number, { x: number; y: number }>();
  let pan: { id: number; sx: number; sy: number; moved: boolean; t0: number } | null = null;
  let pinchPrev: { dx: number; dy: number; mx: number; my: number } | null = null;
  let lastTap = { t: 0, x: 0, y: 0 };

  const scale = (): { sx: number; sy: number; r: DOMRect } => {
    const r = canvas.getBoundingClientRect();
    return { sx: canvas.width / r.width, sy: canvas.height / r.height, r };
  };
  const setHover = (cx: number, cy: number): void => {
    const { sx, sy, r } = scale();
    state.hoverX = (cx - r.left) * sx;
    state.hoverY = (cy - r.top) * sy;
    requestOverlay();
  };
  const clearHover = (): void => {
    if (state.hoverX == null) return;
    state.hoverX = state.hoverY = null;
    state.hoverUntil = 0;
    rt.hover = null;
    requestOverlay();
  };
  /** 倍音マーカーの基音をクリック/タップした位置にする。固定済みの線の近くなら解除 */
  const pinAt = (_cx: number, cy: number): void => {
    if (!settings.harmonics) return;
    const { sy, r } = scale();
    const { ly } = panelAt((cy - r.top) * sy);
    if (state.pinF != null) {
      const py = yOf(view, state.panelH, state.pinF);
      if (Math.abs(py - ly) < 8 * state.dpr) {
        state.pinF = null;
        requestOverlay();
        return;
      }
    }
    state.pinF = freqAt(view, 1 - ly / state.panelH);
    requestOverlay();
  };
  let pinchRaf = 0;
  const applyPinch = (): void => {
    pinchRaf = 0;
    if (pts.size !== 2 || !pinchPrev) return;
    const { sx, sy, r } = scale();
    const cur = pinchMetrics();
    zoomTime(cur.dx / pinchPrev.dx, (cur.mx - r.left) * sx);
    zoomFreq(cur.dy / pinchPrev.dy, (cur.my - r.top) * sy);
    // 中点の移動は、指全体を動かしたぶんだけ
    panTime((cur.mx - pinchPrev.mx) * sx);
    panFreq((cur.my - pinchPrev.my) * sy);
    pinchPrev = cur;
  };
  const pinchMetrics = (): { dx: number; dy: number; mx: number; my: number } => {
    const [a, b] = [...pts.values()];
    return {
      dx: Math.max(PINCH_FLOOR, Math.abs(a.x - b.x)),
      dy: Math.max(PINCH_FLOOR, Math.abs(a.y - b.y)),
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
    };
  };

  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse' && e.button > 1) return;
      canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        pan = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, t0: performance.now() };
      } else if (pts.size === 2) {
        pan = null;
        pinchPrev = pinchMetrics();
        clearHover();
      }
      if (e.pointerType === 'mouse') e.preventDefault();
    },
    { signal },
  );

  canvas.addEventListener(
    'pointermove',
    (e) => {
      const p = pts.get(e.pointerId);
      if (!p) {
        if (e.pointerType === 'mouse') setHover(e.clientX, e.clientY);
        return;
      }
      const { sx, sy } = scale();
      if (pts.size === 2 && pinchPrev) {
        // 2本指の座標は別々のイベントで届くので、1フレームに1回、両方そろった時点で処理する
        p.x = e.clientX;
        p.y = e.clientY;
        if (!pinchRaf) pinchRaf = requestAnimationFrame(applyPinch);
        return;
      }
      if (!pan || pan.id !== e.pointerId) return;
      if (!pan.moved) {
        if (Math.hypot(e.clientX - pan.sx, e.clientY - pan.sy) < DRAG_START) return;
        pan.moved = true;
        canvas.classList.add('grabbing');
        clearHover();
      }
      panTime((e.clientX - p.x) * sx);
      panFreq((e.clientY - p.y) * sy);
      p.x = e.clientX;
      p.y = e.clientY;
    },
    { signal },
  );

  const end = (e: PointerEvent): void => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinchPrev = null;
    const wasPan = pan && pan.id === e.pointerId ? pan : null;
    if (wasPan) pan = null;
    canvas.classList.remove('grabbing');
    if (wasPan && !wasPan.moved && e.type !== 'pointercancel' && e.pointerType === 'mouse') pinAt(e.clientX, e.clientY);
    if (!wasPan || wasPan.moved || e.type === 'pointercancel' || e.pointerType === 'mouse') return;
    // タップ: 読み取りを固定して表示。続けてもう一度タップするとズームを戻す
    const now = performance.now();
    if (now - wasPan.t0 > TAP_MS) return;
    if (now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
      lastTap.t = 0;
      resetZoom();
      return;
    }
    lastTap = { t: now, x: e.clientX, y: e.clientY };
    pinAt(e.clientX, e.clientY);
    setHover(e.clientX, e.clientY);
    state.hoverUntil = now + PIN_SHOW_MS;
  };
  canvas.addEventListener('pointerup', end, { signal });
  canvas.addEventListener('pointercancel', end, { signal });
  canvas.addEventListener(
    'pointerleave',
    (e) => {
      if (e.pointerType === 'mouse') clearHover();
    },
    { signal },
  );
  canvas.addEventListener('dblclick', () => resetZoom(), { signal });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const dx = e.deltaX * k;
      const dy = e.deltaY * k;
      const { sx, sy, r } = scale();
      const ax = (e.clientX - r.left) * sx;
      const ay = (e.clientY - r.top) * sy;
      if (e.ctrlKey) {
        // トラックパッドのピンチ、または Ctrl+ホイール: 両方の軸
        const f = Math.exp(-dy * 0.01);
        zoomTime(f, ax);
        zoomFreq(f, ay);
      } else if (e.shiftKey) {
        // 横方向のスクロールとして届くことがあるので、大きいほうを使う
        zoomFreq(Math.exp(-(dy || dx) * 0.002), ay);
      } else if (Math.abs(dx) > Math.abs(dy)) {
        // 横スクロール: 右 = 新しいほう
        panTime(-dx * state.dpr);
      } else {
        zoomTime(Math.exp(-dy * 0.002), ax);
      }
    },
    { signal, passive: false },
  );

  return () => {
    ac.abort();
    cancelAnimationFrame(pinchRaf);
  };
}
