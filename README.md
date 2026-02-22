# Start XI

Start XI は、サッカーのフォーメーション作成・選手管理・大会/ロースター管理を一体化した Web アプリです。  
本番運用は Vercel + Neon (PostgreSQL) を想定しています。

## 何ができるか

- フォーメーション作成・保存・共有・取り込み
- 選手の登録/編集/削除、JFA URL / Excel 取り込み
- 大会・ロースター管理とフィルター連携
- お気に入り選手管理
- 管理者向けの運用画面（ユーザー、問い合わせ、統計、フォーメーション、ロースター）

## このアプリの工夫点（設計・実装）

### 1. 体験設計（UI/UX）

- Bench / Off Bench の並べ替えを保存対象にし、再表示・共有先でも順序を維持
- Bench size / Off bench size を保存し、編集と閲覧の差分を最小化（Bench 上限 15）
- Off Bench 専用フィルター（名前・ポジション・人数）を搭載
- フィルターUIを折りたたみ化し、モバイルでも作業領域を確保
- 共有リンクは「ボタン押下時のみコピー」で誤操作を回避
- 共有ページの導線（取り込み操作）を上部に配置して操作負荷を軽減
- ロングテキスト（大会名/ロースター名）は読める表示を優先

### 2. データ整合性

- ポジションを「デフォルト（削除不可）」と「ユーザー追加（削除可）」で分離管理
- カスタムポジション削除時に `Player.position` と `RosterPlayer.position` を連動更新
- 共有取り込み時、選手名正規化により重複作成を抑制
- 共有取り込み時、既存大会・ロースターを upsert で再利用して重複を抑制
- フォーメーション `nodes` の読み順を固定（`id asc`）
- 日付処理をユーティリティ化し、表示・保存のブレを抑制

### 3. パフォーマンス

- `/home` 初期処理を並列化し、初回描画までの待機を短縮
- セッション `user.id` を数値IDに安定化し、遅いフォールバック経路を削減
- JWT の `userStatus` 再検証を間引き（`USER_STATUS_REVALIDATE_MS`, 既定5分）
- `/api/players` の返却項目を用途別最適化（不要データ取得を削減）
- 複数ロースター紐付けを一括 INSERT 化し、書き込み効率を改善
- パフォーマンス計測ログは環境変数で明示的に有効化（通常OFF）

### 4. セキュリティ

- NextAuth による JWT セッション管理（Google / Credentials）
- 管理者ログイン比較に `timingSafeEqual` を使用し、比較漏洩リスクを低減
- パスワードは `bcrypt` ハッシュで保存
- 新規登録はメール認証必須（24時間有効トークン）
- 利用規約・プライバシーポリシー同意を必須化し、同意時刻/版を保存
- API入力は Zod で検証（不正入力を早期遮断）
- CSRF 検証を実施（`next-auth` の複数Cookie名にも対応）
- 問い合わせAPIにレート制限（10分あたり5回/IP）
- 問い合わせAPIに honeypot + reCAPTCHA/Turnstile 検証
- メール本文は `escape-html` でエスケープし、表示注入リスクを低減
- `proxy` でセキュリティヘッダを一括付与
  - CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- `/admin` / `/api/admin/*` は管理者のみ
- Gate制御（`GATE_ENABLED`）で許可メールの段階的アクセス制御
- ユーザーステータス（pending等）に応じたアクセス制限
- Cron API は `Authorization: Bearer CRON_SECRET` で保護
- 共有リンクはランダムトークン + 有効期限（3日）+ payload スキーマ検証

### 5. 運用性・再現性

- `prisma.config.ts` 運用へ移行済み（Prisma非推奨設定への先回り対応）
- マイグレーションは `prisma migrate deploy` 前提で本番適用可能
- Docker Compose でアプリ+DBを再現できるローカル環境
- 起動時に migrate/seed を実行し、初期化を標準化
- Vercel Cron で期限切れ共有リンク・論理削除選手を自動クリーンアップ
- Vitest + Testing Library による回帰テスト整備

## 主要機能（現状）

### フォーメーション

- 保存・更新・再読み込み
- Bench / Off Bench の順序編集と保存
- Bench / Off Bench 人数設定の保存
- 共有リンク作成・閲覧・取り込み

### 選手・大会・ロースター

- 選手の新規登録/編集/削除（複数削除対応）
- JFA URL 取り込み、Excel (`.xlsx`) 取り込み
- 大会・ロースターのユーザースコープ管理
- お気に入りフィルター

### ポジション管理

- デフォルトポジション表示（削除不可）
- カスタムポジション追加/削除
- 表記統一（`LSB` / `RSB`）

### 問い合わせ・法務

- 問い合わせ受付 + 自動返信
- 新規登録確認メール
- メールテンプレート（日本語 + 英語）
- `/terms`・`/privacy`・同意情報の保存/管理

## 技術スタック

### コア

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4

### データ・認証

- Prisma
- PostgreSQL（Neon）
- NextAuth（Google / Credentials）

### 主要ライブラリ

- Zod
- Framer Motion
- React Hook Form
- Axios / Cheerio
- Nodemailer / Resend
- `@vercel/analytics` / `@vercel/speed-insights`

### 開発

- Vitest + Testing Library
- ESLint
- Docker Compose

## ディレクトリ

- `src/app`: ページ・API
- `src/components`: UI
- `src/lib`: 認証、DB、共通ロジック
- `prisma`: schema/migrations/seed
- `tests`: テスト
- `scripts`: ベンチ/補助スクリプト

## ローカルセットアップ

```bash
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

## Docker セットアップ

`.env.local` を用意して実行:

```bash
docker compose up --build
```

## テスト / ビルド

```bash
npm test
npm run build
```

## 主要コマンド

- `npm run dev`
- `npm run test`
- `npm run build`
- `npm run migrate`
- `npm run deploy:migrate`
- `npm run seed`
- `node scripts/db-perf-benchmark.mjs`

## 環境変数

### 必須（最小）

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

### 認証 / SSO

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_DEBUG`（任意、通常 `false`）

### CAPTCHA

- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
- `RECAPTCHA_SECRET`
- `TURNSTILE_SECRET_KEY`（任意）

### メール

- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `CONTACT_RECIPIENT`
- `RESEND_API_KEY`
- `CONFIRM_FROM_ADDRESS`

### アクセス制御（任意）

- `GATE_ENABLED`
- `GATE_ALLOWED_EMAILS`

### 性能/デバッグ（任意）

- `USER_STATUS_REVALIDATE_MS`（ms, 既定 `300000`）
- `DEBUG_HOME_PERF`
- `DEBUG_API_PERF`
- `DEBUG_MIDDLEWARE_TOKEN_LOGS`

### Cron / URL

- `CRON_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `JFA_MEMBER_URL`（seed 用）

## データ保持ポリシー

- 選手: 論理削除 → Cron で物理削除
- 共有リンク: 期限切れを Cron で削除
- 大会 / ロースター / フォーメーション: 削除時は物理削除

## デプロイ（Vercel）

1. GitHub リポジトリを Import
2. 環境変数を設定
3. Build Command を設定

```bash
npx prisma generate && npx prisma migrate deploy && next build
```

4. Deploy

### Vercel Cron

`vercel.json` で以下を日次実行:

- `/api/cron/cleanup-formation-shares`（`0 3 * * *`）
- `/api/cron/cleanup-deleted-players`（`15 3 * * *`）

## 補足

- Prisma は `prisma.config.ts` へ移行済み
- Prisma 7 へのメジャーアップデートは別途検証推奨

## ライセンス

- ソースコード: [MIT](LICENSE)
- ロゴ・画像・文章などコード以外のアセット: 特記なき限り All rights reserved
