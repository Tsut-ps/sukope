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
    <h3>スペクトログラム上の操作</h3>
    <dl>
      <dt><kbd>ホイール</kbd></dt>
      <dd>時間軸をズーム(止めているときはカーソル位置が基準)</dd>
      <dt><kbd>Shift+ホイール</kbd></dt>
      <dd>周波数軸をズーム(カーソル位置が基準)</dd>
      <dt><kbd>Ctrl+ホイール</kbd></dt>
      <dd>両方の軸をズーム(トラックパッドのピンチも同じ)</dd>
      <dt><kbd>ドラッグ</kbd></dt>
      <dd>移動。横に動かすと表示を止めて過去へ(ホイールドラッグも可)</dd>
      <dt><kbd>ダブルクリック</kbd></dt>
      <dd>ズームを戻す(スマホはダブルタップ)</dd>
      <dt><kbd>ピンチ</kbd></dt>
      <dd>スマホ: 2本指で縦横を別々にズーム。タップで周波数・時刻・dB を表示</dd>
    </dl>
    <h3>その他</h3>
    <dl>
      <dt><kbd>レベルバー</kbd></dt>
      <dd>▼ で、色に割り当てる dB の範囲を調整(ダブルクリックでリセット)</dd>
      <dt><kbd>ドロップ</kbd></dt>
      <dd>音声ファイルを画面に落とすと再生して解析</dd>
    </dl>
  </div>
</dialog>
