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
import logger from './utils/logger.js';
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
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          error: 'Too many requests from this IP, please try again later.',
          detail: 'Rate limit exceeded. Please wait before making more requests.'
        });
      }
    });
    this.app.use('/api/', limiter);
    
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
        const apiKeyData = this.masterDatabase.getApiKey(authId);
        const automationEngine = new AutomationEngine(authId, apiKeyData.encrypted_key, this.userDatabaseManager, this.masterDatabase);
        await automationEngine.initialize();
        this.automationEngines.set(authId, automationEngine);

        // Refresh polling scheduler to pick up new user
        if (this.pollingScheduler) {
          await this.pollingScheduler.refreshPollers();
        }

        res.json({ success: true, message: 'API key registered successfully', authId });
      } catch (error) {
        logger.error('Error registering API key', error, {
          endpoint: '/api/backend/api-key',
          method: 'POST',
        });
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
        logger.error('Error checking API key status', error, {
          endpoint: '/api/backend/api-key/status',
          method: 'GET',
        });
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
          const apiKeyData = this.masterDatabase.getApiKey(authId);
          const automationEngine = new AutomationEngine(authId, apiKeyData.encrypted_key, this.userDatabaseManager, this.masterDatabase);
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
        logger.error('Error ensuring user database', error, {
          endpoint: '/api/backend/api-key/ensure-db',
          method: 'POST',
        });
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
        res.json({ success: true, rules });
      } catch (error) {
        logger.error('Error fetching automation rules', error, {
          endpoint: '/api/automation/rules',
          method: 'GET',
          authId: req.query.authId || req.headers['x-auth-id'],
        });
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
        logger.error('Error saving automation rules', error, {
          endpoint: '/api/automation/rules',
          method: 'POST',
          authId: req.body.authId || req.headers['x-auth-id'],
        });
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
        logger.error('Error updating rule', error, {
          endpoint: `/api/automation/rules/${req.params.id}`,
          method: 'PUT',
          ruleId: req.params.id,
          authId: req.query.authId || req.headers['x-auth-id'],
        });
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
        logger.error('Error deleting rule', error, {
          endpoint: `/api/automation/rules/${req.params.id}`,
          method: 'DELETE',
          ruleId: req.params.id,
          authId: req.query.authId || req.headers['x-auth-id'],
        });
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

        const logs = await engine.getRuleExecutionHistory(ruleId);
        res.json({ success: true, logs });
      } catch (error) {
        logger.error('Error fetching rule logs', error, {
          endpoint: `/api/automation/rules/${req.params.id}/logs`,
          method: 'GET',
          ruleId: req.params.id,
          authId: req.query.authId || req.headers['x-auth-id'],
        });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.delete('/api/automation/rules/:id/logs', async (req, res) => {
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

        await engine.clearRuleExecutionHistory(ruleId);
        res.json({ success: true, message: 'Rule logs cleared successfully' });
      } catch (error) {
        logger.error('Error clearing rule logs', error, {
          endpoint: `/api/automation/rules/${req.params.id}/logs`,
          method: 'DELETE',
          ruleId: req.params.id,
          authId: req.query.authId || req.headers['x-auth-id'],
        });
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
        logger.error('Error fetching archived downloads', error, {
          endpoint: '/api/archived-downloads',
          method: 'GET',
          authId: req.query.authId || req.headers['x-auth-id'],
        });
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
        logger.error('Error creating archived download', error, {
          endpoint: '/api/archived-downloads',
          method: 'POST',
          authId: req.body.authId || req.headers['x-auth-id'],
        });
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
        logger.error('Error deleting archived download', error, {
          endpoint: `/api/archived-downloads/${req.params.id}`,
          method: 'DELETE',
          archiveId: req.params.id,
          authId: req.query.authId || req.headers['x-auth-id'],
        });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Custom views endpoints (per-user)
    this.app.get('/api/custom-views', async (req, res) => {
      try {
        const authId = req.query.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const userDb = await this.userDatabaseManager.getUserDatabase(authId);
        const views = userDb.db.prepare(`
          SELECT id, name, filters, sort_field, sort_direction, visible_columns, asset_type, created_at, updated_at
          FROM custom_views
          ORDER BY created_at DESC
        `).all();

        // Parse JSON fields for all views
        const parsedViews = views.map(view => {
          const parsed = { ...view };
          if (parsed.filters) {
            parsed.filters = JSON.parse(parsed.filters);
          }
          if (parsed.visible_columns) {
            parsed.visible_columns = JSON.parse(parsed.visible_columns);
          }
          return parsed;
        });

        res.json({ success: true, views: parsedViews });
      } catch (error) {
        logger.error('Error fetching custom views', error, {
          endpoint: '/api/custom-views',
          method: 'GET',
          authId: req.query.authId || req.headers['x-auth-id'],
        });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/custom-views', async (req, res) => {
      try {
        const authId = req.body.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const { name, filters, sort_field, sort_direction, visible_columns, asset_type } = req.body;

        if (!name || !filters) {
          return res.status(400).json({ 
            success: false, 
            error: 'name and filters are required' 
          });
        }

        const userDb = await this.userDatabaseManager.getUserDatabase(authId);
        
        const result = userDb.db.prepare(`
          INSERT INTO custom_views (name, filters, sort_field, sort_direction, visible_columns, asset_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          name,
          JSON.stringify(filters),
          sort_field || null,
          sort_direction || null,
          visible_columns ? JSON.stringify(visible_columns) : null,
          asset_type || null
        );

        const view = userDb.db.prepare(`
          SELECT id, name, filters, sort_field, sort_direction, visible_columns, asset_type, created_at, updated_at
          FROM custom_views
          WHERE id = ?
        `).get(result.lastInsertRowid);

        // Parse JSON fields
        view.filters = JSON.parse(view.filters);
        if (view.visible_columns) {
          view.visible_columns = JSON.parse(view.visible_columns);
        }

        res.json({ success: true, view });
      } catch (error) {
        logger.error('Error creating custom view', error, {
          endpoint: '/api/custom-views',
          method: 'POST',
          authId: req.body.authId || req.headers['x-auth-id'],
        });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/custom-views/:id', async (req, res) => {
      try {
        const authId = req.query.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const viewId = parseInt(req.params.id);
        const userDb = await this.userDatabaseManager.getUserDatabase(authId);

        const view = userDb.db.prepare(`
          SELECT id, name, filters, sort_field, sort_direction, visible_columns, asset_type, created_at, updated_at
          FROM custom_views
          WHERE id = ?
        `).get(viewId);

        if (!view) {
          return res.status(404).json({ 
            success: false, 
            error: 'Custom view not found' 
          });
        }

        // Parse JSON fields
        view.filters = JSON.parse(view.filters);
        if (view.visible_columns) {
          view.visible_columns = JSON.parse(view.visible_columns);
        }

        res.json({ success: true, view });
      } catch (error) {
        logger.error('Error fetching custom view', error, {
          endpoint: `/api/custom-views/${req.params.id}`,
          method: 'GET',
          viewId: req.params.id,
          authId: req.query.authId || req.headers['x-auth-id'],
        });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.put('/api/custom-views/:id', async (req, res) => {
      try {
        const authId = req.body.authId || req.headers['x-auth-id'] || req.query.authId;
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const viewId = parseInt(req.params.id);
        const { name, filters, sort_field, sort_direction, visible_columns, asset_type } = req.body;

        const userDb = await this.userDatabaseManager.getUserDatabase(authId);

        // Check if exists
        const existing = userDb.db.prepare(`
          SELECT id FROM custom_views WHERE id = ?
        `).get(viewId);

        if (!existing) {
          return res.status(404).json({ 
            success: false, 
            error: 'Custom view not found' 
          });
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (name !== undefined) {
          updates.push('name = ?');
          values.push(name);
        }
        if (filters !== undefined) {
          updates.push('filters = ?');
          values.push(JSON.stringify(filters));
        }
        if (sort_field !== undefined) {
          updates.push('sort_field = ?');
          values.push(sort_field || null);
        }
        if (sort_direction !== undefined) {
          updates.push('sort_direction = ?');
          values.push(sort_direction || null);
        }
        if (visible_columns !== undefined) {
          updates.push('visible_columns = ?');
          values.push(visible_columns ? JSON.stringify(visible_columns) : null);
        }
        if (asset_type !== undefined) {
          updates.push('asset_type = ?');
          values.push(asset_type || null);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(viewId);

        userDb.db.prepare(`
          UPDATE custom_views
          SET ${updates.join(', ')}
          WHERE id = ?
        `).run(...values);

        const view = userDb.db.prepare(`
          SELECT id, name, filters, sort_field, sort_direction, visible_columns, asset_type, created_at, updated_at
          FROM custom_views
          WHERE id = ?
        `).get(viewId);

        // Parse JSON fields
        view.filters = JSON.parse(view.filters);
        if (view.visible_columns) {
          view.visible_columns = JSON.parse(view.visible_columns);
        }

        res.json({ success: true, view });
      } catch (error) {
        logger.error('Error updating custom view', error, {
          endpoint: `/api/custom-views/${req.params.id}`,
          method: 'PUT',
          viewId: req.params.id,
          authId: req.body.authId || req.headers['x-auth-id'] || req.query.authId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.delete('/api/custom-views/:id', async (req, res) => {
      try {
        const authId = req.query.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const viewId = parseInt(req.params.id);
        const userDb = await this.userDatabaseManager.getUserDatabase(authId);

        // Check if exists
        const existing = userDb.db.prepare(`
          SELECT id FROM custom_views WHERE id = ?
        `).get(viewId);

        if (!existing) {
          return res.status(404).json({ 
            success: false, 
            error: 'Custom view not found' 
          });
        }

        // Delete
        userDb.db.prepare(`
          DELETE FROM custom_views WHERE id = ?
        `).run(viewId);

        res.json({ success: true, message: 'Custom view deleted successfully' });
      } catch (error) {
        logger.error('Error deleting custom view', error, {
          endpoint: `/api/custom-views/${req.params.id}`,
          method: 'DELETE',
          viewId: req.params.id,
          authId: req.query.authId || req.headers['x-auth-id'],
        });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // ===== Tags API =====
    
    // GET /api/tags - List all tags with usage counts
    this.app.get('/api/tags', async (req, res) => {
      try {
        const authId = req.query.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const userDb = await this.userDatabaseManager.getUserDatabase(authId);
        
        const tags = userDb.db.prepare(`
          SELECT 
            t.id,
            t.name,
            t.created_at,
            t.updated_at,
            COUNT(dt.id) as usage_count
          FROM tags t
          LEFT JOIN download_tags dt ON t.id = dt.tag_id
          GROUP BY t.id, t.name, t.created_at, t.updated_at
          ORDER BY t.name ASC
        `).all();

        res.json({ success: true, tags });
      } catch (error) {
        logger.error('Error fetching tags', error, {
          endpoint: '/api/tags',
          method: 'GET',
          authId: req.query.authId || req.headers['x-auth-id'],
        });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // POST /api/tags - Create tag
    this.app.post('/api/tags', async (req, res) => {
      try {
        const authId = req.body.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const { name } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ 
            success: false, 
            error: 'Tag name is required and must be a non-empty string' 
          });
        }

        const trimmedName = name.trim();
        if (trimmedName.length > 100) {
          return res.status(400).json({ 
            success: false, 
            error: 'Tag name must be 100 characters or less' 
          });
        }

        const userDb = await this.userDatabaseManager.getUserDatabase(authId);
        
        // Check for case-insensitive duplicate
        const existing = userDb.db.prepare(`
          SELECT id FROM tags WHERE LOWER(name) = LOWER(?)
        `).get(trimmedName);

        if (existing) {
          return res.status(409).json({ 
            success: false, 
            error: 'A tag with this name already exists' 
          });
        }

        const result = userDb.db.prepare(`
          INSERT INTO tags (name)
          VALUES (?)
        `).run(trimmedName);

        const tag = userDb.db.prepare(`
          SELECT id, name, created_at, updated_at
          FROM tags
          WHERE id = ?
        `).get(result.lastInsertRowid);

        res.json({ success: true, tag });
      } catch (error) {
        logger.error('Error creating tag', error, {
          endpoint: '/api/tags',
          method: 'POST',
          authId: req.body.authId || req.headers['x-auth-id'],
        });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // GET /api/tags/:id - Get single tag
    this.app.get('/api/tags/:id', async (req, res) => {
      try {
        const authId = req.query.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const tagId = parseInt(req.params.id);
        const userDb = await this.userDatabaseManager.getUserDatabase(authId);

        const tag = userDb.db.prepare(`
          SELECT 
            t.id,
            t.name,
            t.created_at,
            t.updated_at,
            COUNT(dt.id) as usage_count
          FROM tags t
          LEFT JOIN download_tags dt ON t.id = dt.tag_id
          WHERE t.id = ?
          GROUP BY t.id, t.name, t.created_at, t.updated_at
        `).get(tagId);

        if (!tag) {
          return res.status(404).json({ 
            success: false, 
            error: 'Tag not found' 
          });
        }

        res.json({ success: true, tag });
      } catch (error) {
        logger.error('Error fetching tag', error, {
          endpoint: `/api/tags/${req.params.id}`,
          method: 'GET',
          tagId: req.params.id,
          authId: req.query.authId || req.headers['x-auth-id'],
        });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // PUT /api/tags/:id - Update tag
    this.app.put('/api/tags/:id', async (req, res) => {
      try {
        const authId = req.body.authId || req.headers['x-auth-id'] || req.query.authId;
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const tagId = parseInt(req.params.id);
        const { name } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ 
            success: false, 
            error: 'Tag name is required and must be a non-empty string' 
          });
        }

        const trimmedName = name.trim();
        if (trimmedName.length > 100) {
          return res.status(400).json({ 
            success: false, 
            error: 'Tag name must be 100 characters or less' 
          });
        }

        const userDb = await this.userDatabaseManager.getUserDatabase(authId);

        // Check if exists
        const existing = userDb.db.prepare(`
          SELECT id FROM tags WHERE id = ?
        `).get(tagId);

        if (!existing) {
          return res.status(404).json({ 
            success: false, 
            error: 'Tag not found' 
          });
        }

        // Check for case-insensitive duplicate (excluding current tag)
        const duplicate = userDb.db.prepare(`
          SELECT id FROM tags WHERE LOWER(name) = LOWER(?) AND id != ?
        `).get(trimmedName, tagId);

        if (duplicate) {
          return res.status(409).json({ 
            success: false, 
            error: 'A tag with this name already exists' 
          });
        }

        userDb.db.prepare(`
          UPDATE tags
          SET name = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(trimmedName, tagId);

        const tag = userDb.db.prepare(`
          SELECT id, name, created_at, updated_at
          FROM tags
          WHERE id = ?
        `).get(tagId);

        res.json({ success: true, tag });
      } catch (error) {
        logger.error('Error updating tag', error, {
          endpoint: `/api/tags/${req.params.id}`,
          method: 'PUT',
          tagId: req.params.id,
          authId: req.body.authId || req.headers['x-auth-id'] || req.query.authId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // DELETE /api/tags/:id - Delete tag
    this.app.delete('/api/tags/:id', async (req, res) => {
      try {
        const authId = req.query.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const tagId = parseInt(req.params.id);
        const userDb = await this.userDatabaseManager.getUserDatabase(authId);

        // Check if exists
        const existing = userDb.db.prepare(`
          SELECT id FROM tags WHERE id = ?
        `).get(tagId);

        if (!existing) {
          return res.status(404).json({ 
            success: false, 
            error: 'Tag not found' 
          });
        }

        // Delete (cascade will remove download_tags associations)
        userDb.db.prepare(`
          DELETE FROM tags WHERE id = ?
        `).run(tagId);

        res.json({ success: true, message: 'Tag deleted successfully' });
      } catch (error) {
        logger.error('Error deleting tag', error, {
          endpoint: `/api/tags/${req.params.id}`,
          method: 'DELETE',
          tagId: req.params.id,
          authId: req.query.authId || req.headers['x-auth-id'],
        });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // ===== Download Tags API =====

    // GET /api/downloads/tags - Get all download-tag mappings (bulk)
    this.app.get('/api/downloads/tags', async (req, res) => {
      try {
        const authId = req.query.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const userDb = await this.userDatabaseManager.getUserDatabase(authId);
        
        const query = `
          SELECT 
            dt.download_id,
            t.id as tag_id,
            t.name as tag_name
          FROM download_tags dt
          INNER JOIN tags t ON dt.tag_id = t.id
          ORDER BY dt.download_id, t.name
        `;

        const mappings = userDb.db.prepare(query).all();

        // Group by download_id
        const result = {};
        for (const mapping of mappings) {
          const downloadId = mapping.download_id;
          if (!result[downloadId]) {
            result[downloadId] = [];
          }
          result[downloadId].push({
            id: mapping.tag_id,
            name: mapping.tag_name,
          });
        }

        res.json({ success: true, mappings: result });
      } catch (error) {
        logger.error('Error fetching download tags', error, {
          endpoint: '/api/downloads/tags',
          method: 'GET',
          authId: req.query.authId || req.headers['x-auth-id'],
        });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // POST /api/downloads/tags - Assign tags to downloads (bulk)
    this.app.post('/api/downloads/tags', async (req, res) => {
      try {
        const authId = req.body.authId || req.headers['x-auth-id'];
        if (!authId) {
          return res.status(400).json({ success: false, error: 'authId required' });
        }

        const { download_ids, tag_ids, operation = 'add' } = req.body;

        if (!Array.isArray(download_ids) || download_ids.length === 0) {
          return res.status(400).json({ 
            success: false, 
            error: 'download_ids must be a non-empty array' 
          });
        }

        if (!Array.isArray(tag_ids)) {
          return res.status(400).json({ 
            success: false, 
            error: 'tag_ids must be an array' 
          });
        }

        if (operation !== 'add' && operation !== 'remove' && operation !== 'replace') {
          return res.status(400).json({ 
            success: false, 
            error: 'operation must be one of: add, remove, replace' 
          });
        }

        const userDb = await this.userDatabaseManager.getUserDatabase(authId);

        // Validate all tag IDs exist
        if (tag_ids.length > 0) {
          const placeholders = tag_ids.map(() => '?').join(',');
          const existingTags = userDb.db.prepare(`
            SELECT id FROM tags WHERE id IN (${placeholders})
          `).all(...tag_ids);

          if (existingTags.length !== tag_ids.length) {
            return res.status(400).json({ 
              success: false, 
              error: 'One or more tag IDs are invalid' 
            });
          }
        }

        // Use transaction for atomicity
        const transaction = userDb.db.transaction(() => {
          if (operation === 'replace') {
            // Remove all existing tags for these downloads
            const deletePlaceholders = download_ids.map(() => '?').join(',');
            userDb.db.prepare(`
              DELETE FROM download_tags 
              WHERE download_id IN (${deletePlaceholders})
            `).run(...download_ids);

            // Add new tags
            if (tag_ids.length > 0) {
              const insertStmt = userDb.db.prepare(`
                INSERT OR IGNORE INTO download_tags (tag_id, download_id)
                VALUES (?, ?)
              `);
              for (const downloadId of download_ids) {
                for (const tagId of tag_ids) {
                  insertStmt.run(tagId, downloadId);
                }
              }
            }
          } else if (operation === 'add') {
            // Add tags (ignore duplicates)
            const insertStmt = userDb.db.prepare(`
              INSERT OR IGNORE INTO download_tags (tag_id, download_id)
              VALUES (?, ?)
            `);
            for (const downloadId of download_ids) {
              for (const tagId of tag_ids) {
                insertStmt.run(tagId, downloadId);
              }
            }
          } else if (operation === 'remove') {
            // Remove tags
            const deletePlaceholders = download_ids.map(() => '?').join(',');
            const tagPlaceholders = tag_ids.map(() => '?').join(',');
            userDb.db.prepare(`
              DELETE FROM download_tags 
              WHERE download_id IN (${deletePlaceholders}) 
                AND tag_id IN (${tagPlaceholders})
            `).run(...download_ids, ...tag_ids);
          }
        });

        transaction();

        res.json({ 
          success: true, 
          message: `Tags ${operation === 'add' ? 'added' : operation === 'remove' ? 'removed' : 'replaced'} successfully` 
        });
      } catch (error) {
        logger.error('Error assigning tags to downloads', error, {
          endpoint: '/api/downloads/tags',
          method: 'POST',
          authId: req.body.authId || req.headers['x-auth-id'],
        });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Error handling middleware
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error in request handler', error, {
        endpoint: req.originalUrl || req.url,
        method: req.method,
        ip: req.ip || req.connection?.remoteAddress,
      });
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
      logger.info('Master database initialized');

      // Initialize user database manager
      const userDbDir = process.env.USER_DB_DIR || '/app/data/users';
      this.userDatabaseManager = new UserDatabaseManager(this.masterDatabase.db, userDbDir);
      logger.info('User database manager initialized', { userDbDir });

      // Initialize polling scheduler (pass automation engines map for sharing)
      this.pollingScheduler = new PollingScheduler(
        this.userDatabaseManager, 
        this.masterDatabase,
        this.automationEngines
      );
      await this.pollingScheduler.start();
      logger.info('Polling scheduler started');

      // Initialize automation engines for existing users
      const activeUsers = this.masterDatabase.getActiveUsers();
      for (const user of activeUsers) {
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

// Start the server
const backend = new TorBoxBackend();
backend.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await backend.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await backend.shutdown();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', reason instanceof Error ? reason : new Error(String(reason)), {
    promise: promise.toString(),
  });
});

export default TorBoxBackend;
