<script lang="ts">
  import { onMount } from 'svelte';
  import { rt } from './runtime.svelte';
  import { saveSettings, settings } from './settings.svelte';
  import { listDevices } from './engine/audio';
  import { openFile } from './actions';
  import { onKeydown } from './shortcuts';
  import { setWakeLock } from './wakelock';
  import Header from './components/Header.svelte';
  import SpectrogramView from './components/SpectrogramView.svelte';
  import Footer from './components/Footer.svelte';
  import HelpDialog from './components/HelpDialog.svelte';

  const coarsePointer = matchMedia('(pointer: coarse)').matches;

  onMount(() => {
    listDevices().catch(() => {});
    const onChange = () => listDevices().catch(() => {});
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
  });

  // 設定を保存する(どれかが変わるたびに)
  $effect(() => {
    void $state.snapshot(settings);
    saveSettings();
  });

  // スマホでは、取り込み中に画面が消えないようにする
  $effect(() => {
    setWakeLock(rt.running && coarsePointer);
  });

  // マウスで押したボタンにフォーカスが残ると、Space がそのボタンの再押下になってしまうので外す
  function blurAfterClick(e: MouseEvent) {
    if (e.detail > 0) (e.target as HTMLElement | null)?.closest('button')?.blur();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer?.files[0];
    if (f) openFile(f);
  }
</script>

<svelte:window onkeydown={onKeydown} onclick={blurAfterClick} ondragover={(e) => e.preventDefault()} ondrop={onDrop} />
<svelte:document onfullscreenchange={() => (rt.fullscreen = !!document.fullscreenElement)} />

<div id="app" class:immersive={rt.immersive}>
  <Header />
  <SpectrogramView />
  <Footer />
  <HelpDialog />
</div>
