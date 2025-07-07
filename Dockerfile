# Node.js の公式軽量イメージ
FROM node:20-alpine

# 作業ディレクトリ
WORKDIR /app

# package.json と lock をコピー
COPY package*.json ./

# 依存をインストール
RUN npm install

# ソースを全部コピー
COPY . .

# ポート公開
EXPOSE 3000

# 開発サーバー起動
CMD ["npm", "run", "dev"]