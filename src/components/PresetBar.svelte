<script lang="ts">
  import { activePreset, applyPreset, PRESETS } from '../presets';

  const active = $derived(activePreset());
</script>

<div class="presets" role="group" aria-label="用途プリセット">
  <span class="presetLabel">用途</span>
  {#each PRESETS as p, i (p.id)}
    <button class="chip" class:on={active === p.id} title="{p.hint}({i + 1})" onclick={() => applyPreset(p.id)}>
      {p.label}
    </button>
  {/each}
</div>
