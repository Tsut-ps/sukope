<script lang="ts">
  import { onMount } from 'svelte';
  import { rt } from '../runtime.svelte';
  import { settings } from '../settings.svelte';
  import { drawLevel, initLevel } from '../engine/level';

  let canvas: HTMLCanvasElement;

  onMount(() => initLevel(canvas));

  // dB 範囲・配色・現在のレベルが変わったら描き直す
  $effect(() => {
    void [settings.dbMin, settings.dbMax, settings.colormap, rt.level];
    drawLevel();
  });
</script>

<canvas
  id="lvl"
  tabindex="0"
  bind:this={canvas}
  title="レベルバー: ▼のハンドルをドラッグして dB の上限・下限を設定(ダブルクリックでリセット)。白線は現在のピークレベル。フォーカス中は ←→ で値を変更、↑↓ でハンドル切替(Shiftで5dB刻み)"
></canvas>
