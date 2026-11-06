/** 利用者が選ぶ設定。localStorage に保存し、次回起動時に復元する。 */
import type { NoteLang } from './engine/notes';
import { DEFAULTS, sanitize, type Settings } from './settings-schema';

export * from './settings-schema';

const KEY = 'sukope:settings:v1';

function load(): Settings {
  try {
    const t = localStorage.getItem(KEY);
    return sanitize(t ? JSON.parse(t) : null);
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = $state(load());

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify($state.snapshot(settings)));
  } catch {
    /* 保存できない環境(プライベートモードなど)では保存しない */
  }
}

/** 入力とデバイス以外を初期値に戻す */
export function resetSettings(): void {
  Object.assign(settings, DEFAULTS, { source: settings.source, deviceId: settings.deviceId });
}

export const isNoteMode = (): boolean => settings.axisMode !== 'hz';
export const noteLang = (): NoteLang => (settings.axisMode === 'jp' ? 'jp' : 'en');
