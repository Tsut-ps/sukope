import { describe, expect, it } from 'vitest';
import { amplitudes, durationFor, encodeWav, MAX_SEC, MIN_SEC, normalize, rowFrequencies } from '../src/engine/imagesynth';

describe('画像 → 音', () => {
  it('段の周波数は、表示範囲の中で昇順になり、対数軸では等比、線形軸では等差になる', () => {
    const log = rowFrequencies({ log: true, fmin: 50, fmax: 8000 }, 100);
    const lin = rowFrequencies({ log: false, fmin: 0, fmax: 8000 }, 100);
    for (const f of [log, lin]) for (let i = 1; i < f.length; i++) expect(f[i]).toBeGreaterThan(f[i - 1]);
    expect(log[0]).toBeGreaterThan(50);
    expect(log[99]).toBeLessThan(8000);
    expect(log[51] / log[50]).toBeCloseTo(log[11] / log[10], 4);
    expect(lin[51] - lin[50]).toBeCloseTo(lin[11] - lin[10], 3);
  });

  it('画像の上端が高い周波数になり、明るさが強さになる。透明は無音', () => {
    // 2 列 × 2 行: 上段 = 白と黒、下段 = 黒と白(透明)
    const px = new Uint8ClampedArray([
      255, 255, 255, 255, 0, 0, 0, 255,
      255, 255, 255, 0, 255, 255, 255, 255,
    ]);
    const a = amplitudes(px, 2, 2);
    // 段 1(上)・列 0 が白 → 1。段 1・列 1 は黒 → 0
    expect(a[1 * 2 + 0]).toBeCloseTo(1, 6);
    expect(a[1 * 2 + 1]).toBe(0);
    // 段 0(下)・列 0 は透明な白 → 0。列 1 は白 → 1
    expect(a[0 * 2 + 0]).toBe(0);
    expect(a[0 * 2 + 1]).toBeCloseTo(1, 6);
  });

  it('音の長さは、縦横比と速さで決まり、範囲に収まる', () => {
    expect(durationFor(1, 400, 100)).toBeCloseTo(4, 6);
    expect(durationFor(10, 400, 10)).toBe(MAX_SEC);
    expect(durationFor(0.1, 100, 500)).toBe(MIN_SEC);
  });

  it('波形の最大値を揃える。無音はそのまま', () => {
    const x = Float32Array.from([0.1, -0.2, 0.05]);
    normalize(x, 0.5);
    expect(Math.max(...Array.from(x).map(Math.abs))).toBeCloseTo(0.5, 6);
    const z = new Float32Array(4);
    normalize(z);
    expect(Array.from(z)).toEqual([0, 0, 0, 0]);
  });

  it('WAV は、16 bit のモノラル PCM のヘッダーと正しい長さになる', async () => {
    const wav = encodeWav(Float32Array.from([0, 1, -1, 2]), 44100); // 範囲外は丸める
    const v = new DataView(await wav.arrayBuffer());
    const tag = (o: number): string => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(8);
    expect(v.byteLength).toBe(44 + 8);
    expect(v.getInt16(46, true)).toBe(32767);
    expect(v.getInt16(48, true)).toBe(-32768);
    expect(v.getInt16(50, true)).toBe(32767);
  });
});
