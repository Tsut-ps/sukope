/** 用途プリセットの定義と、押したときの動き(画面や保存に依存しない純粋な部分)。 */
import type { Settings } from './settings-schema';

export interface Preset {
  id: string;
  label: string;
  hint: string;
  /** 左軸: 音名(ピアノロール)か、Hz か。用途を押すたびに、これに合わせる */
  axis: 'note' | 'hz';
  values: Partial<Settings>;
}

export const PRESETS: Preset[] = [
  {
    id: 'voice',
    label: '声',
    hint: '声の高さと母音の響きを見る(左軸は音名、50〜8000 Hz)',
    axis: 'note',
    values: { analysis: 'fft', fft: 2048, scale: 'log', fmin: 50, fmax: 8000, zoom: 1, smooth: 0.3, dbMin: -90, dbMax: -30, colormap: 'viridis' },
  },
  {
    id: 'instrument',
    label: '楽器',
    hint: '音程と倍音を見る(音階向け解析・左軸は音名、50〜5000 Hz)',
    axis: 'note',
    values: { analysis: 'cqt', fft: 8192, scale: 'log', fmin: 50, fmax: 5000, zoom: 1, smooth: 0.2, dbMin: -90, dbMax: -25, colormap: 'inferno' },
  },
  {
    id: 'ambient',
    label: '環境音',
    hint: '広い帯域をゆっくり眺める(左軸は Hz、20〜20000 Hz)',
    axis: 'hz',
    values: { analysis: 'fft', fft: 4096, scale: 'log', fmin: 20, fmax: 20000, zoom: 2 / 3, smooth: 0.6, dbMin: -110, dbMax: -40, colormap: 'cividis' },
  },
  {
    id: 'music',
    label: '再生音楽',
    hint: 'ループバックや共有した音楽を見る(左軸は Hz、20〜20000 Hz)',
    axis: 'hz',
    values: { analysis: 'fft', fft: 4096, scale: 'log', fmin: 20, fmax: 20000, zoom: 1, smooth: 0.15, dbMin: -90, dbMax: -20, colormap: 'magma' },
  },
];


/** プリセットを押したときに変わりうる設定の項目(「元の設定」として覚えておく範囲)。左軸は values になくても、必ず含める */
export const PRESET_KEYS = [...new Set([...PRESETS.flatMap((p) => Object.keys(p.values)), 'axisMode'])] as (keyof Settings)[];

/** 用途に合わせた左軸の設定。音名のときは、いま音名ならその言語(C D E / ド レ ミ)を保ち、Hz のときだけ ド レ ミ にする */
export const axisFor = (p: Preset, current: Settings['axisMode']): Settings['axisMode'] =>
  p.axis === 'hz' ? 'hz' : current === 'hz' ? 'jp' : current;

/** いまの設定から、プリセットが触る項目だけを取り出す */
export function snapshot(s: Settings): Partial<Settings> {
  const out: Record<string, unknown> = {};
  for (const k of PRESET_KEYS) out[k] = s[k];
  return out as Partial<Settings>;
}

/** 設定が、あるプリセットと全部一致しているか。左軸は、音名か Hz かだけを見る(C D E と ド レ ミ の違いは見ない) */
export function matchesPreset(s: Settings, p: Preset): boolean {
  if ((s.axisMode !== 'hz') !== (p.axis === 'note')) return false;
  const v = p.values as Record<string, unknown>;
  const cur = s as unknown as Record<string, unknown>;
  // 時間軸の拡大率は、ホイールで自由に変えられるので、一致の判定には使わない
  return Object.keys(v).every((k) => k === 'zoom' || cur[k] === v[k]);
}

/** 一致しているプリセットの id。どれにも一致しない(= カスタム)ときは null */
export function activeId(s: Settings): string | null {
  return PRESETS.find((p) => matchesPreset(s, p))?.id ?? null;
}

export interface PresetClick {
  /** 設定に反映する値 */
  values: Partial<Settings>;
  /** 覚えておく「カスタム」の設定。null = 覚えていない */
  custom: Partial<Settings> | null;
}

/**
 * プリセットを押したときの動き。
 * - カスタムの状態から押すと、そのプリセットにして(左軸も用途に合わせて上書きして)、いまの設定を「カスタム」として覚える
 * - いま選んでいるプリセットをもう一度押すと、覚えておいたカスタムに戻る(覚えていなければ何もしない)
 * - 別のプリセットへ移っても、覚えておいたカスタムはそのまま
 */
export function clickPreset(s: Settings, id: string, custom: Partial<Settings> | null): PresetClick | null {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return null;
  const active = activeId(s);
  if (active === id) return custom ? { values: custom, custom: null } : null;
  const values: Partial<Settings> = { ...p.values, axisMode: axisFor(p, s.axisMode) };
  return { values, custom: active === null ? snapshot(s) : custom };
}
