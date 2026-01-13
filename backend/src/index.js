import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import Database from './database/Database.js';
import UserDatabaseManager from './database/UserDatabaseManager.js';
import PollingScheduler from './automation/PollingScheduler.js';
import AutomationEngine from './automation/AutomationEngine.js';
import logger from './utils/logger.js';
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

class TorBoxBackend {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    this.masterDatabase = new Database();
    this.userDatabaseManager = null;
    this.pollingScheduler = null;
    this.automationEngines = new Map(); // Map of authId -> AutomationEngine

    this.setupMiddleware();
    this.setupRoutes();
    this.initializeServices();
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

      // Initialize automation engines only for users with active rules
      const activeUsers = this.masterDatabase.getActiveUsers();
      const usersWithActiveRules = activeUsers.filter((user) => user.has_active_rules === 1);
      for (const user of usersWithActiveRules) {
        try {
          const automationEngine = new AutomationEngine(
            user.auth_id,
            user.encrypted_key,
            this.userDatabaseManager,
            this.masterDatabase
          );
          await automationEngine.initialize();
          this.automationEngines.set(user.auth_id, automationEngine);
        } catch (error) {
          logger.error(`Failed to initialize automation engine for user ${user.auth_id}`, error, {
            authId: user.auth_id,
          });
        }
      }

      logger.info('TorBox Backend started successfully', {
        activeUsers: activeUsers.length,
        usersWithActiveRules: usersWithActiveRules.length,
        automationEngines: this.automationEngines.size,
      });
    } catch (error) {
      logger.error('Failed to initialize services', error);
      process.exit(1);
    }
  }

  start() {
    this.app.listen(this.port, '0.0.0.0', () => {
      logger.info('TorBox Backend server started', {
        port: this.port,
        healthCheck: `http://localhost:${this.port}/health`,
        statusEndpoint: `http://localhost:${this.port}/api/backend/status`,
      });
    });
  }

  async shutdown() {
    logger.info('Shutting down TorBox Backend...');

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
  await initSentry();

  // Start the server
  backend = new TorBoxBackend();
  global.torboxBackend = backend; // Store globally for shutdown handlers
  backend.start();
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
