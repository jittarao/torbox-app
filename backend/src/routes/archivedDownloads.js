import {
  validateAuthIdMiddleware,
  validateNumericIdMiddleware,
} from '../middleware/validation.js';
import logger from '../utils/logger.js';

/**
 * Archived downloads routes
 */
export function setupArchivedDownloadsRoutes(app, backend) {
  const { userRateLimiter, userDatabaseManager } = backend;

  // GET /api/archived-downloads - List archived downloads
  app.get(
    '/api/archived-downloads',
    validateAuthIdMiddleware,
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;

        const userDb = await userDatabaseManager.getUserDatabase(authId);
        // Enforce maximum limits to prevent memory issues
        const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 1000)); // Max 1000, min 1
        const page = Math.max(1, parseInt(req.query.page, 10) || 1); // Min 1
        const offset = (page - 1) * limit;

        // Get total count
        const totalCount = userDb.db
          .prepare(
            `
          SELECT COUNT(*) as count FROM archived_downloads
        `
          )
          .get();

        // Get paginated results
        const archived = userDb.db
          .prepare(
            `
          SELECT id, torrent_id, hash, tracker, name, archived_at, created_at
          FROM archived_downloads
          ORDER BY archived_at DESC
          LIMIT ? OFFSET ?
        `
          )
          .all(limit, offset);

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
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // POST /api/archived-downloads - Create archived download
  app.post(
    '/api/archived-downloads',
    validateAuthIdMiddleware,
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;

        const { torrent_id, hash, tracker, name } = req.body;

        if (!torrent_id || !hash) {
          return res.status(400).json({
            success: false,
            error: 'torrent_id and hash are required',
          });
        }

        const userDb = await userDatabaseManager.getUserDatabase(authId);

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
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // DELETE /api/archived-downloads/:id - Delete archived download
  app.delete(
    '/api/archived-downloads/:id',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const archiveId = req.validatedIds.id;
        const userDb = await userDatabaseManager.getUserDatabase(authId);

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
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );
}
