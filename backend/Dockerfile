# Multi-stage Dockerfile for TBM backend API service
# Uses Docker BuildKit syntax for advanced features
# syntax=docker/dockerfile:1.4

# Stage 1: Dependencies - Install production dependencies only
# This stage is optimized for layer caching and smaller final image
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# Install system dependencies required for native Node.js modules
# libc6-compat: Compatibility layer for glibc-based packages
# python3, make, g++: Required for compiling native dependencies (e.g., node-gyp packages)
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files first for better Docker layer caching
# This allows dependency installation to be cached if package.json hasn't changed
COPY package.json ./

# Install only production dependencies to reduce image size
# --frozen-lockfile: Use exact versions from lockfile (ensures reproducible builds)
# --no-cache: Don't cache package metadata (reduces image size)
RUN bun install --production --frozen-lockfile --no-cache

# Stage 2: Builder - Prepare build environment
# This stage is used if any build-time processing is needed
# Currently minimal as backend doesn't require compilation step
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Install build dependencies required for compiling native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files first for better Docker layer caching
COPY package.json ./

# Install all dependencies including dev dependencies
# Dev dependencies may be needed for type checking, linting, or other build tools
RUN bun install --frozen-lockfile --no-cache

# Copy entire source code into builder stage
COPY . .

# Stage 3: Runner - Production runtime image
# Minimal image containing only what's needed to run the backend service
FROM oven/bun:1-alpine AS runner
WORKDIR /app

# Install runtime dependencies
# dumb-init: Proper signal handling for graceful shutdowns
# curl: Required for health check endpoint testing
RUN apk add --no-cache dumb-init curl

# Create non-root user for enhanced security
# Running as non-root user limits potential damage if container is compromised
# Using 'torbox' username to match application branding
RUN addgroup -g 1001 -S nodejs && \
    adduser -S torbox -u 1001 -G nodejs

# Set proper ownership of working directory before copying files
RUN chown -R torbox:nodejs /app

# Copy production dependencies from deps stage
# --chown: Set ownership to non-root user for security
COPY --from=deps --chown=torbox:nodejs /app/node_modules ./node_modules
# Copy application source code
COPY --chown=torbox:nodejs . .

# Create necessary runtime directories with proper permissions
# data: Backend data directory (databases, user files, etc.)
# logs: Application logs directory
RUN mkdir -p data logs && \
    chown -R torbox:nodejs data logs

# Set production environment variables
ENV NODE_ENV=production
# Port the backend API will listen on
ENV PORT=3001
# Bind to all network interfaces (0.0.0.0) to accept connections from outside container
ENV HOSTNAME=0.0.0.0

# Expose the backend API port
EXPOSE 3001

# Switch to non-root user before starting application
# This ensures the application runs with minimal privileges
USER torbox

# Health check configuration
# Monitors backend health by checking /health endpoint
# --interval: Check health every 30 seconds
# --timeout: Wait up to 10 seconds for response
# --start-period: Allow 5 seconds for initial startup before health checks begin
# --retries: Mark as unhealthy after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Use dumb-init as entrypoint to properly handle Unix signals
# This ensures graceful shutdown when container receives SIGTERM/SIGINT
ENTRYPOINT ["dumb-init", "--"]

# Start the backend application using Bun runtime
# Bun provides fast JavaScript execution and built-in TypeScript support
CMD ["bun", "run", "src/index.js"]
