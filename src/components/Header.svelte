<script lang="ts">
  import { onMount } from 'svelte';
  import { rt, ui } from '../runtime.svelte';
  import {
    AXIS_MODES,
    COLORMAPS,
    FFT_SIZES,
    FMAX_LIST,
    FMIN_LIST,
    SPEEDS,
    resetSettings,
    settings,
  } from '../settings.svelte';
  import { stop, startFile } from '../engine/audio';
  import {
    fullscreenSupported,
    savePng,
    toggleFullscreen,
    toggleHelp,
    toggleImmersive,
    togglePause,
    toggleStart,
  } from '../actions';
  import PresetBar from './PresetBar.svelte';

  let fileInput = $state<HTMLInputElement>();
  const displaySupported = !!navigator.mediaDevices?.getDisplayMedia;
  const nyquist = $derived(rt.sampleRate / 2);
  const fmaxHz = $derived(settings.fmax || nyquist);
  const hzLabel = (f: number) => (f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`);

  onMount(() => {
    ui.pickFile = () => fileInput?.click();
  });

  function onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) void startFile(f);
    input.value = '';
  }
</script>

<header class:open={rt.optionsOpen}>
  <div class="row">
    <div class="grp">
      <label for="source">入力</label>
      <select id="source" bind:value={settings.source} onchange={() => stop()}>
        <option value="device">入力デバイス(マイク/ループバック)</option>
        <option value="display" disabled={!displaySupported}>
          タブ・画面の音声を共有{displaySupported ? '' : '(この環境では非対応)'}
        </option>
        <option value="file">音声ファイル</option>
      </select>
    </div>
    {#if settings.source === 'device'}
      <div class="grp">
        <label for="device">デバイス</label>
        <select id="device" bind:value={settings.deviceId}>
          <option value="">既定の入力</option>
          {#each rt.devices as d (d.id)}
            <option value={d.id}>{d.label}</option>
          {/each}
        </select>
      </div>
    {:else if settings.source === 'file'}
      <div class="grp">
        <label class="btn" for="file">ファイルを選択…</label>
        <input type="file" id="file" accept="audio/*,video/*" class="hidden" bind:this={fileInput} onchange={onFile} />
        <span class="muted">{rt.fileName || '(ここへドロップも可)'}</span>
      </div>
    {/if}
    <button class="primary" class:on={rt.running} onclick={toggleStart}>
      {rt.running ? '停止' : '開始'}
    </button>
    <button title="スペースキーでも切り替え" onclick={togglePause}>{rt.paused ? '表示を再開' : '表示を止める'}</button>
    <button onclick={savePng}>PNG保存</button>
    <button class="only-sm" aria-expanded={rt.optionsOpen} onclick={() => (rt.optionsOpen = !rt.optionsOpen)}>
      設定 {rt.optionsOpen ? '▴' : '▾'}
    </button>
  </div>
  <PresetBar />
  <div class="row" id="opts">
    <div class="grp">
      <label for="fft" title="大きいほど周波数の分解能が上がり、時間の分解能は下がります">FFT</label>
      <select id="fft" bind:value={settings.fft}>
        {#each FFT_SIZES as n (n)}<option value={n}>{n}</option>{/each}
      </select>
    </div>
    <div class="grp">
      <label for="scale">周波数軸</label>
      <select id="scale" bind:value={settings.scale} disabled={settings.axisMode !== 'hz'}>
        <option value="log">対数</option>
        <option value="lin">線形</option>
      </select>
    </div>
    <div class="grp">
      <label for="fmin">周波数 下限</label>
      <select id="fmin" bind:value={settings.fmin}>
        {#each FMIN_LIST as f (f)}
          <option value={f} disabled={f >= fmaxHz}>{f === 0 ? '0 Hz(対数時は20)' : hzLabel(f)}</option>
        {/each}
      </select>
    </div>
    <div class="grp">
      <label for="fmax">上限</label>
      <select id="fmax" bind:value={settings.fmax}>
        {#each FMAX_LIST as f (f)}
          <option value={f} disabled={f !== 0 && f <= settings.fmin}>{f === 0 ? 'ナイキスト' : hzLabel(f)}</option>
        {/each}
      </select>
    </div>
    <div class="grp">
      <label for="speed">速度</label>
      <select id="speed" bind:value={settings.speed}>
        {#each SPEEDS as s (s.value)}<option value={s.value}>{s.label}</option>{/each}
      </select>
    </div>
    <div class="grp">
      <label for="map">配色</label>
      <select id="map" bind:value={settings.colormap}>
        {#each COLORMAPS as c (c.value)}<option value={c.value}>{c.label}</option>{/each}
      </select>
    </div>
    <div class="grp">
      <label for="smooth" title="0で瞬時値、大きいほど時間方向になめらか">平滑化</label>
      <input type="range" id="smooth" min="0" max="0.9" step="0.05" bind:value={settings.smooth} />
      <span class="val">{settings.smooth.toFixed(2)}</span>
    </div>
    <div class="grp">
      <label for="notes" title="音名にすると左軸が鍵盤になり、ドレミファソラシの線が引かれます(周波数軸は対数固定)">左軸</label>
      <select id="notes" bind:value={settings.axisMode}>
        {#each AXIS_MODES as m (m.value)}<option value={m.value}>{m.label}</option>{/each}
      </select>
    </div>
    <button title="FFT・範囲・配色などを初期値に戻す(入力の選択は残します)" onclick={resetSettings}>初期化</button>
    <span class="grow"></span>
    <button title="ヘッダーとフッターを隠す(H)" onclick={toggleImmersive}>表示に集中</button>
    {#if fullscreenSupported()}
      <button title="全画面(F)" onclick={toggleFullscreen}>{rt.fullscreen ? '全画面を終了' : '全画面'}</button>
    {/if}
    <button class="icon only-kbd" title="ショートカット一覧(?)" aria-label="ショートカット一覧" onclick={toggleHelp}>?</button>
  </div>
</header>
