import { $ } from './dom';
import type { ColormapName } from './colormap';
import type { NoteLang } from './notes';

export type AxisMode = 'hz' | 'en' | 'jp';

const sel = (id: string) => $<HTMLSelectElement>(id);

export const axisMode = (): AxisMode => sel('notes').value as AxisMode;
export const isNoteMode = (): boolean => axisMode() !== 'hz';
export const noteLang = (): NoteLang => (axisMode() === 'jp' ? 'jp' : 'en');

export interface Settings {
  fft: number;
  /** スクロール速度(CSS px/秒) */
  speed: number;
  smooth: number;
  scale: 'log' | 'lin';
  fmin: number;
  /** 'nyq' または Hz */
  fmax: string;
  colormap: ColormapName;
}

export function readSettings(): Settings {
  return {
    fft: +sel('fft').value,
    speed: +sel('speed').value,
    smooth: +$<HTMLInputElement>('smooth').value,
    scale: sel('scale').value as 'log' | 'lin',
    fmin: +sel('fmin').value,
    fmax: sel('fmax').value,
    colormap: sel('map').value as ColormapName,
  };
}
