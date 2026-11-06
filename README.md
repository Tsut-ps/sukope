# sukope

ブラウザで動く、リアルタイムのスペクトログラム(縦軸=周波数、横軸=時間)。

<img width="1912" height="924" alt="image" src="https://github.com/user-attachments/assets/04da7c1c-863e-43fb-b7cb-e0e245306943" />

## 機能

- 入力: マイク / ループバック入力デバイス / タブ・画面の音声共有 / 音声ファイル
- 用途プリセット(声 / 楽器 / 環境音 / 再生音楽)をワンタップで切り替え
- 左軸: Hz、または音名(C D E… / ド レ ミ…)。音名のときは鍵盤とドレミの線を表示
- レベルバーで dB の上限・下限をドラッグ設定(過去の表示も描き直し)
- FFT サイズ、周波数の下限・上限、スクロール速度、配色(色覚配慮の Viridis が既定)、平滑化
- 設定は自動で保存
- ショートカット(`?` で一覧)、全画面、ヘッダー・フッターを隠す表示
- スマホ対応(縦・横、取り込み中は画面が消えない)
- 音が流れていないときの案内

## 再生音(PC の音)を見るには

- **ループバック入力デバイス**を選ぶ: Windows はステレオミキサーか VB-CABLE、Mac は BlackHole か Loopback
- または「タブ・画面の音声を共有」(Chrome / Edge)

## 開発

```sh
npm install
npm run dev        # 開発サーバー
npm run typecheck  # 型チェック
npm run build      # dist/ に出力
```

マイクと画面共有は、HTTPS または localhost でのみ使えます。

## 構成

Svelte 5 + TypeScript。画面は Svelte、音声処理と Canvas 描画は `src/engine/` にまとめています。

```
index.html
src/
  main.ts                 起動
  App.svelte              全体(保存、Wake Lock、ドロップ)
  components/             Header / PresetBar / SpectrogramView / Footer / LevelBar / HelpDialog
  settings.svelte.ts      設定(検証と localStorage への保存)
  runtime.svelte.ts       実行時の状態(画面に出すもの)
  presets.ts              用途プリセット
  actions.ts              操作(ボタン・キー・ドロップで共通)
  shortcuts.ts            ショートカット表
  wakelock.ts             画面の自動消灯の防止
  engine/
    audio.ts              音声入力
    render.ts             表示範囲の更新、リサイズ、フレーム描画
    spectrogram.ts        描画と履歴
    axis.ts / overlay.ts / level.ts / png.ts
    freqmap.ts / notes.ts / colormap.ts   純粋な計算
public/_headers           セキュリティヘッダー(CSP など)
```

## 公開(Cloudflare Workers の静的アセット)

`wrangler.jsonc` で `dist/` を配信します。Worker のコードはありません。

```sh
npm run deploy
```
