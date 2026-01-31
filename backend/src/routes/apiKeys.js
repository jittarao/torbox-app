import ApiClient from '../api/ApiClient.js';
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
      const { authId, wasNew } = await backend.masterDatabase.registerApiKey(apiKey, keyName);

      // Invalidate cached API client if it exists (in case key was updated)
      if (backend.uploadProcessor) {
        backend.uploadProcessor.invalidateApiClient(authId);
      }

      // Register user in UserDatabaseManager (creates DB if needed)
      // If this fails and the API key was newly inserted, rollback by deleting the API key
      try {
        await backend.userDatabaseManager.registerUser(apiKey, keyName);
      } catch (error) {
        // Rollback: if API key was newly inserted and user registration failed,
        // delete the API key to maintain consistency between api_keys and user_registry
        if (wasNew) {
          logger.warn('User registration failed after API key registration, rolling back API key', {
            authId,
            error: error.message,
          });
          try {
            backend.masterDatabase.deleteApiKey(authId);
          } catch (rollbackError) {
            logger.error(
              'Failed to rollback API key after user registration failure',
              rollbackError,
              {
                authId,
              }
            );
          }
        }
        // Re-throw the original error
        throw error;
      }

      // Refresh polling scheduler to pick up new user (engines are created per poll / on demand)
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

        // Register API key in master database
        const { authId: registeredAuthId, wasNew } = await backend.masterDatabase.registerApiKey(
          apiKey,
          keyName
        );

        // Verify authId matches (should always be the same)
        if (registeredAuthId !== authId) {
          logger.warn('AuthId mismatch during registration', {
            expected: authId,
            received: registeredAuthId,
          });
        }

        // Invalidate cached API client if it exists (in case key was updated)
        if (backend.uploadProcessor) {
          backend.uploadProcessor.invalidateApiClient(authId);
        }

        // Register user in UserDatabaseManager (creates DB if needed)
        // If this fails and the API key was newly inserted, rollback by deleting the API key
        try {
          await backend.userDatabaseManager.registerUser(apiKey, keyName, pollInterval);
        } catch (error) {
          // Rollback: if API key was newly inserted and user registration failed,
          // delete the API key to maintain consistency between api_keys and user_registry
          if (wasNew) {
            logger.warn(
              'User registration failed after API key registration, rolling back API key',
              {
                authId,
                error: error.message,
              }
            );
            try {
              backend.masterDatabase.deleteApiKey(authId);
            } catch (rollbackError) {
              logger.error(
                'Failed to rollback API key after user registration failure',
                rollbackError,
                {
                  authId,
                }
              );
            }
          }
          // Re-throw the original error
          throw error;
        }

        // Refresh polling scheduler (engines are created per poll / on demand)
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
