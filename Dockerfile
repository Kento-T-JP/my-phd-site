# Node.js の公式軽量イメージ
FROM node:20-alpine

# 作業ディレクトリ
WORKDIR /app

# package.json と lock をコピー
COPY package*.json ./

# 依存をインストール
RUN npm install

# Prisma CLI をグローバルにインストール
RUN npm install -g prisma

# Prisma スキーマをコピー
COPY prisma ./prisma

# Prisma Client を生成
RUN prisma generate

# ソースを全部コピー
COPY . .

# ポート公開
EXPOSE 3000

# 開発サーバー起動
CMD ["sh", "-c", "prisma migrate deploy && npm run dev"]
