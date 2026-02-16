# Start XI

Start XI は、サッカーのフォーメーション作成・選手管理・大会/ロスター管理を行う Web アプリです。  
本番環境は Vercel、DB は Neon(PostgreSQL) を使用します。

## 現在の状態（2026-02 時点）

- フォーメーション作成/保存/編集
- 選手の新規登録・編集・削除（複数削除含む）
- JFA メンバー URL からのインポート
- Excel (`.xlsx`) からの選手インポート
- 大会/ロスター管理（ユーザースコープ運用）
- NextAuth 認証（Google / Credentials）
- お問い合わせフォーム（Gmail + Resend）
- reCAPTCHA 対応
- Vercel Analytics 導入済み
- Vercel Speed Insights 導入済み

## 技術スタック

- Next.js 16.1.6 / React 19 / TypeScript
- Tailwind CSS 4
- Prisma / PostgreSQL (Neon)
- NextAuth
- Vitest / Testing Library
- Vercel

## セットアップ（ローカル）

```bash
npm install
cp .env.example .env
```

`.env` を設定後:

```bash
npm run migrate
npm run seed
npm run dev
```

## Docker 開発

```bash
docker compose up --build
```

`app` 起動時に `prisma migrate deploy` と `prisma db seed` が実行されます。

## 主要コマンド

- `npm run dev`: 開発サーバー
- `npm run build`: 本番ビルド（`prebuild: prisma generate` 実行）
- `npm run test`: テスト
- `npm run migrate`: `prisma migrate dev`
- `npm run deploy:migrate`: `prisma migrate deploy`
- `npm run seed`: 初期データ投入

## Seed の現在仕様

- `ADMIN_EMAIL` / `ADMIN_PASSWORD` を `upsert` して管理者を用意
- `player` テーブルが空のときのみ、`JFA_MEMBER_URL` から選手を取り込み
- 取り込み時は大会/ロスターも作成して紐づけ

注意:
- 既に選手データが存在する場合は `Players already exist, skipping seed.` になります。

## 本番デプロイ（Vercel）

1. GitHub リポジトリを Import
2. Environment Variables を登録（特に `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`）
3. Build Command を設定

```bash
npx prisma generate && npx prisma migrate deploy && next build
```

4. デプロイ

補足:
- `seed` は毎デプロイで自動実行しない運用を推奨（必要時のみ手動）
- Prisma migrate は pooler ではなく direct URL を使う運用が安全です

## 必須環境変数（最小）

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `JFA_MEMBER_URL`（seed / JFA import を使う場合）

## セキュリティ

- `.env` は Git 管理しない
- APIキー/秘密情報を README に記載しない
- 本番のシークレットは十分長いランダム値を使用
- 認証・メール・Captcha 設定は本番ドメインで再確認

## 今後の改善方針

今後は以下を重点的に進めます。

1. 不具合修正と安定化
- 本番ログベースで再発しやすいエラーを優先修正
- 失敗時メッセージ/リカバリ導線の改善

2. 動作最適化（高速化）
- DBアクセス回数の削減
- 重いAPIのバッチ化・タイムアウト耐性向上
- モバイル環境での描画/体感速度改善

3. デザインと UX の洗練
- 操作導線の整理（登録・削除・インポート周り）
- エラー表示・進捗表示の明確化
- モバイルでの視認性と操作性向上

4. 将来的な拡張
- 対話型 AI の組み込み（例: フォーメーション提案、選手比較補助）
- データ活用機能の強化

## ライセンス

[MIT](LICENSE)
