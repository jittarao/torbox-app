import { parsePagination, sendSuccess, asyncHandler, getUserDatabaseSafe } from './helpers.js';
import logger from '../../utils/logger.js';

/**
 * Automation Monitoring Routes
 */
export function setupAutomationRoutes(router, backend) {
  // Get all automation rules
  router.get(
    '/automation/rules',
    asyncHandler(async (req, res) => {
      const activeUsers = backend.masterDatabase.getActiveUsers();
      const allRules = [];

      for (const user of activeUsers) {
        const userDb = await getUserDatabaseSafe(backend, user.auth_id);
        if (!userDb) continue;

        try {
          const rules = userDb.db
            .prepare(
              `
          SELECT id, name, enabled, execution_count, last_executed_at, created_at
          FROM automation_rules
          ORDER BY created_at DESC
        `
            )
            .all();

          for (const rule of rules) {
            allRules.push({
              ...rule,
              auth_id: user.auth_id,
              key_name: user.key_name,
            });
          }
        } catch (error) {
          logger.warn('Error getting rules for user', {
            authId: user.auth_id,
            error: error.message,
          });
        }
      }

      sendSuccess(res, { rules: allRules });
    })
  );

  // Get automation executions
  router.get(
    '/automation/executions',
    asyncHandler(async (req, res) => {
      const { limit } = parsePagination(req);
      const authId = req.query.authId; // Optional filter by user
      const success = req.query.success; // Optional filter by success status

      const activeUsers = authId
        ? backend.masterDatabase.allQuery(
            'SELECT auth_id, key_name FROM user_registry WHERE auth_id = ? AND status = ?',
            [authId, 'active']
          )
        : backend.masterDatabase.getActiveUsers();

      const allExecutions = [];

      for (const user of activeUsers) {
        const userDb = await getUserDatabaseSafe(backend, user.auth_id);
        if (!userDb) continue;

        try {
          let query = `
          SELECT id, rule_id, rule_name, execution_type, items_processed, 
                 success, error_message, executed_at
          FROM rule_execution_log
        `;
          const conditions = [];
          const params = [];

          if (success !== undefined) {
            conditions.push('success = ?');
            params.push(success === 'true' ? 1 : 0);
          }

          if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
          }

          query += ' ORDER BY executed_at DESC LIMIT ?';
          params.push(limit);

          const executions = userDb.db.prepare(query).all(...params);

          for (const exec of executions) {
            allExecutions.push({
              ...exec,
              auth_id: user.auth_id,
              key_name: user.key_name,
            });
          }
        } catch (error) {
          logger.warn('Error getting executions for user', {
            authId: user.auth_id,
            error: error.message,
          });
        }
      }

      // Sort by executed_at descending and limit
      allExecutions.sort((a, b) => new Date(b.executed_at) - new Date(a.executed_at));
      const limited = allExecutions.slice(0, limit);

      sendSuccess(res, { executions: limited });
    })
  );

  // Get automation errors
  router.get(
    '/automation/errors',
    asyncHandler(async (req, res) => {
      const { limit } = parsePagination(req);
      const activeUsers = backend.masterDatabase.getActiveUsers();
      const errors = [];

      for (const user of activeUsers) {
        const userDb = await getUserDatabaseSafe(backend, user.auth_id);
        if (!userDb) continue;

        try {
          const errorLogs = userDb.db
            .prepare(
              `
          SELECT id, rule_id, rule_name, execution_type, items_processed, 
                 error_message, executed_at
          FROM rule_execution_log
          WHERE success = 0
          ORDER BY executed_at DESC
          LIMIT ?
        `
            )
            .all(limit);

          for (const error of errorLogs) {
            errors.push({
              ...error,
              auth_id: user.auth_id,
              key_name: user.key_name,
            });
          }
        } catch (error) {
          logger.warn('Error getting errors for user', {
            authId: user.auth_id,
            error: error.message,
          });
        }
      }

      // Sort by executed_at descending and limit
      errors.sort((a, b) => new Date(b.executed_at) - new Date(a.executed_at));
      const limited = errors.slice(0, limit);

      sendSuccess(res, { errors: limited });
    })
  );

  // Get automation statistics
  router.get(
    '/automation/stats',
    asyncHandler(async (req, res) => {
      const activeUsers = backend.masterDatabase.getActiveUsers();

      let totalRules = 0;
      let enabledRules = 0;
      let totalExecutions = 0;
      let successfulExecutions = 0;
      let failedExecutions = 0;
      let totalItemsProcessed = 0;

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
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
            SUM(items_processed) as items
          FROM rule_execution_log
          WHERE executed_at >= datetime('now', '-7 days')
        `
            )
            .get();

          totalExecutions += execStats?.total || 0;
          successfulExecutions += execStats?.successful || 0;
          failedExecutions += execStats?.failed || 0;
          totalItemsProcessed += execStats?.items || 0;
        } catch (error) {
          logger.warn('Error getting automation stats for user', {
            authId: user.auth_id,
            error: error.message,
          });
        }
      }

      sendSuccess(res, {
        stats: {
          rules: {
            total: totalRules,
            enabled: enabledRules,
            disabled: totalRules - enabledRules,
          },
          executions_last_7_days: {
            total: totalExecutions,
            successful: successfulExecutions,
            failed: failedExecutions,
            success_rate:
              totalExecutions > 0
                ? ((successfulExecutions / totalExecutions) * 100).toFixed(2) + '%'
                : '0%',
            total_items_processed: totalItemsProcessed,
          },
        },
      });
    })
  );
}
