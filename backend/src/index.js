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
import { createAdminRateLimiter } from './middleware/adminAuth.js';
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

class TorBoxBackend {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    this.masterDatabase = new Database();
    this.userDatabaseManager = null;
    this.pollingScheduler = null;
    this.uploadProcessor = null;
    this.automationEngines = new Map(); // Map of authId -> AutomationEngine

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Initialize Sentry Express middleware if Sentry is enabled
    const Sentry = getSentry();
    if (Sentry) {
      // Request handler must be the first middleware
      if (typeof Sentry.Handlers?.requestHandler === 'function') {
        this.app.use(Sentry.Handlers.requestHandler());
      }
      // Tracing handler creates a trace for every incoming request
      if (typeof Sentry.Handlers?.tracingHandler === 'function') {
        this.app.use(Sentry.Handlers.tracingHandler());
      }
    }

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

    // IP-based rate limiting (global)
    const ipLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
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
      max: parseInt(process.env.USER_RATE_LIMIT_MAX || '200', 10),
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

    // Admin rate limiting (stricter than user limits)
    this.adminRateLimiter = createAdminRateLimiter(rateLimit);

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
    setupAdminRoutes(this.app, this);

    // Sentry error handler must be before other error handlers
    const Sentry = getSentry();
    if (Sentry && typeof Sentry.Handlers?.errorHandler === 'function') {
      this.app.use(Sentry.Handlers.errorHandler());
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
      this.uploadProcessor.start();
      logger.info('Upload processor started');

      // Sync upload counters on startup (safety net to fix any drift)
      logger.info('Syncing upload counters for all users...');
      await this.masterDatabase.syncUploadCountersForAllUsers(this.userDatabaseManager);
      logger.info('Upload counter sync completed');

      // Initialize polling scheduler (pass automation engines map for sharing)
      this.pollingScheduler = new PollingScheduler(
        this.userDatabaseManager,
        this.masterDatabase,
        this.automationEngines,
        {
          maxConcurrentPolls: parseInt(process.env.MAX_CONCURRENT_POLLS || '7', 10),
          pollTimeoutMs: parseInt(process.env.POLL_TIMEOUT_MS || '300000', 10),
          pollerCleanupIntervalHours: parseInt(
            process.env.POLLER_CLEANUP_INTERVAL_HOURS || '24',
            10
          ),
        }
      );
      await this.pollingScheduler.start();
      logger.info('Polling scheduler started');

      // Initialize automation engines for all active users
      // This ensures has_active_rules flags are synced on startup
      // (even if flags are out of sync, initialization will correct them)
      // Uses parallel initialization with concurrency control for scalability (1000+ users)
      const activeUsers = this.masterDatabase.getActiveUsers();
      const syncStats = { initialized: 0, errors: 0, flagsSynced: 0 };
      const initStartTime = Date.now();

      // Concurrency limit for parallel initialization (configurable via env)
      const maxConcurrentInit = parseInt(process.env.MAX_CONCURRENT_INIT || '20', 10);
      logger.info('Starting parallel automation engine initialization', {
        totalUsers: activeUsers.length,
        maxConcurrent: maxConcurrentInit,
      });

      // Semaphore for concurrency control
      class InitSemaphore {
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

      const semaphore = new InitSemaphore(maxConcurrentInit);
      const usersToInit = activeUsers.filter((user) => user.encrypted_key);

      // Initialize users in parallel with concurrency control
      const initPromises = usersToInit.map(async (user) => {
        const { auth_id, encrypted_key, has_active_rules: dbFlag } = user;

        await semaphore.acquire();
        try {
          const automationEngine = new AutomationEngine(
            auth_id,
            encrypted_key,
            this.userDatabaseManager,
            this.masterDatabase
          );
          await automationEngine.initialize();

          // Check if flag was out of sync (initialize() calls syncActiveRulesFlag())
          const actualHasActiveRules = await automationEngine.hasActiveRules();
          const actualFlag = actualHasActiveRules ? 1 : 0;

          if (dbFlag !== actualFlag) {
            logger.info('Active rules flag synced during startup', {
              authId: auth_id,
              previousFlag: dbFlag,
              actualFlag,
            });
            syncStats.flagsSynced++;
          }

          this.automationEngines.set(auth_id, automationEngine);
          syncStats.initialized++;

          // Log progress for large user counts
          if (usersToInit.length > 50 && syncStats.initialized % 50 === 0) {
            const progress = ((syncStats.initialized / usersToInit.length) * 100).toFixed(1);
            logger.info('Initialization progress', {
              initialized: syncStats.initialized,
              total: usersToInit.length,
              progress: `${progress}%`,
              errors: syncStats.errors,
            });
          }
        } catch (error) {
          logger.error(`Failed to initialize automation engine for user ${auth_id}`, error, {
            authId: auth_id,
          });
          syncStats.errors++;
        } finally {
          semaphore.release();
        }
      });

      // Wait for all initializations to complete
      await Promise.all(initPromises);

      const initDuration = ((Date.now() - initStartTime) / 1000).toFixed(2);
      logger.info('Automation engine initialization completed', {
        totalUsers: usersToInit.length,
        initialized: syncStats.initialized,
        errors: syncStats.errors,
        flagsSynced: syncStats.flagsSynced,
        duration: `${initDuration}s`,
        averageTime:
          usersToInit.length > 0 ? `${(initDuration / usersToInit.length).toFixed(3)}s` : '0s',
      });

      // Refresh active users list after syncing flags to get accurate counts
      if (syncStats.flagsSynced > 0) {
        cache.invalidateActiveUsers();
        const refreshedActiveUsers = this.masterDatabase.getActiveUsers();
        const usersWithActiveRules = refreshedActiveUsers.filter(
          (user) => user.has_active_rules === 1
        );

        logger.info('TorBox Backend started successfully', {
          activeUsers: refreshedActiveUsers.length,
          usersWithActiveRules: usersWithActiveRules.length,
          automationEngines: this.automationEngines.size,
          flagsSyncedOnStartup: syncStats.flagsSynced,
          initializationErrors: syncStats.errors,
        });
      } else {
        const usersWithActiveRules = activeUsers.filter((user) => user.has_active_rules === 1);

        logger.info('TorBox Backend started successfully', {
          activeUsers: activeUsers.length,
          usersWithActiveRules: usersWithActiveRules.length,
          automationEngines: this.automationEngines.size,
          flagsSyncedOnStartup: syncStats.flagsSynced,
          initializationErrors: syncStats.errors,
        });
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
