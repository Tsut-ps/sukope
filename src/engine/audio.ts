/** 音声入力(入力デバイス / 画面共有 / ファイル)の取得と解析ノードの接続。 */
import { state } from './state';
import { rt, setStatus, ui } from '../runtime.svelte';
import { settings } from '../settings.svelte';

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

function connectGraph(node: AudioNode, monitor: boolean, live: boolean, label: string): void {
  const ctx = state.ctx;
  if (!ctx) return;
  const an = ctx.createAnalyser();
  an.fftSize = settings.fft;
  an.smoothingTimeConstant = settings.smooth;
  node.connect(an);
  if (monitor) an.connect(ctx.destination);
  state.node = node;
  state.analyser = an;
  state.data = new Float32Array(an.frequencyBinCount);
  state.live = live;
  state.silentSince = performance.now();
  state.acc = 0;
  rt.sampleRate = ctx.sampleRate;
  rt.running = true;
  rt.silent = false;
  rt.everStarted = true;
  setStatus(`${label} / ${ctx.sampleRate} Hz`);
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
  const p = rt.player;
  if (p) {
    p.pause();
    p.removeAttribute('src');
    p.load();
    rt.player = null;
  }
  if (state.url) {
    URL.revokeObjectURL(state.url);
    state.url = null;
  }
  state.node = null;
  state.analyser = null;
  state.live = false;
  rt.running = false;
  rt.silent = false;
  rt.level = null;
  rt.peak = null;
  setStatus('停止中');
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
  rt.devices = devs
    .filter((d) => d.deviceId !== 'default')
    .map((d, i) => ({ id: d.deviceId, label: d.label || `入力 ${i + 1}` }));
  // 権限が出る前は ID が空のことがある。ID が分かっていて、保存した入力が無くなっているときだけ既定に戻す
  if (settings.deviceId && rt.devices.some((d) => d.id) && !rt.devices.some((d) => d.id === settings.deviceId)) {
    settings.deviceId = '';
  }
}

/** 加工なしで取り込む(ループバックの音を変えないため) */
const RAW_AUDIO = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

async function openInput(): Promise<MediaStream> {
  const audio: MediaTrackConstraints = { ...RAW_AUDIO };
  if (settings.deviceId) audio.deviceId = { exact: settings.deviceId };
  try {
    return await navigator.mediaDevices.getUserMedia({ audio });
  } catch (e) {
    // 保存していたデバイスが無いときは、既定の入力でやり直す
    if (settings.deviceId && (e as { name?: string } | null)?.name === 'OverconstrainedError') {
      settings.deviceId = '';
      return navigator.mediaDevices.getUserMedia({ audio: RAW_AUDIO });
    }
    throw e;
  }
}

async function startDevice(ctx: AudioContext): Promise<void> {
  state.stream = await openInput();
  const label = state.stream.getAudioTracks()[0]?.label || 'デバイス';
  connectGraph(ctx.createMediaStreamSource(state.stream), false, true, `入力: ${label}`);
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
  connectGraph(ctx.createMediaStreamSource(new MediaStream(audioTracks)), false, true, '共有された音声');
}

export async function startFile(file: File): Promise<void> {
  stop();
  const ctx = await ensureCtx();
  state.file = file;
  state.url = URL.createObjectURL(file);
  const a = document.createElement('audio');
  a.controls = true;
  a.src = state.url;
  rt.player = a;
  rt.fileName = file.name;
  connectGraph(ctx.createMediaElementSource(a), true, false, `ファイル: ${file.name}`);
  try {
    await a.play();
  } catch {
    setStatus('再生ボタンを押してください');
  }
}

export async function start(): Promise<void> {
  stop();
  const mode = settings.source;
  if (mode === 'file') {
    if (state.file) return startFile(state.file);
    ui.pickFile();
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
