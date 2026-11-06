# sukope

ブラウザで動く、リアルタイムのスペクトログラム(縦軸=周波数、横軸=時間)。

<img width="1912" height="924" alt="image" src="https://github.com/user-attachments/assets/04da7c1c-863e-43fb-b7cb-e0e245306943" />

## 機能

- 入力: マイク / ループバック入力デバイス / タブ・画面の音声共有 / 音声ファイル
- 左軸: Hz、または音名(C D E… / ド レ ミ…)。音名のときは鍵盤とドレミの線を表示
- レベルバーで dB の上限・下限をドラッグ設定(過去の表示も描き直し)
- FFT サイズ、周波数の下限・上限、スクロール速度、配色、平滑化
- スマホ幅に対応

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

```
index.html        画面の骨組み
src/
  main.ts         起動
  app.ts          表示範囲の更新、リサイズ、フレーム描画
  ui.ts           操作と各処理の結びつけ
  audio.ts        音声入力
  spectrogram.ts  描画と履歴
  axis.ts         左軸(Hz / 鍵盤)
  overlay.ts      グリッド線とカーソル表示
  level.ts        レベルバー
  freqmap.ts      周波数と位置の対応(純粋な計算)
  notes.ts        音名(純粋な計算)
  colormap.ts     配色と dB の対応(純粋な計算)
public/_headers   セキュリティヘッダー(CSP など)
```

## 公開(Cloudflare Workers の静的アセット)

`wrangler.jsonc` で `dist/` を配信します。Worker のコードはありません。

```sh
npm run deploy
```
