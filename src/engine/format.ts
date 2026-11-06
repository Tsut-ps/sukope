export const fmtTick = (f: number): string => (f >= 1000 ? String(f / 1000) + 'k' : String(f));

export const fmtHz = (f: number): string =>
  f >= 1000 ? (f / 1000).toFixed(2) + ' kHz' : f.toFixed(1) + ' Hz';

/** 経過時間(秒)を m:ss にする。目盛りの間隔が 1 秒未満のときは小数も付ける */
export function fmtClock(t: number, step: number): string {
  const q = step >= 1 ? 1 : step >= 0.1 ? 0.1 : 0.01;
  const digits = q === 1 ? 0 : q === 0.1 ? 1 : 2;
  const per = Math.round(60 / q);
  const u = Math.round(Math.abs(t) / q);
  const m = Math.floor(u / per);
  const s = ((u - m * per) * q).toFixed(digits).padStart(digits ? digits + 3 : 2, '0');
  return `${t < 0 ? '-' : ''}${m}:${s}`;
}
