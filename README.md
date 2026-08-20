# ぷにぷにエアホッケー

スマホ1台を横向きにして2人で遊べる、GitHub Pages向けの対戦エアホッケーゲームです。PCではWASDと矢印キーで2人対戦できます。

## 現在の完成版仕様

- iPhone / iPad / Android のマルチタッチ対応
- Windows / Mac の Chrome / Edge / Firefox / Safari を想定
- PLAYER 1: 左側タッチ または WASD
- PLAYER 2: 右側タッチ または 矢印キー
- Pointer Events + pointerId による同時入力分離
- 120Hz固定タイムステップの物理計算
- マレットは指へ瞬間移動せず、バネ＋減衰で追従
- マレット・パックそれぞれに質量、速度、反発、摩擦を設定
- 正面強打、かすり当たり、通常打撃を判定して挙動とSEを変更
- 壁反射は入射角と速度に応じて反射感を変更
- 中央でマレット同士が接触すると物理的に押し返し合う
- 高速パックは残像・発光・回転ハイライトを強化
- ぷにキャラは衝突方向と衝撃量に応じて潰れ、揺り返して滑らかに復元
- ゴール時の画面シェイク、フラッシュ、パーティクル、ヒットストップ風演出
- 強打とゴール時はBGMを一瞬下げてSEを前に出すダッキング
- BGM/SE ON-OFF保存
- 実BGM: MusMus「魔法のクッキング」
- iOSの自動再生制限に合わせ、START操作で音声をアンロック
- タブ切替・フォーカス喪失時に自動ポーズ
- 画面回転、visualViewport、safe-area、100dvh対応

## BGM

`assets/audio/bgm/mahou-no-cooking.mp3`

MusMus「魔法のクッキング」 / watson

著作権表示は `CREDITS.md` に記載しています。

## GitHub Pages

`main` ブランチの `/(root)` をGitHub Pagesの公開元に設定してください。
