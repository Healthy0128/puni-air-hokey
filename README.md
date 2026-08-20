# ぷにぷにエアホッケー

スマホ1台を横向きにして2人で遊ぶ、GitHub Pages向けの静的エアホッケーゲームです。

## Features

- スマホ・タブレット：左右のプレイヤーを2本指で同時操作
- PC：BLUE = WASD / PINK = 矢印キー
- Pointer Eventsによるマルチタッチ入力
- 120Hz固定ステップの専用2D物理演算
- マレットはバネ＋減衰で入力位置へ追従
- 質量・反発係数・摩擦を使ったパック衝突
- 衝突方向と速度に応じた滑らかなぷにぷに変形
- iPhone/Android/Windows/macOSの主要ブラウザを想定
- BGM・SE設定保存

## Audio

BGM: MusMus / watson「魔法のクッキング」

実ファイルは `assets/audio/bgm/mahou-no-cooking.mp3` として同梱します。

## Hosting

GitHub Pagesで `main` / root を公開してください。
