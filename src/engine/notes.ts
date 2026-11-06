/** 音名まわり。midi 69 = A4(440 Hz)、midi 60 = 中央のド(C4)。 */
import { yOf, type View } from './freqmap';

export type NoteLang = 'en' | 'jp';

const NOTE_EN = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const NOTE_JP = ['ド', 'ド♯', 'レ', 'レ♯', 'ミ', 'ファ', 'ファ♯', 'ソ', 'ソ♯', 'ラ', 'ラ♯', 'シ'];

export const pcOf = (m: number): number => ((m % 12) + 12) % 12;

export const isBlack = (m: number): boolean => {
  const p = pcOf(m);
  return p === 1 || p === 3 || p === 6 || p === 8 || p === 10;
};

/** 基準ピッチ(A4 の周波数)。設定から差し替える */
export const tuning = { a4: 440 };
export const setReferencePitch = (a4: number): void => {
  tuning.a4 = a4;
};

export const midiToHz = (m: number): number => tuning.a4 * Math.pow(2, (m - 69) / 12);
export const hzToMidi = (f: number): number => 69 + 12 * Math.log2(f / tuning.a4);

/** オクターブ番号なしの音名 */
export const pcName = (m: number, lang: NoteLang): string => (lang === 'jp' ? NOTE_JP : NOTE_EN)[pcOf(m)];

/** オクターブ番号つきの音名(例: A4 / ラ4) */
export const noteName = (m: number, lang: NoteLang): string => pcName(m, lang) + (Math.floor(m / 12) - 1);

/** 周波数 → 「音名 ±セント」。聞き取れない低さのときは空文字 */
export function describePitch(f: number, lang: NoteLang): string {
  if (f < 16) return '';
  const m = hzToMidi(f);
  const r = Math.round(m);
  const cents = Math.round((m - r) * 100);
  return `${noteName(r, lang)} ${cents >= 0 ? '+' : ''}${cents}¢`;
}

/** 表示範囲に含まれる midi の範囲(余白1つ)と、1半音あたりの高さ(CSS px) */
export function noteView(v: View, cssHeight: number): { m0: number; m1: number; semi: number } {
  const lo = hzToMidi(v.fmin);
  const hi = hzToMidi(v.fmax);
  return { m0: Math.floor(lo) - 1, m1: Math.ceil(hi) + 1, semi: cssHeight / (hi - lo) };
}

/** midi 番号の音の y 座標 */
export const yOfMidi = (v: View, height: number, m: number): number => yOf(v, height, midiToHz(m));
