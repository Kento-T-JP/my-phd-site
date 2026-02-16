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

`.env.local` を作成・更新してから起動します。

```bash
docker compose up --build
```

`app` は `docker-compose.yml` の `env_file` で `.env.local` を読み込みます。  
起動時に `prisma migrate deploy` と `prisma db seed` が実行されます。

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

- 認証: NextAuth（Credentials / Google OAuth）でセッション管理
- パスワード: `bcrypt` でハッシュ化して保存（平文保存しない）
- Bot対策: reCAPTCHA（ログイン / 登録 / 問い合わせ）
- CSRF対策: 主要POST APIで `X-CSRF-Token` を検証
- 入力検証: Zod スキーマでサーバー側バリデーション
- ヘッダー対策: CSP / HSTS / X-Frame-Options / nosniff を middleware で付与
- 問い合わせAPIに簡易レート制限（IP単位）
- 運用面: `.env` / `.env.local` は Git 管理しない（秘密情報は Vercel の Environment Variables で管理）

## 軽量化と性能の現状

- 不要な毎回 seed を避け、デプロイ時の処理負荷を抑制
- 一部の重い処理はバッチ化・トランザクション見直しでタイムアウトを低減
- モバイルでは描画演出を弱め、体感速度を改善
- Vercel Analytics / Speed Insights で実測を継続

重要:
- 現状の主要ボトルネックは DB アクセスです。
- Neon(PostgreSQL) との往復遅延（リージョン差）や、書き込みが多い処理（登録・削除・インポート）で待ち時間が出やすい構成です。

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

- ソースコードは [MIT](LICENSE) ライセンスです。
- ロゴ・画像・文章などコード以外のアセットは、特記がない限り `All rights reserved` です。
