import express from 'express';
import fs from 'fs';
import path from 'path';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import logger from '../utils/logger.js';

/**
 * Admin API Routes
 * Provides admin endpoints for managing the entire application
 */
export function setupAdminRoutes(app, backend) {
  const router = express.Router();
  const { adminRateLimiter } = backend;

  // Apply admin auth middleware to all routes
  router.use(adminAuthMiddleware);
  router.use(adminRateLimiter);

  // ===== Admin Authentication =====
  
  router.post('/auth', (req, res) => {
    // Authentication is handled by middleware
    res.json({
      success: true,
      message: 'Admin authenticated',
      timestamp: new Date().toISOString()
    });
  });

  router.get('/verify', (req, res) => {
    res.json({
      success: true,
      authenticated: true,
      timestamp: new Date().toISOString()
    });
  });

  // ===== User Management =====

  router.get('/users', async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 1000));
      const offset = (page - 1) * limit;
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
      const countQuery = query.replace(
        /SELECT[\s\S]*?FROM/,
        'SELECT COUNT(*) as total FROM'
      );
      const totalResult = backend.masterDatabase.getQuery(countQuery, params);
      const total = totalResult?.total || 0;

      // Get paginated results
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
      const users = backend.masterDatabase.allQuery(query, params);

      // Get database sizes for users
      const usersWithSizes = await Promise.all(
        users.map(async (user) => {
          let dbSize = null;
          let dbExists = false;
          try {
            if (fs.existsSync(user.db_path)) {
              dbExists = true;
              const stats = fs.statSync(user.db_path);
              dbSize = stats.size;
            }
          } catch (error) {
            logger.warn('Error getting database size', { authId: user.auth_id, error: error.message });
          }

          return {
            ...user,
            db_size: dbSize,
            db_exists: dbExists,
            db_size_formatted: dbSize ? `${(dbSize / 1024 / 1024).toFixed(2)} MB` : null
          };
        })
      );

      res.json({
        success: true,
        users: usersWithSizes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching users', error, { endpoint: '/api/admin/users' });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/users/:authId', async (req, res) => {
    try {
      const { authId } = req.params;
      
      if (!/^[a-f0-9]{64}$/.test(authId)) {
        return res.status(400).json({ success: false, error: 'Invalid authId format' });
      }

      const user = backend.masterDatabase.getQuery(`
        SELECT 
          ur.*,
          ak.encrypted_key,
          ak.key_name,
          ak.is_active as api_key_active,
          ak.created_at as api_key_created_at
        FROM user_registry ur
        LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
        WHERE ur.auth_id = ?
      `, [authId]);

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Get database info
      let dbInfo = null;
      try {
        if (fs.existsSync(user.db_path)) {
          const stats = fs.statSync(user.db_path);
          dbInfo = {
            exists: true,
            size: stats.size,
            size_formatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
            modified: stats.mtime
          };
        } else {
          dbInfo = { exists: false };
        }
      } catch (error) {
        logger.warn('Error getting database info', { authId, error: error.message });
      }

      // Get automation engine status
      const engine = backend.automationEngines.get(authId);
      const engineStatus = engine ? {
        initialized: engine.isInitialized,
        running_jobs: engine.runningJobs.size
      } : null;

      // Get poller status
      const pollerStatus = backend.pollingScheduler?.pollers.get(authId)?.getStatus() || null;

      res.json({
        success: true,
        user: {
          ...user,
          db_info: dbInfo,
          automation_engine: engineStatus,
          poller: pollerStatus
        }
      });
    } catch (error) {
      logger.error('Error fetching user details', error, { authId: req.params.authId });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/users/:authId', async (req, res) => {
    try {
      const { authId } = req.params;
      
      if (!/^[a-f0-9]{64}$/.test(authId)) {
        return res.status(400).json({ success: false, error: 'Invalid authId format' });
      }

      // Check if user exists
      const user = backend.masterDatabase.getQuery(
        'SELECT db_path FROM user_registry WHERE auth_id = ?',
        [authId]
      );

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Log admin action
      logger.info('Admin deleting user', {
        authId,
        adminIp: req.ip,
        dbPath: user.db_path
      });

      // Stop automation engine if running
      const engine = backend.automationEngines.get(authId);
      if (engine) {
        engine.shutdown();
        backend.automationEngines.delete(authId);
      }

      // Remove poller if exists
      if (backend.pollingScheduler) {
        const poller = backend.pollingScheduler.pollers.get(authId);
        if (poller) {
          backend.pollingScheduler.pollers.delete(authId);
        }
      }

      // Close database connection from pool
      if (backend.userDatabaseManager && backend.userDatabaseManager.pool) {
        backend.userDatabaseManager.pool.delete(authId);
      }

      // Delete user database file
      let dbDeleted = false;
      if (fs.existsSync(user.db_path)) {
        try {
          fs.unlinkSync(user.db_path);
          dbDeleted = true;
        } catch (error) {
          logger.error('Error deleting user database file', error, { authId, dbPath: user.db_path });
        }
      }

      // Delete from master database (cascade will handle api_keys)
      backend.masterDatabase.runQuery(
        'DELETE FROM user_registry WHERE auth_id = ?',
        [authId]
      );

      // Clear cache
      const cache = (await import('../utils/cache.js')).default;
      cache.clearUserRegistry(authId);
      cache.clearActiveUsers();

      res.json({
        success: true,
        message: 'User deleted successfully',
        db_deleted: dbDeleted
      });
    } catch (error) {
      logger.error('Error deleting user', error, { authId: req.params.authId });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.put('/users/:authId/status', async (req, res) => {
    try {
      const { authId } = req.params;
      const { status } = req.body;

      if (!/^[a-f0-9]{64}$/.test(authId)) {
        return res.status(400).json({ success: false, error: 'Invalid authId format' });
      }

      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Status must be "active" or "inactive"' });
      }

      // Check if user exists
      const user = backend.masterDatabase.getQuery(
        'SELECT status FROM user_registry WHERE auth_id = ?',
        [authId]
      );

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Log admin action
      logger.info('Admin updating user status', {
        authId,
        oldStatus: user.status,
        newStatus: status,
        adminIp: req.ip
      });

      // Update status
      backend.masterDatabase.runQuery(
        'UPDATE user_registry SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE auth_id = ?',
        [status, authId]
      );

      // Clear cache
      const cache = (await import('../utils/cache.js')).default;
      cache.clearUserRegistry(authId);
      cache.clearActiveUsers();

      res.json({
        success: true,
        message: 'User status updated successfully'
      });
    } catch (error) {
      logger.error('Error updating user status', error, { authId: req.params.authId });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/users/:authId/database', async (req, res) => {
    try {
      const { authId } = req.params;
      
      if (!/^[a-f0-9]{64}$/.test(authId)) {
        return res.status(400).json({ success: false, error: 'Invalid authId format' });
      }

      const user = backend.masterDatabase.getQuery(
        'SELECT db_path FROM user_registry WHERE auth_id = ?',
        [authId]
      );

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      let dbStats = null;
      try {
        if (fs.existsSync(user.db_path)) {
          const stats = fs.statSync(user.db_path);
          const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
          
          // Get table counts
          const tables = ['automation_rules', 'torrent_shadow', 'torrent_telemetry', 
                         'speed_history', 'archived_downloads', 'custom_views', 'tags', 'download_tags'];
          const tableCounts = {};
          
          for (const table of tables) {
            try {
              const count = userDb.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
              tableCounts[table] = count?.count || 0;
            } catch (error) {
              // Table might not exist or error querying
              tableCounts[table] = null;
            }
          }

          dbStats = {
            exists: true,
            path: user.db_path,
            size: stats.size,
            size_formatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
            modified: stats.mtime,
            table_counts: tableCounts
          };
        } else {
          dbStats = { exists: false, path: user.db_path };
        }
      } catch (error) {
        logger.error('Error getting database stats', error, { authId });
        return res.status(500).json({ success: false, error: error.message });
      }

      res.json({
        success: true,
        database: dbStats
      });
    } catch (error) {
      logger.error('Error fetching user database info', error, { authId: req.params.authId });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/users/:authId/automation', async (req, res) => {
    try {
      const { authId } = req.params;
      
      if (!/^[a-f0-9]{64}$/.test(authId)) {
        return res.status(400).json({ success: false, error: 'Invalid authId format' });
      }

      const user = backend.masterDatabase.getQuery(
        'SELECT auth_id FROM user_registry WHERE auth_id = ?',
        [authId]
      );

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
      
      // Get automation rules
      const rules = userDb.db.prepare(`
        SELECT id, name, enabled, trigger_config, conditions, action_config, 
               metadata, last_executed_at, execution_count, created_at, updated_at
        FROM automation_rules
        ORDER BY created_at DESC
      `).all();

      // Get recent execution logs (last 100)
      const logs = userDb.db.prepare(`
        SELECT id, rule_id, rule_name, execution_type, items_processed, 
               success, error_message, executed_at
        FROM rule_execution_log
        ORDER BY executed_at DESC
        LIMIT 100
      `).all();

      // Get execution statistics
      const stats = userDb.db.prepare(`
        SELECT 
          COUNT(*) as total_executions,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_executions,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_executions,
          SUM(items_processed) as total_items_processed
        FROM rule_execution_log
        WHERE executed_at >= datetime('now', '-7 days')
      `).get();

      res.json({
        success: true,
        rules: rules.map(rule => ({
          ...rule,
          trigger_config: JSON.parse(rule.trigger_config || '{}'),
          conditions: JSON.parse(rule.conditions || '{}'),
          action_config: JSON.parse(rule.action_config || '{}'),
          metadata: rule.metadata ? JSON.parse(rule.metadata) : null
        })),
        recent_logs: logs,
        statistics: {
          total_rules: rules.length,
          enabled_rules: rules.filter(r => r.enabled).length,
          ...stats
        }
      });
    } catch (error) {
      logger.error('Error fetching user automation info', error, { authId: req.params.authId });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== System Metrics =====

  router.get('/metrics/overview', async (req, res) => {
    try {
      const activeUsers = backend.masterDatabase.getActiveUsers();
      const totalUsers = backend.masterDatabase.allQuery('SELECT COUNT(*) as count FROM user_registry')[0]?.count || 0;
      const inactiveUsers = totalUsers - activeUsers.length;

      // Get users with active rules
      const usersWithRules = backend.masterDatabase.allQuery(`
        SELECT COUNT(DISTINCT auth_id) as count 
        FROM user_registry 
        WHERE has_active_rules = 1 AND status = 'active'
      `)[0]?.count || 0;

      // Get memory usage
      const memoryUsage = backend.getMemoryUsage();

      // Get database stats
      let masterDbSize = null;
      try {
        if (fs.existsSync(backend.masterDatabase.dbPath)) {
          const stats = fs.statSync(backend.masterDatabase.dbPath);
          masterDbSize = stats.size;
        }
      } catch (error) {
        logger.warn('Error getting master DB size', { error: error.message });
      }

      // Get total user database sizes
      let totalUserDbSize = 0;
      let userDbCount = 0;
      try {
        const userDbs = backend.masterDatabase.allQuery('SELECT db_path FROM user_registry');
        for (const user of userDbs) {
          if (fs.existsSync(user.db_path)) {
            const stats = fs.statSync(user.db_path);
            totalUserDbSize += stats.size;
            userDbCount++;
          }
        }
      } catch (error) {
        logger.warn('Error calculating total user DB size', { error: error.message });
      }

      res.json({
        success: true,
        overview: {
          users: {
            total: totalUsers,
            active: activeUsers.length,
            inactive: inactiveUsers,
            with_active_rules: usersWithRules
          },
          databases: {
            master_size: masterDbSize,
            master_size_formatted: masterDbSize ? `${(masterDbSize / 1024 / 1024).toFixed(2)} MB` : null,
            total_user_size: totalUserDbSize,
            total_user_size_formatted: `${(totalUserDbSize / 1024 / 1024).toFixed(2)} MB`,
            user_db_count: userDbCount
          },
          memory: memoryUsage,
          system: backend.getSystemInfo(),
          automation_engines: backend.automationEngines.size,
          polling_scheduler: backend.pollingScheduler ? backend.pollingScheduler.getStatus() : null
        }
      });
    } catch (error) {
      logger.error('Error fetching overview metrics', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/metrics/database', async (req, res) => {
    try {
      // Master database stats
      let masterStats = null;
      try {
        if (fs.existsSync(backend.masterDatabase.dbPath)) {
          const stats = fs.statSync(backend.masterDatabase.dbPath);
          const tableCounts = {};
          
          // Get table counts
          const tables = ['user_registry', 'api_keys'];
          for (const table of tables) {
            try {
              const count = backend.masterDatabase.getQuery(`SELECT COUNT(*) as count FROM ${table}`);
              tableCounts[table] = count?.count || 0;
            } catch (error) {
              tableCounts[table] = null;
            }
          }

          masterStats = {
            path: backend.masterDatabase.dbPath,
            size: stats.size,
            size_formatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
            modified: stats.mtime,
            table_counts: tableCounts
          };
        }
      } catch (error) {
        logger.warn('Error getting master DB stats', { error: error.message });
      }

      // Connection pool stats
      const poolStats = backend.userDatabaseManager ? backend.userDatabaseManager.getPoolStats() : null;

      res.json({
        success: true,
        master_database: masterStats,
        connection_pool: poolStats
      });
    } catch (error) {
      logger.error('Error fetching database metrics', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/metrics/polling', (req, res) => {
    try {
      const schedulerStatus = backend.pollingScheduler ? backend.pollingScheduler.getStatus() : null;
      
      res.json({
        success: true,
        polling: schedulerStatus
      });
    } catch (error) {
      logger.error('Error fetching polling metrics', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/metrics/automation', async (req, res) => {
    try {
      const activeUsers = backend.masterDatabase.getActiveUsers();
      
      let totalRules = 0;
      let enabledRules = 0;
      let totalExecutions = 0;
      let successfulExecutions = 0;
      let failedExecutions = 0;

      for (const user of activeUsers) {
        try {
          const userDb = await backend.userDatabaseManager.getUserDatabase(user.auth_id);
          
          const ruleStats = userDb.db.prepare(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled
            FROM automation_rules
          `).get();

          totalRules += ruleStats?.total || 0;
          enabledRules += ruleStats?.enabled || 0;

          const execStats = userDb.db.prepare(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
              SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
            FROM rule_execution_log
            WHERE executed_at >= datetime('now', '-7 days')
          `).get();

          totalExecutions += execStats?.total || 0;
          successfulExecutions += execStats?.successful || 0;
          failedExecutions += execStats?.failed || 0;
        } catch (error) {
          logger.warn('Error getting automation stats for user', { authId: user.auth_id, error: error.message });
        }
      }

      res.json({
        success: true,
        automation: {
          total_rules: totalRules,
          enabled_rules: enabledRules,
          disabled_rules: totalRules - enabledRules,
          executions_last_7_days: {
            total: totalExecutions,
            successful: successfulExecutions,
            failed: failedExecutions,
            success_rate: totalExecutions > 0 ? ((successfulExecutions / totalExecutions) * 100).toFixed(2) + '%' : '0%'
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching automation metrics', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/metrics/performance', (req, res) => {
    try {
      res.json({
        success: true,
        performance: {
          memory: backend.getMemoryUsage(),
          system: backend.getSystemInfo(),
          uptime: process.uptime(),
          uptime_formatted: backend.formatUptime(process.uptime())
        }
      });
    } catch (error) {
      logger.error('Error fetching performance metrics', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== Database Management =====

  router.get('/databases', async (req, res) => {
    try {
      const users = backend.masterDatabase.allQuery('SELECT auth_id, db_path FROM user_registry');
      
      const databases = await Promise.all(
        users.map(async (user) => {
          let dbInfo = {
            auth_id: user.auth_id,
            path: user.db_path,
            exists: false,
            size: null,
            size_formatted: null
          };

          try {
            if (fs.existsSync(user.db_path)) {
              const stats = fs.statSync(user.db_path);
              dbInfo.exists = true;
              dbInfo.size = stats.size;
              dbInfo.size_formatted = `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
              dbInfo.modified = stats.mtime;
            }
          } catch (error) {
            logger.warn('Error getting DB info', { authId: user.auth_id, error: error.message });
          }

          return dbInfo;
        })
      );

      res.json({
        success: true,
        databases
      });
    } catch (error) {
      logger.error('Error fetching databases list', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/databases/pool', (req, res) => {
    try {
      const poolStats = backend.userDatabaseManager ? backend.userDatabaseManager.getPoolStats() : null;
      
      res.json({
        success: true,
        pool: poolStats
      });
    } catch (error) {
      logger.error('Error fetching pool stats', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/databases/:authId/backup', async (req, res) => {
    try {
      const { authId } = req.params;
      
      if (!/^[a-f0-9]{64}$/.test(authId)) {
        return res.status(400).json({ success: false, error: 'Invalid authId format' });
      }

      const user = backend.masterDatabase.getQuery(
        'SELECT db_path FROM user_registry WHERE auth_id = ?',
        [authId]
      );

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      if (!fs.existsSync(user.db_path)) {
        return res.status(404).json({ success: false, error: 'Database file not found' });
      }

      // Create backup path
      const backupDir = path.join(path.dirname(user.db_path), 'backups');
      await fs.promises.mkdir(backupDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `user_${authId.substring(0, 8)}_${timestamp}.db`;
      const backupPath = path.join(backupDir, backupFileName);

      // Copy database file
      await fs.promises.copyFile(user.db_path, backupPath);

      logger.info('Admin created database backup', {
        authId,
        backupPath,
        adminIp: req.ip
      });

      const stats = fs.statSync(backupPath);

      res.json({
        success: true,
        message: 'Backup created successfully',
        backup: {
          path: backupPath,
          filename: backupFileName,
          size: stats.size,
          size_formatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          created: stats.birthtime
        }
      });
    } catch (error) {
      logger.error('Error creating database backup', error, { authId: req.params.authId });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/databases/:authId/backups', async (req, res) => {
    try {
      const { authId } = req.params;
      
      if (!/^[a-f0-9]{64}$/.test(authId)) {
        return res.status(400).json({ success: false, error: 'Invalid authId format' });
      }

      const user = backend.masterDatabase.getQuery(
        'SELECT db_path FROM user_registry WHERE auth_id = ?',
        [authId]
      );

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Get backups directory
      const backupDir = path.join(path.dirname(user.db_path), 'backups');
      
      if (!fs.existsSync(backupDir)) {
        return res.json({
          success: true,
          backups: []
        });
      }

      // Read backup files
      const files = await fs.promises.readdir(backupDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.db') && file.startsWith(`user_${authId.substring(0, 8)}_`)) {
          const filePath = path.join(backupDir, file);
          try {
            const stats = fs.statSync(filePath);
            backups.push({
              filename: file,
              size: stats.size,
              size_formatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
              created: stats.birthtime,
              modified: stats.mtime
            });
          } catch (error) {
            logger.warn('Error getting backup file stats', { file, error: error.message });
          }
        }
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => new Date(b.created) - new Date(a.created));

      res.json({
        success: true,
        backups
      });
    } catch (error) {
      logger.error('Error listing backups', error, { authId: req.params.authId });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/databases/:authId/backup/:filename', async (req, res) => {
    try {
      const { authId, filename } = req.params;
      
      if (!/^[a-f0-9]{64}$/.test(authId)) {
        return res.status(400).json({ success: false, error: 'Invalid authId format' });
      }

      // Validate filename to prevent path traversal
      if (!/^user_[a-f0-9]{8}_[\d\-TZ]+\.db$/.test(filename)) {
        return res.status(400).json({ success: false, error: 'Invalid backup filename' });
      }

      const user = backend.masterDatabase.getQuery(
        'SELECT db_path FROM user_registry WHERE auth_id = ?',
        [authId]
      );

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Construct backup path
      const backupDir = path.join(path.dirname(user.db_path), 'backups');
      const backupPath = path.join(backupDir, filename);

      // Check if backup file exists
      if (!fs.existsSync(backupPath)) {
        return res.status(404).json({ success: false, error: 'Backup file not found' });
      }

      // Get file stats
      const stats = fs.statSync(backupPath);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', stats.size);

      // Stream the file
      const fileStream = fs.createReadStream(backupPath);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        logger.error('Error streaming backup file', error, { authId, filename });
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Error reading backup file' });
        }
      });

      logger.info('Admin downloaded database backup', {
        authId,
        filename,
        size: stats.size,
        adminIp: req.ip
      });
    } catch (error) {
      logger.error('Error downloading database backup', error, { authId: req.params.authId, filename: req.params.filename });
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  });

  router.post('/databases/:authId/vacuum', async (req, res) => {
    try {
      const { authId } = req.params;
      
      if (!/^[a-f0-9]{64}$/.test(authId)) {
        return res.status(400).json({ success: false, error: 'Invalid authId format' });
      }

      const user = backend.masterDatabase.getQuery(
        'SELECT db_path FROM user_registry WHERE auth_id = ?',
        [authId]
      );

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      logger.info('Admin running database vacuum', {
        authId,
        adminIp: req.ip
      });

      const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
      
      // Get size before
      const statsBefore = fs.statSync(user.db_path);
      const sizeBefore = statsBefore.size;

      // Run VACUUM
      userDb.db.prepare('VACUUM').run();

      // Get size after
      const statsAfter = fs.statSync(user.db_path);
      const sizeAfter = statsAfter.size;

      const spaceFreed = sizeBefore - sizeAfter;

      res.json({
        success: true,
        message: 'Database vacuum completed',
        before: {
          size: sizeBefore,
          size_formatted: `${(sizeBefore / 1024 / 1024).toFixed(2)} MB`
        },
        after: {
          size: sizeAfter,
          size_formatted: `${(sizeAfter / 1024 / 1024).toFixed(2)} MB`
        },
        space_freed: spaceFreed,
        space_freed_formatted: `${(spaceFreed / 1024 / 1024).toFixed(2)} MB`
      });
    } catch (error) {
      logger.error('Error running database vacuum', error, { authId: req.params.authId });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/databases/master/stats', (req, res) => {
    try {
      let stats = null;
      try {
        if (fs.existsSync(backend.masterDatabase.dbPath)) {
          const fileStats = fs.statSync(backend.masterDatabase.dbPath);
          
          const tableCounts = {};
          const tables = ['user_registry', 'api_keys'];
          for (const table of tables) {
            try {
              const count = backend.masterDatabase.getQuery(`SELECT COUNT(*) as count FROM ${table}`);
              tableCounts[table] = count?.count || 0;
            } catch (error) {
              tableCounts[table] = null;
            }
          }

          stats = {
            path: backend.masterDatabase.dbPath,
            size: fileStats.size,
            size_formatted: `${(fileStats.size / 1024 / 1024).toFixed(2)} MB`,
            modified: fileStats.mtime,
            table_counts: tableCounts
          };
        }
      } catch (error) {
        logger.warn('Error getting master DB stats', { error: error.message });
      }

      res.json({
        success: true,
        master_database: stats
      });
    } catch (error) {
      logger.error('Error fetching master database stats', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== Automation Monitoring =====

  router.get('/automation/rules', async (req, res) => {
    try {
      const activeUsers = backend.masterDatabase.getActiveUsers();
      const allRules = [];

      for (const user of activeUsers) {
        try {
          const userDb = await backend.userDatabaseManager.getUserDatabase(user.auth_id);
          const rules = userDb.db.prepare(`
            SELECT id, name, enabled, execution_count, last_executed_at, created_at
            FROM automation_rules
            ORDER BY created_at DESC
          `).all();

          for (const rule of rules) {
            allRules.push({
              ...rule,
              auth_id: user.auth_id,
              key_name: user.key_name
            });
          }
        } catch (error) {
          logger.warn('Error getting rules for user', { authId: user.auth_id, error: error.message });
        }
      }

      res.json({
        success: true,
        rules: allRules
      });
    } catch (error) {
      logger.error('Error fetching automation rules', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/automation/executions', async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 100, 1000));
      const authId = req.query.authId; // Optional filter by user
      const success = req.query.success; // Optional filter by success status

      const activeUsers = authId 
        ? backend.masterDatabase.allQuery('SELECT auth_id, key_name FROM user_registry WHERE auth_id = ? AND status = ?', [authId, 'active'])
        : backend.masterDatabase.getActiveUsers();

      const allExecutions = [];

      for (const user of activeUsers) {
        try {
          const userDb = await backend.userDatabaseManager.getUserDatabase(user.auth_id);
          
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
              key_name: user.key_name
            });
          }
        } catch (error) {
          logger.warn('Error getting executions for user', { authId: user.auth_id, error: error.message });
        }
      }

      // Sort by executed_at descending and limit
      allExecutions.sort((a, b) => new Date(b.executed_at) - new Date(a.executed_at));
      const limited = allExecutions.slice(0, limit);

      res.json({
        success: true,
        executions: limited
      });
    } catch (error) {
      logger.error('Error fetching automation executions', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/automation/errors', async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 100, 1000));
      const activeUsers = backend.masterDatabase.getActiveUsers();
      const errors = [];

      for (const user of activeUsers) {
        try {
          const userDb = await backend.userDatabaseManager.getUserDatabase(user.auth_id);
          const errorLogs = userDb.db.prepare(`
            SELECT id, rule_id, rule_name, execution_type, items_processed, 
                   error_message, executed_at
            FROM rule_execution_log
            WHERE success = 0
            ORDER BY executed_at DESC
            LIMIT ?
          `).all(limit);

          for (const error of errorLogs) {
            errors.push({
              ...error,
              auth_id: user.auth_id,
              key_name: user.key_name
            });
          }
        } catch (error) {
          logger.warn('Error getting errors for user', { authId: user.auth_id, error: error.message });
        }
      }

      // Sort by executed_at descending and limit
      errors.sort((a, b) => new Date(b.executed_at) - new Date(a.executed_at));
      const limited = errors.slice(0, limit);

      res.json({
        success: true,
        errors: limited
      });
    } catch (error) {
      logger.error('Error fetching automation errors', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/automation/stats', async (req, res) => {
    try {
      const activeUsers = backend.masterDatabase.getActiveUsers();
      
      let totalRules = 0;
      let enabledRules = 0;
      let totalExecutions = 0;
      let successfulExecutions = 0;
      let failedExecutions = 0;
      let totalItemsProcessed = 0;

      for (const user of activeUsers) {
        try {
          const userDb = await backend.userDatabaseManager.getUserDatabase(user.auth_id);
          
          const ruleStats = userDb.db.prepare(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled
            FROM automation_rules
          `).get();

          totalRules += ruleStats?.total || 0;
          enabledRules += ruleStats?.enabled || 0;

          const execStats = userDb.db.prepare(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
              SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
              SUM(items_processed) as items
            FROM rule_execution_log
            WHERE executed_at >= datetime('now', '-7 days')
          `).get();

          totalExecutions += execStats?.total || 0;
          successfulExecutions += execStats?.successful || 0;
          failedExecutions += execStats?.failed || 0;
          totalItemsProcessed += execStats?.items || 0;
        } catch (error) {
          logger.warn('Error getting automation stats for user', { authId: user.auth_id, error: error.message });
        }
      }

      res.json({
        success: true,
        stats: {
          rules: {
            total: totalRules,
            enabled: enabledRules,
            disabled: totalRules - enabledRules
          },
          executions_last_7_days: {
            total: totalExecutions,
            successful: successfulExecutions,
            failed: failedExecutions,
            success_rate: totalExecutions > 0 ? ((successfulExecutions / totalExecutions) * 100).toFixed(2) + '%' : '0%',
            total_items_processed: totalItemsProcessed
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching automation stats', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== Logs and Debugging =====

  router.get('/logs', async (req, res) => {
    try {
      const { spawn } = await import('child_process');
      const container = req.query.container || 'torbox-backend';
      const tail = parseInt(req.query.tail, 10) || 100;
      const since = req.query.since || null; // e.g., "10m", "1h", "2024-01-01T00:00:00"

      // Validate container name to prevent command injection
      const allowedContainers = ['torbox-backend', 'torbox-app'];
      if (!allowedContainers.includes(container)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid container name',
          allowed: allowedContainers
        });
      }

      // Build docker logs command
      const args = ['logs'];
      if (tail) {
        args.push('--tail', tail.toString());
      }
      if (since) {
        args.push('--since', since);
      }
      args.push(container);

      // Execute docker logs command
      const dockerProcess = spawn('docker', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      dockerProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      dockerProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      dockerProcess.on('close', (code) => {
        if (code !== 0) {
          logger.error('Docker logs command failed', { container, code, stderr });
          return res.status(500).json({
            success: false,
            error: stderr || 'Failed to retrieve logs',
            code
          });
        }

        // Parse logs into lines
        const lines = stdout.split('\n').filter(line => line.trim());
        
        res.json({
          success: true,
          container,
          logs: lines,
          count: lines.length
        });
      });

      dockerProcess.on('error', (error) => {
        logger.error('Error executing docker logs', error, { container });
        if (error.code === 'ENOENT') {
          res.status(503).json({
            success: false,
            error: 'Docker command not found',
            note: 'Docker CLI must be installed. For Docker containers, mount Docker socket: -v /var/run/docker.sock:/var/run/docker.sock'
          });
        } else {
          res.status(500).json({
            success: false,
            error: error.message || 'Failed to execute docker command',
            note: 'Make sure Docker is available and the container exists'
          });
        }
      });
    } catch (error) {
      logger.error('Error in logs endpoint', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/logs/stream', async (req, res) => {
    try {
      const { spawn } = await import('child_process');
      const container = req.query.container || 'torbox-backend';
      const tail = parseInt(req.query.tail, 10) || 100;

      // Validate container name
      const allowedContainers = ['torbox-backend', 'torbox-app'];
      if (!allowedContainers.includes(container)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid container name',
          allowed: allowedContainers
        });
      }

      // Set up Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Send initial connection message
      res.write(`data: ${JSON.stringify({ type: 'connected', container })}\n\n`);

      // Build docker logs command with follow flag
      const args = ['logs', '--follow', '--tail', tail.toString(), container];

      const dockerProcess = spawn('docker', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      dockerProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        for (const line of lines) {
          res.write(`data: ${JSON.stringify({ type: 'log', line, timestamp: new Date().toISOString() })}\n\n`);
        }
      });

      dockerProcess.stderr.on('data', (data) => {
        res.write(`data: ${JSON.stringify({ type: 'error', error: data.toString() })}\n\n`);
      });

      dockerProcess.on('close', (code) => {
        res.write(`data: ${JSON.stringify({ type: 'closed', code })}\n\n`);
        res.end();
      });

      dockerProcess.on('error', (error) => {
        logger.error('Error in docker logs stream', error, { container });
        if (error.code === 'ENOENT') {
          res.write(`data: ${JSON.stringify({ type: 'error', error: 'Docker command not found. Docker CLI must be installed or Docker socket must be mounted.' })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Failed to execute docker command' })}\n\n`);
        }
        res.end();
      });

      // Clean up on client disconnect
      req.on('close', () => {
        dockerProcess.kill();
        res.end();
      });
    } catch (error) {
      logger.error('Error in logs stream endpoint', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/logs/errors', async (req, res) => {
    try {
      const { spawn } = await import('child_process');
      const container = req.query.container || 'torbox-backend';
      const tail = parseInt(req.query.tail, 10) || 100;

      // Validate container name
      const allowedContainers = ['torbox-backend', 'torbox-app'];
      if (!allowedContainers.includes(container)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid container name',
          allowed: allowedContainers
        });
      }

      const args = ['logs', '--tail', tail.toString(), container];

      const dockerProcess = spawn('docker', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      dockerProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      dockerProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      dockerProcess.on('close', (code) => {
        if (code !== 0) {
          return res.status(500).json({
            success: false,
            error: stderr || 'Failed to retrieve logs'
          });
        }

        // Filter for error-level logs (this is a simple filter - adjust based on your log format)
        const lines = stdout.split('\n').filter(line => {
          const lower = line.toLowerCase();
          return lower.includes('error') || 
                 lower.includes('err') || 
                 lower.includes('fatal') ||
                 lower.includes('exception') ||
                 lower.includes('failed');
        });

        res.json({
          success: true,
          container,
          errors: lines,
          count: lines.length
        });
      });

      dockerProcess.on('error', (error) => {
        logger.error('Error executing docker logs', error, { container });
        if (error.code === 'ENOENT') {
          res.status(503).json({
            success: false,
            error: 'Docker command not found',
            note: 'Docker CLI must be installed. For Docker containers, mount Docker socket: -v /var/run/docker.sock:/var/run/docker.sock'
          });
        } else {
          res.status(500).json({
            success: false,
            error: error.message || 'Failed to execute docker command'
          });
        }
      });
    } catch (error) {
      logger.error('Error in logs/errors endpoint', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== System Configuration =====

  router.get('/config', (req, res) => {
    try {
      const config = {
        polling: {
          max_concurrent_polls: parseInt(process.env.MAX_CONCURRENT_POLLS || '7', 10),
          poll_timeout_ms: parseInt(process.env.POLL_TIMEOUT_MS || '300000', 10),
          poller_cleanup_interval_hours: parseInt(process.env.POLLER_CLEANUP_INTERVAL_HOURS || '24', 10)
        },
        rate_limiting: {
          user_rate_limit_max: parseInt(process.env.USER_RATE_LIMIT_MAX || '200', 10),
          admin_rate_limit_max: parseInt(process.env.ADMIN_RATE_LIMIT_MAX || '100', 10)
        },
        database: {
          max_db_connections: parseInt(process.env.MAX_DB_CONNECTIONS || '200', 10),
          master_db_path: process.env.MASTER_DB_PATH || '/app/data/master.db',
          user_db_dir: process.env.USER_DB_DIR || '/app/data/users'
        },
        frontend_url: process.env.FRONTEND_URL || 'http://localhost:3000',
        node_env: process.env.NODE_ENV || 'development'
      };

      res.json({
        success: true,
        config
      });
    } catch (error) {
      logger.error('Error fetching system config', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.put('/config', (req, res) => {
    // Note: Updating config at runtime would require environment variable changes
    // which typically requires a restart. This is a read-only endpoint for now.
    res.json({
      success: false,
      message: 'Configuration updates require environment variable changes and server restart',
      note: 'Modify environment variables and restart the server to update configuration'
    });
  });

  // Mount admin routes
  app.use('/api/admin', router);
}
