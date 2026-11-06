export const fmtTick = (f: number): string => (f >= 1000 ? String(f / 1000) + 'k' : String(f));

export const fmtHz = (f: number): string =>
  f >= 1000 ? (f / 1000).toFixed(2) + ' kHz' : f.toFixed(1) + ' Hz';
