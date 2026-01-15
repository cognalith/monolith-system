# ============================================
# MONOLITH OS - Production Dockerfile
# Multi-stage build for optimized production image
# ============================================

# ============================================
# Stage 1: Builder
# ============================================
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY agents/package*.json ./agents/
COPY dashboard/package*.json ./dashboard/

# Install root dependencies if any
RUN if [ -f package.json ]; then npm ci --only=production 2>/dev/null || true; fi

# Install agents dependencies
WORKDIR /app/agents
RUN npm ci --only=production

# Install dashboard dependencies (including dev deps for build)
WORKDIR /app/dashboard
RUN npm ci

# Copy source code
WORKDIR /app
COPY . .

# Build dashboard for production
WORKDIR /app/dashboard
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS production

# Install Playwright dependencies and chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init

# Set Playwright to use installed chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create non-root user for security
RUN addgroup -g 1001 -S monolith && \
    adduser -S monolith -u 1001 -G monolith

WORKDIR /app

# Copy agents with production dependencies
COPY --from=builder /app/agents ./agents

# Copy dashboard server and built assets
COPY --from=builder /app/dashboard/package*.json ./dashboard/
COPY --from=builder /app/dashboard/node_modules ./dashboard/node_modules
COPY --from=builder /app/dashboard/dist ./dashboard/dist
COPY --from=builder /app/dashboard/src/server.js ./dashboard/src/server.js
COPY --from=builder /app/dashboard/src/api ./dashboard/src/api
COPY --from=builder /app/dashboard/src/notifications.js ./dashboard/src/notifications.js
COPY --from=builder /app/dashboard/src/middleware ./dashboard/src/middleware
COPY --from=builder /app/dashboard/src/security ./dashboard/src/security
COPY --from=builder /app/dashboard/src/auth ./dashboard/src/auth
COPY --from=builder /app/dashboard/src/config ./dashboard/src/config
# Copy task JSON data files (required for API)
COPY --from=builder /app/dashboard/src/data ./dashboard/src/data

# Create logs directory
RUN mkdir -p /app/logs && chown -R monolith:monolith /app

# Switch to non-root user
USER monolith

# Set working directory for the server
WORKDIR /app/dashboard/src

# Expose dashboard port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command: run dashboard server
CMD ["node", "server.js"]
