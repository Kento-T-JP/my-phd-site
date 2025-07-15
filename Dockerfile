# Node.js の公式軽量イメージ
FROM node:20-alpine

# 作業ディレクトリ
WORKDIR /app

# package.json と lock をコピー
COPY package*.json ./

RUN apk add --no-cache bash

# 依存をインストール
RUN npm install

# Prisma CLI をグローバルにインストール
RUN npm install -g prisma ts-node tsx @types/node

# Prisma スキーマをコピー
COPY prisma ./prisma

# Prisma Client を生成
RUN npx prisma generate

COPY wait-for-it.sh ./wait-for-it.sh
RUN chmod +x wait-for-it.sh

# ソースを全部コピー
COPY . .

# ポート公開
EXPOSE 3000

# マイグレーション → シード → 開発サーバーを起動
CMD ["sh", "-c", "./wait-for-it.sh db:5432 -- prisma migrate deploy && prisma db seed && npm run dev"]
