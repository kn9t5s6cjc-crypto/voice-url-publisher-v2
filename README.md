# VOICE URL Publisher v2

イベント参加者が静的WebサイトのZIPをアップロードし、共有URLを発行するツールです。

## 対応
- HTML / CSS / JavaScript の静的サイト
- Windowsで作成したZIP
- macOS Finderで作成したZIP
- `__MACOSX`, `.DS_Store`, `._*` を自動除外
- ZIP内のトップフォルダを自動判定し `index.html` を検出
- 20MBまでのZIP、300ファイルまで

## Cloudflare構成
Cloudflare Workers + R2 を使用します。公開サイト本体はR2に保存します。

### 初回セットアップ
1. Cloudflareアカウントを作成
2. R2で `voice-published-sites` バケットを作成
3. GitHubリポジトリをCloudflare Workersに接続
4. Build command: `npm install`
5. Deploy command: `npx wrangler deploy`

`wrangler.jsonc` のR2 binding `SITES` が `voice-published-sites` を参照します。

## ローカル
```bash
npm install
npx wrangler dev
```
