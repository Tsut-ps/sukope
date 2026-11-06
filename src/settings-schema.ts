/** 設定の型・選択肢・既定値と、保存値の検証。ブラウザにも Svelte にも依存しない。 */
import { DB_HI, DB_LO, type ColormapName } from './engine/colormap';

export type SourceKind = 'device' | 'display' | 'file';
export type AxisMode = 'hz' | 'en' | 'jp';
export type AnalysisMode = 'fft' | 'cqt';
export type ChannelMode = 'mix' | 'lr';

export interface Settings {
  source: SourceKind;
  deviceId: string;
  /** 解析方式: fft = 一定の分解能 / cqt = 低音ほど細かい(音階向け) */
  analysis: AnalysisMode;
  fft: number;
  /** mix = 左右を合わせて1枚 / lr = 左右を上下に分けて表示 */
  channels: ChannelMode;
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
  /** スペクトログラム上に音名を流す */
  labels: boolean;
  /** 倍音マーカー(クリック/タップで基音を選ぶ) */
  harmonics: boolean;
  tuner: boolean;
  /** 基準ピッチ(A4 の周波数) */
  a4: number;
}

export const FFT_SIZES = [1024, 2048, 4096, 8192, 16384, 32768];
export const FMIN_LIST = [0, 20, 50, 100, 200, 500, 1000, 2000];
export const FMAX_LIST = [1000, 2000, 5000, 8000, 10000, 20000, 0];
export const A4_LIST = [415, 430, 432, 435, 438, 440, 442, 444, 445, 450];
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
export const ANALYSIS_MODES: { value: AnalysisMode; label: string }[] = [
  { value: 'fft', label: 'FFT(一定の分解能)' },
  { value: 'cqt', label: '音階向け(低音を細かく)' },
];
export const CHANNEL_MODES: { value: ChannelMode; label: string }[] = [
  { value: 'mix', label: '左右を合わせる' },
  { value: 'lr', label: '左右を上下に分ける' },
];
export const SMOOTH_MAX = 0.9;
export const DB_GAP = 5;

export const DEFAULTS: Settings = {
  source: 'device',
  deviceId: '',
  analysis: 'fft',
  fft: 4096,
  channels: 'mix',
  scale: 'log',
  fmin: 20,
  fmax: 20000,
  speed: 120,
  colormap: 'viridis',
  smooth: 0,
  axisMode: 'hz',
  dbMin: -100,
  dbMax: -30,
  labels: true,
  harmonics: false,
  tuner: false,
  a4: 440,
};

const pick = <T>(v: unknown, list: readonly T[], def: T): T => (list.includes(v as T) ? (v as T) : def);
const int = (v: unknown, lo: number, hi: number, def: number): number =>
  typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : def;
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);

/** 保存値を信用せず、1項目ずつ検証して、不正なもの・足りないものは既定値にする */
export function sanitize(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULTS;
  const s: Settings = {
    source: pick(r.source, ['device', 'display', 'file'], d.source),
    deviceId: typeof r.deviceId === 'string' ? r.deviceId.slice(0, 512) : d.deviceId,
    analysis: pick(
      r.analysis,
      ANALYSIS_MODES.map((o) => o.value),
      d.analysis,
    ),
    fft: pick(r.fft, FFT_SIZES, d.fft),
    channels: pick(
      r.channels,
      CHANNEL_MODES.map((o) => o.value),
      d.channels,
    ),
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
    labels: bool(r.labels, d.labels),
    harmonics: bool(r.harmonics, d.harmonics),
    tuner: bool(r.tuner, d.tuner),
    a4: pick(r.a4, A4_LIST, d.a4),
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
