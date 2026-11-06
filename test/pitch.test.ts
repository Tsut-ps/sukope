import { describe, expect, it } from 'vitest';
import { detectPitch } from '../src/engine/pitch';

const N = 4096;
const wave = (sr: number, f: number, shape: (ph: number) => number, amp = 0.3): Float32Array => {
  const x = new Float32Array(N);
  for (let i = 0; i < N; i++) x[i] = amp * shape(((f * i) / sr) % 1);
  return x;
};
const sine = (ph: number): number => Math.sin(2 * Math.PI * ph);
const saw = (ph: number): number => 2 * ph - 1;
const cents = (a: number, b: number): number => Math.abs(1200 * Math.log2(a / b));

describe('detectPitch', () => {
  for (const sr of [44100, 48000]) {
    for (const f of [82.41, 110, 261.63, 440, 987.77]) {
      it(`正弦波 ${f} Hz (${sr} Hz サンプリング)`, () => {
        const p = detectPitch(wave(sr, f, sine), sr);
        expect(p).not.toBeNull();
        expect(cents(p!.f, f)).toBeLessThan(3);
      });
    }
    it(`のこぎり波 196 Hz (${sr} Hz サンプリング)`, () => {
      const p = detectPitch(wave(sr, 196, saw), sr);
      expect(p).not.toBeNull();
      expect(cents(p!.f, 196)).toBeLessThan(5);
    });
  }

  it('基音が無くても、倍音の間隔から基音の高さを返す', () => {
    const sr = 48000;
    const x = new Float32Array(N);
    for (let i = 0; i < N; i++) for (const n of [2, 3, 4, 5]) x[i] += 0.1 * Math.sin((2 * Math.PI * 200 * n * i) / sr);
    const p = detectPitch(x, sr);
    expect(p).not.toBeNull();
    expect(cents(p!.f, 200)).toBeLessThan(5);
  });

  it('小さすぎる音は無音として扱う', () => {
    expect(detectPitch(wave(48000, 440, sine, 0.0005), 48000)).toBeNull();
  });

  it('雑音には音程を出さない', () => {
    let seed = 12345;
    const rnd = (): number => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
    const x = new Float32Array(N).map(() => 0.3 * rnd());
    expect(detectPitch(x, 48000)).toBeNull();
  });
});
