/** 画像 → 音。画像の明るさを、スペクトログラム上の強さとして鳴らす(逆スペクトログラム)。 */
import { freqAt, type View } from './freqmap';

/** 画像を縦に分ける段数(= 同時に鳴らす正弦波の数) */
export const ROWS = 200;
/** 前後の無音(秒)。画像が画面の外から流れてくるようにする */
const PAD_SEC = 0.4;
/** 音の長さの範囲(秒) */
export const MIN_SEC = 3;
export const MAX_SEC = 30;
/** 暗い部分を静かにするための指数 */
const GAMMA = 2;
/** 音量を整えるときの、波形の最大値 */
const PEAK = 0.5;

/** 段 r(0 = 一番下)の周波数。表示範囲 v の上に画像が歪まず載るよう、表示の縦方向に均等に割り当てる */
export function rowFrequencies(v: View, rows: number): Float32Array {
  const out = new Float32Array(rows);
  for (let r = 0; r < rows; r++) out[r] = freqAt(v, (r + 0.5) / rows);
  return out;
}

/**
 * RGBA の画素(上から下、左から右)を、段ごとの強さ(0〜1)にする。戻り値は rows × cols で、段 0 = 一番下。
 * w × h の画素は、すでに cols × rows に縮小してあるものを渡す。透明な部分は黒(無音)として扱う。
 */
export function amplitudes(rgba: Uint8ClampedArray, cols: number, rows: number): Float32Array {
  const out = new Float32Array(rows * cols);
  for (let y = 0; y < rows; y++) {
    const r = rows - 1 - y; // 画像の上端が高い周波数
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const a = rgba[i + 3] / 255;
      const lum = (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255;
      out[r * cols + x] = Math.pow(lum * a, GAMMA);
    }
  }
  return out;
}

/** 画像の縦横比と画面の大きさから、画像がそのままの形で流れる長さ(秒)を決める */
export function durationFor(aspect: number, panelHeightCss: number, pxPerSec: number): number {
  const sec = (aspect * panelHeightCss) / pxPerSec;
  return Math.min(MAX_SEC, Math.max(MIN_SEC, sec));
}

/** 波形の最大値を揃える */
export function normalize(x: Float32Array, peak = PEAK): void {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  if (m <= 0) return;
  const g = peak / m;
  for (let i = 0; i < x.length; i++) x[i] *= g;
}

/** 16 bit PCM のモノラル WAV にする */
export function encodeWav(x: Float32Array, sampleRate: number): Blob {
  const n = x.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // モノラル
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, x[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

export interface ImageSynthInput {
  file: File;
  /** いま表示している周波数の範囲 */
  view: View;
  sampleRate: number;
  /** 1 段の高さ(CSS px)と、時間軸の速さ(CSS px/秒) */
  panelHeightCss: number;
  pxPerSec: number;
}

const MAX_BYTES = 30 * 1024 * 1024;

/** 画像ファイルを、逆スペクトログラムの音(WAV)にする */
export async function imageToWav(o: ImageSynthInput): Promise<File> {
  if (o.file.size > MAX_BYTES) throw new Error('画像が大きすぎます(30 MB まで)');
  const url = URL.createObjectURL(o.file);
  let img: HTMLImageElement;
  try {
    img = new Image();
    img.src = url;
    await img.decode();
  } catch {
    throw new Error('画像を読み込めませんでした');
  } finally {
    URL.revokeObjectURL(url);
  }
  const iw = img.naturalWidth || 1;
  const ih = img.naturalHeight || 1;
  const dur = durationFor(iw / ih, o.panelHeightCss, o.pxPerSec);
  const cols = Math.max(2, Math.min(iw, Math.round(dur * 60)));

  // 段数 × 列数に縮小して、明るさを読む(透明は黒)
  const cv = document.createElement('canvas');
  cv.width = cols;
  cv.height = ROWS;
  const g = cv.getContext('2d');
  if (!g) throw new Error('画像を処理できませんでした');
  g.fillStyle = '#000';
  g.fillRect(0, 0, cols, ROWS);
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, cols, ROWS);
  const amps = amplitudes(g.getImageData(0, 0, cols, ROWS).data, cols, ROWS);

  // 段ごとに正弦波を 1 つ鳴らし、音量を画素の明るさに合わせて変える
  const total = dur + PAD_SEC * 2;
  const sr = o.sampleRate;
  const off = new OfflineAudioContext(1, Math.ceil(total * sr), sr);
  const freqs = rowFrequencies(o.view, ROWS);
  const top = (sr / 2) * 0.98;
  for (let r = 0; r < ROWS; r++) {
    const f = freqs[r];
    if (f < 20 || f > top) continue;
    const curve = amps.subarray(r * cols, (r + 1) * cols);
    let m = 0;
    for (let i = 0; i < cols; i++) m = Math.max(m, curve[i]);
    if (m < 0.003) continue;
    // 位相をばらして、始まりで全部が重なって大きな音にならないようにする
    const ph = Math.random() * 2 * Math.PI;
    const wave = off.createPeriodicWave(new Float32Array([0, Math.cos(ph)]), new Float32Array([0, Math.sin(ph)]));
    const osc = off.createOscillator();
    osc.setPeriodicWave(wave);
    osc.frequency.value = f;
    const gain = off.createGain();
    gain.gain.value = 0;
    gain.gain.setValueCurveAtTime(Float32Array.from(curve), PAD_SEC, dur);
    osc.connect(gain).connect(off.destination);
    osc.start();
  }
  const rendered = await off.startRendering();
  const pcm = rendered.getChannelData(0);
  normalize(pcm);
  const base = o.file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([encodeWav(pcm, sr)], `${base}(画像を音に).wav`, { type: 'audio/wav' });
}
