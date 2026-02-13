import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import Database from './database/Database.js';
import UserDatabaseManager from './database/UserDatabaseManager.js';
import PollingScheduler from './automation/PollingScheduler.js';
import AutomationEngine from './automation/AutomationEngine.js';
import UploadProcessor from './automation/UploadProcessor.js';
import logger from './utils/logger.js';
import cache from './utils/cache.js';
import { validateJsonPayloadSize } from './middleware/validation.js';
import { initSentry, getSentry } from './utils/sentry.js';
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

class TorBoxBackend {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    this.masterDatabase = new Database();
    this.userDatabaseManager = null;
    this.pollingScheduler = null;
    this.uploadProcessor = null;
    this.automationEngines = new Map(); // Map of authId -> AutomationEngine
    this.memoryLogIntervalId = null;

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Note: In Sentry v10, expressIntegration (added during init) automatically handles
    // request and tracing instrumentation, so no separate middleware is needed here.
    // The integration is configured in src/utils/sentry.js during Sentry.init()

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

    // Compression
    this.app.use(compression());

    // IP-based rate limiting (global); skip admin routes so they are not limited or counted
    const ipLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        const url = (req.originalUrl || '').split('?')[0];
        const path = (req.path || '').split('?')[0];
        return url.startsWith('/api/admin') || path.startsWith('/admin');
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
      windowMs: 15 * 60 * 1000,
      max: parseInt(process.env.USER_RATE_LIMIT_MAX || '300', 10),
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

    // JSON payload size validation
    this.app.use(validateJsonPayloadSize(10 * 1024 * 1024)); // 10MB

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();

      // Log response when finished
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.http(req, res, duration);
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
      };

      // Add authId if available
      if (req.validatedAuthId) {
        context.authId = req.validatedAuthId;
      }

      logger.error('Unhandled error in request handler', error, context);

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
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
      // Initialize master database
      await this.masterDatabase.initialize();
      logger.info('Master database initialized');

      // Initialize user database manager
      const userDbDir = process.env.USER_DB_DIR || '/app/data/users';
      this.userDatabaseManager = new UserDatabaseManager(this.masterDatabase, userDbDir);
      logger.info('User database manager initialized', { userDbDir });

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

      // Initialize polling scheduler (pass automation engines map for sharing)
      this.pollingScheduler = new PollingScheduler(
        this.userDatabaseManager,
        this.masterDatabase,
        this.automationEngines,
        {
          maxConcurrentPolls: parseInt(process.env.MAX_CONCURRENT_POLLS || '12', 10),
          pollKickoutMs: parseInt(process.env.POLL_KICKOUT_MS || '120000', 10),
          pollerCleanupIntervalHours: parseInt(
            process.env.POLLER_CLEANUP_INTERVAL_HOURS || '24',
            10
          ),
        }
      );
      await this.pollingScheduler.start();
      logger.info('Polling scheduler started');

      // Sync has_active_rules flags at startup by querying user DBs directly (no engine creation).
      // Engines are created on demand when pollers are created (users with active rules) or when API needs one.
      const activeUsers = this.masterDatabase.getActiveUsers();
      const syncStats = { synced: 0, errors: 0, skipped: 0 };
      const syncStartTime = Date.now();
      const maxConcurrentSync = parseInt(process.env.MAX_CONCURRENT_INIT || '20', 10);

      class SyncSemaphore {
        constructor(maxConcurrent) {
          this.maxConcurrent = maxConcurrent;
          this.running = 0;
          this.queue = [];
        }
        async acquire() {
          return new Promise((resolve) => {
            if (this.running < this.maxConcurrent) {
              this.running++;
              resolve();
            } else {
              this.queue.push(resolve);
            }
          });
        }
        release() {
          this.running--;
          if (this.queue.length > 0) {
            this.running++;
            const next = this.queue.shift();
            next();
          }
        }
      }

      const syncSemaphore = new SyncSemaphore(maxConcurrentSync);
      const usersToSync = activeUsers.filter((user) => user.encrypted_key);

      logger.info('Syncing has_active_rules flags at startup (no engine creation)', {
        totalUsers: usersToSync.length,
        maxConcurrent: maxConcurrentSync,
      });

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
              logger.info('Active rules flag synced at startup', {
                authId: auth_id,
                previousFlag: dbFlag,
                actualFlag,
              });
              syncStats.synced++;
            }
          } catch (error) {
            logger.warn('Failed to sync active rules flag for user at startup', {
              authId: auth_id,
              errorMessage: error.message,
            });
            syncStats.errors++;
          } finally {
            syncSemaphore.release();
          }
        })
      );

      if (syncStats.synced > 0) {
        cache.invalidateActiveUsers();
      }

      const syncDuration = ((Date.now() - syncStartTime) / 1000).toFixed(2);
      logger.info('Startup flag sync completed', {
        totalUsers: usersToSync.length,
        flagsSynced: syncStats.synced,
        errors: syncStats.errors,
        skipped: syncStats.skipped,
        duration: `${syncDuration}s`,
      });

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
    } catch (error) {
      logger.error('Failed to initialize services', error);
      process.exit(1);
    }
  }

  start() {
    const server = this.app.listen(this.port, '0.0.0.0', () => {
      logger.info('TorBox Backend server started', {
        port: this.port,
        healthCheck: `http://localhost:${this.port}/health`,
        statusEndpoint: `http://localhost:${this.port}/api/backend/status`,
      });
    });

    server.on('error', (error) => {
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
   * Get memory usage information
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`,
      arrayBuffers: `${(usage.arrayBuffers / 1024 / 1024).toFixed(2)} MB`,
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

  async shutdown() {
    logger.info('Shutting down TorBox Backend...');

    if (this.memoryLogIntervalId) {
      clearInterval(this.memoryLogIntervalId);
      this.memoryLogIntervalId = null;
    }

    if (this.uploadProcessor) {
      this.uploadProcessor.stop();
    }

    if (this.pollingScheduler) {
      this.pollingScheduler.stop();
    }

    for (const [authId, engine] of this.automationEngines) {
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
    await initSentry();

    // Create the backend instance
    backend = new TorBoxBackend();
    global.torboxBackend = backend; // Store globally for shutdown handlers

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
  const backend = global.torboxBackend;
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
  const backend = global.torboxBackend;
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

  // In production, consider graceful shutdown
  if (process.env.NODE_ENV === 'production') {
    const backend = global.torboxBackend;
    if (backend) {
      await backend.shutdown();
    }
    process.exit(1);
  }
});

export default TorBoxBackend;
