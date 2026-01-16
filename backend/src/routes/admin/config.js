import { sendSuccess, sendError } from './helpers.js';

/**
 * System Configuration Routes
 */
export function setupConfigRoutes(router, backend) {
  // Get system configuration
  router.get('/config', (req, res) => {
    try {
      const config = {
        polling: {
          max_concurrent_polls: parseInt(process.env.MAX_CONCURRENT_POLLS || '7', 10),
          poll_timeout_ms: parseInt(process.env.POLL_TIMEOUT_MS || '300000', 10),
          poller_cleanup_interval_hours: parseInt(
            process.env.POLLER_CLEANUP_INTERVAL_HOURS || '24',
            10
          ),
        },
        rate_limiting: {
          user_rate_limit_max: parseInt(process.env.USER_RATE_LIMIT_MAX || '300', 10),
          admin_rate_limit_max: parseInt(process.env.ADMIN_RATE_LIMIT_MAX || '100', 10),
        },
        database: {
          max_db_connections: parseInt(process.env.MAX_DB_CONNECTIONS || '200', 10),
          master_db_path: process.env.MASTER_DB_PATH || '/app/data/master.db',
          user_db_dir: process.env.USER_DB_DIR || '/app/data/users',
        },
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
