# Start XI

Start XI は、サッカーのフォーメーション作成・選手管理・大会/ロスター管理を行う Web アプリです。  
本番環境は Vercel、DB は Neon (PostgreSQL) を利用します。

## 現在の実装状況（2026-02 更新）

- フォーメーション作成/保存/更新/再表示
- ベンチ / Off Bench の順序入れ替え（保存・共有画面で順序維持）
- ベンチ人数設定（保存・共有対応、上限15）
- Off Bench フィルター（名前/ポジション/人数）と保存反映
- ポジション管理（デフォルト表示 + ユーザー追加/削除）
- 選手の新規登録・編集・削除（複数削除含む）
- 選手一覧/フォーメーションの「お気に入りのみ」フィルター
- 共有リンク（3日有効）でフォーメーション公開・取り込み
- 共有リンクのコピー操作（明示ボタンでコピー）
- JFA URL 取り込み / Excel (`.xlsx`) 取り込み
- 大会/ロスター管理（ユーザースコープ）
- NextAuth 認証（Google / Credentials）
- 管理者画面（Users/Inquiries/Formations/Rosters/Stats）
- お問い合わせフォーム（Gmail + Resend）
- reCAPTCHA 対応
- Vercel Analytics / Speed Insights

## 最近の主な変更（整理版）

### フォーメーション体験

- Bench / Off Bench の並び順を編集可能にし、保存・共有・取り込みで順序を維持
- ベンチ人数（上限15）を保存対象にし、共有先にも反映
- Off Bench フィルター（名前/ポジション/人数）を追加し、`offBenchSize` として保存・復元
- フォーメーション操作（テンプレ切替・Reset・保存系）を上部に集約し、スクロール負荷を削減
- PLAYER/OFF BENCH フィルターを折りたたみ化（開閉アニメーション付き）
- ドロップダウンのクリッピング問題を解消（ロスター/ポジション選択が末尾まで表示）

### フィルターUI

- フォーメーション画面のメインフィルターを4条件（Name / Roster / Position / Favorite）で整理
- 選手一覧にも「お気に入りのみ」フィルターを追加
- ロスター名・大会名の長文表示を省略せず折り返し表示
- ポジション候補は文脈別に動的表示
  - メインフィルター: 現在選手が持つポジション
  - Off Benchフィルター: Off Bench選手が持つポジション

### 共有リンク

- 共有リンクは3日有効、未ログイン閲覧可、ログイン後取り込み可
- 共有リンク作成後に URL 表示カードと「コピー」ボタンを追加
  - クリック/タップ時のみコピー（自動コピーなし）
  - コピー成功メッセージをカード内に表示
- 共有ページの「このフォーメーションを取り込む」を上部へ再配置（モバイル最適化）

### データ整合性・安定性

- 日付処理を UTC ベース共通ユーティリティへ統一
- フォーメーション `nodes` の取得順を `id asc` で固定
- CSRF検証で `next-auth` の複数Cookie名を許容
- 削除ポリシーを明確化（選手は論理削除 + Cron物理削除、大会/ロースター/フォーメーションは物理削除）

### パフォーマンス

- `/api/players` の返却項目を用途別最適化（`includeRosterLinks` / `includeExtra` / `includeImage`）
- Formations/Home の初期表示で不要データ取得を削減
- ロスター/大会系APIにユーザー単位キャッシュ（`revalidate: 60`）を導入
- 複数ロスター紐付けを一括INSERT化して書き込みを高速化

### 管理・運用

- 管理画面UIを統一し、モバイルはカード表示・PCはテーブル表示
- Quick Actions から大会/ロスター管理へ遷移可能
- ポジション管理（`/positions`）をユーザー単位で実装
  - デフォルト表示・削除不可
  - カスタム追加/削除可
- ポジション表記を `LB/RB` から `LSB/RSB` に整理（旧入力は互換変換）
- SEO基盤（metadata/OG/Twitter/robots/sitemap）を整備

## ルーティング / アクセス制御

- `src/proxy.ts` でアクセス制御とセキュリティヘッダを適用
- `/admin` / `/api/admin` は管理者のみ
- `userStatus` ベースのアクセス制御
- 任意の gate 制御（`GATE_ENABLED`）
- `/share/*` は未ログイン閲覧を許可（取り込みはログイン必須）
- `/api/cron/*` は `CRON_SECRET` 認証で実行

## 技術スタック

### コア

- Next.js 16.1.6（App Router） / React 19 / TypeScript
- Tailwind CSS 4
- Prisma / PostgreSQL（Neon）
- NextAuth（Google / Credentials）

### 主要ライブラリ

- Zod（入力バリデーション）
- Framer Motion（アニメーション）
- Cheerio / Axios（JFAページ解析・取得）
- React Hook Form（フォーム処理）
- Nodemailer / Resend（問い合わせ通知）
- `@vercel/analytics` / `@vercel/speed-insights`（計測）

### インフラ・運用

- Vercel（本番ホスティング）
- Neon PostgreSQL（本番DB）
- Vercel Cron
  - `/api/cron/cleanup-formation-shares`
  - `/api/cron/cleanup-deleted-players`
- Docker Compose（ローカル統合開発）

### 開発ツール

- Prisma Migrate / Prisma Client
  - 開発: `prisma migrate dev`
  - 本番: `prisma migrate deploy`
- Vitest / Testing Library（ユニット・UIテスト）
- ESLint（`next lint`）
- TSX（seed / スクリプト実行）

## ローカルセットアップ

```bash
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

## Docker 開発

`.env.local` を作成・更新してから起動します。

```bash
docker compose up --build
```

`app` は `.env.local` を読み込み、起動時に `prisma migrate deploy` と `prisma db seed` を実行します。

## 主要コマンド

- `npm run dev`: 開発サーバー
- `npm run build`: 本番ビルド（`prebuild` で `prisma generate`）
- `npm run test`: テスト
- `npm run migrate`: `prisma migrate dev`
- `npm run deploy:migrate`: `prisma migrate deploy`
- `npm run seed`: `tsx prisma/seed.ts`
- `node scripts/db-perf-benchmark.mjs`: DB性能ベンチマーク

## 性能計測（DBベンチ）

`/scripts/db-perf-benchmark.mjs` は以下を計測します。

- players list（リンク情報あり/なし）
- paged filtered query（リンク情報あり/なし）
- rosters list
- unique visitors 集計（旧/新クエリ）
- `EXPLAIN ANALYZE`

最新の計測方針は `docs/db-perf-phase2-plan.md` に記載しています。

## 必須環境変数（最小）

- `DATABASE_URL`
- `DIRECT_URL`（Prisma migrate/restore時に unpooled 接続を使う場合）
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## 主な追加環境変数（機能別）

- 認証/SSO
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
- CAPTCHA
  - `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
  - `RECAPTCHA_SECRET`
- 問い合わせ送信
  - `GMAIL_USER`
  - `GMAIL_APP_PASSWORD`
  - `RESEND_API_KEY`
  - `CONTACT_RECIPIENT`
  - `CONFIRM_FROM_ADDRESS`
- gate制御
  - `GATE_ENABLED`
  - `GATE_ALLOWED_EMAILS`
- ミドルウェアデバッグログ（任意）
  - `DEBUG_MIDDLEWARE_TOKEN_LOGS`（`true/1/on/yes` で有効）
- Cron（期限切れデータ掃除）
  - `CRON_SECRET`
- Seed/JFA
  - `JFA_MEMBER_URL`
- ポジション管理
  - （追加の環境変数なし）
- SEO/公開URL
  - `NEXT_PUBLIC_SITE_URL`（任意: metadataBase の明示用）
  - `NEXT_PUBLIC_GA_MEASUREMENT_ID`（任意: Google Analytics 4。未指定時は既定IDを利用）

## セキュリティ

- NextAuth によるセッション管理
- `bcrypt` によるパスワードハッシュ保存
- CSRFトークン検証
- Zod による入力検証
- `proxy` で CSP/HSTS/nosniff/X-Frame-Options などを付与
- 問い合わせAPIに簡易レート制限

## 本番デプロイ（Vercel）

1. GitHub リポジトリを Import
2. Environment Variables を設定
3. Build Command を設定

```bash
npx prisma generate && npx prisma migrate deploy && next build
```

4. デプロイ

### Vercel Cron

- `vercel.json` で以下を日次実行
  - `/api/cron/cleanup-formation-shares`
  - `/api/cron/cleanup-deleted-players`
- 両APIは `Authorization: Bearer ${CRON_SECRET}` で保護

## ライセンス

- ソースコード: [MIT](LICENSE)
- ロゴ・画像・文章などコード以外のアセット: 特記なき限り `All rights reserved`
