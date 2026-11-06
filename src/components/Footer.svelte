<script lang="ts">
  import { rt } from '../runtime.svelte';
  import { isNoteMode, noteLang, settings } from '../settings.svelte';
  import { fmtHz } from '../engine/format';
  import { describePitch } from '../engine/notes';
  import LevelBar from './LevelBar.svelte';

  let playerBox: HTMLSpanElement;

  const noteMode = $derived(isNoteMode());
  const peakNote = $derived(rt.peak ? describePitch(rt.peak.f, noteLang()) : '');
  const hoverNote = $derived(rt.hover != null ? describePitch(rt.hover, noteLang()) : '');
  const seconds = $derived(rt.widthCss ? (rt.widthCss / settings.speed).toFixed(1) : '');

  // 再生プレーヤー(ファイル入力時)は、作った要素をそのまま置く
  $effect(() => {
    playerBox.replaceChildren(...(rt.player ? [rt.player] : []));
  });
</script>

<footer>
  <LevelBar />
  <span id="peak">
    ピーク:
    {#if rt.peak}
      {#if noteMode}<b>{peakNote}</b> {fmtHz(rt.peak.f)}{:else}<b>{fmtHz(rt.peak.f)}</b> {peakNote}{/if}
      / {rt.peak.db.toFixed(0)} dB
    {:else}—{/if}
  </span>
  <span id="hover">
    {#if rt.hover != null}
      カーソル:
      {#if noteMode}<b>{hoverNote}</b> {fmtHz(rt.hover)}{:else}<b>{fmtHz(rt.hover)}</b> {hoverNote}{/if}
    {/if}
  </span>
  <span class="spacer"></span>
  <span id="playerBox" bind:this={playerBox}></span>
  <span id="status" class:err={rt.statusErr}>{rt.status}</span>
  {#if seconds}<span class="muted">← 過去 / 表示幅 約 {seconds} 秒 / 現在 →</span>{/if}
</footer>
