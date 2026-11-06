/** 画面の自動消灯を防ぐ(スマホで見せ続けるとき用)。非対応の環境では何もしない。 */
let sentinel: WakeLockSentinel | null = null;
let wanted = false;
let pending = false;

async function acquire(): Promise<void> {
  if (!('wakeLock' in navigator) || pending || (sentinel && !sentinel.released)) return;
  pending = true;
  try {
    const s = await navigator.wakeLock.request('screen');
    if (!wanted) {
      void s.release();
      return;
    }
    sentinel = s;
    s.addEventListener('release', () => {
      if (sentinel === s) sentinel = null;
    });
  } catch {
    /* 省電力モードなどで拒否されることがある */
  } finally {
    pending = false;
  }
}

export function setWakeLock(on: boolean): void {
  wanted = on;
  if (on) void acquire();
  else {
    void sentinel?.release().catch(() => {});
    sentinel = null;
  }
}

// タブを離れると自動で解除されるので、戻ってきたときに取り直す
document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible') void acquire();
});
