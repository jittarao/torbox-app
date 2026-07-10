import { sendSuccess, sendError } from './helpers.js';
import { getMasterDbPath, getUserDbDir } from '../../utils/dataPaths.js';
import { getUploadQuotaLimits } from '../../config/uploadQuota.js';
import { getAutomationInactivityDays } from '../../config/automationInactivity.js';

/**
 * System Configuration Routes
 */
export function setupConfigRoutes(router, backend) {
  // Get system configuration
  router.get('/config', (req, res) => {
    try {
      const config = {
        polling: {
          max_concurrent_polls: parseInt(process.env.MAX_CONCURRENT_POLLS || '12', 10),
          min_poll_interval_ms: 5 * 60 * 1000,
          poll_kickout_ms: parseInt(process.env.POLL_KICKOUT_MS || '180000', 10),
          poller_cleanup_interval_hours: parseInt(
            process.env.POLLER_CLEANUP_INTERVAL_HOURS || '24',
            10
          ),
          inactive_user_days: getAutomationInactivityDays(),
        },
        rate_limiting: {
          ip_rate_limit_max: parseInt(process.env.IP_RATE_LIMIT_MAX || '1000', 10),
          user_rate_limit_max: parseInt(process.env.USER_RATE_LIMIT_MAX || '500', 10),
          admin_rate_limit_max: parseInt(process.env.ADMIN_RATE_LIMIT_MAX || '100', 10),
        },
        database: {
          max_db_connections: parseInt(process.env.MAX_DB_CONNECTIONS || '50', 10),
          master_db_path: getMasterDbPath(),
          user_db_dir: getUserDbDir(),
        },
        upload_quotas: (() => {
          const limits = getUploadQuotaLimits();
          return {
            max_storage_mb: limits.maxStorageMb,
            max_files: limits.maxFiles,
            default_tier: 'limited',
          };
        })(),
        frontend_url: process.env.FRONTEND_URL || 'http://localhost:3000',
        node_env: process.env.NODE_ENV || 'development',
      };

      sendSuccess(res, { config });
    } catch (error) {
      sendError(res, error, 500, { endpoint: '/config' });
    }
  });

  // Update system configuration (read-only for now)
  router.put('/config', (req, res) => {
    // Note: Updating config at runtime would require environment variable changes
    // which typically requires a restart. This is a read-only endpoint for now.
    sendSuccess(res, {
      success: false,
      message: 'Configuration updates require environment variable changes and server restart',
      note: 'Modify environment variables and restart the server to update configuration',
    });
  });
}
