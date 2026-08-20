# ぷにぷにエアホッケー

スマホ・タブレット1台を縦向きでも横向きでも2人で遊べる、GitHub Pages向けの対戦エアホッケーゲームです。PCではWASDと矢印キーで2人対戦できます。

## 現在の完成版仕様

- iPhone / iPad / Android のマルチタッチ対応
- Windows / Mac の Chrome / Edge / Firefox / Safari を想定
- PLAYER 1: 手前（下半分）タッチ または WASD
- PLAYER 2: 奥（上半分）タッチ または 矢印キー
- ゴールは常に上下固定。手前BLUEは上、奥PINKは下を狙う
- 縦向き・横向きで操作ルールを変えない
- Pointer Events + pointerId による同時入力分離
- 120Hz固定タイムステップの物理計算
- 指速度を先読みした高追従マレット
- マレット・パックそれぞれに質量、速度、反発、摩擦を設定
- 正面強打、かすり当たり、通常打撃で挙動とSEを変更
- 壁反射は入射角と速度に応じて反射感を変更
- マレット同士も物理的に押し返し合う
- 高速パックは残像・発光を強化
- ぷにキャラは衝突量に応じて潰れ、滑らかに揺り返して復元
- BURSTゲージと4.5秒の必殺技
- 必殺中はマレット大型化、実質質量増加、打球強化
- 手前の必殺ゲージは下、奥の必殺ゲージは上に固定
- BGM/SE ON-OFF保存
- 実BGM: MusMus「魔法のクッキング」
- iOSの自動再生制限に合わせ、START操作で音声をアンロック
- タブ切替・フォーカス喪失時に自動ポーズ
- visualViewport、safe-area、100dvh対応

## BGM

`assets/audio/bgm/mahou-no-cooking.mp3`

MusMus「魔法のクッキング」 / watson

著作権表示は `CREDITS.md` に記載しています。

GitHub上でも `assets/audio/bgm/` が見えるように、同フォルダへ `README.txt` を配置しています。

## GitHub Pages

`main` ブランチの `/(root)` をGitHub Pagesの公開元に設定してください。
