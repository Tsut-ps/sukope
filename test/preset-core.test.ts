import { describe, expect, it } from 'vitest';
import { activeId, clickPreset, PRESET_KEYS, PRESETS, snapshot, type PresetClick } from '../src/preset-core';
import { DEFAULTS, type Settings } from '../src/settings-schema';

/** プリセットを押して、設定と「覚えているカスタム」を更新する(画面側と同じ動き) */
function press(state: { s: Settings; custom: Partial<Settings> | null }, id: string): PresetClick | null {
  const r = clickPreset(state.s, id, state.custom);
  if (r) {
    state.custom = r.custom;
    state.s = { ...state.s, ...r.values };
  }
  return r;
}

const customSettings = (): Settings => ({ ...DEFAULTS, fft: 16384, fmin: 100, fmax: 3000, speed: 80, colormap: 'turbo', smooth: 0.45 });

describe('用途プリセットの押し直し', () => {
  it('カスタムから用途を押すと切り替わり、もう一度押すとカスタムに戻る', () => {
    const st = { s: customSettings(), custom: null as Partial<Settings> | null };
    const before = snapshot(st.s);
    expect(activeId(st.s)).toBeNull();

    press(st, 'voice');
    expect(activeId(st.s)).toBe('voice');
    expect(st.s.fft).toBe(2048);

    press(st, 'voice');
    expect(snapshot(st.s)).toEqual(before);
    expect(activeId(st.s)).toBeNull();
  });

  it('別の用途へ移ってから同じ用途を押し直しても、戻り先は最初のカスタム', () => {
    const st = { s: customSettings(), custom: null as Partial<Settings> | null };
    const before = snapshot(st.s);
    press(st, 'voice');
    press(st, 'ambient');
    expect(activeId(st.s)).toBe('ambient');
    press(st, 'ambient');
    expect(snapshot(st.s)).toEqual(before);
  });

  it('カスタムに戻したあとにまた用途を押すと、そのときの設定を新しいカスタムとして覚える', () => {
    const st = { s: customSettings(), custom: null as Partial<Settings> | null };
    press(st, 'music');
    press(st, 'music'); // カスタムに戻る
    st.s = { ...st.s, speed: 240 }; // さらに調整
    const adjusted = snapshot(st.s);
    press(st, 'music');
    press(st, 'music');
    expect(snapshot(st.s)).toEqual(adjusted);
  });

  it('覚えているカスタムが無いときは、選択中の用途を押しても何も起きない', () => {
    const st = { s: { ...DEFAULTS, ...PRESETS[0].values } as Settings, custom: null as Partial<Settings> | null };
    expect(activeId(st.s)).toBe(PRESETS[0].id);
    expect(press(st, PRESETS[0].id)).toBeNull();
  });

  it('楽器は Hz 表示のとき音名表示に切り替わり、戻すと Hz 表示に戻る', () => {
    const st = { s: { ...customSettings(), axisMode: 'hz' as const }, custom: null as Partial<Settings> | null };
    press(st, 'instrument');
    expect(st.s.axisMode).toBe('jp');
    press(st, 'instrument');
    expect(st.s.axisMode).toBe('hz');
  });

  it('覚える項目は、どのプリセットが触る項目も含む', () => {
    for (const p of PRESETS) for (const k of Object.keys(p.values)) expect(PRESET_KEYS).toContain(k);
    expect(PRESET_KEYS).toContain('axisMode');
  });

  it('存在しない用途は無視する', () => {
    expect(clickPreset(DEFAULTS, 'nope', null)).toBeNull();
  });
});
