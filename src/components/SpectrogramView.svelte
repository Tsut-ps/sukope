<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { rt } from '../runtime.svelte';
  import { settings } from '../settings.svelte';
  import { state } from '../engine/state';
  import Tuner from './Tuner.svelte';
  import { applyAnalysis, applyReferencePitch, applySmooth, initEngine, rebuildColors, resetFreqWindow } from '../engine/render';
  import { clampZoomT, requestFull, requestOverlay } from '../engine/viewport';
  import { fullscreenSupported, goLive, toggleFullscreen, toggleImmersive, togglePause } from '../actions';

  let host: HTMLDivElement;
  let axisCol: HTMLDivElement;
  let spec: HTMLCanvasElement;
  let over: HTMLCanvasElement;
  let axis: HTMLCanvasElement;

  onMount(() => initEngine({ host, axisCol, spec, over, axis }));

  // 設定が変わったら、必要な部分だけエンジンに反映する
  $effect(() => {
    void [settings.scale, settings.fmin, settings.fmax, settings.axisMode, rt.sampleRate];
    untrack(resetFreqWindow);
  });
  // 速度が変わると時間軸の縮尺が変わる
  $effect(() => {
    void settings.speed;
    untrack(() => {
      clampZoomT();
      requestFull();
      requestOverlay();
    });
  });
  $effect(() => {
    void [settings.fft, settings.analysis, settings.channels];
    untrack(applyAnalysis);
  });
  $effect(() => {
    void settings.a4;
    untrack(applyReferencePitch);
  });
  // 表示だけが変わる設定(ラベル・倍音)は、オーバーレイを描き直す
  $effect(() => {
    void [settings.labels, settings.harmonics, settings.tuner];
    untrack(() => {
      if (!settings.harmonics) state.pinF = null;
      requestOverlay();
    });
  });
  $effect(() => {
    void settings.smooth;
    untrack(applySmooth);
  });
  $effect(() => {
    void [settings.colormap, settings.dbMin, settings.dbMax];
    untrack(rebuildColors);
  });
</script>

<main>
  <div id="axisCol" bind:this={axisCol}><canvas bind:this={axis}></canvas></div>
  <div id="host" bind:this={host}>
    <canvas bind:this={spec}></canvas>
    <canvas id="over" bind:this={over}></canvas>
    {#if settings.tuner}<Tuner />{/if}
    {#if !rt.everStarted}
      <div id="hint">
        <div class="hintBody">
          入力を選んで <b>「開始」</b> を押してください。<br />
          PCの再生音は、<b>ループバック入力デバイス</b>(BlackHole / Loopback / ステレオミキサー / VB-CABLE など)を選ぶか、<br />
          <b>「タブ・画面の音声を共有」</b>(Chrome/Edge)で取り込めます。<br />
          音声ファイルはこの画面にドラッグ&amp;ドロップしても再生・解析できます。<br />
          用途のボタンで設定をまとめて切り替えられます。<span class="only-kbd"><b>?</b> でショートカット一覧。</span>
        </div>
      </div>
    {/if}
    {#if rt.silent}
      <div class="notice" role="status">
        このデバイスには音が流れていないようです。<span class="sub">入力デバイスの選択・音量・共有時の「音声も共有」を確認してください。</span>
      </div>
    {/if}
    {#if rt.paused && rt.behind > 0.3}
      <button class="live" onclick={goLive}>▶ ライブに戻る({rt.behind.toFixed(1)} 秒前を表示中)</button>
    {/if}
    {#if rt.immersive}
      <div class="floating">
        <button onclick={togglePause}>{rt.paused ? '再開' : '止める'}</button>
        {#if fullscreenSupported()}
          <button onclick={toggleFullscreen}>{rt.fullscreen ? '全画面を終了' : '全画面'}</button>
        {/if}
        <button onclick={toggleImmersive}>メニューを表示</button>
      </div>
    {/if}
  </div>
</main>
