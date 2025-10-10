# syntax=docker/dockerfile:1.4
FROM node:22-alpine AS deps
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install dependencies with optimizations
RUN --mount=type=cache,target=/root/.npm \
    npm install --only=production --prefer-offline --no-audit && \
    npm cache clean --force

FROM node:22-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install all dependencies (including dev dependencies)
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefer-offline --no-audit

# Copy source code
COPY . .

FROM node:22-alpine AS runner
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache dumb-init curl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S torbox -u 1001 -G nodejs

# Copy built application
COPY --from=deps --chown=torbox:nodejs /app/node_modules ./node_modules
COPY --chown=torbox:nodejs . .

# Create necessary directories with proper permissions
RUN mkdir -p data logs && \
    chown -R torbox:nodejs data logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Expose port
EXPOSE 3001

# Switch to non-root user
USER torbox

# Health check (optional)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/index.js"]
