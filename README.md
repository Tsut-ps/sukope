# sukope

ブラウザで動く、リアルタイムのスペクトログラム(縦軸=周波数、横軸=時間)。

<img width="1912" height="924" alt="image" src="https://github.com/user-attachments/assets/04da7c1c-863e-43fb-b7cb-e0e245306943" />

## 機能

- 入力: マイク / ループバック入力デバイス / タブ・画面の音声共有 / 音声ファイル
- 用途プリセット(声 / 楽器 / 環境音 / 再生音楽)をワンタップで切り替え
- 左軸: Hz、または音名(C D E… / ド レ ミ…)。音名のときは鍵盤とドレミの線を表示
- レベルバーで dB の上限・下限をドラッグ設定(過去の表示も描き直し)
- ズームと移動: ホイール(時間軸)、Shift+ホイール(周波数軸)、ドラッグ、ピンチ。止めて過去へさかのぼれる(最大で数分)
- カーソルやタップで、周波数・音名・dB・時刻を表示。時間軸の目盛りつき
- PNG 保存は、軸・目盛り・設定のキャプション・色の凡例つき
- FFT サイズ、周波数の下限・上限、スクロール速度、配色(色覚配慮の Viridis が既定)、平滑化
- 音階向けの解析: 低音ほど周波数を細かく・高音ほど時間を細かく見る(1オクターブごとに FFT サイズを切り替える方式。ふつうの FFT も選べる)
- 音名ラベル: 鳴っている音の名前を、スペクトログラムに流して表示(PNG にも入る)
- 倍音マーカー: クリック/タップした周波数を基音として、倍音(×2, ×3…)の線を引く
- チューナー: いま鳴っている音の高さを、音名とずれ(セント)で表示。A4 の基準は 415〜450 Hz から選べる
- 左右(L/R)を上下に分けて表示
- PWA: ホーム画面やアプリ一覧に追加でき、オフラインでも開ける(保存するのは画面だけで、音声は保存しない)
- 設定は自動で保存
- ショートカット(`?` で一覧)、全画面、ヘッダー・フッターを隠す表示
- スマホ対応(縦・横、取り込み中は画面が消えない)
- 音が流れていないときの案内

## おまけ

画像を画面にドロップ(またはコピーして貼り付け)すると、いま見えている周波数の範囲に絵が載るような音を作って再生します。
画像の明るさが音の強さになるので、スペクトログラムに絵が流れます。範囲や速度を変えてからもう一度ドロップすると、その見え方に合わせて作り直します。

## 再生音(PC の音)を見るには

- **ループバック入力デバイス**を選ぶ: Windows はステレオミキサーか VB-CABLE、Mac は BlackHole か Loopback
- または「タブ・画面の音声を共有」(Chrome / Edge)

## 開発

```sh
npm install
npm run dev        # 開発サーバー
npm run typecheck  # 型チェック
npm test           # テスト(音程検出・設定の読み込み・解析の周波数表・履歴の作り直し・画像→音)
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
  components/             Header / PresetBar / SpectrogramView / Footer / LevelBar / HelpDialog / Tuner
  settings-schema.ts      設定の型・既定値・検証(画面に依存しない)
  settings.svelte.ts      設定(localStorage への保存)
  runtime.svelte.ts       実行時の状態(画面に出すもの)
  presets.ts              用途プリセット
  actions.ts              操作(ボタン・キー・ドロップで共通)
  shortcuts.ts            ショートカット表
  wakelock.ts             画面の自動消灯の防止
  pwa.ts                  Service Worker の登録と「アプリとして追加」
  engine/
    audio.ts              音声入力
    layout.ts             解析の周波数表(FFT / 音階向け)
    history.ts            履歴(時刻つきリングバッファ。周波数表つきで保存し、解析を切り替えても残す)
    pitch.ts              音程の検出(YIN 法)
    labels.ts             音名ラベルの検出と記録
    imagesynth.ts         画像 → 音(逆スペクトログラム)
    viewport.ts           ズーム・移動・ライブへの復帰(計算)
    gesture.ts            ホイール・ドラッグ・ピンチ・タップ
    render.ts             表示範囲の更新、リサイズ、フレーム描画
    spectrogram.ts        履歴から画素を作って描く
    axis.ts / overlay.ts / level.ts / png.ts
    freqmap.ts / notes.ts / colormap.ts   純粋な計算
public/_headers           セキュリティヘッダー(CSP など)
public/sw.js              オフライン用の Service Worker(画面だけを保存)
public/manifest.webmanifest, icons/   PWA の設定とアイコン
```

## 公開(Cloudflare Workers の静的アセット)

`wrangler.jsonc` で `dist/` を配信します。Worker のコードはありません。

```sh
npm run deploy
```
