/** 画面に出す実行時の状態(設定とは違い、保存しない)。 */

export interface PeakInfo {
  f: number;
  db: number;
}

export interface DeviceOption {
  id: string;
  label: string;
}

export const rt = $state({
  running: false,
  paused: false,
  status: '停止中',
  statusErr: false,
  /** 取り込み中の音のピーク */
  peak: null as PeakInfo | null,
  /** カーソル位置の周波数(Hz) */
  hover: null as number | null,
  /** 現在のピークレベル(dB)。無音のときは null */
  level: null as number | null,
  /** 入力があるのに、しばらく音が来ていない */
  silent: false,
  devices: [] as DeviceOption[],
  fileName: '',
  player: null as HTMLAudioElement | null,
  sampleRate: 48000,
  /** スペクトログラム領域の幅(CSS px) */
  widthCss: 0,
  /** ヘッダーとフッターを隠している */
  immersive: false,
  fullscreen: false,
  helpOpen: false,
  /** スマホ幅で詳細設定を開いている */
  optionsOpen: false,
  /** 一度でも開始したか(最初の案内を消すため) */
  everStarted: false,
});

export function setStatus(text: string, err = false): void {
  rt.status = text;
  rt.statusErr = err;
}

/** 画面側が差し込む操作 */
export const ui = {
  pickFile: () => {},
};
