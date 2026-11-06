/** 画面の操作。ボタン・ショートカット・ドロップが同じ処理を呼ぶ。 */
import { rt } from './runtime.svelte';
import { AXIS_MODES, COLORMAPS, FFT_SIZES, SPEEDS, settings } from './settings.svelte';
import { start, startFile, stop } from './engine/audio';
import { savePng } from './engine/png';
import { panWindow, resetZoom, setPaused } from './engine/viewport';

export function togglePause(): void {
  setPaused(!rt.paused);
}

export const goLive = (): void => setPaused(false);

export function toggleStart(): void {
  if (rt.running) stop();
  else void start();
}

export function toggleImmersive(): void {
  rt.immersive = !rt.immersive;
  if (rt.immersive) rt.optionsOpen = false;
}

export const fullscreenSupported = (): boolean => !!document.fullscreenEnabled;

export function toggleFullscreen(): void {
  if (!fullscreenSupported()) return;
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}

export const toggleHelp = (): void => {
  rt.helpOpen = !rt.helpOpen;
};

/** list の中で value の dir 個隣(端で止まる) */
function step<T>(list: readonly T[], value: T, dir: 1 | -1): T {
  const i = list.indexOf(value);
  return list[Math.min(list.length - 1, Math.max(0, (i < 0 ? 0 : i) + dir))];
}

export function cycleAxisMode(): void {
  const list = AXIS_MODES.map((m) => m.value);
  settings.axisMode = list[(list.indexOf(settings.axisMode) + 1) % list.length];
}

export function cycleColormap(): void {
  const list = COLORMAPS.map((m) => m.value);
  settings.colormap = list[(list.indexOf(settings.colormap) + 1) % list.length];
}

export function toggleScale(): void {
  if (settings.axisMode === 'hz') settings.scale = settings.scale === 'log' ? 'lin' : 'log';
}

export function stepFft(dir: 1 | -1): void {
  settings.fft = step(FFT_SIZES, settings.fft, dir);
}

export function stepSpeed(dir: 1 | -1): void {
  const list = SPEEDS.map((s) => s.value);
  settings.speed = step(list, settings.speed, dir);
}

export { savePng, resetZoom, panWindow };

export function openFile(f: File): void {
  settings.source = 'file';
  void startFile(f);
}
