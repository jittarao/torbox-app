import { extractAuthIdMiddleware, validateNumericIdMiddleware } from '../middleware/validation.js';
import logger from '../utils/logger.js';

/**
 * Link history routes
 * Handles CRUD operations for download link history
 */
export function setupLinkHistoryRoutes(app, backend) {
  const { userRateLimiter } = backend;

  // GET /api/link-history - List link history with pagination
  app.get('/api/link-history', extractAuthIdMiddleware, userRateLimiter, async (req, res) => {
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

      // Build query with optional search
      let countQuery = 'SELECT COUNT(*) as count FROM link_history';
      let dataQuery = `
          SELECT id, item_id, file_id, url, asset_type, item_name, file_name, generated_at, created_at
          FROM link_history
        `;
      const queryParams = [];

      if (search) {
        const searchParam = `%${search}%`;
        countQuery += ' WHERE item_id LIKE ? OR item_name LIKE ? OR file_name LIKE ?';
        dataQuery += ' WHERE item_id LIKE ? OR item_name LIKE ? OR file_name LIKE ?';
        queryParams.push(searchParam, searchParam, searchParam);
      }

      dataQuery += ' ORDER BY generated_at DESC LIMIT ? OFFSET ?';

      // Get total count (search uses 3 params for item_id, item_name, file_name)
      const totalCount = search
        ? userDb.db.prepare(countQuery).get(queryParams[0], queryParams[1], queryParams[2])
        : userDb.db.prepare(countQuery).get();

      // Get paginated results
      queryParams.push(limit, offset);
      const history = userDb.db.prepare(dataQuery).all(...queryParams);

      res.json({
        success: true,
        data: history,
        pagination: {
          page,
          limit,
          total: totalCount.count,
          totalPages: Math.ceil(totalCount.count / limit),
        },
      });
    } catch (error) {
      logger.error('Error fetching link history', error, {
        endpoint: '/api/link-history',
        method: 'GET',
        authId: req.validatedAuthId,
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/link-history - Create new link history entry
  app.post('/api/link-history', extractAuthIdMiddleware, userRateLimiter, async (req, res) => {
    try {
      const authId = req.validatedAuthId;

      if (!backend.userDatabaseManager) {
        return res.status(503).json({
          success: false,
          error: 'Service is initializing, please try again in a moment',
        });
      }

      const { item_id, file_id, url, asset_type, item_name, file_name } = req.body;

      if (!item_id || !url || !asset_type) {
        return res.status(400).json({
          success: false,
          error: 'item_id, url, and asset_type are required',
        });
      }

      if (!['torrents', 'usenet', 'webdl'].includes(asset_type)) {
        return res.status(400).json({
          success: false,
          error: 'asset_type must be one of: torrents, usenet, webdl',
        });
      }

      const userDb = await backend.userDatabaseManager.getUserDatabase(authId);

      // Insert new link history entry
      const result = userDb.db
        .prepare(
          `
            INSERT INTO link_history (item_id, file_id, url, asset_type, item_name, file_name, generated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `
        )
        .run(item_id, file_id || null, url, asset_type, item_name || null, file_name || null);

      const linkHistory = userDb.db
        .prepare(
          `
            SELECT id, item_id, file_id, url, asset_type, item_name, file_name, generated_at, created_at
            FROM link_history
            WHERE id = ?
          `
        )
        .get(result.lastInsertRowid);

      res.json({ success: true, data: linkHistory });
    } catch (error) {
      logger.error('Error creating link history entry', error, {
        endpoint: '/api/link-history',
        method: 'POST',
        authId: req.validatedAuthId,
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/link-history/:id - Delete single entry
  app.delete(
    '/api/link-history/:id',
    extractAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const linkId = req.validatedIds.id;

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
            SELECT id FROM link_history WHERE id = ?
          `
          )
          .get(linkId);

        if (!existing) {
          return res.status(404).json({
            success: false,
            error: 'Link history entry not found',
          });
        }

        // Delete
        userDb.db
          .prepare(
            `
            DELETE FROM link_history WHERE id = ?
          `
          )
          .run(linkId);

        res.json({
          success: true,
          message: 'Link history entry deleted successfully',
        });
      } catch (error) {
        logger.error('Error deleting link history entry', error, {
          endpoint: `/api/link-history/${req.params.id}`,
          method: 'DELETE',
          linkId: req.validatedIds?.id,
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // DELETE /api/link-history/bulk - Bulk delete entries
  app.delete(
    '/api/link-history/bulk',
    extractAuthIdMiddleware,
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const { ids } = req.body; // Array of link history IDs

        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'ids array is required and must not be empty',
          });
        }

        // Validate all IDs are positive integers
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

        // Convert all IDs to numbers
        const numericIds = ids.map((id) => parseInt(id, 10));

        if (!backend.userDatabaseManager) {
          return res.status(503).json({
            success: false,
            error: 'Service is initializing, please try again in a moment',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);

        // Delete entries
        const placeholders = numericIds.map(() => '?').join(',');
        const deleteStmt = userDb.db.prepare(
          `DELETE FROM link_history WHERE id IN (${placeholders})`
        );
        const result = deleteStmt.run(...numericIds);

        logger.info('Bulk link history delete', {
          authId,
          requested: numericIds.length,
          deleted: result.changes,
        });

        res.json({
          success: true,
          message: `Deleted ${result.changes} link history entr${result.changes === 1 ? 'y' : 'ies'}`,
          data: {
            deleted: result.changes,
            requested: numericIds.length,
          },
        });
      } catch (error) {
        logger.error('Error bulk deleting link history', error, {
          endpoint: '/api/link-history/bulk',
          method: 'DELETE',
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );
}
