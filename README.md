# Start XI

Start XI は、サッカーのフォーメーション作成・選手管理・大会/ロスター管理を行う Web アプリです。  
本番環境は Vercel、DB は Neon (PostgreSQL) を利用します。

## 現在の実装状況（2026-02 更新）

- フォーメーション作成/保存/更新/再表示
- 選手の新規登録・編集・削除（複数削除含む）
- 共有リンク（3日有効）でフォーメーション公開・取り込み
- JFA URL 取り込み / Excel (`.xlsx`) 取り込み
- 大会/ロスター管理（ユーザースコープ）
- NextAuth 認証（Google / Credentials）
- 管理者画面（Users/Inquiries/Formations/Rosters/Stats）
- お問い合わせフォーム（Gmail + Resend）
- reCAPTCHA 対応
- Vercel Analytics / Speed Insights

## 最近の主な変更

### 1. 読み込み性能の最適化

- `/api/players` のレスポンスを用途別に最適化
  - `includeRosterLinks=1` のときのみ `rosterPlayers` を返却
  - `includeExtra` / `includeImage` で返却項目を制御
- `Formation` 側は必要データのみ取得（`includeRosterLinks=1&includeExtra=0`）
- `/home` 初期表示で全選手取得を避け、存在確認ベースの軽量判定へ変更
- ロスター/大会系API（`/api/rosters`, `/api/tournaments`, `/api/rosters/titles`, `/api/tournaments/names`）に
  ユーザー単位キャッシュ（`revalidate: 60`）を導入
- 選手/管理者操作後に関連タグを再検証して、表示更新の整合性を維持

### 2. 書き込み性能の最適化（新規登録・編集）

- 複数ロスター紐付けを一括INSERT化
  - `addRosterPlayers` が複数 `rosterId` を受け取り可能
  - `POST /api/players` と `PUT /api/players/[id]` で、ループ呼び出しを集約

### 3. 管理画面のUI改善 + モバイル対応

- 管理画面レイアウトを共通トーンに統一
- `AdminNav` を横スクロール対応のナビへ改善
- `Users/Inquiries/Formations/Rosters` は
  - `md` 未満: カード表示
  - `md` 以上: テーブル表示

### 4. CSRF検証の安定化

- `verifyCsrfToken` が `next-auth` の複数Cookie名を許容
  - `__Host-next-auth.csrf-token`
  - `__Secure-next-auth.csrf-token`
  - `next-auth.csrf-token`
- Chrome環境で発生していた登録時CSRF不一致を解消

### 5. 本番DBリージョン最適化（Singapore → US East）

- Vercel実行リージョン（`iad1`）に合わせて Neon DB を US East へ移行
- アプリサーバーとDB間の往復レイテンシが短縮され、TTFB体感が大幅に改善
- Home / Formations / 各種一覧ページの初回ロード時間を実運用で短縮

### 6. JFA取り込みURL対応の拡張

- `samuraiblue` 配下の多階層 `member.html` URL に対応
  - 例: `https://www.jfa.jp/samuraiblue/worldcup_2026/final_q_2026/20250320/member.html`
- 深いURLからの大会slug抽出ロジックを改善し、既存URL形式との互換性も維持

### 7. SEO基盤の整備

- App Router の metadata を拡張
  - `metadataBase` / canonical / Open Graph / Twitter Card / robots
- `robots.txt` と `sitemap.xml` を実装
  - 公開ページをクロール対象にし、認証必須ページは `noindex` を適用
- Search Console のドメイン認証・サイトマップ送信を前提に運用可能な状態へ更新

### 8. アイコン設定の更新

- ヘッダーのブランド表示に `public/emblem.svg` を利用
- ブラウザタブのファビコンとして `src/app/favicon.ico` を利用
  - `layout.tsx` の icon 参照を `/favicon.ico` に統一

### 9. 共有リンク機能（3日有効）

- フォーメーション共有リンクを発行し、未ログインでも閲覧可能
- ログイン後に取り込み可能（同名選手は既存を再利用）
- 取り込み時はフォーメーション名の重複を自動調整
- 共有データには選手配置に加えて大会/ロースター紐付けも含めて復元

### 10. 削除ポリシーの明確化

- 選手削除はハイブリッド方式
  - 即時: 論理削除（`isDeleted=true`, `deletedAt` 記録）
  - 後続: Cron で30日経過分を物理削除（関連 `RosterPlayer` / `FavoritePlayer` / `FormationNode` も整理）
- 大会・ロースター・フォーメーションは物理削除
- 危険操作（削除）は確認ダイアログを表示

### 11. Quick Actions: 大会・ロースター管理

- `Quick Actions` から `/tournaments` へ遷移
- 大会追加（必須: 大会名）
- ロースター追加（必須: 大会名 / 任意: ロースター名・日付）
- 大会削除・ロースター削除をユーザースコープで実行可能

## ルーティング / アクセス制御

- `src/proxy.ts` でアクセス制御とセキュリティヘッダを適用
- `/admin` / `/api/admin` は管理者のみ
- `userStatus` ベースのアクセス制御
- 任意の gate 制御（`GATE_ENABLED`）
- `/share/*` は未ログイン閲覧を許可（取り込みはログイン必須）
- `/api/cron/*` は `CRON_SECRET` 認証で実行

## 技術スタック

- Next.js 16.1.6 / React 19 / TypeScript
- Tailwind CSS 4
- Prisma / PostgreSQL (Neon)
- NextAuth
- Vitest / Testing Library
- Docker Compose
- Vercel

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
- Cron（期限切れデータ掃除）
  - `CRON_SECRET`
- Seed/JFA
  - `JFA_MEMBER_URL`
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
