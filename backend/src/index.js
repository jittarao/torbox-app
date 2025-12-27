import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import path from 'path';
import fs from 'fs';

import Database from './database/Database.js';
import AutomationEngine from './automation/AutomationEngine.js';
import ApiClient from './api/ApiClient.js';

class TorBoxBackend {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    this.database = new Database();
    this.automationEngine = null;
    this.apiClient = null;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeServices();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable for API
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
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
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
      res.json({ 
        available: true, 
        mode: 'selfhosted',
        version: process.env.npm_package_version || '0.1.0',
        uptime: process.uptime()
      });
    });

    // Health check for Docker
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Automation rules endpoints
    this.app.get('/api/automation/rules', async (req, res) => {
      try {
        const rules = await this.database.getAutomationRules();
        // Transform database structure to match frontend expectations
        const transformedRules = rules.map(rule => ({
          id: rule.id,
          name: rule.name,
          enabled: rule.enabled === 1,
          trigger: rule.trigger_config,
          conditions: rule.conditions,
          logicOperator: rule.logic_operator || 'and',
          action: rule.action_config,
          metadata: rule.metadata,
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
        console.log('Received request body:', JSON.stringify(req.body, null, 2));
        const { rules } = req.body;
        console.log('Extracted rules:', rules);
        await this.database.saveAutomationRules(rules);
        
        // Restart automation engine with new rules
        if (this.automationEngine) {
          await this.automationEngine.reloadRules();
        }
        
        res.json({ success: true, message: 'Rules saved successfully' });
      } catch (error) {
        console.error('Error saving automation rules:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Individual rule operations
    this.app.put('/api/automation/rules/:id', async (req, res) => {
      try {
        const ruleId = parseInt(req.params.id);
        const { enabled } = req.body;
        
        if (enabled !== undefined) {
          await this.database.updateRuleStatus(ruleId, enabled);
          res.json({ success: true, message: 'Rule updated successfully' });
        } else {
          res.status(400).json({ success: false, error: 'Missing enabled field' });
        }
      } catch (error) {
        console.error('Error updating rule:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.delete('/api/automation/rules/:id', async (req, res) => {
      try {
        const ruleId = parseInt(req.params.id);
        await this.database.deleteRule(ruleId);
        res.json({ success: true, message: 'Rule deleted successfully' });
      } catch (error) {
        console.error('Error deleting rule:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Rule execution logs endpoint
    this.app.get('/api/automation/rules/:id/logs', async (req, res) => {
      try {
        const ruleId = parseInt(req.params.id);
        const logs = await this.database.getRuleExecutionHistory(ruleId);
        res.json({ success: true, logs });
      } catch (error) {
        console.error('Error fetching rule logs:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API key management endpoints
    this.app.post('/api/backend/api-key', async (req, res) => {
      try {
        const { apiKey } = req.body;
        
        if (!apiKey) {
          return res.status(400).json({ success: false, error: 'API key is required' });
        }

        // Initialize API client with the provided key
        this.apiClient = new ApiClient(apiKey);
        
        // Test the API key by making a simple request
        try {
          await this.apiClient.getTorrents();
          console.log('TorBox API key validated and client initialized');
        } catch (error) {
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid API key or TorBox API unavailable' 
          });
        }

        // Initialize automation engine if not already done
        if (!this.automationEngine) {
          this.automationEngine = new AutomationEngine(this.database, this.apiClient);
          await this.automationEngine.initialize();
          console.log('Automation engine initialized with user-provided API key');
        } else {
          // Update existing automation engine with new API client
          this.automationEngine.apiClient = this.apiClient;
          await this.automationEngine.reloadRules();
          console.log('Automation engine updated with new API key');
        }

        res.json({ success: true, message: 'API key set successfully' });
      } catch (error) {
        console.error('Error setting API key:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/backend/api-key/status', async (req, res) => {
      try {
        const hasApiKey = !!this.apiClient;
        const automationStatus = this.automationEngine ? this.automationEngine.getStatus() : null;
        
        res.json({ 
          success: true, 
          hasApiKey,
          automationEngine: automationStatus
        });
      } catch (error) {
        console.error('Error checking API key status:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Download history endpoints
    this.app.get('/api/downloads/history', async (req, res) => {
      try {
        const history = await this.database.getDownloadHistory();
        res.json({ success: true, history });
      } catch (error) {
        console.error('Error fetching download history:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/downloads/history', async (req, res) => {
      try {
        const { history } = req.body;
        await this.database.saveDownloadHistory(history);
        res.json({ success: true, message: 'Download history saved successfully' });
      } catch (error) {
        console.error('Error saving download history:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Generic storage endpoints
    this.app.get('/api/storage/:key', async (req, res) => {
      try {
        const { key } = req.params;
        
        // Validate key to prevent path traversal
        if (!key || key.includes('..') || key.includes('/') || key.includes('\\')) {
          return res.status(400).json({ success: false, error: 'Invalid key format' });
        }
        
        const value = await this.database.getStorageValue(key);
        res.json({ success: true, value });
      } catch (error) {
        console.error(`Error fetching storage value for key ${req.params.key}:`, error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/storage/:key', async (req, res) => {
      try {
        const { key } = req.params;
        
        // Validate key to prevent path traversal
        if (!key || key.includes('..') || key.includes('/') || key.includes('\\')) {
          return res.status(400).json({ success: false, error: 'Invalid key format' });
        }
        
        const { value } = req.body;
        await this.database.setStorageValue(key, value);
        res.json({ success: true, message: 'Value saved successfully' });
      } catch (error) {
        console.error(`Error saving storage value for key ${req.params.key}:`, error);
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
      // Initialize database
      await this.database.initialize();
      console.log('Database initialized');

      // Initialize API client if TorBox API key is provided
      if (process.env.TORBOX_API_KEY) {
        this.apiClient = new ApiClient(process.env.TORBOX_API_KEY);
        console.log('TorBox API client initialized with environment key');
      } else {
        console.log('No TorBox API key in environment - frontend will handle API key input');
        // Backend will work in limited mode, frontend handles API calls directly
      }

      // Initialize automation engine
      if (this.apiClient) {
        this.automationEngine = new AutomationEngine(this.database, this.apiClient);
        await this.automationEngine.initialize();
        console.log('Automation engine initialized');
      }

      console.log('TorBox Backend started successfully');
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
}

// Start the server
const backend = new TorBoxBackend();
backend.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default TorBoxBackend;