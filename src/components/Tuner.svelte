<script lang="ts">
  import { rt } from '../runtime.svelte';
  import { noteLang } from '../settings.svelte';
  import { noteName } from '../engine/notes';
  import { fmtHz } from '../engine/format';

  /** このずれ(セント)以内なら「合っている」 */
  const IN_TUNE = 5;
  const p = $derived(rt.pitch);
  const cents = $derived(p ? Math.max(-50, Math.min(50, p.cents)) : 0);
  const sign = (c: number): string => (c >= 0 ? '+' : '−') + Math.abs(Math.round(c));
  let needle: HTMLDivElement;

  // CSP で inline style を使えないので、DOM のプロパティとして位置を設定する
  $effect(() => {
    needle.style.left = `${50 + cents}%`;
  });
</script>

<div id="tuner" class:on={!!p} class:ok={!!p && Math.abs(p.cents) <= IN_TUNE} role="status" aria-label="チューナー">
  <div class="note">{p ? noteName(p.midi, noteLang()) : '—'}</div>
  <div class="hz">{p ? fmtHz(p.f) : '音を鳴らしてください'}</div>
  <div class="meter"><div class="mid"></div><div class="needle" bind:this={needle}></div></div>
  <div class="cents">{p ? `${sign(p.cents)} セント` : ''}</div>
</div>
