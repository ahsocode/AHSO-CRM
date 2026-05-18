# Stage 1: install node_modules (invalidated only when package-lock.json changes)
FROM node:22-alpine3.21 AS deps
WORKDIR /app
RUN apk upgrade --no-cache
COPY package*.json ./
RUN npm ci

# Stage 2: build Next.js (invalidated when source files change)
FROM node:22-alpine3.21 AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_APP_NAME="AHSO CRM"
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: minimal runtime — only standalone output, no dev deps
FROM node:22-alpine3.21 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
RUN apk upgrade --no-cache
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
