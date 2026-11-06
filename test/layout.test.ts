import { describe, expect, it } from 'vitest';
import { buildLayout, cqtLayout, uniformLayout } from '../src/engine/layout';
import { remapRanges } from '../src/engine/history';

describe('解析の周波数表', () => {
  for (const sr of [44100, 48000, 96000]) {
    it(`音階向け: 昇順で、全帯域を隙間なく覆う (${sr} Hz)`, () => {
      const { freqs, specs } = cqtLayout(sr);
      for (let i = 1; i < freqs.length; i++) expect(freqs[i]).toBeGreaterThan(freqs[i - 1]);
      expect(freqs[0]).toBe(0);
      expect(freqs[freqs.length - 1]).toBeGreaterThanOrEqual(sr / 2 - sr / 256);
      // 各帯域の書き込み位置が連続している
      let off = 0;
      for (const s of specs) {
        expect(s.off).toBe(off);
        off += s.k1 - s.k0;
      }
      expect(off).toBe(freqs.length);
    });

    // Analyser の FFT は 32768 が上限なので、96 kHz では低音の分解能が半分になる(1 半音に 1 ビン以上は保つ)
    const need = sr > 48000 ? 1 : 2;
    it(`音階向け: 低音は 1 半音あたり ${need} ビン以上 (${sr} Hz)`, () => {
      const { freqs } = cqtLayout(sr);
      // 80 Hz〜 の各半音(ふつうの楽器の低音)に、2 ビン以上入る
      for (let f = 80; f < 4000; f *= Math.pow(2, 1 / 12)) {
        const hi = f * Math.pow(2, 1 / 12);
        const n = freqs.filter((x) => x >= f && x < hi).length;
        expect(n).toBeGreaterThanOrEqual(need);
      }
    });
  }

  it('FFT: 等間隔で、ナイキストの手前まで', () => {
    const { freqs } = uniformLayout(2048, 48000);
    expect(freqs.length).toBe(1024);
    expect(freqs[1] - freqs[0]).toBeCloseTo(48000 / 2048, 6);
  });

  it('buildLayout は方式で切り替わる', () => {
    expect(buildLayout('fft', 2048, 48000).freqs.length).toBe(1024);
    expect(buildLayout('cqt', 2048, 48000).specs.length).toBeGreaterThan(1);
  });
});

describe('履歴の作り直し(周波数での対応づけ)', () => {
  it('粗くなるときは範囲、細かくなるときは最も近いビンを指す', () => {
    const fine = Float32Array.from({ length: 100 }, (_, i) => i * 10);
    const coarse = Float32Array.from({ length: 10 }, (_, i) => i * 100);
    const down = remapRanges(fine, coarse);
    expect(down.hi[5] - down.lo[5]).toBeGreaterThan(0);
    const up = remapRanges(coarse, fine);
    for (let j = 0; j < 91; j++) {
      expect(up.lo[j]).toBe(up.hi[j]);
      expect(Math.abs(coarse[up.lo[j]] - fine[j])).toBeLessThanOrEqual(50);
    }
  });
});
