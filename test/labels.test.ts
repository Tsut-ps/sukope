import { describe, expect, it } from 'vitest';
import { pickPeaks } from '../src/engine/labels';

const freqs = Float32Array.from({ length: 2048 }, (_, i) => (i * 24000) / 2048);
const spec = (peaks: [number, number][], floor = -120): Float32Array => {
  const d = new Float32Array(freqs.length).fill(floor);
  for (const [k, db] of peaks) {
    d[k] = db;
    d[k - 1] = db - 6;
    d[k + 1] = db - 6;
  }
  return d;
};

describe('pickPeaks', () => {
  it('しきい値を超える山を、強い順に最大 2 つ返す', () => {
    const p = pickPeaks(spec([[100, -30], [300, -35], [500, -33]]), freqs, -60);
    expect(p.length).toBe(2);
    expect(p[0].db).toBe(-30);
    expect(p[1].db).toBe(-33);
  });

  it('最大より 12 dB より弱い山は拾わない', () => {
    expect(pickPeaks(spec([[100, -30], [300, -50]]), freqs, -60).length).toBe(1);
  });

  it('しきい値以下は拾わない / 無音(-Infinity)でも落ちない', () => {
    expect(pickPeaks(spec([[100, -80]]), freqs, -60)).toEqual([]);
    expect(pickPeaks(new Float32Array(freqs.length).fill(-Infinity), freqs, -60)).toEqual([]);
  });
});
