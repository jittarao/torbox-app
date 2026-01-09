import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';

import Database from './database/Database.js';
import UserDatabaseManager from './database/UserDatabaseManager.js';
import PollingScheduler from './automation/PollingScheduler.js';
import AutomationEngine from './automation/AutomationEngine.js';
import ApiClient from './api/ApiClient.js';
import { hashApiKey } from './utils/crypto.js';
import fs from 'fs';

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
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));
    
    // CORS configuration
    const allowedOrigins = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',')
      : ['http://localhost:3000'];
    this.app.use(cors({
      origin: allowedOrigins,
      credentials: true
    }));
    
    // Compression
    this.app.use(compression());
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use('/api/', limiter);
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  setupRoutes() {
    // Health check
    this.app.get('/api/backend/status', (req, res) => {
      const schedulerStatus = this.pollingScheduler ? this.pollingScheduler.getStatus() : null;
      res.json({ 
        available: true, 
        mode: 'selfhosted',
        version: process.env.npm_package_version || '0.1.0',
        uptime: process.uptime(),
        pollingScheduler: schedulerStatus
      });
    });

    // Health check for Docker
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // API key management endpoints
    this.app.post('/api/backend/api-key', async (req, res) => {
      try {
        const { apiKey, keyName } = req.body;
        
        if (!apiKey) {
          return res.status(400).json({ success: false, error: 'API key is required' });
        }

        // Validate API key by making a test request
        const testClient = new ApiClient(apiKey);
        try {
          await testClient.getTorrents();
        } catch (error) {
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid API key or TorBox API unavailable' 
          });
        }

        // Register API key in master database
        const authId = await this.masterDatabase.registerApiKey(apiKey, keyName);

        // Register user in UserDatabaseManager (creates DB if needed)
        await this.userDatabaseManager.registerUser(apiKey, keyName);

        // Create automation engine for this user
        const userDb = await this.userDatabaseManager.getUserDatabase(authId);
        const apiKeyData = this.masterDatabase.getApiKey(authId);
        const automationEngine = new AutomationEngine(authId, apiKeyData.encrypted_key, userDb.db, this.masterDatabase);
        await automationEngine.initialize();
        this.automationEngines.set(authId, automationEngine);

        // Refresh polling scheduler to pick up new user
        if (this.pollingScheduler) {
          await this.pollingScheduler.refreshPollers();
        }

        res.json({ success: true, message: 'API key registered successfully', authId });
      } catch (error) {
        console.error('Error registering API key:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/backend/api-key/status', async (req, res) => {
      try {
        const activeUsers = this.masterDatabase.getActiveUsers();
        const schedulerStatus = this.pollingScheduler ? this.pollingScheduler.getStatus() : null;
        
        res.json({ 
          success: true,
          activeUsers: activeUsers.length,
          automationEngines: this.automationEngines.size,
          pollingScheduler: schedulerStatus
        });
      } catch (error) {
        console.error('Error checking API key status:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Ensure user database exists endpoint
    this.app.post('/api/backend/api-key/ensure-db', async (req, res) => {
      try {
        const apiKey = req.headers['x-api-key'] || req.body.apiKey;
        
        if (!apiKey) {
          return res.status(400).json({ success: false, error: 'API key is required' });
        }

        // Hash API key to get authId
        const authId = hashApiKey(apiKey);

        // Check if user is already registered
        const existingUser = this.masterDatabase.getQuery(
          'SELECT auth_id, db_path FROM user_registry WHERE auth_id = ?',
          [authId]
        );

        let dbExists = false;
        let wasCreated = false;

        if (existingUser) {
          // User is registered, check if DB file exists
          dbExists = fs.existsSync(existingUser.db_path);
          
          if (!dbExists) {
            // DB file doesn't exist, create it
            await this.userDatabaseManager.getUserDatabase(authId);
            wasCreated = true;
            dbExists = true;
          }
        } else {
          // User not registered, register them (this creates the DB)
          const keyName = req.body.keyName || null;
          const pollInterval = req.body.pollInterval || 5;
          
          await this.masterDatabase.registerApiKey(apiKey, keyName, pollInterval);
          await this.userDatabaseManager.registerUser(apiKey, keyName, pollInterval);
          
          // Create automation engine for this user
          const userDb = await this.userDatabaseManager.getUserDatabase(authId);
          const apiKeyData = this.masterDatabase.getApiKey(authId);
          const automationEngine = new AutomationEngine(authId, apiKeyData.encrypted_key, userDb.db, this.masterDatabase);
          await automationEngine.initialize();
          this.automationEngines.set(authId, automationEngine);

          // Refresh polling scheduler
          if (this.pollingScheduler) {
            await this.pollingScheduler.refreshPollers();
          }

          wasCreated = true;
          dbExists = true;
        }

        res.json({ 
          success: true, 
          authId,
          dbExists,
          wasCreated,
          message: wasCreated ? 'User database created' : 'User database already exists'
        });
      } catch (error) {
        console.error('Error ensuring user database:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Automation rules endpoints (per-user)
    this.app.get('/api/automation/rules', async (req, res) => {
      try {
        const authId = req.query.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const engine = this.automationEngines.get(authId);
        if (!engine) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        const rules = await engine.getAutomationRules();
        const transformedRules = rules.map(rule => ({
          id: rule.id,
          name: rule.name,
          enabled: rule.enabled,
          trigger: rule.trigger_config,
          conditions: rule.conditions,
          logicOperator: 'and',
          action: rule.action_config,
          metadata: rule.metadata,
          cooldown_minutes: rule.cooldown_minutes,
          created_at: rule.created_at,
          updated_at: rule.updated_at
        }));
        res.json({ success: true, rules: transformedRules });
      } catch (error) {
        console.error('Error fetching automation rules:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/automation/rules', async (req, res) => {
      try {
        const authId = req.body.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const { rules } = req.body;
        const engine = this.automationEngines.get(authId);
        if (!engine) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        await engine.saveAutomationRules(rules);
        await engine.reloadRules();
        
        // Refresh pollers to ensure poller exists for this user
        if (this.pollingScheduler) {
          await this.pollingScheduler.refreshPollers();
        }
        
        res.json({ success: true, message: 'Rules saved successfully' });
      } catch (error) {
        console.error('Error saving automation rules:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.put('/api/automation/rules/:id', async (req, res) => {
      try {
        const authId = req.query.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const ruleId = parseInt(req.params.id);
        const { enabled } = req.body;
        const engine = this.automationEngines.get(authId);
        if (!engine) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        await engine.updateRuleStatus(ruleId, enabled);
        
        // Refresh pollers to ensure poller exists for this user
        if (this.pollingScheduler) {
          await this.pollingScheduler.refreshPollers();
        }
        
        res.json({ success: true, message: 'Rule updated successfully' });
      } catch (error) {
        console.error('Error updating rule:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.delete('/api/automation/rules/:id', async (req, res) => {
      try {
        const authId = req.query.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const ruleId = parseInt(req.params.id);
        const engine = this.automationEngines.get(authId);
        if (!engine) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        await engine.deleteRule(ruleId);
        
        // Refresh pollers to ensure poller exists for this user
        if (this.pollingScheduler) {
          await this.pollingScheduler.refreshPollers();
        }
        
        res.json({ success: true, message: 'Rule deleted successfully' });
      } catch (error) {
        console.error('Error deleting rule:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/automation/rules/:id/logs', async (req, res) => {
      try {
        const authId = req.query.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const ruleId = parseInt(req.params.id);
        const engine = this.automationEngines.get(authId);
        if (!engine) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        const logs = engine.getRuleExecutionHistory(ruleId);
        res.json({ success: true, logs });
      } catch (error) {
        console.error('Error fetching rule logs:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Archived downloads endpoints (per-user)
    this.app.get('/api/archived-downloads', async (req, res) => {
      try {
        const authId = req.query.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const userDb = await this.userDatabaseManager.getUserDatabase(authId);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        // Get total count
        const totalCount = userDb.db.prepare(`
          SELECT COUNT(*) as count FROM archived_downloads
        `).get();

        // Get paginated results
        const archived = userDb.db.prepare(`
          SELECT id, torrent_id, hash, tracker, name, archived_at, created_at
          FROM archived_downloads
          ORDER BY archived_at DESC
          LIMIT ? OFFSET ?
        `).all(limit, offset);

        res.json({
          success: true,
          data: archived,
          pagination: {
            page,
            limit,
            total: totalCount.count,
            totalPages: Math.ceil(totalCount.count / limit)
          }
        });
      } catch (error) {
        console.error('Error fetching archived downloads:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/archived-downloads', async (req, res) => {
      try {
        const authId = req.body.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const { torrent_id, hash, tracker, name } = req.body;
        
        if (!torrent_id || !hash) {
          return res.status(400).json({ 
            success: false, 
            error: 'torrent_id and hash are required' 
          });
        }

        const userDb = await this.userDatabaseManager.getUserDatabase(authId);
        
        // Check if already archived
        const existing = userDb.db.prepare(`
          SELECT id FROM archived_downloads WHERE torrent_id = ?
        `).get(torrent_id);

        if (existing) {
          return res.status(409).json({ 
            success: false, 
            error: 'Download already archived' 
          });
        }

        // Insert new archive entry
        const result = userDb.db.prepare(`
          INSERT INTO archived_downloads (torrent_id, hash, tracker, name, archived_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(torrent_id, hash, tracker || null, name || null);

        const archived = userDb.db.prepare(`
          SELECT id, torrent_id, hash, tracker, name, archived_at, created_at
          FROM archived_downloads
          WHERE id = ?
        `).get(result.lastInsertRowid);

        res.json({ success: true, data: archived });
      } catch (error) {
        console.error('Error creating archived download:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.delete('/api/archived-downloads/:id', async (req, res) => {
      try {
        const authId = req.query.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const archiveId = parseInt(req.params.id);
        const userDb = await this.userDatabaseManager.getUserDatabase(authId);

        // Check if exists
        const existing = userDb.db.prepare(`
          SELECT id FROM archived_downloads WHERE id = ?
        `).get(archiveId);

        if (!existing) {
          return res.status(404).json({ 
            success: false, 
            error: 'Archived download not found' 
          });
        }

        // Delete
        userDb.db.prepare(`
          DELETE FROM archived_downloads WHERE id = ?
        `).run(archiveId);

        res.json({ success: true, message: 'Archived download deleted successfully' });
      } catch (error) {
        console.error('Error deleting archived download:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Error handling middleware
    this.app.use((error, req, res, next) => {
      console.error('Unhandled error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ 
        success: false, 
        error: 'Endpoint not found',
        path: req.originalUrl
      });
    });
  }

  async initializeServices() {
    try {
      // Initialize master database
      await this.masterDatabase.initialize();
      console.log('Master database initialized');

      // Initialize user database manager
      const userDbDir = process.env.USER_DB_DIR || '/app/data/users';
      this.userDatabaseManager = new UserDatabaseManager(this.masterDatabase.db, userDbDir);
      console.log('User database manager initialized');

      // Initialize polling scheduler (pass automation engines map for sharing)
      this.pollingScheduler = new PollingScheduler(
        this.userDatabaseManager, 
        this.masterDatabase,
        this.automationEngines
      );
      await this.pollingScheduler.start();
      console.log('Polling scheduler started');

      // Initialize automation engines for existing users
      const activeUsers = this.masterDatabase.getActiveUsers();
      for (const user of activeUsers) {
        try {
          const userDb = await this.userDatabaseManager.getUserDatabase(user.auth_id);
          const automationEngine = new AutomationEngine(
            user.auth_id,
            user.encrypted_key,
            userDb.db,
            this.masterDatabase
          );
          await automationEngine.initialize();
          this.automationEngines.set(user.auth_id, automationEngine);
        } catch (error) {
          console.error(`Failed to initialize automation engine for user ${user.auth_id}:`, error);
        }
      }

      console.log(`TorBox Backend started successfully with ${activeUsers.length} active users`);
    } catch (error) {
      console.error('Failed to initialize services:', error);
      process.exit(1);
    }
  }

  start() {
    this.app.listen(this.port, '0.0.0.0', () => {
      console.log(`TorBox Backend running on port ${this.port}`);
      console.log(`Health check: http://localhost:${this.port}/health`);
      console.log(`Backend status: http://localhost:${this.port}/api/backend/status`);
    });
  }

  async shutdown() {
    console.log('Shutting down TorBox Backend...');
    
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

    console.log('Shutdown complete');
  }
}

// Start the server
const backend = new TorBoxBackend();
backend.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await backend.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await backend.shutdown();
  process.exit(0);
});

export default TorBoxBackend;
