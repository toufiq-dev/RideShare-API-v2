# Build stage
FROM node:22-alpine AS builder

RUN npm i -g pnpm

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm prisma generate
RUN pnpm run build

CMD ["node", "dist/src/main"]