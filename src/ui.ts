/** 画面の操作(セレクト・ボタン・キー操作)と、各処理の結びつけ。 */
import { $ } from './dom';
import { state, view } from './state';
import { readSettings } from './settings';
import { setPalette } from './palette';
import { listDevices, start, startFile, stop } from './audio';
import { rebuildColors, rebuildRows, updateTimeInfo, updateView } from './app';
import { clearHistory, redrawAll, specCanvas } from './spectrogram';
import { initOverlay } from './overlay';
import { initLevel } from './level';

const select = (id: string) => $<HTMLSelectElement>(id);

/** 下限 < 上限 になるよう、成立しない選択肢を無効化する */
function syncFreqOptions(): void {
  const nyq = state.sampleRate / 2;
  const fm = select('fmax').value;
  const fmax = fm === 'nyq' ? nyq : +fm;
  const fmin = +select('fmin').value;
  for (const o of select('fmax').options) if (o.value !== 'nyq') o.disabled = +o.value <= fmin;
  for (const o of select('fmin').options) o.disabled = +o.value >= fmax;
}

function onSourceChange(): void {
  stop();
  const m = select('source').value;
  $('deviceWrap').classList.toggle('hidden', m !== 'device');
  $('fileWrap').classList.toggle('hidden', m !== 'file');
}

function onSmoothInput(): void {
  const v = readSettings().smooth;
  $('smoothV').textContent = v.toFixed(2);
  if (state.analyser) state.analyser.smoothingTimeConstant = v;
}

/** 軸の対応が変わると過去の描画と合わなくなるので、履歴を消して描き直す */
function resetHistory(): void {
  clearHistory();
  updateView();
  redrawAll();
}

export function initUi(): void {
  $('start').addEventListener('click', () => {
    if (state.running) stop();
    else void start();
  });
  select('source').addEventListener('change', onSourceChange);
  $<HTMLInputElement>('file').addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) void startFile(f);
    input.value = '';
  });
  $('pause').addEventListener('click', () => {
    state.paused = !state.paused;
    $('pause').textContent = state.paused ? '表示を再開' : '表示を止める';
  });
  $('png').addEventListener('click', () =>
    specCanvas.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `sukope-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }),
  );

  select('fft').addEventListener('change', () => {
    const an = state.analyser;
    if (an) {
      an.fftSize = readSettings().fft;
      state.data = new Float32Array(an.frequencyBinCount);
    }
    rebuildRows();
  });
  for (const id of ['scale', 'fmin', 'fmax']) {
    select(id).addEventListener('change', () => {
      syncFreqOptions();
      resetHistory();
    });
  }
  select('speed').addEventListener('change', updateTimeInfo);
  select('notes').addEventListener('change', () => {
    const prev = view.log;
    updateView();
    if (view.log !== prev) {
      // 線形 → 対数で軸の対応が変わる
      clearHistory();
      redrawAll();
    }
  });
  select('map').addEventListener('change', () => {
    setPalette(readSettings().colormap);
    rebuildColors();
  });
  $<HTMLInputElement>('smooth').addEventListener('input', onSmoothInput);

  // スマホ幅: 詳細設定の開閉
  $('optBtn').addEventListener('click', () => {
    const h = document.querySelector('header');
    if (!h) return;
    h.classList.toggle('open');
    $('optBtn').textContent = h.classList.contains('open') ? '設定 ▴' : '設定 ▾';
  });

  // 画面共有に対応していない環境(スマホなど)では選択肢を無効にする
  if (!navigator.mediaDevices?.getDisplayMedia) {
    const o = select('source').querySelector<HTMLOptionElement>('option[value=display]');
    if (o) {
      o.disabled = true;
      o.textContent += '(この環境では非対応)';
    }
  }

  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (e.code === 'Space' && !/^(INPUT|SELECT|BUTTON|AUDIO|TEXTAREA|CANVAS)$/.test(tag)) {
      e.preventDefault();
      $('pause').click();
    }
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files[0];
    if (!f) return;
    select('source').value = 'file';
    onSourceChange();
    void startFile(f);
  });
  navigator.mediaDevices?.addEventListener?.('devicechange', () => {
    listDevices().catch(() => {});
  });

  initOverlay();
  initLevel(rebuildColors);
  syncFreqOptions();
  onSmoothInput();
}
