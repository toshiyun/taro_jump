# タロジャンプ

黒柴のタロ助をタップでジャンプさせて、赤白のバーを飛びこえていく障害物レースです。
iPhoneのSafariで遊べるWebゲームで、Three.js で3D表示しています。

## あそびかた

- 画面をタップするとタロ助がジャンプします。空中でもう一度タップすると、さらに高く跳びます（最大3回）。
- 障害物は赤白のバーが1〜3本積まれていて、**バーの本数＝必要なタップ回数**です。障害物の上の肉球マークの数でも分かります。
- バーを20こ飛びこえるとゴール。ゴールまでのタイムを計ります（ベストタイムはその端末に保存されます）。
- 3回ぶつかるとゲームオーバーです。
- **ボーナス「ナイス、わん！」**：ジャンプのいちばん高いところでタロ助の体がバーの真上にあり（バーの中心から前後1.0以内）、タップ回数がバーの本数と同じだと、タイムが0.5秒へります。判定の幅は `src/config.js` の `bonusWindow`、へる秒数は `bonusTime` で変えられます。

## iPhoneで遊ぶ（GitHub Pages で公開する）

自前のWebサーバは不要です。GitHub Pages を一度オンにすると、URLを開くだけで遊べます。

1. GitHub でこのリポジトリを開き、**Settings → Pages** を開きます。
2. 「Build and deployment」の **Source** を `Deploy from a branch`、**Branch** を `main` と `/ (root)` にして **Save** を押します。
3. 1〜2分待つと、同じ画面に公開URL（`https://toshiyun.github.io/taro_jump/`）が表示されます。
4. iPhoneのSafariでそのURLを開けば遊べます。共有ボタン →「ホーム画面に追加」にすると、アプリのように全画面で遊べます。

> **注意**：非公開（private）リポジトリで GitHub Pages を使うには、GitHub Pro などの有料プランが必要です。
> 無料プランの場合は、Settings → General のいちばん下（Danger Zone）で「Change visibility」から公開（public）にすると使えるようになります。

ゲームの中身はビルド不要の静的ファイルだけです。Three.js も `vendor/` に同梱しているので、外部のCDNには頼りません（文字のフォントだけ Google Fonts から読み込み、つながらないときは iPhone 内蔵の丸ゴシックで表示します）。

## パソコンで動かして確認する

`index.html` をダブルクリックで開くと、ブラウザの制限で動きません。簡単なWebサーバを立ててから開いてください。

```sh
# どちらか一方
python3 -m http.server 8000
npx http-server -p 8000
```

ブラウザで <http://localhost:8000> を開きます。スペースキー（または↑キー）でもジャンプできます。

## ファイル構成

| ファイル | 中身 |
| --- | --- |
| `index.html` | 画面の骨組み（タイトル・プレイ中の表示・結果画面） |
| `style.css` | 画面のデザイン |
| `src/main.js` | ゲームの進行（タップ、当たり判定、タイム、カメラ） |
| `src/config.js` | 難しさの調整値（ゴールに必要な数、ジャンプの高さ、スピードなど） |
| `src/dog.js` | タロ助の3Dモデルと動き |
| `src/world.js` | 空・芝生・コース・障害物・ゴールなどの3Dの景色 |
| `src/audio.js` | 効果音（Web Audio でその場で合成） |
| `vendor/three.module.min.js` | Three.js r170（MITライセンス、`vendor/THREE_LICENSE`） |

難しさを変えたいときは `src/config.js` の数字を変えてください。たとえば `goalCount` を 10 にすると10こでゴール、`maxSpeed` を下げるとゆっくりになります。
