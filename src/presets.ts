/** 用途ごとの設定のまとまり。1回押すだけで FFT・範囲・速度・配色などを切り替える。 */
import { settings, type Settings } from './settings.svelte';

export interface Preset {
  id: string;
  label: string;
  hint: string;
  values: Partial<Settings>;
}

export const PRESETS: Preset[] = [
  {
    id: 'voice',
    label: '声',
    hint: '声の高さと母音の響きを見る(50〜8000 Hz)',
    values: { analysis: 'fft', fft: 2048, scale: 'log', fmin: 50, fmax: 8000, speed: 120, smooth: 0.3, dbMin: -90, dbMax: -30, colormap: 'viridis' },
  },
  {
    id: 'instrument',
    label: '楽器',
    hint: '音程と倍音を見る(音階向け解析・左軸は音名、50〜5000 Hz)',
    values: { analysis: 'cqt', fft: 8192, scale: 'log', fmin: 50, fmax: 5000, speed: 120, smooth: 0.2, dbMin: -90, dbMax: -25, colormap: 'inferno' },
  },
  {
    id: 'ambient',
    label: '環境音',
    hint: '広い帯域をゆっくり眺める(20〜20000 Hz)',
    values: { analysis: 'fft', fft: 4096, scale: 'log', fmin: 20, fmax: 20000, speed: 80, smooth: 0.6, dbMin: -110, dbMax: -40, colormap: 'cividis' },
  },
  {
    id: 'music',
    label: '再生音楽',
    hint: 'ループバックや共有した音楽を見る(20〜20000 Hz)',
    values: { analysis: 'fft', fft: 4096, scale: 'log', fmin: 20, fmax: 20000, speed: 120, smooth: 0.15, dbMin: -90, dbMax: -20, colormap: 'magma' },
  },
];

export function applyPreset(id: string): void {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return;
  Object.assign(settings, p.values);
  // 楽器は音名で見るのが基本。すでに音名表示ならそのまま、Hz のときだけ切り替える
  if (id === 'instrument' && settings.axisMode === 'hz') settings.axisMode = 'jp';
}

/** 現在の設定と値が全部一致するプリセット(左軸の表示形式は見ない) */
export function activePreset(): string | null {
  for (const p of PRESETS) {
    const v = p.values as Record<string, unknown>;
    const s = settings as unknown as Record<string, unknown>;
    if (Object.keys(v).every((k) => s[k] === v[k])) return p.id;
  }
  return null;
}
