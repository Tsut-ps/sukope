/** 音声入力(入力デバイス / 画面共有 / ファイル)の取得と解析ノードの接続。 */
import { $ } from './dom';
import { state } from './state';
import { readSettings } from './settings';
import { setRunningUi, setStatus } from './status';

/** app 側が差し込む通知 */
export const hooks = {
  /** 解析ノードが接続された(サンプルレートが確定した)とき */
  onConnected: () => {},
  /** 停止したとき */
  onStopped: () => {},
};

export async function ensureCtx(): Promise<AudioContext> {
  if (!state.ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    state.ctx = new Ctor({ latencyHint: 'interactive' });
  }
  await state.ctx.resume();
  return state.ctx;
}

function connectGraph(node: AudioNode, monitor: boolean, label: string): void {
  const ctx = state.ctx;
  if (!ctx) return;
  const c = readSettings();
  const an = ctx.createAnalyser();
  an.fftSize = c.fft;
  an.smoothingTimeConstant = c.smooth;
  node.connect(an);
  if (monitor) an.connect(ctx.destination);
  state.node = node;
  state.analyser = an;
  state.data = new Float32Array(an.frequencyBinCount);
  state.sampleRate = ctx.sampleRate;
  state.running = true;
  state.acc = 0;
  setRunningUi(true);
  $('hint').classList.add('hidden');
  setStatus(`${label} / ${state.sampleRate} Hz`);
  hooks.onConnected();
}

export function stop(): void {
  state.stream?.getTracks().forEach((t) => t.stop());
  state.stream = null;
  try {
    state.node?.disconnect();
    state.analyser?.disconnect();
  } catch {
    /* すでに切断済み */
  }
  if (state.player) {
    state.player.pause();
    state.player.removeAttribute('src');
    state.player.load();
    state.player.remove();
    state.player = null;
  }
  if (state.url) {
    URL.revokeObjectURL(state.url);
    state.url = null;
  }
  state.node = null;
  state.analyser = null;
  state.running = false;
  setRunningUi(false);
  setStatus('停止中');
  hooks.onStopped();
}

function errText(e: unknown): string {
  const name = (e as { name?: string } | null)?.name;
  if (name === 'NotAllowedError') return '許可されませんでした(ブラウザの権限設定を確認してください)';
  if (name === 'NotFoundError') return '入力デバイスが見つかりません';
  if (name === 'NotReadableError') return 'デバイスを使用できません(他のアプリが占有している可能性)';
  return (e as { message?: string } | null)?.message || name || String(e);
}

export async function listDevices(): Promise<void> {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  const sel = $<HTMLSelectElement>('device');
  const cur = sel.value;
  sel.replaceChildren(new Option('既定の入力', ''));
  devs.forEach((d, i) => {
    if (d.deviceId !== 'default') sel.add(new Option(d.label || `入力 ${i + 1}`, d.deviceId));
  });
  if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

/** 加工なしで取り込む(ループバックの音を変えないため) */
const RAW_AUDIO = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

async function startDevice(ctx: AudioContext): Promise<void> {
  const audio: MediaTrackConstraints = { ...RAW_AUDIO };
  const id = $<HTMLSelectElement>('device').value;
  if (id) audio.deviceId = { exact: id };
  state.stream = await navigator.mediaDevices.getUserMedia({ audio });
  const label = state.stream.getAudioTracks()[0]?.label || 'デバイス';
  connectGraph(ctx.createMediaStreamSource(state.stream), false, `入力: ${label}`);
  void listDevices();
}

async function startDisplay(ctx: AudioContext): Promise<void> {
  const options = { video: true, systemAudio: 'include', audio: RAW_AUDIO } as DisplayMediaStreamOptions;
  const stream = await navigator.mediaDevices.getDisplayMedia(options);
  const audioTracks = stream.getAudioTracks();
  if (!audioTracks.length) {
    stream.getTracks().forEach((t) => t.stop());
    setStatus('音声が共有されていません。共有ダイアログで「タブの音声も共有」(またはシステム音声)にチェックしてください', true);
    return;
  }
  state.stream = stream;
  stream.getTracks().forEach((t) =>
    t.addEventListener('ended', () => {
      if (state.stream === stream) stop();
    }),
  );
  connectGraph(ctx.createMediaStreamSource(new MediaStream(audioTracks)), false, '共有された音声');
}

export async function startFile(file: File): Promise<void> {
  stop();
  const ctx = await ensureCtx();
  state.file = file;
  state.url = URL.createObjectURL(file);
  const a = document.createElement('audio');
  a.controls = true;
  a.src = state.url;
  $('playerBox').replaceChildren(a);
  state.player = a;
  const name = $('fileName');
  name.textContent = file.name;
  name.classList.remove('muted');
  connectGraph(ctx.createMediaElementSource(a), true, `ファイル: ${file.name}`);
  try {
    await a.play();
  } catch {
    setStatus('再生ボタンを押してください');
  }
}

export async function start(): Promise<void> {
  stop();
  const mode = $<HTMLSelectElement>('source').value;
  if (mode === 'file') {
    if (state.file) return startFile(state.file);
    $('file').click();
    return;
  }
  if (!navigator.mediaDevices) {
    setStatus('このページは HTTPS または localhost で開いてください', true);
    return;
  }
  try {
    const ctx = await ensureCtx();
    if (mode === 'device') await startDevice(ctx);
    else await startDisplay(ctx);
  } catch (e) {
    stop();
    setStatus(errText(e), true);
  }
}
