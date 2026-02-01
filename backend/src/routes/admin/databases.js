import fs from 'fs';
import path from 'path';
import {
  validateAuthIdParam,
  sendSuccess,
  sendError,
  asyncHandler,
  getDatabaseStats,
  formatBytes,
  getUserDatabaseSafe,
} from './helpers.js';
import logger from '../../utils/logger.js';

/**
 * Database Management Routes
 */
export function setupDatabaseRoutes(router, backend) {
  // List all databases
  router.get(
    '/databases',
    asyncHandler(async (req, res) => {
      const users = backend.masterDatabase.allQuery('SELECT auth_id, db_path FROM user_registry');

      const databases = await Promise.all(
        users.map(async (user) => {
          const dbStats = getDatabaseStats(user.db_path);
          return {
            auth_id: user.auth_id,
            path: user.db_path,
            exists: dbStats?.exists || false,
            size: dbStats?.size || null,
            size_formatted: dbStats?.size_formatted || null,
            modified: dbStats?.modified || null,
          };
        })
      );

      sendSuccess(res, { databases });
    })
  );

  // Get connection pool stats
  router.get('/databases/pool', (req, res) => {
    try {
      const poolStats = backend.userDatabaseManager
        ? backend.userDatabaseManager.getPoolStats()
        : null;
      sendSuccess(res, { pool: poolStats });
    } catch (error) {
      sendError(res, error, 500, { endpoint: '/databases/pool' });
    }
  });

  // Create database backup
  router.post(
    '/databases/:authId/backup',
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
      if (!dbStats?.exists) {
        return sendError(res, 'Database file not found', 404);
      }

      // Flush WAL into main .db so backup is a consistent snapshot (DB uses WAL mode)
      const userDb = await getUserDatabaseSafe(backend, authId);
      if (userDb) {
        try {
          userDb.db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').run();
        } catch (checkpointError) {
          logger.warn('WAL checkpoint failed before backup', {
            authId,
            error: checkpointError.message,
          });
        }
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
        adminIp: req.ip,
      });

      const backupStats = fs.statSync(backupPath);

      sendSuccess(res, {
        message: 'Backup created successfully',
        backup: {
          path: backupPath,
          filename: backupFileName,
          size: backupStats.size,
          size_formatted: formatBytes(backupStats.size),
          created: backupStats.birthtime,
        },
      });
    })
  );

  // List database backups
  router.get(
    '/databases/:authId/backups',
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

      // Get backups directory
      const backupDir = path.join(path.dirname(user.db_path), 'backups');

      if (!fs.existsSync(backupDir)) {
        return sendSuccess(res, { backups: [] });
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
              size_formatted: formatBytes(stats.size),
              created: stats.birthtime,
              modified: stats.mtime,
            });
          } catch (error) {
            logger.warn('Error getting backup file stats', { file, error: error.message });
          }
        }
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => new Date(b.created) - new Date(a.created));

      sendSuccess(res, { backups });
    })
  );

  // Download database backup
  router.get(
    '/databases/:authId/backup/:filename',
    asyncHandler(async (req, res) => {
      const authId = validateAuthIdParam(req, res);
      if (!authId) return;

      const { filename } = req.params;

      // Validate filename to prevent path traversal
      if (!/^user_[a-f0-9]{8}_[\d\-TZ]+\.db$/.test(filename)) {
        return sendError(res, 'Invalid backup filename', 400);
      }

      const user = backend.masterDatabase.getQuery(
        'SELECT db_path FROM user_registry WHERE auth_id = ?',
        [authId]
      );

      if (!user) {
        return sendError(res, 'User not found', 404);
      }

      // Construct backup path
      const backupDir = path.join(path.dirname(user.db_path), 'backups');
      const backupPath = path.join(backupDir, filename);

      // Check if backup file exists
      if (!fs.existsSync(backupPath)) {
        return sendError(res, 'Backup file not found', 404);
      }

      // Read file as buffer and send raw bytes (avoids compression/stream corruption)
      const buffer = await fs.promises.readFile(backupPath);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'no-transform');

      res.send(buffer);

      logger.info('Admin downloaded database backup', {
        authId,
        filename,
        size: buffer.length,
        adminIp: req.ip,
      });
    })
  );

  // Vacuum database
  router.post(
    '/databases/:authId/vacuum',
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

      logger.info('Admin running database vacuum', {
        authId,
        adminIp: req.ip,
      });

      const userDb = await getUserDatabaseSafe(backend, authId);
      if (!userDb) {
        return sendError(res, 'Failed to access user database', 500);
      }

      // Get size before
      const statsBefore = fs.statSync(user.db_path);
      const sizeBefore = statsBefore.size;

      // Run VACUUM
      userDb.db.prepare('VACUUM').run();

      // Get size after
      const statsAfter = fs.statSync(user.db_path);
      const sizeAfter = statsAfter.size;

      const spaceFreed = sizeBefore - sizeAfter;

      sendSuccess(res, {
        message: 'Database vacuum completed',
        before: {
          size: sizeBefore,
          size_formatted: formatBytes(sizeBefore),
        },
        after: {
          size: sizeAfter,
          size_formatted: formatBytes(sizeAfter),
        },
        space_freed: spaceFreed,
        space_freed_formatted: formatBytes(spaceFreed),
      });
    })
  );

  // Get master database stats
  router.get('/databases/master/stats', (req, res) => {
    try {
      const stats = getDatabaseStats(backend.masterDatabase.dbPath);

      if (stats?.exists) {
        const tables = ['user_registry', 'api_keys'];
        stats.table_counts = {};

        for (const table of tables) {
          try {
            const count = backend.masterDatabase.getQuery(`SELECT COUNT(*) as count FROM ${table}`);
            stats.table_counts[table] = count?.count || 0;
          } catch (error) {
            stats.table_counts[table] = null;
          }
        }
      }

      sendSuccess(res, { master_database: stats });
    } catch (error) {
      sendError(res, error, 500, { endpoint: '/databases/master/stats' });
    }
  });
}
