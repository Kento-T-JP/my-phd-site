FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache bash
RUN npm ci --legacy-peer-deps

COPY prisma ./prisma
RUN npx prisma generate

COPY wait-for-it.sh ./wait-for-it.sh
RUN chmod +x wait-for-it.sh

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "./wait-for-it.sh db:5432 -- npm run dev"]