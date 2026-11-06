/** ボタンの下に出す popover の位置を決める。位置は CSS 変数で渡す(スタイルは style.css 側)。 */
export function placeUnder(pop: HTMLElement, anchor: HTMLElement | undefined): void {
  if (!anchor) return;
  const r = anchor.getBoundingClientRect();
  pop.style.setProperty('--pt', `${Math.round(r.bottom + 6)}px`);
  pop.style.setProperty('--pr', `${Math.max(8, Math.round(window.innerWidth - r.right))}px`);
}

/** 開いている popover をすべて閉じる */
export function closePopovers(): void {
  document.querySelectorAll<HTMLElement>('[popover]:popover-open').forEach((p) => p.hidePopover());
}
