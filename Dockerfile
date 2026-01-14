# Multi-stage Dockerfile for TBM frontend (Next.js application)
# Uses Docker BuildKit syntax for advanced features
# syntax=docker/dockerfile:1.4

# Stage 1: Dependencies - Install production dependencies only
# This stage is optimized for layer caching and smaller final image
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# Install system dependencies required for native Node.js modules
# libc6-compat provides compatibility layer for glibc-based packages
RUN apk add --no-cache libc6-compat

# Copy package files first for better Docker layer caching
# This allows dependency installation to be cached if package.json hasn't changed
COPY package.json ./

# Install only production dependencies to reduce image size
# --frozen-lockfile: Use exact versions from lockfile (ensures reproducible builds)
# --no-cache: Don't cache package metadata (reduces image size)
RUN bun install --production --frozen-lockfile --no-cache

# Stage 2: Builder - Build the Next.js application
# This stage includes all dependencies needed for building
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Set production environment for build
ENV NODE_ENV=production
# Disable Next.js telemetry to prevent data collection during build
ENV NEXT_TELEMETRY_DISABLED=1

# Install build dependencies required for compiling native modules
# Also install nodejs to ensure compatibility with Next.js standalone output
RUN apk add --no-cache libc6-compat nodejs npm

# Enable strict error handling to catch build failures
# This ensures the build fails immediately if any command returns non-zero
SHELL ["/bin/sh", "-e", "-c"]

# Copy package files first for better Docker layer caching
COPY package.json ./

# Install all dependencies including dev dependencies needed for building
# Dev dependencies are required for TypeScript compilation, linting, etc.
RUN bun install --frozen-lockfile --no-cache

# Copy entire source code into builder stage
COPY . .

# Build the Next.js application with production optimizations
# This creates optimized static files and server bundles
# Use node explicitly for the build to ensure compatibility with standalone output
RUN NODE_ENV=production node node_modules/.bin/next build

# Verify that the standalone output was created
# This prevents silent build failures from causing COPY errors later
RUN if [ ! -d ".next/standalone" ]; then \
      echo "ERROR: .next/standalone directory not found after build!"; \
      echo "This usually means the Next.js build failed or standalone output is not configured."; \
      (ls -la .next/ 2>/dev/null || echo ".next directory does not exist"); \
      exit 1; \
    fi

# Verify that server.js exists in standalone output
RUN if [ ! -f ".next/standalone/server.js" ]; then \
      echo "ERROR: server.js not found in .next/standalone!"; \
      echo "Standalone directory contents:"; \
      ls -la .next/standalone/ || echo "Standalone directory is empty or doesn't exist"; \
      exit 1; \
    fi

# Verify that Next.js is present in standalone node_modules
RUN if [ ! -d ".next/standalone/node_modules/next" ]; then \
      echo "ERROR: Next.js not found in standalone node_modules!"; \
      echo "This indicates the standalone build is incomplete."; \
      echo "Standalone node_modules contents:"; \
      ls -la .next/standalone/node_modules/ 2>/dev/null || echo "node_modules directory doesn't exist"; \
      exit 1; \
    fi

# Debug: Show the structure of the standalone output
RUN echo "=== Standalone output structure ===" && \
    ls -la .next/standalone/ && \
    echo "=== Checking for Next.js ===" && \
    ls -la .next/standalone/node_modules/next/ 2>/dev/null | head -10 || echo "Next.js directory not found" && \
    echo "=== Checking server.js ===" && \
    head -20 .next/standalone/server.js || echo "server.js not found"

# Stage 3: Runner - Production runtime image
# Minimal image containing only what's needed to run the application
FROM node:20-alpine AS runner
WORKDIR /app

# Disable Next.js telemetry in production runtime
ENV NEXT_TELEMETRY_DISABLED=1

# Install dumb-init for proper signal handling
# dumb-init ensures signals (SIGTERM, SIGINT) are properly forwarded to the Node.js process
RUN apk add --no-cache dumb-init

# Create non-root user for enhanced security
# Running as non-root user limits potential damage if container is compromised
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Set proper ownership of working directory before copying files
RUN chown -R nextjs:nodejs /app

# Copy built application from builder stage
# --chown: Set ownership to non-root user for security
# .next/standalone: Contains the minimal server bundle (Next.js standalone output)
# Note: The verification step in the builder stage ensures this directory exists
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# .next/static: Contains static assets (JS, CSS, images)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# public: Contains public static files
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Verify that required files exist in the runner stage
# This catches issues before the container starts
RUN if [ ! -f "server.js" ]; then \
      echo "ERROR: server.js not found in runner stage!"; \
      ls -la /app/ || echo "Cannot list /app directory"; \
      exit 1; \
    fi && \
    if [ ! -d "node_modules/next" ]; then \
      echo "ERROR: Next.js not found in node_modules!"; \
      echo "node_modules contents:"; \
      ls -la node_modules/ 2>/dev/null | head -20 || echo "node_modules directory doesn't exist or is empty"; \
      exit 1; \
    fi && \
    echo "✓ Standalone build verification passed"

# Create necessary runtime directories with proper permissions
# .next/cache: Next.js build cache
# data: Application data directory
# logs: Application logs directory
RUN mkdir -p .next/cache data logs && \
    chown -R nextjs:nodejs .next data logs

# Set production environment variables
ENV NODE_ENV=production
# Port the application will listen on
ENV PORT=3000
# Bind to all network interfaces (0.0.0.0) to accept connections from outside container
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Expose the application port
EXPOSE 3000

# Switch to non-root user before starting application
# This ensures the application runs with minimal privileges
USER nextjs

# Health check configuration
# Monitors application health by checking /api/health endpoint
# --interval: Check health every 30 seconds
# --timeout: Wait up to 10 seconds for response
# --start-period: Allow 5 seconds for initial startup before health checks begin
# --retries: Mark as unhealthy after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Use dumb-init as entrypoint to properly handle Unix signals
# This ensures graceful shutdown when container receives SIGTERM/SIGINT
ENTRYPOINT ["dumb-init", "--"]

# Start the Next.js server
# server.js is generated by Next.js standalone build output
CMD ["node", "server.js"]

