/** キーボードショートカット。一覧表示(?)と実際の処理で同じ表を使う。 */
import { rt } from './runtime.svelte';
import {
  cycleAxisMode,
  panWindow,
  resetZoom,
  cycleColormap,
  savePng,
  stepFft,
  stepSpeed,
  toggleAnalysis,
  toggleChannels,
  toggleFullscreen,
  toggleHarmonics,
  toggleLabels,
  toggleTuner,
  toggleHelp,
  toggleImmersive,
  togglePause,
  toggleScale,
  toggleStart,
} from './actions';
import { applyPreset, PRESETS } from './presets.svelte';

export interface Shortcut {
  /** 画面に出すキー名 */
  keys: string;
  /** KeyboardEvent.key(小文字)または code */
  match: string;
  group: '基本' | '表示' | '設定';
  label: string;
  run: () => void;
}

export const SHORTCUTS: Shortcut[] = [
  { keys: 'Space', match: 'Space', group: '基本', label: '表示を止める / 再開', run: togglePause },
  { keys: 'S', match: 's', group: '基本', label: '開始 / 停止', run: toggleStart },
  { keys: 'P', match: 'p', group: '基本', label: 'PNG保存', run: savePng },
  { keys: '?', match: '?', group: '基本', label: 'この一覧を表示 / 閉じる', run: toggleHelp },
  { keys: 'F', match: 'f', group: '表示', label: '全画面', run: toggleFullscreen },
  { keys: 'H', match: 'h', group: '表示', label: 'ヘッダー・フッターを隠す / 戻す', run: toggleImmersive },
  { keys: 'N', match: 'n', group: '表示', label: '左軸の切り替え(Hz / C D E / ド レ ミ)', run: cycleAxisMode },
  { keys: 'C', match: 'c', group: '表示', label: '配色を切り替え', run: cycleColormap },
  { keys: '←', match: 'arrowleft', group: '表示', label: '過去へ移動(表示を止める)', run: () => panWindow(-0.25) },
  { keys: '→', match: 'arrowright', group: '表示', label: '新しいほうへ移動', run: () => panWindow(0.25) },
  { keys: '0', match: '0', group: '表示', label: 'ズームを戻す', run: resetZoom },
  { keys: 'B', match: 'b', group: '表示', label: '音名ラベルの表示 / 非表示', run: toggleLabels },
  { keys: 'K', match: 'k', group: '表示', label: '倍音マーカー(クリックで基音を指定)', run: toggleHarmonics },
  { keys: 'T', match: 't', group: '表示', label: 'チューナー表示', run: toggleTuner },
  { keys: 'D', match: 'd', group: '表示', label: '左右を上下に分ける / 合わせる', run: toggleChannels },
  { keys: 'A', match: 'a', group: '設定', label: '解析の切り替え(FFT / 音階向け)', run: toggleAnalysis },
  { keys: 'L', match: 'l', group: '表示', label: '周波数軸 対数 / 線形(Hz表示のとき)', run: toggleScale },
  ...PRESETS.map<Shortcut>((p, i) => ({
    keys: String(i + 1),
    match: String(i + 1),
    group: '設定',
    label: `プリセット「${p.label}」`,
    run: () => applyPreset(p.id),
  })),
  { keys: '[', match: '[', group: '設定', label: 'FFT を小さく', run: () => stepFft(-1) },
  { keys: ']', match: ']', group: '設定', label: 'FFT を大きく', run: () => stepFft(1) },
  { keys: ',', match: ',', group: '設定', label: '速度を遅く', run: () => stepSpeed(-1) },
  { keys: '.', match: '.', group: '設定', label: '速度を速く', run: () => stepSpeed(1) },
];

export function onKeydown(e: KeyboardEvent): void {
  // レベルバーなどが先に処理したキーは、ここでは扱わない
  if (e.defaultPrevented) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (e.target as HTMLElement | null)?.tagName ?? '';
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag)) return;
  if (e.key === 'Escape') {
    if (rt.immersive && !rt.helpOpen) toggleImmersive();
    return;
  }
  const isSpace = e.code === 'Space';
  // ボタンや音声コントロールでは、Space は本来の操作に任せる
  if (isSpace && /^(BUTTON|AUDIO|CANVAS)$/.test(tag)) return;
  const key = isSpace ? 'Space' : e.key.toLowerCase();
  // 音声コントロールの矢印キーはシークに使う
  if (tag === 'AUDIO' && key.startsWith('arrow')) return;
  const s = SHORTCUTS.find((x) => x.match === key);
  if (!s) return;
  if (rt.helpOpen && s.match !== '?') return;
  e.preventDefault();
  s.run();
}
