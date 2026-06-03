import { validateNumericIdMiddleware } from '../middleware/validation.js';
import logger from '../utils/logger.js';
import { serverErrorPayload } from '../utils/httpErrors.js';

export const BULK_ARCHIVE_MAX = 500;

/**
 * Insert archive metadata for many torrents in one transaction.
 * @param {import('bun:sqlite').Database} db
 * @param {Array<{ torrent_id: string, hash: string, tracker?: string, name?: string }>} downloads
 * @returns {string[]} torrent_ids eligible for TorBox removal (valid + present in archive table after upsert)
 */
export function bulkArchiveDownloadsInDb(db, downloads) {
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO archived_downloads (torrent_id, hash, tracker, name, archived_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const existsStmt = db.prepare(`
    SELECT torrent_id FROM archived_downloads WHERE torrent_id = ?
  `);

  const torrentIds = [];

  const archiveMany = db.transaction((entries) => {
    for (const entry of entries) {
      insertStmt.run(
        entry.torrent_id,
        entry.hash,
        entry.tracker ?? null,
        entry.name ?? null
      );
      const row = existsStmt.get(entry.torrent_id);
      if (row) {
        torrentIds.push(String(entry.torrent_id));
      }
    }
  });

  archiveMany(downloads);
  return torrentIds;
}

/**
 * Archived downloads routes
 */
export function setupArchivedDownloadsRoutes(app, backend) {
  const { userRateLimiter } = backend;

  // GET /api/archived-downloads - List archived downloads
  app.get(
    '/api/archived-downloads',
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
        // Enforce maximum limits to prevent memory issues
        const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 1000)); // Max 1000, min 1
        const page = Math.max(1, parseInt(req.query.page, 10) || 1); // Min 1
        const offset = (page - 1) * limit;
        const search = req.query.search?.trim() || null;

        let countQuery = 'SELECT COUNT(*) as count FROM archived_downloads';
        let dataQuery = `
          SELECT id, torrent_id, hash, tracker, name, archived_at, created_at
          FROM archived_downloads
        `;
        const queryParams = [];

        if (search) {
          const searchParam = `%${search}%`;
          const whereClause =
            ' WHERE torrent_id LIKE ? OR name LIKE ? OR hash LIKE ? OR tracker LIKE ?';
          countQuery += whereClause;
          dataQuery += whereClause;
          queryParams.push(searchParam, searchParam, searchParam, searchParam);
        }

        dataQuery += ' ORDER BY archived_at DESC LIMIT ? OFFSET ?';

        const totalCount = search
          ? userDb.db
              .prepare(countQuery)
              .get(queryParams[0], queryParams[1], queryParams[2], queryParams[3])
          : userDb.db.prepare(countQuery).get();

        const archived = userDb.db
          .prepare(dataQuery)
          .all(...queryParams, limit, offset);

        res.json({
          success: true,
          data: archived,
          pagination: {
            page,
            limit,
            total: totalCount.count,
            totalPages: Math.ceil(totalCount.count / limit),
          },
        });
      } catch (error) {
        logger.error('Error fetching archived downloads', error, {
          endpoint: '/api/archived-downloads',
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

  // POST /api/archived-downloads - Create archived download
  app.post(
    '/api/archived-downloads',
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

        const { torrent_id, hash, tracker, name } = req.body;

        if (!torrent_id || !hash) {
          return res.status(400).json({
            success: false,
            error: 'torrent_id and hash are required',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);

        // Check if already archived
        const existing = userDb.db
          .prepare(
            `
          SELECT id FROM archived_downloads WHERE torrent_id = ?
        `
          )
          .get(torrent_id);

        if (existing) {
          return res.status(409).json({
            success: false,
            error: 'Download already archived',
          });
        }

        // Insert new archive entry
        const result = userDb.db
          .prepare(
            `
          INSERT INTO archived_downloads (torrent_id, hash, tracker, name, archived_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `
          )
          .run(torrent_id, hash, tracker || null, name || null);

        const archived = userDb.db
          .prepare(
            `
          SELECT id, torrent_id, hash, tracker, name, archived_at, created_at
          FROM archived_downloads
          WHERE id = ?
        `
          )
          .get(result.lastInsertRowid);

        res.json({ success: true, data: archived });
      } catch (error) {
        logger.error('Error creating archived download', error, {
          endpoint: '/api/archived-downloads',
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

  // POST /api/archived-downloads/bulk - Bulk archive torrent metadata
  app.post(
    '/api/archived-downloads/bulk',
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

        const { downloads } = req.body;

        if (!Array.isArray(downloads) || downloads.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'downloads array is required and must not be empty',
          });
        }

        if (downloads.length > BULK_ARCHIVE_MAX) {
          return res.status(400).json({
            success: false,
            error: `downloads array must not exceed ${BULK_ARCHIVE_MAX} items`,
          });
        }

        const validated = [];
        const seenIds = new Set();

        for (const entry of downloads) {
          const torrent_id =
            entry?.torrent_id != null ? String(entry.torrent_id) : '';
          const hash = entry?.hash != null ? String(entry.hash) : '';

          if (!torrent_id || !hash) {
            continue;
          }

          if (seenIds.has(torrent_id)) {
            continue;
          }
          seenIds.add(torrent_id);

          validated.push({
            torrent_id,
            hash,
            tracker: entry.tracker ?? null,
            name: entry.name ?? null,
          });
        }

        if (validated.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No valid downloads to archive (torrent_id and hash required)',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        const torrentIds = bulkArchiveDownloadsInDb(userDb.db, validated);

        res.json({
          success: true,
          data: { torrentIds },
        });
      } catch (error) {
        logger.error('Error bulk archiving downloads', error, {
          endpoint: '/api/archived-downloads/bulk',
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

  // DELETE /api/archived-downloads/bulk - Bulk delete archived downloads
  // NOTE: Register before /api/archived-downloads/:id so "bulk" is not captured as :id
  app.delete(
    '/api/archived-downloads/bulk',
    backend.requireRegisteredUser,
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'ids array is required and must not be empty',
          });
        }

        if (ids.length > BULK_ARCHIVE_MAX) {
          return res.status(400).json({
            success: false,
            error: `ids array must not exceed ${BULK_ARCHIVE_MAX} items`,
          });
        }

        const invalidIds = ids.filter((id) => {
          const numId = parseInt(id, 10);
          return isNaN(numId) || numId <= 0;
        });
        if (invalidIds.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Invalid ids. All IDs must be positive integers.',
          });
        }

        const numericIds = ids.map((id) => parseInt(id, 10));

        if (!backend.userDatabaseManager) {
          return res.status(503).json({
            success: false,
            error: 'Service is initializing, please try again in a moment',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        const placeholders = numericIds.map(() => '?').join(',');
        const deleteStmt = userDb.db.prepare(
          `DELETE FROM archived_downloads WHERE id IN (${placeholders})`
        );
        const result = deleteStmt.run(...numericIds);

        logger.info('Bulk archived downloads delete', {
          authId,
          requested: numericIds.length,
          deleted: result.changes,
        });

        res.json({
          success: true,
          message: `Deleted ${result.changes} archived download${result.changes === 1 ? '' : 's'}`,
          data: {
            deleted: result.changes,
            requested: numericIds.length,
          },
        });
      } catch (error) {
        logger.error('Error bulk deleting archived downloads', error, {
          endpoint: '/api/archived-downloads/bulk',
          method: 'DELETE',
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

  // DELETE /api/archived-downloads/:id - Delete archived download
  app.delete(
    '/api/archived-downloads/:id',
    backend.requireRegisteredUser,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const archiveId = req.validatedIds.id;

        if (!backend.userDatabaseManager) {
          return res.status(503).json({
            success: false,
            error: 'Service is initializing, please try again in a moment',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);

        // Check if exists
        const existing = userDb.db
          .prepare(
            `
          SELECT id FROM archived_downloads WHERE id = ?
        `
          )
          .get(archiveId);

        if (!existing) {
          return res.status(404).json({
            success: false,
            error: 'Archived download not found',
          });
        }

        // Delete
        userDb.db
          .prepare(
            `
          DELETE FROM archived_downloads WHERE id = ?
        `
          )
          .run(archiveId);

        res.json({
          success: true,
          message: 'Archived download deleted successfully',
        });
      } catch (error) {
        logger.error('Error deleting archived download', error, {
          endpoint: `/api/archived-downloads/${req.params.id}`,
          method: 'DELETE',
          archiveId: req.validatedIds?.id,
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
