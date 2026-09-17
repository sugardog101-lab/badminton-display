【Cloudflare移行手順】

1. Cloudflare Workers & Pages を開く
2. Create application → Workers → Create Worker
3. worker.js の内容を貼り付けて保存・デプロイ
4. Settings → Variables → KV Namespace Bindings で
   変数名 BADMINTON_STATE にKVを接続
5. KV Namespaceを新規作成し、Binding名を BADMINTON_STATE にする
6. WorkerのURLを確認する
7. index.html内の
   fetch('/api?action=save' / fetch('/api?action=get'
   を、同じWorkerのURL + '/api?action=save' などに変更

【重要】
Cloudflare Pagesでindex.htmlを公開する場合、Workerと同一ドメイン配下に
/apiをプロキシする構成が必要です。最も簡単なのは、Worker側で画面も配信する
構成にする方法です。現ファイルは画面部分の移行用です。
