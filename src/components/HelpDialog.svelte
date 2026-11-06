<script lang="ts">
  import { rt } from '../runtime.svelte';
  import { SHORTCUTS } from '../shortcuts';

  let dialog: HTMLDialogElement;
  const groups = ['基本', '表示', '設定'] as const;

  // rt.helpOpen と <dialog> の開閉を揃える
  $effect(() => {
    if (rt.helpOpen && !dialog.open) dialog.showModal();
    else if (!rt.helpOpen && dialog.open) dialog.close();
  });
</script>

<dialog bind:this={dialog} onclose={() => (rt.helpOpen = false)} onclick={(e) => e.target === dialog && dialog.close()}>
  <div class="dlgBody">
    <form method="dialog"><button class="icon" aria-label="閉じる" title="閉じる(Esc)">✕</button></form>
    <h2>ショートカット</h2>
    {#each groups as g (g)}
      <h3>{g}</h3>
      <dl>
        {#each SHORTCUTS.filter((s) => s.group === g) as s (s.label)}
          <dt><kbd>{s.keys}</kbd></dt>
          <dd>{s.label}</dd>
        {/each}
      </dl>
    {/each}
    <h3>スペクトログラム</h3>
    <dl>
      <dt><kbd>ドラッグ</kbd></dt>
      <dd>レベルバーの ▼ で、色に割り当てる dB の範囲を調整(ダブルクリックでリセット)</dd>
      <dt><kbd>ドロップ</kbd></dt>
      <dd>音声ファイルを画面に落とすと再生して解析</dd>
    </dl>
  </div>
</dialog>
