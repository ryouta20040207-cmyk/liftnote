# LiftNote

iPhoneで使いやすい筋トレ記録メモアプリです。静的ファイルだけで動くので、GitHub Pages、Netlify、Vercelなどに置くとWi-FiやLTEを問わず使えます。

## 使い方

1. 公開されたHTTPSのURLをiPhoneのSafariで開く
2. 共有ボタンから「ホーム画面に追加」を選ぶ
3. ジムではホーム画面のLiftNoteから起動する

記録はiPhone内のブラウザ保存に残ります。外部サーバーには送信しません。

## 公開方法

GitHub Pagesを使う場合は、このリポジトリをGitHubにpushして、リポジトリ設定のPagesでGitHub Actionsを有効にします。`.github/workflows/pages.yml` が公開処理を行います。
