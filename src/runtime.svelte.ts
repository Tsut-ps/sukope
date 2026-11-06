/** 画面に出す実行時の状態(設定とは違い、保存しない)。 */

export interface PeakInfo {
  f: number;
  db: number;
}

export interface HoverInfo {
  f: number;
  /** データが無い位置は null */
  db: number | null;
  /** 履歴の時計での時刻(秒) */
  t: number;
  /** 何秒前か */
  ago: number;
}

export interface PitchInfo {
  f: number;
  /** 最も近い音(MIDI 番号)と、そこからのずれ(セント) */
  midi: number;
  cents: number;
  clarity: number;
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
  /** カーソル(タップ)位置の読み取り値 */
  hover: null as HoverInfo | null,
  /** ズーム倍率(時間 / 周波数) */
  zoomF: 1,
  /** ライブより何秒前を見ているか(一時停止中のみ) */
  behind: 0,
  /** チューナーが検出した音程。検出できないときは null */
  pitch: null as PitchInfo | null,
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
  /** 一度でも開始したか(最初の案内を消すため) */
  everStarted: false,
  /** アプリとして追加できる状態か(ブラウザが案内を出せるとき) */
  installable: false,
});

export function setStatus(text: string, err = false): void {
  rt.status = text;
  rt.statusErr = err;
}

/** 画面側が差し込む操作 */
export const ui = {
  pickFile: () => {},
  install: () => {},
};
