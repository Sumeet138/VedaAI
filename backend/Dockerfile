# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace manifests first (layer cache)
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Install all workspace deps (skip Puppeteer browser download — using system Chromium in runner)
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm ci

# Copy source
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build shared types then backend
RUN npm run build --workspace=@vedaai/shared || true
RUN npm run build --workspace=@vedaai/backend

# ── Stage 2: Production ───────────────────────────────────────
FROM node:20-slim AS runner

# Chromium deps for Puppeteer PDF export
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-freefont-ttf \
    fonts-noto-color-emoji \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnss3 \
    libpango-1.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy workspace manifests + install prod deps only
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
RUN PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm ci --omit=dev

# Copy compiled output
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/src ./shared/src

# Cloud Run sets PORT env var; app reads it via env.ts
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "backend/dist/index.js"]
