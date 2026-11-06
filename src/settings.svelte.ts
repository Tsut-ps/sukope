/** 利用者が選ぶ設定。localStorage に保存し、次回起動時に復元する。 */
import { DB_HI, DB_LO, type ColormapName } from './engine/colormap';
import type { NoteLang } from './engine/notes';

export type SourceKind = 'device' | 'display' | 'file';
export type AxisMode = 'hz' | 'en' | 'jp';

export interface Settings {
  source: SourceKind;
  deviceId: string;
  fft: number;
  scale: 'log' | 'lin';
  fmin: number;
  /** 0 = ナイキスト */
  fmax: number;
  /** スクロール速度(CSS px/秒) */
  speed: number;
  colormap: ColormapName;
  smooth: number;
  axisMode: AxisMode;
  /** 色に割り当てる dB の範囲 */
  dbMin: number;
  dbMax: number;
}

export const FFT_SIZES = [1024, 2048, 4096, 8192, 16384, 32768];
export const FMIN_LIST = [0, 20, 50, 100, 200, 500, 1000, 2000];
export const FMAX_LIST = [1000, 2000, 5000, 8000, 10000, 20000, 0];
export const SPEEDS = [
  { value: 40, label: '遅い' },
  { value: 80, label: 'やや遅い' },
  { value: 120, label: '標準' },
  { value: 240, label: '速い' },
  { value: 480, label: '最速' },
];
export const COLORMAPS: { value: ColormapName; label: string }[] = [
  { value: 'viridis', label: 'Viridis(色覚配慮)' },
  { value: 'cividis', label: 'Cividis(色覚配慮)' },
  { value: 'inferno', label: 'Inferno' },
  { value: 'magma', label: 'Magma' },
  { value: 'turbo', label: 'Turbo' },
  { value: 'gray', label: 'グレー' },
];
export const AXIS_MODES: { value: AxisMode; label: string }[] = [
  { value: 'hz', label: 'Hz' },
  { value: 'en', label: 'C D E F G A B' },
  { value: 'jp', label: 'ド レ ミ ファ ソ ラ シ' },
];
export const SMOOTH_MAX = 0.9;
export const DB_GAP = 5;

export const DEFAULTS: Settings = {
  source: 'device',
  deviceId: '',
  fft: 4096,
  scale: 'log',
  fmin: 20,
  fmax: 20000,
  speed: 120,
  colormap: 'viridis',
  smooth: 0,
  axisMode: 'hz',
  dbMin: -100,
  dbMax: -30,
};

const KEY = 'sukope:settings:v1';

const pick = <T>(v: unknown, list: readonly T[], def: T): T => (list.includes(v as T) ? (v as T) : def);
const int = (v: unknown, lo: number, hi: number, def: number): number =>
  typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : def;

/** 保存値を信用せず、1項目ずつ検証して、不正なものは既定値に戻す */
export function sanitize(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULTS;
  const s: Settings = {
    source: pick(r.source, ['device', 'display', 'file'], d.source),
    deviceId: typeof r.deviceId === 'string' ? r.deviceId.slice(0, 512) : d.deviceId,
    fft: pick(r.fft, FFT_SIZES, d.fft),
    scale: pick(r.scale, ['log', 'lin'], d.scale),
    fmin: pick(r.fmin, FMIN_LIST, d.fmin),
    fmax: pick(r.fmax, FMAX_LIST, d.fmax),
    speed: pick(
      r.speed,
      SPEEDS.map((o) => o.value),
      d.speed,
    ),
    colormap: pick(
      r.colormap,
      COLORMAPS.map((o) => o.value),
      d.colormap,
    ),
    smooth:
      typeof r.smooth === 'number' && isFinite(r.smooth)
        ? Math.min(SMOOTH_MAX, Math.max(0, Math.round(r.smooth * 20) / 20))
        : d.smooth,
    axisMode: pick(
      r.axisMode,
      AXIS_MODES.map((o) => o.value),
      d.axisMode,
    ),
    dbMin: int(r.dbMin, DB_LO, DB_HI - DB_GAP, d.dbMin),
    dbMax: int(r.dbMax, DB_LO + DB_GAP, DB_HI, d.dbMax),
  };
  if (s.fmax !== 0 && s.fmin >= s.fmax) {
    s.fmin = d.fmin;
    s.fmax = d.fmax;
  }
  if (s.dbMax - s.dbMin < DB_GAP) {
    s.dbMin = d.dbMin;
    s.dbMax = d.dbMax;
  }
  return s;
}

function load(): Settings {
  try {
    const t = localStorage.getItem(KEY);
    return sanitize(t ? JSON.parse(t) : null);
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = $state(load());

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify($state.snapshot(settings)));
  } catch {
    /* 保存できない環境(プライベートモードなど)では保存しない */
  }
}

/** 入力元とデバイス以外を初期値に戻す */
export function resetSettings(): void {
  Object.assign(settings, DEFAULTS, { source: settings.source, deviceId: settings.deviceId });
}

export const isNoteMode = (): boolean => settings.axisMode !== 'hz';
export const noteLang = (): NoteLang => (settings.axisMode === 'jp' ? 'jp' : 'en');
