/** PWA: オフライン用の Service Worker の登録と、「アプリとして追加」の案内。 */
import { rt, ui } from './runtime.svelte';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

export function setupPwa(): void {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  let deferred: InstallPromptEvent | null = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    rt.installable = true;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    rt.installable = false;
  });
  ui.install = () => {
    const d = deferred;
    if (!d) return;
    deferred = null;
    rt.installable = false;
    void d.prompt();
  };
}
