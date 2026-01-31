import {
  sendSuccess,
  sendError,
  asyncHandler,
  getDatabaseStats,
  formatBytes,
  getUserDatabaseSafe,
} from './helpers.js';
import logger from '../../utils/logger.js';

/**
 * System Metrics Routes
 */
export function setupMetricsRoutes(router, backend) {
  // Get overview metrics
  router.get(
    '/metrics/overview',
    asyncHandler(async (req, res) => {
      const activeUsers = backend.masterDatabase.getActiveUsers();
      const totalUsers =
        backend.masterDatabase.allQuery('SELECT COUNT(*) as count FROM user_registry')[0]?.count ||
        0;
      const inactiveUsers = totalUsers - activeUsers.length;

      // Get users with active rules
      const usersWithRules =
        backend.masterDatabase.allQuery(`
      SELECT COUNT(DISTINCT auth_id) as count 
      FROM user_registry 
      WHERE has_active_rules = 1 AND status = 'active'
    `)[0]?.count || 0;

      // Get memory usage
      const memoryUsage = backend.getMemoryUsage();

      // Get database stats
      const masterDbStats = getDatabaseStats(backend.masterDatabase.dbPath);

      // Get total user database sizes
      let totalUserDbSize = 0;
      let userDbCount = 0;
      try {
        const userDbs = backend.masterDatabase.allQuery('SELECT db_path FROM user_registry');
        for (const user of userDbs) {
          const stats = getDatabaseStats(user.db_path);
          if (stats?.exists) {
            totalUserDbSize += stats.size;
            userDbCount++;
          }
        }
      } catch (error) {
        logger.warn('Error calculating total user DB size', { error: error.message });
      }

      sendSuccess(res, {
        overview: {
          users: {
            total: totalUsers,
            active: activeUsers.length,
            inactive: inactiveUsers,
            with_active_rules: usersWithRules,
          },
          databases: {
            master_size: masterDbStats?.size || null,
            master_size_formatted: masterDbStats?.size_formatted || null,
            total_user_size: totalUserDbSize,
            total_user_size_formatted: formatBytes(totalUserDbSize),
            user_db_count: userDbCount,
          },
          memory: memoryUsage,
          system: backend.getSystemInfo(),
          connection_pool: backend.userDatabaseManager?.getPoolStats() ?? null,
          polling_scheduler: backend.pollingScheduler ? backend.pollingScheduler.getStatus() : null,
        },
      });
    })
  );

  // Get database metrics
  router.get(
    '/metrics/database',
    asyncHandler(async (req, res) => {
      // Master database stats
      const masterStats = getDatabaseStats(backend.masterDatabase.dbPath);

      if (masterStats?.exists) {
        const tables = ['user_registry', 'api_keys'];
        masterStats.table_counts = {};

        for (const table of tables) {
          try {
            const count = backend.masterDatabase.getQuery(`SELECT COUNT(*) as count FROM ${table}`);
            masterStats.table_counts[table] = count?.count || 0;
          } catch (error) {
            masterStats.table_counts[table] = null;
          }
        }
      }

      // Connection pool stats
      const poolStats = backend.userDatabaseManager
        ? backend.userDatabaseManager.getPoolStats()
        : null;

      sendSuccess(res, {
        master_database: masterStats,
        connection_pool: poolStats,
      });
    })
  );

  // Get polling metrics
  router.get('/metrics/polling', (req, res) => {
    try {
      const schedulerStatus = backend.pollingScheduler
        ? backend.pollingScheduler.getStatus()
        : null;
      sendSuccess(res, { polling: schedulerStatus });
    } catch (error) {
      sendError(res, error, 500, { endpoint: '/metrics/polling' });
    }
  });

  // Get automation metrics
  router.get(
    '/metrics/automation',
    asyncHandler(async (req, res) => {
      const activeUsers = backend.masterDatabase.getActiveUsers();

      let totalRules = 0;
      let enabledRules = 0;
      let totalExecutions = 0;
      let successfulExecutions = 0;
      let failedExecutions = 0;

      for (const user of activeUsers) {
        const userDb = await getUserDatabaseSafe(backend, user.auth_id);
        if (!userDb) continue;

        try {
          const ruleStats = userDb.db
            .prepare(
              `
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled
          FROM automation_rules
        `
            )
            .get();

          totalRules += ruleStats?.total || 0;
          enabledRules += ruleStats?.enabled || 0;

          const execStats = userDb.db
            .prepare(
              `
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
          FROM rule_execution_log
          WHERE executed_at >= datetime('now', '-7 days')
        `
            )
            .get();

          totalExecutions += execStats?.total || 0;
          successfulExecutions += execStats?.successful || 0;
          failedExecutions += execStats?.failed || 0;
        } catch (error) {
          logger.warn('Error getting automation stats for user', {
            authId: user.auth_id,
            error: error.message,
          });
        }
      }

      sendSuccess(res, {
        automation: {
          total_rules: totalRules,
          enabled_rules: enabledRules,
          disabled_rules: totalRules - enabledRules,
          executions_last_7_days: {
            total: totalExecutions,
            successful: successfulExecutions,
            failed: failedExecutions,
            success_rate:
              totalExecutions > 0
                ? ((successfulExecutions / totalExecutions) * 100).toFixed(2) + '%'
                : '0%',
          },
        },
      });
    })
  );

  // Get performance metrics
  router.get('/metrics/performance', (req, res) => {
    try {
      sendSuccess(res, {
        performance: {
          memory: backend.getMemoryUsage(),
          system: backend.getSystemInfo(),
          uptime: process.uptime(),
          uptime_formatted: backend.formatUptime(process.uptime()),
        },
      });
    } catch (error) {
      sendError(res, error, 500, { endpoint: '/metrics/performance' });
    }
  });
}
