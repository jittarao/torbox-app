import { sendSuccess, sendError, asyncHandler } from './helpers.js';
import logger from '../../utils/logger.js';

/**
 * System maintenance routes (admin-triggered operations).
 */
export function setupSystemRoutes(router, backend) {
  router.get(
    '/system/upload-quota-summary',
    asyncHandler(async (req, res) => {
      if (!backend.uploadQuotaService) {
        return sendError(res, 'Upload quota service unavailable', 503);
      }

      sendSuccess(res, {
        summary: backend.uploadQuotaService.getAdminSummary(),
      });
    })
  );

  router.post(
    '/system/enforce-upload-quotas',
    asyncHandler(async (req, res) => {
      if (!backend.uploadQuotaService || !backend.userDatabaseManager) {
        return sendError(res, 'Upload quota service unavailable', 503);
      }

      logger.info('Admin triggered upload quota enforcement', { adminIp: req.ip });

      const result = await backend.uploadQuotaService.enforceQuotaForAllLimitedUsers(
        backend.userDatabaseManager
      );

      sendSuccess(res, {
        message: 'Upload quota enforcement completed',
        result,
        summary: backend.uploadQuotaService.getAdminSummary(),
      });
    })
  );
}
