import './style.css';
import { $ } from './dom';
import { state } from './state';
import { hooks, listDevices } from './audio';
import { frame, rebuildColors, resize, updateView } from './app';
import { drawLevel } from './level';
import { initUi } from './ui';

hooks.onConnected = updateView;
hooks.onStopped = () => {
  state.level = null;
  $('peak').textContent = 'ピーク: —';
  drawLevel();
};

initUi();
rebuildColors();
new ResizeObserver(resize).observe($('host'));
resize();
updateView();
listDevices().catch(() => {});
requestAnimationFrame(frame);

// 動作確認用: URL に ?debug を付けたときだけ状態を公開する
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __spec: typeof state }).__spec = state;
}
