# syntax=docker/dockerfile:1.4
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY worker/package.json ./package.json
COPY package.json ./root-package.json

# Install dependencies
RUN npm install --production --frozen-lockfile

FROM node:20-alpine AS runner
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S worker -u 1001 -G nodejs

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code (both worker and shared src)
COPY worker/src ./worker/src
COPY src ./src

# Set permissions
RUN chown -R worker:nodejs /app

# Set environment variables
ENV NODE_ENV=production
ENV WORKER_PORT=3002

# Expose port
EXPOSE 3002

# Switch to non-root user
USER worker

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the worker
CMD ["node", "worker/src/index.js"]

