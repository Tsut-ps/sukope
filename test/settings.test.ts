import { describe, expect, it } from 'vitest';
import { DEFAULTS, sanitize } from '../src/settings-schema';

describe('設定の読み込み(sanitize)', () => {
  it('空や壊れた値は既定値になる', () => {
    expect(sanitize(null)).toEqual(DEFAULTS);
    expect(sanitize('x')).toEqual(DEFAULTS);
    expect(sanitize({ fft: 12345, colormap: 'nope', zoom: 'fast', a4: 1 })).toEqual(DEFAULTS);
  });

  it('古いバージョンの保存データ(新しい項目なし)でも、既存の値を保ち、新しい項目は既定値で補う', () => {
    const old = { source: 'display', fft: 8192, fmin: 50, fmax: 5000, colormap: 'magma' };
    const s = sanitize(old);
    expect(s.source).toBe('display');
    expect(s.fft).toBe(8192);
    expect(s.fmin).toBe(50);
    expect(s.colormap).toBe('magma');
    expect(s.analysis).toBe(DEFAULTS.analysis);
    expect(s.channels).toBe(DEFAULTS.channels);
    expect(s.labels).toBe(DEFAULTS.labels);
    expect(s.a4).toBe(440);
    expect(s.zoom).toBe(DEFAULTS.zoom);
  });

  it('時間軸の拡大率は範囲内に収める', () => {
    expect(sanitize({ zoom: 100 }).zoom).toBe(8);
    expect(sanitize({ zoom: 0.001 }).zoom).toBe(1 / 8);
    expect(sanitize({ zoom: 2 }).zoom).toBe(2);
    expect(sanitize({ zoom: NaN }).zoom).toBe(DEFAULTS.zoom);
  });

  it('許される値はそのまま通る', () => {
    const s = sanitize({ analysis: 'cqt', channels: 'lr', a4: 442, tuner: true, harmonics: true, labels: false });
    expect(s).toMatchObject({ analysis: 'cqt', channels: 'lr', a4: 442, tuner: true, harmonics: true, labels: false });
  });

  it('下限が上限以上になる組み合わせは、範囲を既定に戻す', () => {
    const s = sanitize({ fmin: 5000, fmax: 100 });
    expect(s.fmin).toBe(DEFAULTS.fmin);
    expect(s.fmax).toBe(DEFAULTS.fmax);
  });
});
