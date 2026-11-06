<script lang="ts">
  import { rt } from '../runtime.svelte';
  import { resetZoom } from '../actions';
  import { BASE_PPS, isNoteMode, noteLang, settings } from '../settings.svelte';
  import { fmtHz } from '../engine/format';
  import { describePitch } from '../engine/notes';
  import LevelBar from './LevelBar.svelte';

  let playerBox: HTMLSpanElement;

  const noteMode = $derived(isNoteMode());
  const peakNote = $derived(rt.peak ? describePitch(rt.peak.f, noteLang()) : '');
  const hoverNote = $derived(rt.hover ? describePitch(rt.hover.f, noteLang()) : '');
  const seconds = $derived(rt.widthCss ? (rt.widthCss / (BASE_PPS * settings.zoom)).toFixed(1) : '');
  const zoomed = $derived(settings.zoom !== 1 || rt.zoomF > 1.01);

  // 再生プレーヤー(ファイル入力時)は、作った要素をそのまま置く
  $effect(() => {
    playerBox.replaceChildren(...(rt.player ? [rt.player] : []));
  });
</script>

<footer>
  <LevelBar />
  <div class="read">
    <span id="peak">
      ピーク:
      {#if rt.peak}
        {#if noteMode}<b>{peakNote}</b> {fmtHz(rt.peak.f)}{:else}<b>{fmtHz(rt.peak.f)}</b> {peakNote}{/if}
        / {rt.peak.db.toFixed(0)} dB
      {:else}—{/if}
    </span>
    <span id="hover">
      {#if rt.hover}
        カーソル:
        {#if noteMode}<b>{hoverNote}</b> {fmtHz(rt.hover.f)}{:else}<b>{fmtHz(rt.hover.f)}</b> {hoverNote}{/if}
        / {rt.hover.db == null ? '—' : rt.hover.db.toFixed(0) + ' dB'} / {rt.hover.ago.toFixed(1)} 秒前
      {/if}
    </span>
  </div>
  <div class="info">
    <span id="status" class:err={rt.statusErr}>{rt.status}</span>
    <span class="tail">
      {#if zoomed}
        <button class="small" title="ズームを戻す(0 / ダブルクリック / ダブルタップ)" onclick={resetZoom}>
          ズーム 時間×{settings.zoom.toFixed(1)} 周波数×{rt.zoomF.toFixed(1)} ✕
        </button>
      {/if}
      {#if seconds}<span class="muted">表示幅 約 {seconds} 秒</span>{/if}
    </span>
  </div>
  <span id="playerBox" bind:this={playerBox}></span>
</footer>
