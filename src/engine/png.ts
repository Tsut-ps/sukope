import { specCanvas } from './spectrogram';

/** 現在のスペクトログラムを PNG として保存する */
export function savePng(): void {
  specCanvas.toBlob((b) => {
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `sukope-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
