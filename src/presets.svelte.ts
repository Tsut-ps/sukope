/** 用途プリセットを、設定に反映する。 */
import { settings } from './settings.svelte';
import { activeId, clickPreset, PRESETS, type PresetClick } from './preset-core';
import type { Settings } from './settings-schema';

export { PRESETS };

/** カスタムの状態から用途を選んだときの、元の設定(もう一度押すと戻る) */
let custom = $state<Partial<Settings> | null>(null);

export function applyPreset(id: string): void {
  const r: PresetClick | null = clickPreset(settings, id, custom);
  if (!r) return;
  custom = r.custom;
  Object.assign(settings, r.values);
}

/** 現在の設定と値が全部一致するプリセット(左軸の表示形式は見ない) */
export const activePreset = (): string | null => activeId(settings);

/** もう一度押すと元の設定に戻れるか */
export const canRevert = (): boolean => custom !== null;
