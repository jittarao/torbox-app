import ApiClient from '../api/ApiClient.js';
import AutomationEngine from '../automation/AutomationEngine.js';
import { hashApiKey } from '../utils/crypto.js';
import logger from '../utils/logger.js';
import fs from 'fs';

/**
 * API key management routes
 */
export function setupApiKeyRoutes(app, backend) {
  // POST /api/backend/api-key - Register API key
  app.post('/api/backend/api-key', async (req, res) => {
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
          error: 'Invalid API key or TorBox API unavailable',
        });
      }

      // Register API key in master database
      const authId = await backend.masterDatabase.registerApiKey(apiKey, keyName);

      // Register user in UserDatabaseManager (creates DB if needed)
      await backend.userDatabaseManager.registerUser(apiKey, keyName);

      // Create automation engine for this user
      const apiKeyData = backend.masterDatabase.getApiKey(authId);
      const automationEngine = new AutomationEngine(
        authId,
        apiKeyData.encrypted_key,
        backend.userDatabaseManager,
        backend.masterDatabase
      );
      await automationEngine.initialize();
      backend.automationEngines.set(authId, automationEngine);

      // Refresh polling scheduler to pick up new user
      if (backend.pollingScheduler) {
        await backend.pollingScheduler.refreshPollers();
      }

      res.json({
        success: true,
        message: 'API key registered successfully',
        authId,
      });
    } catch (error) {
      logger.error('Error registering API key', error, {
        endpoint: '/api/backend/api-key',
        method: 'POST',
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/backend/api-key/status - Get API key status
  app.get('/api/backend/api-key/status', async (req, res) => {
    try {
      const activeUsers = backend.masterDatabase.getActiveUsers();
      const schedulerStatus = backend.pollingScheduler
        ? backend.pollingScheduler.getStatus()
        : null;

      res.json({
        success: true,
        activeUsers: activeUsers.length,
        automationEngines: backend.automationEngines.size,
        pollingScheduler: schedulerStatus,
      });
    } catch (error) {
      logger.error('Error checking API key status', error, {
        endpoint: '/api/backend/api-key/status',
        method: 'GET',
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/backend/api-key/ensure-db - Ensure user database exists
  app.post('/api/backend/api-key/ensure-db', async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] || req.body.apiKey;

      if (!apiKey) {
        return res.status(400).json({ success: false, error: 'API key is required' });
      }

      // Hash API key to get authId
      const authId = hashApiKey(apiKey);

      // Check if user is already registered
      const existingUser = backend.masterDatabase.getQuery(
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
          await backend.userDatabaseManager.getUserDatabase(authId);
          wasCreated = true;
          dbExists = true;
        }
      } else {
        // User not registered, register them (this creates the DB)
        const keyName = req.body.keyName || null;
        const pollInterval = req.body.pollInterval || 5;

        await backend.masterDatabase.registerApiKey(apiKey, keyName, pollInterval);
        await backend.userDatabaseManager.registerUser(apiKey, keyName, pollInterval);

        // Create automation engine for this user
        const apiKeyData = backend.masterDatabase.getApiKey(authId);
        const automationEngine = new AutomationEngine(
          authId,
          apiKeyData.encrypted_key,
          backend.userDatabaseManager,
          backend.masterDatabase
        );
        await automationEngine.initialize();
        backend.automationEngines.set(authId, automationEngine);

        // Refresh polling scheduler
        if (backend.pollingScheduler) {
          await backend.pollingScheduler.refreshPollers();
        }

        wasCreated = true;
        dbExists = true;
      }

      res.json({
        success: true,
        authId,
        dbExists,
        wasCreated,
        message: wasCreated ? 'User database created' : 'User database already exists',
      });
    } catch (error) {
      logger.error('Error ensuring user database', error, {
        endpoint: '/api/backend/api-key/ensure-db',
        method: 'POST',
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
