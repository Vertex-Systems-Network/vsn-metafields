FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

EXPOSE 3000

COPY package.json package-lock.json* ./
COPY prisma ./prisma

RUN npm ci && npm cache clean --force

COPY . .

ENV NODE_ENV=production

RUN npm run build

CMD ["npm", "run", "docker-start"]