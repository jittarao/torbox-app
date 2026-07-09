import logger from '../utils/logger.js';
import { serverErrorPayload } from '../utils/httpErrors.js';
import {
  DownloadProtectionService,
  DownloadProtectedError,
} from '../services/DownloadProtectionService.js';
import { isDestructiveOperation } from '../config/destructiveDownloadOperations.mjs';
import { respondDownloadProtected } from '../utils/downloadProtectionResponse.js';
import { notifyProtectionChanged } from '../utils/userEvents.js';

export const BULK_PROTECTION_MAX = 1000;

/**
 * Protected download routes
 */
export function setupProtectedDownloadsRoutes(app, backend) {
  const { userRateLimiter } = backend;

  // GET /api/downloads/protect - all protected download IDs
  app.get(
    '/api/downloads/protect',
    backend.requireRegisteredUser,
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;

        if (!backend.userDatabaseManager) {
          return res.status(503).json({
            success: false,
            error: 'Service is initializing, please try again in a moment',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        const service = new DownloadProtectionService(userDb.db);

        res.json({ success: true, protected_ids: service.getProtectedIds() });
      } catch (error) {
        logger.error('Error fetching protected downloads', error, {
          endpoint: '/api/downloads/protect',
          method: 'GET',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        if (req.validatedAuthId && backend.userDatabaseManager) {
          backend.userDatabaseManager.releaseConnection(req.validatedAuthId);
        }
      }
    }
  );

  // PUT /api/downloads/protect - bulk protect or unprotect
  app.put(
    '/api/downloads/protect',
    backend.requireRegisteredUser,
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;

        if (!backend.userDatabaseManager) {
          return res.status(503).json({
            success: false,
            error: 'Service is initializing, please try again in a moment',
          });
        }

        const { download_ids: downloadIds, protected: isProtected } = req.body;

        if (!Array.isArray(downloadIds) || downloadIds.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'download_ids array is required and must not be empty',
          });
        }

        if (downloadIds.length > BULK_PROTECTION_MAX) {
          return res.status(400).json({
            success: false,
            error: `download_ids array must not exceed ${BULK_PROTECTION_MAX} items`,
          });
        }

        if (typeof isProtected !== 'boolean') {
          return res.status(400).json({
            success: false,
            error: 'protected boolean is required',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        const service = new DownloadProtectionService(userDb.db);
        service.setProtected(downloadIds, isProtected);

        notifyProtectionChanged(backend, authId);

        res.json({
          success: true,
          protected_ids: service.getProtectedIds(),
        });
      } catch (error) {
        logger.error('Error updating protected downloads', error, {
          endpoint: '/api/downloads/protect',
          method: 'PUT',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        if (req.validatedAuthId && backend.userDatabaseManager) {
          backend.userDatabaseManager.releaseConnection(req.validatedAuthId);
        }
      }
    }
  );

  // POST /api/downloads/protect/assert - partition IDs for destructive operations
  app.post(
    '/api/downloads/protect/assert',
    backend.requireRegisteredUser,
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;

        if (!backend.userDatabaseManager) {
          return res.status(503).json({
            success: false,
            error: 'Service is initializing, please try again in a moment',
          });
        }

        const { download_ids: downloadIds, operation } = req.body;

        if (!Array.isArray(downloadIds) || downloadIds.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'download_ids array is required and must not be empty',
          });
        }

        if (downloadIds.length > BULK_PROTECTION_MAX) {
          return res.status(400).json({
            success: false,
            error: `download_ids array must not exceed ${BULK_PROTECTION_MAX} items`,
          });
        }

        if (!operation || !isDestructiveOperation(operation)) {
          return res.status(400).json({
            success: false,
            error: 'operation must be a destructive download operation',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        const service = new DownloadProtectionService(userDb.db);
        const { allowed, blocked } = service.partitionByProtection(downloadIds);

        if (blocked.length > 0 && allowed.length === 0) {
          return respondDownloadProtected(res, blocked);
        }

        res.json({
          success: true,
          allowed,
          blocked,
        });
      } catch (error) {
        logger.error('Error asserting download protection', error, {
          endpoint: '/api/downloads/protect/assert',
          method: 'POST',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        if (req.validatedAuthId && backend.userDatabaseManager) {
          backend.userDatabaseManager.releaseConnection(req.validatedAuthId);
        }
      }
    }
  );
}
