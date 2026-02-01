import fs from 'fs';
import {
  validateAuthIdParam,
  parsePagination,
  getDatabaseStats,
  getTableCounts,
  sendSuccess,
  sendError,
  asyncHandler,
  getUserDatabaseSafe,
} from './helpers.js';
import { decrypt } from '../../utils/crypto.js';
import logger from '../../utils/logger.js';

/**
 * User Management Routes
 */
export function setupUserRoutes(router, backend) {
  // Get all users with pagination and filtering
  router.get(
    '/users',
    asyncHandler(async (req, res) => {
      const { page, limit, offset } = parsePagination(req);
      const status = req.query.status; // 'active', 'inactive', or undefined for all
      const search = req.query.search; // Search in key_name or auth_id

      let query = `
      SELECT 
        ur.auth_id,
        ur.db_path,
        ur.status,
        ur.has_active_rules,
        ur.non_terminal_torrent_count,
        ur.next_poll_at,
        ur.created_at,
        ur.updated_at,
        ak.key_name,
        ak.is_active as api_key_active
      FROM user_registry ur
      LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
    `;

      const conditions = [];
      const params = [];

      if (status) {
        conditions.push('ur.status = ?');
        params.push(status);
      }

      if (search) {
        conditions.push('(ur.auth_id LIKE ? OR ak.key_name LIKE ?)');
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY ur.created_at DESC';

      // Get total count
      const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
      const totalResult = backend.masterDatabase.getQuery(countQuery, params);
      const total = totalResult?.total || 0;

      // Get paginated results
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
      const users = backend.masterDatabase.allQuery(query, params);

      // Get database sizes for users
      const usersWithSizes = await Promise.all(
        users.map(async (user) => {
          const dbStats = getDatabaseStats(user.db_path);
          return {
            ...user,
            db_size: dbStats?.size || null,
            db_exists: dbStats?.exists || false,
            db_size_formatted: dbStats?.size_formatted || null,
          };
        })
      );

      sendSuccess(res, {
        users: usersWithSizes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    })
  );

  // Get decrypted API key for a user
  router.get(
    '/users/:authId/api-key',
    asyncHandler(async (req, res) => {
      const authId = validateAuthIdParam(req, res);
      if (!authId) return;

      const row = backend.masterDatabase.getQuery(
        'SELECT encrypted_key FROM api_keys WHERE auth_id = ?',
        [authId]
      );

      if (!row?.encrypted_key) {
        return sendError(res, 'No API key found for this user', 404);
      }

      try {
        const apiKey = decrypt(row.encrypted_key);
        sendSuccess(res, { api_key: apiKey });
      } catch (error) {
        logger.error('Failed to decrypt API key', { authId, error: error.message });
        return sendError(res, 'Failed to retrieve API key', 500);
      }
    })
  );

  // Get single user details
  router.get(
    '/users/:authId',
    asyncHandler(async (req, res) => {
      const authId = validateAuthIdParam(req, res);
      if (!authId) return;

      const user = backend.masterDatabase.getQuery(
        `
      SELECT 
        ur.*,
        ak.encrypted_key,
        ak.key_name,
        ak.is_active as api_key_active,
        ak.created_at as api_key_created_at
      FROM user_registry ur
      LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
      WHERE ur.auth_id = ?
    `,
        [authId]
      );

      if (!user) {
        return sendError(res, 'User not found', 404);
      }

      // Get database info
      const dbInfo = getDatabaseStats(user.db_path);

      // Get poller status (engines are created per poll / on demand, not cached)
      const pollerStatus = backend.pollingScheduler?.pollers.get(authId)?.getStatus() || null;

      sendSuccess(res, {
        user: {
          ...user,
          db_info: dbInfo,
          poller: pollerStatus,
        },
      });
    })
  );

  // Delete user
  router.delete(
    '/users/:authId',
    asyncHandler(async (req, res) => {
      const authId = validateAuthIdParam(req, res);
      if (!authId) return;

      // Check if user exists
      const user = backend.masterDatabase.getQuery(
        'SELECT db_path FROM user_registry WHERE auth_id = ?',
        [authId]
      );

      if (!user) {
        return sendError(res, 'User not found', 404);
      }

      // Log admin action
      logger.info('Admin deleting user', {
        authId,
        adminIp: req.ip,
        dbPath: user.db_path,
      });

      // Remove poller if exists (engines are not cached)
      if (backend.pollingScheduler) {
        const poller = backend.pollingScheduler.pollers.get(authId);
        if (poller) {
          backend.pollingScheduler.pollers.delete(authId);
        }
      }

      // Close database connection from pool
      if (backend.userDatabaseManager?.pool) {
        backend.userDatabaseManager.pool.delete(authId);
      }

      // Delete user database file
      let dbDeleted = false;
      if (fs.existsSync(user.db_path)) {
        try {
          fs.unlinkSync(user.db_path);
          dbDeleted = true;
        } catch (error) {
          logger.error('Error deleting user database file', error, {
            authId,
            dbPath: user.db_path,
          });
        }
      }

      // Delete from master database (cascade will handle api_keys)
      backend.masterDatabase.runQuery('DELETE FROM user_registry WHERE auth_id = ?', [authId]);

      // Invalidate cache
      const cache = (await import('../../utils/cache.js')).default;
      cache.invalidateUserRegistry(authId);
      cache.invalidateActiveUsers();

      sendSuccess(res, {
        message: 'User deleted successfully',
        db_deleted: dbDeleted,
      });
    })
  );

  // Update user status
  router.put(
    '/users/:authId/status',
    asyncHandler(async (req, res) => {
      const authId = validateAuthIdParam(req, res);
      if (!authId) return;

      const { status } = req.body;

      if (!['active', 'inactive'].includes(status)) {
        return sendError(res, 'Status must be "active" or "inactive"', 400);
      }

      // Check if user exists
      const user = backend.masterDatabase.getQuery(
        'SELECT status FROM user_registry WHERE auth_id = ?',
        [authId]
      );

      if (!user) {
        return sendError(res, 'User not found', 404);
      }

      // Log admin action
      logger.info('Admin updating user status', {
        authId,
        oldStatus: user.status,
        newStatus: status,
        adminIp: req.ip,
      });

      // Update status (syncs both user_registry.status and api_keys.is_active)
      backend.masterDatabase.updateUserStatus(authId, status);

      // Invalidate cache
      const cache = (await import('../../utils/cache.js')).default;
      cache.invalidateUserRegistry(authId);
      cache.invalidateActiveUsers();

      sendSuccess(res, {
        message: 'User status updated successfully',
      });
    })
  );

  // Get user database info
  router.get(
    '/users/:authId/database',
    asyncHandler(async (req, res) => {
      const authId = validateAuthIdParam(req, res);
      if (!authId) return;

      const user = backend.masterDatabase.getQuery(
        'SELECT db_path FROM user_registry WHERE auth_id = ?',
        [authId]
      );

      if (!user) {
        return sendError(res, 'User not found', 404);
      }

      const dbStats = getDatabaseStats(user.db_path);

      if (dbStats?.exists) {
        const userDb = await getUserDatabaseSafe(backend, authId);
        if (userDb) {
          const tables = [
            'automation_rules',
            'torrent_shadow',
            'torrent_telemetry',
            'speed_history',
            'archived_downloads',
            'custom_views',
            'tags',
            'download_tags',
          ];
          dbStats.table_counts = getTableCounts(userDb.db, tables);
        }
      }

      sendSuccess(res, { database: dbStats });
    })
  );

  // Get user automation info
  router.get(
    '/users/:authId/automation',
    asyncHandler(async (req, res) => {
      const authId = validateAuthIdParam(req, res);
      if (!authId) return;

      const user = backend.masterDatabase.getQuery(
        'SELECT auth_id FROM user_registry WHERE auth_id = ?',
        [authId]
      );

      if (!user) {
        return sendError(res, 'User not found', 404);
      }

      const userDb = await getUserDatabaseSafe(backend, authId);
      if (!userDb) {
        return sendError(res, 'Failed to access user database', 500);
      }

      // Get automation rules
      const rules = userDb.db
        .prepare(
          `
      SELECT id, name, enabled, trigger_config, conditions, action_config, 
             metadata, last_executed_at, execution_count, created_at, updated_at
      FROM automation_rules
      ORDER BY created_at DESC
    `
        )
        .all();

      // Get recent execution logs (last 100)
      const logs = userDb.db
        .prepare(
          `
      SELECT id, rule_id, rule_name, execution_type, items_processed, 
             success, error_message, executed_at
      FROM rule_execution_log
      ORDER BY executed_at DESC
      LIMIT 100
    `
        )
        .all();

      // Get execution statistics
      const stats = userDb.db
        .prepare(
          `
      SELECT 
        COUNT(*) as total_executions,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_executions,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_executions,
        SUM(items_processed) as total_items_processed
      FROM rule_execution_log
      WHERE executed_at >= datetime('now', '-7 days')
    `
        )
        .get();

      sendSuccess(res, {
        rules: rules.map((rule) => ({
          ...rule,
          trigger_config: JSON.parse(rule.trigger_config || '{}'),
          conditions: JSON.parse(rule.conditions || '{}'),
          action_config: JSON.parse(rule.action_config || '{}'),
          metadata: rule.metadata ? JSON.parse(rule.metadata) : null,
        })),
        recent_logs: logs,
        statistics: {
          total_rules: rules.length,
          enabled_rules: rules.filter((r) => r.enabled).length,
          ...stats,
        },
      });
    })
  );
}
