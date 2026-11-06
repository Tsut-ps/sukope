import { $ } from './dom';

export function setStatus(text: string, err = false): void {
  const s = $('status');
  s.textContent = text;
  s.classList.toggle('err', err);
}

export function setRunningUi(running: boolean): void {
  const b = $('start');
  b.textContent = running ? '停止' : '開始';
  b.classList.toggle('on', running);
}
