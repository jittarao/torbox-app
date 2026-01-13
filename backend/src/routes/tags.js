import {
  validateAuthIdMiddleware,
  validateNumericIdMiddleware,
} from '../middleware/validation.js';
import logger from '../utils/logger.js';

/**
 * Tags routes
 */
export function setupTagsRoutes(app, backend) {
  const { userRateLimiter, userDatabaseManager } = backend;

  // GET /api/tags - List all tags with usage counts
  app.get('/api/tags', validateAuthIdMiddleware, userRateLimiter, async (req, res) => {
    try {
      const authId = req.validatedAuthId;

      const userDb = await userDatabaseManager.getUserDatabase(authId);

      const tags = userDb.db
        .prepare(
          `
          SELECT 
            t.id,
            t.name,
            t.created_at,
            t.updated_at,
            COUNT(dt.id) as usage_count
          FROM tags t
          LEFT JOIN download_tags dt ON t.id = dt.tag_id
          GROUP BY t.id, t.name, t.created_at, t.updated_at
          ORDER BY t.name ASC
        `
        )
        .all();

      res.json({ success: true, tags });
    } catch (error) {
      logger.error('Error fetching tags', error, {
        endpoint: '/api/tags',
        method: 'GET',
        authId: req.validatedAuthId,
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/tags - Create tag
  app.post('/api/tags', validateAuthIdMiddleware, userRateLimiter, async (req, res) => {
    try {
      const authId = req.validatedAuthId;

      const { name } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Tag name is required and must be a non-empty string',
        });
      }

      const trimmedName = name.trim();
      if (trimmedName.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Tag name must be 100 characters or less',
        });
      }

      const userDb = await userDatabaseManager.getUserDatabase(authId);

      // Check for case-insensitive duplicate
      const existing = userDb.db
        .prepare(
          `
          SELECT id FROM tags WHERE LOWER(name) = LOWER(?)
        `
        )
        .get(trimmedName);

      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'A tag with this name already exists',
        });
      }

      const result = userDb.db
        .prepare(
          `
          INSERT INTO tags (name)
          VALUES (?)
        `
        )
        .run(trimmedName);

      const tag = userDb.db
        .prepare(
          `
          SELECT id, name, created_at, updated_at
          FROM tags
          WHERE id = ?
        `
        )
        .get(result.lastInsertRowid);

      res.json({ success: true, tag });
    } catch (error) {
      logger.error('Error creating tag', error, {
        endpoint: '/api/tags',
        method: 'POST',
        authId: req.validatedAuthId,
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/tags/:id - Get single tag
  app.get(
    '/api/tags/:id',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const tagId = req.validatedIds.id;
        const userDb = await userDatabaseManager.getUserDatabase(authId);

        const tag = userDb.db
          .prepare(
            `
          SELECT 
            t.id,
            t.name,
            t.created_at,
            t.updated_at,
            COUNT(dt.id) as usage_count
          FROM tags t
          LEFT JOIN download_tags dt ON t.id = dt.tag_id
          WHERE t.id = ?
          GROUP BY t.id, t.name, t.created_at, t.updated_at
        `
          )
          .get(tagId);

        if (!tag) {
          return res.status(404).json({
            success: false,
            error: 'Tag not found',
          });
        }

        res.json({ success: true, tag });
      } catch (error) {
        logger.error('Error fetching tag', error, {
          endpoint: `/api/tags/${req.params.id}`,
          method: 'GET',
          tagId: req.validatedIds?.id,
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // PUT /api/tags/:id - Update tag
  app.put(
    '/api/tags/:id',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const tagId = req.validatedIds.id;
        const { name } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Tag name is required and must be a non-empty string',
          });
        }

        const trimmedName = name.trim();
        if (trimmedName.length > 100) {
          return res.status(400).json({
            success: false,
            error: 'Tag name must be 100 characters or less',
          });
        }

        const userDb = await userDatabaseManager.getUserDatabase(authId);

        // Check if exists
        const existing = userDb.db
          .prepare(
            `
          SELECT id FROM tags WHERE id = ?
        `
          )
          .get(tagId);

        if (!existing) {
          return res.status(404).json({
            success: false,
            error: 'Tag not found',
          });
        }

        // Check for case-insensitive duplicate (excluding current tag)
        const duplicate = userDb.db
          .prepare(
            `
          SELECT id FROM tags WHERE LOWER(name) = LOWER(?) AND id != ?
        `
          )
          .get(trimmedName, tagId);

        if (duplicate) {
          return res.status(409).json({
            success: false,
            error: 'A tag with this name already exists',
          });
        }

        userDb.db
          .prepare(
            `
          UPDATE tags
          SET name = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
          )
          .run(trimmedName, tagId);

        const tag = userDb.db
          .prepare(
            `
          SELECT id, name, created_at, updated_at
          FROM tags
          WHERE id = ?
        `
          )
          .get(tagId);

        res.json({ success: true, tag });
      } catch (error) {
        logger.error('Error updating tag', error, {
          endpoint: `/api/tags/${req.params.id}`,
          method: 'PUT',
          tagId: req.validatedIds?.id,
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // DELETE /api/tags/:id - Delete tag
  app.delete(
    '/api/tags/:id',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const tagId = req.validatedIds.id;
        const userDb = await userDatabaseManager.getUserDatabase(authId);

        // Check if exists
        const existing = userDb.db
          .prepare(
            `
          SELECT id FROM tags WHERE id = ?
        `
          )
          .get(tagId);

        if (!existing) {
          return res.status(404).json({
            success: false,
            error: 'Tag not found',
          });
        }

        // Delete (cascade will remove download_tags associations)
        userDb.db
          .prepare(
            `
          DELETE FROM tags WHERE id = ?
        `
          )
          .run(tagId);

        res.json({ success: true, message: 'Tag deleted successfully' });
      } catch (error) {
        logger.error('Error deleting tag', error, {
          endpoint: `/api/tags/${req.params.id}`,
          method: 'DELETE',
          tagId: req.validatedIds?.id,
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );
}
