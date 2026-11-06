import { beforeEach, describe, expect, it } from 'vitest';
import { clearHistory, ensureLayout, hist, phys, pushFrame, timeAt } from '../src/engine/history';
import { cqtLayout, uniformLayout } from '../src/engine/layout';

const SR = 48000;

/** 周波数 f にだけ強い音がある周波数データ(dB) */
function tone(freqs: Float32Array, f: number): Float32Array {
  const d = new Float32Array(freqs.length).fill(-120);
  let best = 0;
  for (let i = 1; i < freqs.length; i++) if (Math.abs(freqs[i] - f) < Math.abs(freqs[best] - f)) best = i;
  d[best] = -20;
  return d;
}

/** 列 i・チャンネル c で最も強いビンの周波数 */
function peakFreq(i: number, c: number): number {
  const o = phys(i) * hist.stride + c * hist.bins;
  let m = 0;
  for (let k = 1; k < hist.bins; k++) if (hist.data[o + k] > hist.data[o + m]) m = k;
  return hist.freqs[m];
}

describe('履歴の並びの作り直し(ensureLayout)', () => {
  beforeEach(() => {
    hist.bins = 0;
    hist.ch = 1;
    clearHistory();
  });

  it('FFT → 音階向け → FFT で、時刻・音の高さ・列数が保たれる', () => {
    const fft = uniformLayout(4096, SR).freqs;
    ensureLayout(fft, 1);
    for (let i = 0; i < 20; i++) pushFrame([tone(fft, 1000)], i * 0.1);

    const cqt = cqtLayout(SR).freqs;
    ensureLayout(cqt, 2); // 左右を分けると、チャンネルは複製される
    expect(hist.count).toBe(20);
    expect(hist.ch).toBe(2);
    for (let i = 0; i < 20; i++) {
      expect(timeAt(i)).toBeCloseTo(i * 0.1, 9);
      for (let c = 0; c < 2; c++) expect(Math.abs(peakFreq(i, c) - 1000)).toBeLessThan(60);
    }

    ensureLayout(fft, 1);
    expect(hist.count).toBe(20);
    for (let i = 0; i < 20; i++) expect(Math.abs(peakFreq(i, 0) - 1000)).toBeLessThan(60);
  });

  it('同じ並びなら何もしない(履歴を作り直さない)', () => {
    const f = uniformLayout(2048, SR).freqs;
    ensureLayout(f, 1);
    pushFrame([tone(f, 500)], 0);
    const data = hist.data;
    ensureLayout(Float32Array.from(f), 1);
    expect(hist.data).toBe(data);
    expect(hist.count).toBe(1);
  });
});
