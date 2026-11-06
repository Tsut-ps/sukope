import { describe, expect, it } from 'vitest';
import { cleanDeviceName } from '../src/engine/format';

describe('機器名の表示', () => {
  it('末尾の USB 識別番号を取り除く', () => {
    expect(cleanDeviceName('Input 1/2 (4- Steinberg UR22C) (0499:172f)')).toBe('Input 1/2 (4- Steinberg UR22C)');
    expect(cleanDeviceName('USB Mic (0D8C:0014) ')).toBe('USB Mic');
  });
  it('番号でない括弧や、途中の括弧は残す', () => {
    expect(cleanDeviceName('Built-in Microphone')).toBe('Built-in Microphone');
    expect(cleanDeviceName('Mic (2- Foo)')).toBe('Mic (2- Foo)');
    expect(cleanDeviceName('Mic (0499:172f) Pro')).toBe('Mic (0499:172f) Pro');
  });
  it('空の名前は空のまま', () => {
    expect(cleanDeviceName('')).toBe('');
  });
});
