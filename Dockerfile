# syntax=docker/dockerfile:1.4
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# Install dependencies for native modules if needed
RUN apk add --no-cache libc6-compat

# Copy package files first for better layer caching
COPY package.json ./

# Install dependencies with optimizations and frozen lockfile
RUN bun install --production --frozen-lockfile --no-cache

FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Install build dependencies
RUN apk add --no-cache libc6-compat

# Copy package files first for better layer caching
COPY package.json ./

# Install all dependencies (including dev dependencies and optional dependencies)
RUN bun install --frozen-lockfile --no-cache

# Copy source code
COPY . .

# Build the application with optimizations
RUN bun run build

FROM node:20-alpine AS runner
WORKDIR /app

# Disable Next.js telemetry in production as well
ENV NEXT_TELEMETRY_DISABLED=1

# Install runtime dependencies
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Set working directory permissions
RUN chown -R nextjs:nodejs /app

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Create necessary directories with proper permissions
RUN mkdir -p .next/cache data logs && \
    chown -R nextjs:nodejs .next data logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Expose port
EXPOSE 3000

# Switch to non-root user
USER nextjs

# Health check with timeout
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]

