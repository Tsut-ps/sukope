<script lang="ts">
  export type IconName = 'labels' | 'harmonics' | 'tuner' | 'lr' | 'settings' | 'focus' | 'more';
  let { name }: { name: IconName } = $props();
</script>

<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'labels'}
    <path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" />
  {:else if name === 'harmonics'}
    <path d="M3 19h18" /><path d="M3 12h18" stroke-dasharray="3 3" /><path d="M3 8h18" stroke-dasharray="3 3" /><path d="M3 5h18" stroke-dasharray="3 3" />
  {:else if name === 'tuner'}
    <path d="M4 18a8 8 0 0 1 16 0" /><path d="M12 18l4-7" /><circle cx="12" cy="18" r="1" />
  {:else if name === 'lr'}
    <rect x="4" y="4" width="16" height="7" rx="1.5" /><rect x="4" y="13" width="16" height="7" rx="1.5" />
  {:else if name === 'settings'}
    <path d="M4 7h9M19 7h1M4 17h1M11 17h9" /><circle cx="16" cy="7" r="2.5" /><circle cx="8" cy="17" r="2.5" />
  {:else if name === 'focus'}
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  {:else if name === 'more'}
    <circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" />
  {/if}
</svg>
