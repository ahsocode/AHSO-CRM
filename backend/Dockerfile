# Pull rclone binary for the backup/restore feature
FROM rclone/rclone:latest AS rclone-src

# Stage 1: system packages + chromium (changes rarely → stable cache layer)
# alpine3.21 = latest patch; apk upgrade applies any remaining CVE fixes
FROM node:20-alpine3.21 AS base
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
RUN apk upgrade --no-cache && \
  apk add --no-cache \
  openssl \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  font-noto \
  font-noto-extra \
  weasyprint \
  postgresql16-client

# Stage 2: install node_modules (invalidated only when package-lock.json changes)
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 3: build (invalidated when source files change)
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# Stage 4: production runner (copies only compiled output, no dev deps)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# Must copy node_modules from builder (not deps) because prisma generate
# runs in builder and writes the generated client into node_modules/@prisma/client
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# rclone for backup listing/restore; PostgreSQL client is installed in base.
COPY --from=rclone-src /usr/local/bin/rclone /usr/local/bin/rclone
RUN mkdir -p uploads
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
