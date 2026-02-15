# Start XI

サッカーのフォーメーション作成・保存・共有を行う Next.js Web アプリです。  
本番は Vercel で運用し、カスタムドメイン `start-xi.com` を利用します。

## 主な機能

- フォーメーション作成（ドラッグ操作）
- 選手データ管理（管理者）
- Google / Credentials 認証（NextAuth）
- お問い合わせフォーム（Gmail + Resend）
- reCAPTCHA / Turnstile によるスパム対策

## 技術スタック

- Framework: Next.js 16.1.6 (App Router), React 19, TypeScript
- Styling: Tailwind CSS 4
- Database / ORM: PostgreSQL, Prisma
- Authentication: NextAuth (`next-auth`)
- Mail: Nodemailer, Resend
- Testing: Vitest, Testing Library
- Hosting: Vercel

## 必要環境

- Node.js 20 以上
- npm
- PostgreSQL

## ローカルセットアップ

```bash
npm install
cp .env.example .env
```

`.env` を設定後、DB を初期化します。

```bash
npm run migrate
npm run seed
npm run dev
```

起動後: [http://localhost:3000](http://localhost:3000)

## 環境変数

`./.env.example` に全項目を定義しています。  
以下は用途別の一覧です。

### 必須（アプリ起動に必要）

- `DATABASE_URL`: PostgreSQL 接続文字列
- `NEXTAUTH_URL`: ローカルは `http://localhost:3000`、本番は本番 URL
- `NEXTAUTH_SECRET`: NextAuth 用シークレット

### 必須（管理者ログイン作成）

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

### 任意（Google ログインを使う場合）

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### 任意（フォームの Bot 対策）

- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
- `RECAPTCHA_SECRET`
- `TURNSTILE_SECRET_KEY`

### 任意（問い合わせメール送信）

- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `CONTACT_RECIPIENT`
- `RESEND_API_KEY`
- `CONFIRM_FROM_ADDRESS`

### 任意（アクセス制限）

- `GATE_ENABLED`
- `GATE_ALLOWED_EMAILS`

### 任意（初期選手データ取り込み）

- `JFA_MEMBER_URL`（例: `https://www.jfa.jp/samuraiblue/member.html`）

## Seed の仕様（重要）

`npm run seed` では以下を実行します。

1. `Player` テーブルが空のときだけ JFA URL から選手を取得して登録
2. `ADMIN_EMAIL` / `ADMIN_PASSWORD` があれば管理者ユーザーを upsert

つまり、既に選手データがある場合は JFA 取り込みはスキップされます。

### Seed の自動実行について

- `docker compose up --build` のとき: 自動実行される（`prisma db seed` を実行）
- ローカルで `npm run dev` のとき: 自動実行されない（手動で `npm run seed` が必要）
- Vercel デプロイ時: 自動実行されない（手動で seed 実行が必要）

本番初回のみ、DB マイグレーション後に `npm run seed` を1回実行します。  
2回目以降は `Player` が既に存在するため、JFA 取り込みはスキップされます。

## npm スクリプト

- `npm run dev`: 開発サーバー
- `npm run build`: 本番ビルド
- `npm run start`: 本番起動
- `npm run lint`: ESLint
- `npm run test`: テスト実行
- `npm run migrate`: Prisma migrate dev
- `npm run deploy:migrate`: Prisma migrate deploy
- `npm run seed`: 初期データ投入
- `npm run update:images`: 選手画像更新スクリプト

## Docker で動かす場合

```bash
docker compose up --build
```

- `app` コンテナ起動時に `prisma migrate deploy` と `prisma db seed` を実行
- DB は `postgres:16`

## Vercel 本番デプロイ

1. GitHub リポジトリを Vercel に Import
2. Vercel Project Settings > Environment Variables に `.env` の本番値を登録
3. 本番 DB の `DATABASE_URL` を設定
4. `npm run build` が Docker 開発環境で成功することを確認して push
5. Vercel でデプロイ実行
6. Domain に `start-xi.com` を追加し、DNS を設定
7. 初回のみ、ローカル（またはCI）から本番DBに対して `npm run seed` を実行

### Vercel に設定する代表的な環境変数

- `DATABASE_URL`
- `NEXTAUTH_URL`（例: `https://start-xi.com`）
- `NEXTAUTH_SECRET`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`（使う場合）
- `RESEND_API_KEY`, `CONFIRM_FROM_ADDRESS`（使う場合）
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CONTACT_RECIPIENT`（使う場合）
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET`, `TURNSTILE_SECRET_KEY`（使う場合）

## セキュリティ運用ルール

- `.env` は Git 管理しない（`.env.example` のみ管理）
- API キーやパスワードは README に書かない
- 本番用の `NEXTAUTH_SECRET` は十分長いランダム値を使う
- Gmail は通常パスワードでなく App Password を使う
- 公開前に `npm run build` を通す

## 公開前チェックリスト

- Docker 開発環境で `npm run test` が成功
- Docker 開発環境で `npm run build` が成功
- 必要な環境変数が Vercel に登録済み
- 本番 `DATABASE_URL` が接続可能
- Google OAuth の Callback URL が本番ドメインで登録済み（使う場合）
- Resend で送信ドメイン検証済み（使う場合）
- お問い合わせ送信と認証フローの実機確認済み

### Docker内での検証コマンド

```bash
docker compose build
docker compose run --rm --no-deps app npm test
docker compose run --rm --no-deps app npm run build
```

上記3コマンドが成功してから、Vercelへデプロイする運用を推奨します。

## デプロイ手順

1. 公開前チェックリストを満たしていることを確認する。
2. 最新変更を GitHub に push する。
3. Vercel でデプロイを実行する。
4. 初回本番デプロイ後に、本番DBへ `npm run seed` を1回実行する。
5. 本番環境で管理者ログインと問い合わせフォーム送信を確認する。

## ライセンス

[MIT](LICENSE)
