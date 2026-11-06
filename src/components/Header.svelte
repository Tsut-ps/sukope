<script lang="ts">
  import { onMount } from 'svelte';
  import { rt, ui } from '../runtime.svelte';
  import {
    A4_LIST,
    ANALYSIS_MODES,
    AXIS_MODES,
    COLORMAPS,
    FFT_SIZES,
    FMAX_LIST,
    FMIN_LIST,
    resetSettings,
    settings,
  } from '../settings.svelte';
  import { stop, startFile } from '../engine/audio';
  import {
    fullscreenSupported,
    savePng,
    toggleFullscreen,
    toggleChannels,
    toggleHarmonics,
    toggleHelp,
    toggleImmersive,
    toggleLabels,
    togglePause,
    toggleStart,
    toggleTuner,
  } from '../actions';
  import PresetBar from './PresetBar.svelte';
  import Icon from './Icon.svelte';
  import { closePopovers, placeUnder } from '../popover';

  let fileInput = $state<HTMLInputElement>();
  let settingsBtn = $state<HTMLButtonElement>();
  let menuBtn = $state<HTMLButtonElement>();
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

<header>
  <div class="bar">
    <div class="grp src">
      <select id="source" aria-label="入力" bind:value={settings.source} onchange={() => stop()}>
        <option value="device">入力デバイス(マイク/ループバック)</option>
        <option value="display" disabled={!displaySupported}>
          タブ・画面の音声を共有{displaySupported ? '' : '(この環境では非対応)'}
        </option>
        <option value="file">音声ファイル</option>
      </select>
      {#if settings.source === 'device'}
        <select id="device" aria-label="デバイス" bind:value={settings.deviceId}>
          <option value="">既定の入力</option>
          {#each rt.devices as d (d.id)}
            <option value={d.id}>{d.label}</option>
          {/each}
        </select>
      {:else if settings.source === 'file'}
        <label class="btn" for="file">ファイルを選択…</label>
        <input type="file" id="file" accept="audio/*,video/*" class="hidden" bind:this={fileInput} onchange={onFile} />
        <span class="muted fname">{rt.fileName || '(ここへドロップも可)'}</span>
      {/if}
    </div>
    <div class="grp run">
      <button class="primary" class:on={rt.running} onclick={toggleStart}>
        {rt.running ? '停止' : '開始'}
      </button>
      <button title="スペースキーでも切り替え" onclick={togglePause}>{rt.paused ? '再開' : '止める'}</button>
    </div>
    <PresetBar />
    <span class="grow"></span>
    <div class="tgls" role="group" aria-label="表示の切り替え">
      <button class="ibtn" class:on={settings.labels} aria-pressed={settings.labels} title="音名ラベル(B)" onclick={toggleLabels}>
        <Icon name="labels" /><span class="sr">音名ラベル</span>
      </button>
      <button class="ibtn" class:on={settings.harmonics} aria-pressed={settings.harmonics} title="倍音マーカー: クリックした周波数を基音にして倍音の線を引く(K)" onclick={toggleHarmonics}>
        <Icon name="harmonics" /><span class="sr">倍音</span>
      </button>
      <button class="ibtn" class:on={settings.tuner} aria-pressed={settings.tuner} title="チューナー(T)" onclick={toggleTuner}>
        <Icon name="tuner" /><span class="sr">チューナー</span>
      </button>
      <button class="ibtn" class:on={settings.channels === 'lr'} aria-pressed={settings.channels === 'lr'} title="左右を上下に分ける(D)" onclick={toggleChannels}>
        <Icon name="lr" /><span class="sr">左右分け</span>
      </button>
    </div>
    <div class="acts">
      <button class="ibtn wide" bind:this={settingsBtn} popovertarget="settingsPop" title="解析・範囲・見た目の設定">
        <Icon name="settings" /><span class="lbl">設定</span>
      </button>
      <button class="ibtn" title="ヘッダーとフッターを隠す(H)" onclick={toggleImmersive}>
        <Icon name="focus" /><span class="sr">表示に集中</span>
      </button>
      <button class="ibtn" bind:this={menuBtn} popovertarget="menuPop" aria-label="その他" title="その他">
        <Icon name="more" />
      </button>
    </div>
  </div>

  <div id="settingsPop" class="pop settings" popover onbeforetoggle={(e) => e.newState === 'open' && placeUnder(e.currentTarget, settingsBtn)}>
    <section>
      <h3>解析</h3>
      <div class="field">
        <label for="analysis" title="音階向けは、低音ほど周波数を細かく・高音ほど時間を細かく見ます">方式</label>
        <select id="analysis" bind:value={settings.analysis}>
          {#each ANALYSIS_MODES as m (m.value)}<option value={m.value}>{m.label}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="fft" title="大きいほど周波数の分解能が上がり、時間の分解能は下がります(音階向けのときは自動)">FFT</label>
        <select id="fft" bind:value={settings.fft} disabled={settings.analysis === 'cqt'}>
          {#each FFT_SIZES as n (n)}<option value={n}>{n}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="smooth" title="0で瞬時値、大きいほど時間方向になめらか">平滑化</label>
        <span class="slider">
          <input type="range" id="smooth" min="0" max="0.9" step="0.05" bind:value={settings.smooth} />
          <span class="val">{settings.smooth.toFixed(2)}</span>
        </span>
      </div>
    </section>
    <section>
      <h3>周波数の範囲</h3>
      <div class="field">
        <label for="notes" title="音名にすると左軸が鍵盤になり、ドレミファソラシの線が引かれます(周波数軸は対数固定)">左軸</label>
        <select id="notes" bind:value={settings.axisMode}>
          {#each AXIS_MODES as m (m.value)}<option value={m.value}>{m.label}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="scale">周波数軸</label>
        <select id="scale" bind:value={settings.scale} disabled={settings.axisMode !== 'hz'}>
          <option value="log">対数</option>
          <option value="lin">線形</option>
        </select>
      </div>
      <div class="field">
        <label for="fmin">下限</label>
        <select id="fmin" bind:value={settings.fmin}>
          {#each FMIN_LIST as f (f)}
            <option value={f} disabled={f >= fmaxHz}>{f === 0 ? '0 Hz(対数時は20)' : hzLabel(f)}</option>
          {/each}
        </select>
      </div>
      <div class="field">
        <label for="fmax">上限</label>
        <select id="fmax" bind:value={settings.fmax}>
          {#each FMAX_LIST as f (f)}
            <option value={f} disabled={f !== 0 && f <= settings.fmin}>{f === 0 ? 'ナイキスト' : hzLabel(f)}</option>
          {/each}
        </select>
      </div>
    </section>
    <section>
      <h3>見た目・音</h3>
      <div class="field">
        <label for="map">配色</label>
        <select id="map" bind:value={settings.colormap}>
          {#each COLORMAPS as c (c.value)}<option value={c.value}>{c.label}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="a4" title="音名の基準(A4 の周波数)。ピアノは 440、古楽は 415 など">A4 の基準</label>
        <select id="a4" bind:value={settings.a4}>
          {#each A4_LIST as n (n)}<option value={n}>{n} Hz</option>{/each}
        </select>
      </div>
    </section>
  </div>

  <div id="menuPop" class="pop menu" popover onbeforetoggle={(e) => e.newState === 'open' && placeUnder(e.currentTarget, menuBtn)}>
    <button onclick={() => (closePopovers(), savePng())}>PNG保存<kbd>P</kbd></button>
    {#if fullscreenSupported()}
      <button onclick={() => (closePopovers(), toggleFullscreen())}>{rt.fullscreen ? '全画面を終了' : '全画面'}<kbd>F</kbd></button>
    {/if}
    <button onclick={() => (closePopovers(), toggleHelp())}>ショートカット一覧<kbd>?</kbd></button>
    {#if rt.installable}
      <button onclick={() => (closePopovers(), ui.install())}>アプリとして追加</button>
    {/if}
    <hr />
    <button title="解析・範囲・配色などを初期値に戻す(入力の選択は残します)" onclick={() => (closePopovers(), resetSettings())}>設定を初期化</button>
  </div>
</header>
