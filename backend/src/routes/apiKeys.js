import ApiClient from '../api/ApiClient.js';
import { hashApiKey } from '../utils/crypto.js';
import logger from '../utils/logger.js';
import { access } from 'fs/promises';
import { constants } from 'fs';

/**
 * Validate API key against TorBox API (test request).
 * @returns {Promise<boolean>} - true if valid
 */
async function validateApiKeyWithTorBox(apiKey) {
  const testClient = new ApiClient(apiKey);
  try {
    await testClient.getTorrents();
    return true;
  } catch {
    return false;
  }
}

/**
 * Register API key and user DB; on user registration failure, rollback API key if it was newly inserted.
 * @param {Object} backend - Backend instance
 * @param {string} apiKey - Raw API key
 * @param {string|null} keyName - Optional key name
 * @param {number|null} [pollInterval=null] - Optional poll interval for ensure-db
 * @returns {Promise<{ authId: string, wasNew: boolean }>}
 */
async function registerAndRollbackOnFailure(backend, apiKey, keyName, pollInterval = null) {
  const { authId, wasNew } = await backend.masterDatabase.registerApiKey(apiKey, keyName);

  if (backend.uploadProcessor) {
    backend.uploadProcessor.invalidateApiClient(authId);
  }

  try {
    await backend.userDatabaseManager.registerUser(apiKey, keyName, pollInterval);
  } catch (error) {
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
          { authId }
        );
      }
    }
    throw error;
  }

  return { authId, wasNew };
}

function apiKeyRouteError(res, error, context) {
  const message =
    process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong';
  res.status(500).json({ success: false, error: message, ...context });
}

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

      if (!(await validateApiKeyWithTorBox(apiKey))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid API key or TorBox API unavailable',
        });
      }

      const { authId } = await registerAndRollbackOnFailure(backend, apiKey, keyName);

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
      apiKeyRouteError(res, error);
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
      apiKeyRouteError(res, error);
    }
  });

  // POST /api/backend/api-key/ensure-db - Ensure user database exists
  app.post('/api/backend/api-key/ensure-db', async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] || req.body.apiKey;

      if (!apiKey) {
        return res.status(400).json({ success: false, error: 'API key is required' });
      }

      const authId = hashApiKey(apiKey);

      const existingUser = backend.masterDatabase.getQuery(
        'SELECT auth_id, db_path FROM user_registry WHERE auth_id = ?',
        [authId]
      );

      let dbExists = false;
      let wasCreated = false;

      if (existingUser) {
        try {
          await access(existingUser.db_path, constants.F_OK);
          dbExists = true;
        } catch {
          dbExists = false;
        }

        if (!dbExists) {
          await backend.userDatabaseManager.getUserDatabase(authId);
          backend.userDatabaseManager.releaseConnection(authId);
          wasCreated = true;
          dbExists = true;
        }
      } else {
        if (!(await validateApiKeyWithTorBox(apiKey))) {
          return res.status(400).json({
            success: false,
            error: 'Invalid API key or TorBox API unavailable',
          });
        }

        const keyName = req.body.keyName || null;
        const pollInterval = req.body.pollInterval ?? 5;

        await registerAndRollbackOnFailure(backend, apiKey, keyName, pollInterval);

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
      apiKeyRouteError(res, error);
    }
  });
}
