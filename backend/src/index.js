import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import Database from './database/Database.js';
import UserDatabaseManager from './database/UserDatabaseManager.js';
import PollingScheduler from './automation/PollingScheduler.js';
import EventNotifier from './automation/EventNotifier.js';
import AutomationEngine from './automation/AutomationEngine.js';
import UploadProcessor from './automation/UploadProcessor.js';
import logger from './utils/logger.js';
import cache from './utils/cache.js';
import Semaphore from './utils/semaphore.js';
import { createRequireRegisteredUser, warnAuthMode } from './middleware/userAuth.js';
import { initSentry, getSentry } from './utils/sentry.js';
import { validateEncryption } from './utils/crypto.js';
import { serverErrorPayload } from './utils/httpErrors.js';
import { validateEnv } from './config/validateEnv.js';
import { getUserDbDir } from './utils/dataPaths.js';
import { isPrivateOrLoopbackIp, parseRateLimitMax } from './utils/ip.js';
import { setupAdminRoutes } from './routes/admin.js';
import { setupHealthRoutes } from './routes/health.js';
import { setupApiKeyRoutes } from './routes/apiKeys.js';
import { setupAutomationRoutes } from './routes/automation.js';
import { setupArchivedDownloadsRoutes } from './routes/archivedDownloads.js';
import { setupCustomViewsRoutes } from './routes/customViews.js';
import { setupTagsRoutes } from './routes/tags.js';
import { setupDownloadTagsRoutes } from './routes/downloadTags.js';
import { setupUploadsRoutes } from './routes/uploads.js';
import { setupLinkHistoryRoutes } from './routes/linkHistory.js';
import UploadQuotaService from './services/UploadQuotaService.js';

class TorBoxBackend {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    this.masterDatabase = new Database();
    this.userDatabaseManager = null;
    this.pollingScheduler = null;
    this.uploadProcessor = null;
    this.uploadQuotaService = null;
    this.eventNotifier = new EventNotifier();
    this.automationEngines = new Map(); // Map of authId -> AutomationEngine
    this.memoryLogIntervalId = null;
    this._server = null;
    this._inflightRequests = new Set();
    this.requireRegisteredUser = createRequireRegisteredUser(() => this.masterDatabase);

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Request timeout in milliseconds. Applied to all routes after middleware
   * processing. Default: 120s (must exceed TorBox API timeout of 30s + DB work).
   */
  static get REQUEST_TIMEOUT_MS() {
    return parseInt(process.env.REQUEST_TIMEOUT_MS || '120000', 10);
  }

  setupMiddleware() {
    // Note: In Sentry v10, expressIntegration (added during init) automatically handles
    // request and tracing instrumentation, so no separate middleware is needed here.
    // The integration is configured in src/utils/sentry.js during Sentry.init()

    // Global request timeout — prevents a slow user DB query or stuck API call
    // from holding the event loop indefinitely.
    this.app.use((req, res, next) => {
      const timer = setTimeout(() => {
        if (!res.headersSent) {
          res.status(503).json({
            success: false,
            error: 'Request timed out',
          });
        }
      }, TorBoxBackend.REQUEST_TIMEOUT_MS);
      res.on('finish', () => clearTimeout(timer));
      next();
    });

    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      })
    );

    // CORS configuration
    const allowedOrigins = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',')
      : ['http://localhost:3000'];
    this.app.use(
      cors({
        origin: allowedOrigins,
        credentials: true,
      })
    );

    // Compression — never compress SSE (buffers small heartbeat writes → proxy 524 timeouts)
    const defaultCompressFilter = compression.filter;
    this.app.use(
      compression({
        filter: (req, res) => {
          const path = (req.originalUrl || req.path || '').split('?')[0];
          if (path === '/api/automation/events') return false;
          const type = res.getHeader('Content-Type');
          if (type && String(type).includes('text/event-stream')) return false;
          return defaultCompressFilter(req, res);
        },
      })
    );

    // Trust X-Forwarded-For when behind a reverse proxy (set TRUST_PROXY=true in production)
    if (process.env.TRUST_PROXY === 'true') {
      this.app.set('trust proxy', 1);
    }

    // Correlation ID middleware — every request gets a unique traceable ID
    this.app.use((req, res, next) => {
      req.correlationId = crypto.randomUUID().slice(0, 8);
      res.setHeader('X-Correlation-Id', req.correlationId);
      next();
    });

    // In-flight request tracking — enables graceful shutdown to drain active requests
    // before closing DB connections. A cleanup interval removes stuck entries.
    this.app.use((req, res, next) => {
      const id = req.correlationId;
      this._inflightRequests.add(id);
      const cleanup = () => {
        this._inflightRequests.delete(id);
      };
      res.on('finish', cleanup);
      res.on('close', cleanup);
      next();
    });

    // Reject when a reverse proxy reports plaintext (x-forwarded-proto: http).
    // Internal Docker/Compose traffic has no forwarded-proto header and is allowed.
    if (process.env.NODE_ENV === 'production') {
      this.app.use((req, res, next) => {
        const forwardedProto = req.get('x-forwarded-proto');
        if (forwardedProto === 'http') {
          return res.status(426).json({ success: false, error: 'TLS required' });
        }
        next();
      });
    }

    const rateLimitWindowMs = 15 * 60 * 1000;
    const ipRateLimitMax = parseRateLimitMax(process.env.IP_RATE_LIMIT_MAX, 1000);

    // IP-based rate limiting (global). Skip admin/health and internal proxy traffic
    // (Next.js → backend in Docker shares one container IP without per-client forwarding).
    const ipLimiter = rateLimit({
      windowMs: rateLimitWindowMs,
      max: ipRateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        const url = (req.originalUrl || '').split('?')[0];
        const path = (req.path || '').split('?')[0];
        if (url.startsWith('/api/admin') || path.startsWith('/admin')) {
          return true;
        }
        if (url.startsWith('/api/health') || path === '/health') {
          return true;
        }
        if (isPrivateOrLoopbackIp(req.ip)) {
          return true;
        }
        return false;
      },
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          error: 'Too many requests from this IP, please try again later.',
          detail: 'Rate limit exceeded. Please wait before making more requests.',
        });
      },
    });
    this.app.use('/api/', ipLimiter);

    // Per-user rate limiting (applied after authId validation)
    this.userRateLimiter = rateLimit({
      windowMs: rateLimitWindowMs,
      max: parseRateLimitMax(process.env.USER_RATE_LIMIT_MAX, 500),
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // Use validated authId if available, otherwise fall back to IP
        return req.validatedAuthId || req.ip;
      },
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          error: 'Too many requests, please try again later.',
          detail: 'User rate limit exceeded. Please wait before making more requests.',
        });
      },
    });

    // Body parsing (limit enforced by express.json below)
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();

      // Log response when finished
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.http(req, res, duration, req.correlationId);
      });

      next();
    });
  }

  setupRoutes() {
    // Setup all route modules
    setupHealthRoutes(this.app, this);
    setupApiKeyRoutes(this.app, this);
    setupAutomationRoutes(this.app, this);
    setupArchivedDownloadsRoutes(this.app, this);
    setupCustomViewsRoutes(this.app, this);
    setupTagsRoutes(this.app, this);
    setupDownloadTagsRoutes(this.app, this);
    setupUploadsRoutes(this.app, this);
    setupLinkHistoryRoutes(this.app, this);
    setupAdminRoutes(this.app, this);

    // Sentry error handler must be before other error handlers
    // In Sentry v10, use expressErrorHandler instead of Handlers.errorHandler
    const Sentry = getSentry();
    if (Sentry) {
      if (typeof Sentry.expressErrorHandler === 'function') {
        this.app.use(Sentry.expressErrorHandler());
      } else if (typeof Sentry.setupExpressErrorHandler === 'function') {
        // Alternative: setupExpressErrorHandler can be used to set up error handling
        Sentry.setupExpressErrorHandler(this.app);
      }
    }

    // Error handling middleware
    this.app.use((error, req, res, next) => {
      const context = {
        endpoint: req.originalUrl || req.url,
        method: req.method,
        ip: req.ip || req.connection?.remoteAddress,
        correlationId: req.correlationId,
      };

      // Add authId if available
      if (req.validatedAuthId) {
        context.authId = req.validatedAuthId;
      }

      logger.error('Unhandled error in request handler', error, context);

      res.status(500).json(serverErrorPayload(error));
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
      });
    });
  }

  async initializeServices() {
    try {
      // Validate encryption key before doing anything else
      // Catches misconfiguration (missing/invalid ENCRYPTION_KEY) early
      validateEncryption();
      logger.info('Encryption round-trip validated');

      warnAuthMode();

      // Initialize master database
      await this.masterDatabase.initialize();
      logger.info('Master database initialized');

      // Initialize user database manager
      const userDbDir = getUserDbDir();
      this.userDatabaseManager = new UserDatabaseManager(this.masterDatabase, userDbDir);
      logger.info('User database manager initialized', { userDbDir });

      // Upload quota service (tier-based retention for LIMITED users)
      this.uploadQuotaService = new UploadQuotaService(this.masterDatabase);

      // Initialize upload processor
      this.uploadProcessor = new UploadProcessor(this.userDatabaseManager, this.masterDatabase);

      // Recover stuck 'processing' uploads on startup (before syncing counters)
      // This ensures uploads stuck from a previous crash/restart are reset to 'queued'
      logger.info('Recovering stuck processing uploads on startup...');
      const recoveredCount = await this.uploadProcessor.recoverStuckUploadsForAllUsers();
      if (recoveredCount > 0) {
        logger.info('Startup recovery completed', { recoveredCount });
      } else {
        logger.info('No stuck uploads found on startup');
      }

      // Start the upload processor
      this.uploadProcessor.start();
      logger.info('Upload processor started');

      // Sync upload counters on startup (safety net to fix any drift)
      // This runs after recovery to ensure recovered uploads are counted
      logger.info('Syncing upload counters for all users...');
      await this.masterDatabase.syncUploadCountersForAllUsers(this.userDatabaseManager);
      logger.info('Upload counter sync completed');

      logger.info('Backfilling upload quota counters for all users (accounting only, no eviction)...');
      await this.uploadQuotaService.backfillAllUsers(this.userDatabaseManager);
      logger.info('Upload quota backfill completed');

      // Sync has_active_rules before the scheduler starts so spreadOverdueUsersOnStartup() and
      // the first poll tick see corrected flags (admin: POST /api/admin/automation/sync-rules-flags).
      const syncResult = await this.syncHasActiveRulesFromUserDbs();
      const syncStats = {
        synced: syncResult.synced,
        errors: syncResult.errors,
        skipped: syncResult.skipped,
      };
      logger.info('has_active_rules sync completed before scheduler start', { ...syncStats });

      // Initialize polling scheduler (pass automation engines map for sharing)
      this.pollingScheduler = new PollingScheduler(
        this.userDatabaseManager,
        this.masterDatabase,
        this.automationEngines,
        {
          maxConcurrentPolls: parseInt(process.env.MAX_CONCURRENT_POLLS || '12', 10),
          pollKickoutMs: parseInt(process.env.POLL_KICKOUT_MS || '180000', 10),
          pollerCleanupIntervalHours: parseInt(
            process.env.POLLER_CLEANUP_INTERVAL_HOURS || '24',
            10
          ),
          eventNotifier: this.eventNotifier,
        }
      );
      await this.pollingScheduler.start();
      this.eventNotifier.startHeartbeat();
      logger.info('Polling scheduler started');

      const refreshedActiveUsers = this.masterDatabase.getActiveUsers();
      const usersWithActiveRules = refreshedActiveUsers.filter(
        (user) => user.has_active_rules === 1
      );

      logger.info('TorBox Backend started successfully', {
        activeUsers: refreshedActiveUsers.length,
        usersWithActiveRules: usersWithActiveRules.length,
        flagsSyncedOnStartup: syncStats.synced,
        syncErrors: syncStats.errors,
      });

      // Optional: periodic log of memory and pool/engine stats (e.g. hourly) for monitoring
      const memoryLogIntervalMs = parseInt(
        process.env.MEMORY_LOG_INTERVAL_MS || String(60 * 60 * 1000),
        10
      );
      if (memoryLogIntervalMs > 0) {
        this.memoryLogIntervalId = setInterval(() => {
          try {
            const memory = this.getMemoryUsage();
            const poolStats = this.userDatabaseManager?.getPoolStats() ?? null;
            logger.info('Memory and pool stats', {
              memory,
              connectionPool: poolStats
                ? {
                    size: poolStats.size,
                    maxSize: poolStats.maxSize,
                    usagePercent: poolStats.usagePercent,
                    status: poolStats.status,
                  }
                : null,
            });
          } catch (err) {
            logger.warn('Failed to log memory/pool stats', { error: err.message });
          }
        }, memoryLogIntervalMs);
      }

      // WAL checkpoint every 15 minutes for all open user databases
      const WAL_CHECKPOINT_INTERVAL_MS = 15 * 60 * 1000;
      setInterval(() => {
        this.userDatabaseManager?.checkpointAllDatabases();
        this.masterDatabase?.checkpointWal();
      }, WAL_CHECKPOINT_INTERVAL_MS);
    } catch (error) {
      logger.error('Failed to initialize services', error);
      process.exit(1);
    }
  }

  start() {
    this._server = this.app.listen(this.port, '0.0.0.0', () => {
      logger.info('TorBox Backend server started', {
        port: this.port,
        healthCheck: `http://localhost:${this.port}/health`,
        statusEndpoint: `http://localhost:${this.port}/api/backend/status`,
      });
    });

    this._server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error('Failed to start server. Port is already in use.', {
          port: this.port,
          error: error.message,
          suggestion: `Port ${this.port} is already in use. Please either:
1. Stop the process using port ${this.port} (check with: netstat -ano | findstr :${this.port})
2. Set a different port using the PORT environment variable (e.g., PORT=3002)`,
        });
        throw new Error(`Failed to start server. Is port ${this.port} in use?`);
      } else {
        logger.error('Failed to start server', { error: error.message, code: error.code });
        throw error;
      }
    });
  }

  /**
   * Get memory usage information (raw bytes for log aggregators and alerting)
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
    };
  }

  /**
   * Get system information
   */
  getSystemInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: `${Math.floor(process.uptime())}s`,
      uptimeFormatted: this.formatUptime(process.uptime()),
      cpuUsage: process.cpuUsage
        ? {
            user: `${(process.cpuUsage().user / 1000).toFixed(2)}ms`,
            system: `${(process.cpuUsage().system / 1000).toFixed(2)}ms`,
          }
        : null,
    };
  }

  /**
   * Format uptime in human-readable format
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Re-sync has_active_rules in master from each user DB (same logic as startup).
   * Use after suspected flag drift so pollers are recreated for users who have enabled rules.
   * @returns {Promise<{ synced: number, errors: number, skipped: number, durationSeconds: number }>}
   */
  async syncHasActiveRulesFromUserDbs() {
    const activeUsers = this.masterDatabase.getActiveUsers();
    const syncStats = { synced: 0, errors: 0, skipped: 0 };
    const syncStartTime = Date.now();
    const maxConcurrentSync = parseInt(process.env.MAX_CONCURRENT_INIT || '20', 10);
    const syncSemaphore = new Semaphore(maxConcurrentSync);
    const usersToSync = activeUsers.filter((user) => user.encrypted_key);

    await Promise.all(
      usersToSync.map(async (user) => {
        const { auth_id, has_active_rules: dbFlag } = user;
        await syncSemaphore.acquire();
        try {
          const userDb = await this.userDatabaseManager.getUserDatabase(auth_id);
          if (!userDb?.db) {
            syncStats.skipped++;
            return;
          }
          const result = userDb.db
            .prepare('SELECT COUNT(*) as count FROM automation_rules WHERE enabled = 1')
            .get();
          const actualHasActiveRules = result && result.count > 0;
          const actualFlag = actualHasActiveRules ? 1 : 0;
          if (dbFlag !== actualFlag) {
            this.masterDatabase.updateActiveRulesFlag(auth_id, actualHasActiveRules);
            syncStats.synced++;
          }
        } catch (error) {
          logger.warn('Failed to sync active rules flag for user', {
            authId: auth_id,
            errorMessage: error.message,
          });
          syncStats.errors++;
        } finally {
          this.userDatabaseManager.closeConnection(auth_id);
          syncSemaphore.release();
        }
      })
    );

    if (syncStats.synced > 0) {
      cache.invalidateActiveUsers();
    }

    const durationSeconds = (Date.now() - syncStartTime) / 1000;
    logger.info('Sync has_active_rules from user DBs completed', {
      ...syncStats,
      durationSeconds,
    });
    return { ...syncStats, durationSeconds };
  }

  async shutdown() {
    logger.info('Shutting down TorBox Backend...');

    // Stop accepting new connections immediately
    if (this._server) {
      this._server.close();
    }

    // Drain in-flight HTTP requests with timeout
    const inflightCount = this._inflightRequests.size;
    if (inflightCount > 0) {
      logger.info('Waiting for in-flight requests to complete', { count: inflightCount });
      const drainTimeoutMs = 30000;
      const drainStart = Date.now();
      while (this._inflightRequests.size > 0 && Date.now() - drainStart < drainTimeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const remaining = this._inflightRequests.size;
      if (remaining > 0) {
        logger.warn('Proceeding with shutdown despite in-flight requests', { remaining });
      }
    }

    if (this.memoryLogIntervalId) {
      clearInterval(this.memoryLogIntervalId);
      this.memoryLogIntervalId = null;
    }

    if (this.uploadProcessor) {
      this.uploadProcessor.stop();
    }

    if (this.pollingScheduler) {
      await this.pollingScheduler.stop();
    }

    if (this.eventNotifier && this.eventNotifier.stopHeartbeat) {
      this.eventNotifier.stopHeartbeat();
    }

    for (const engine of this.automationEngines.values()) {
      engine.shutdown();
    }

    if (this.userDatabaseManager) {
      this.userDatabaseManager.closeAll();
    }

    if (this.masterDatabase) {
      this.masterDatabase.close();
    }

    logger.info('Shutdown complete');
  }
}

// Initialize Sentry before starting the server
let backend;
(async () => {
  try {
    validateEnv();
    await initSentry();

    // Create the backend instance
    backend = new TorBoxBackend();

    // Initialize services before starting the server
    await backend.initializeServices();

    // Start the server only after initialization completes
    backend.start();
  } catch (error) {
    logger.error('Failed to start TorBox Backend', error);

    // Flush Sentry before exit
    const Sentry = getSentry();
    if (Sentry) {
      await Sentry.flush(2000);
    }

    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (backend) {
    await backend.shutdown();
  }

  // Flush Sentry before exit
  const Sentry = getSentry();
  if (Sentry) {
    await Sentry.flush(2000);
  }

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (backend) {
    await backend.shutdown();
  }

  // Flush Sentry before exit
  const Sentry = getSentry();
  if (Sentry) {
    await Sentry.flush(2000);
  }

  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception', error);

  // Send to Sentry
  const Sentry = getSentry();
  if (Sentry) {
    Sentry.captureException(error);
    await Sentry.flush(2000);
  }

  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('Unhandled promise rejection', error, {
    promise: promise.toString(),
  });

  // Send to Sentry
  const Sentry = getSentry();
  if (Sentry) {
    Sentry.captureException(error, {
      contexts: {
        promise: {
          promise: promise.toString(),
        },
      },
    });
    await Sentry.flush(2000);
  }

  if (process.env.NODE_ENV === 'production' && backend) {
    await backend.shutdown();
    process.exit(1);
  }
});

export default TorBoxBackend;
