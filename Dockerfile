# Multi-stage Dockerfile for production optimization
FROM node:24-alpine AS base

# Install pnpm and create app user
RUN npm i -g pnpm && addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Install PostgreSQL client tools
RUN apk add --no-cache postgresql-client

WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml ./

# Install dependencies
FROM base AS deps
RUN pnpm install --frozen-lockfile --prod

# Build stage
FROM base AS builder
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma generate
RUN pnpm run build

# Production stage
FROM node:24-alpine AS production

# Install pnpm and create app user
RUN npm i -g pnpm && addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Install PostgreSQL client tools
RUN apk add --no-cache postgresql-client

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/static ./static
COPY --from=builder --chown=nestjs:nodejs /app/artifacts ./artifacts

# Create required directories with proper permissions BEFORE switching to nestjs user
RUN mkdir -p /app/logs /app/uploads/temp && chown -R nestjs:nodejs /app/logs /app/uploads

# Switch to non-root user
USER nestjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/src/main"]