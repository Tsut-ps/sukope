/** 解析の周波数の並び(ビンの中心周波数)。純粋な計算だけを置く。 */

export interface BandSpec {
  /** Analyser の FFT サイズ */
  fft: number;
  /** その Analyser のビンのうち、使う範囲 [k0, k1) */
  k0: number;
  k1: number;
  /** 全体のビン列の中での先頭位置 */
  off: number;
}

export interface Layout {
  specs: BandSpec[];
  /** 全体のビンの中心周波数(Hz)。昇順 */
  freqs: Float32Array;
}

/**
 * 音階向け(CQT 風)の帯域。低音ほど大きい FFT(周波数分解能が高い)、高音ほど小さい FFT(時間分解能が高い)。
 * 各帯域は 1 オクターブ幅で、下端で 1 半音あたり 2.5 ビン以上になるよう FFT サイズを選んである。
 */
export const CQT_BANDS: { fft: number; f0: number }[] = [
  { fft: 32768, f0: 0 },
  { fft: 16384, f0: 120 },
  { fft: 8192, f0: 240 },
  { fft: 4096, f0: 480 },
  { fft: 2048, f0: 960 },
  { fft: 1024, f0: 1920 },
  { fft: 512, f0: 3840 },
  { fft: 256, f0: 7680 },
];

/** 帯域の定義から配置を作る。bands[i] は [f0, 次の f0) を担当し、最後はナイキストまで */
function fromBands(bands: { fft: number; f0: number }[], sampleRate: number): Layout {
  const nyq = sampleRate / 2;
  const specs: BandSpec[] = [];
  const freqs: number[] = [];
  for (let i = 0; i < bands.length; i++) {
    const { fft, f0 } = bands[i];
    if (f0 >= nyq) break;
    const f1 = i + 1 < bands.length ? Math.min(bands[i + 1].f0, nyq) : nyq;
    const df = sampleRate / fft;
    const k0 = Math.max(0, Math.ceil(f0 / df - 1e-9));
    const k1 = f1 >= nyq ? fft / 2 : Math.ceil(f1 / df - 1e-9);
    if (k1 <= k0) continue;
    specs.push({ fft, k0, k1, off: freqs.length });
    for (let k = k0; k < k1; k++) freqs.push(k * df);
  }
  return { specs, freqs: Float32Array.from(freqs) };
}

/** 一定の分解能(すべてのビンが等間隔) */
export const uniformLayout = (fft: number, sampleRate: number): Layout =>
  fromBands([{ fft, f0: 0 }], sampleRate);

export const cqtLayout = (sampleRate: number): Layout => fromBands(CQT_BANDS, sampleRate);

export const buildLayout = (mode: 'fft' | 'cqt', fft: number, sampleRate: number): Layout =>
  mode === 'cqt' ? cqtLayout(sampleRate) : uniformLayout(fft, sampleRate);
