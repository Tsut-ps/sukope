import './style.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { rt } from './runtime.svelte';
import { settings } from './settings.svelte';
import { state } from './engine/state';

const target = document.getElementById('app-root');
if (!target) throw new Error('#app-root が見つかりません');
mount(App, { target });

// 動作確認用: URL に ?debug を付けたときだけ状態を公開する
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as Record<string, unknown>).__spec = { state, rt, settings };
}
