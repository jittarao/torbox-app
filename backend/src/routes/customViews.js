import {
  validateAuthIdMiddleware,
  validateNumericIdMiddleware,
} from '../middleware/validation.js';
import logger from '../utils/logger.js';

/**
 * Helper function to parse JSON fields in custom views
 */
function parseViewJsonFields(view) {
  const parsed = { ...view };
  if (parsed.filters) {
    try {
      parsed.filters = JSON.parse(parsed.filters);
    } catch (error) {
      logger.error('Failed to parse filters JSON', error, {
        viewId: view.id,
      });
      parsed.filters = {}; // Default to empty object
    }
  }
  if (parsed.visible_columns) {
    try {
      parsed.visible_columns = JSON.parse(parsed.visible_columns);
    } catch (error) {
      logger.error('Failed to parse visible_columns JSON', error, {
        viewId: view.id,
      });
      parsed.visible_columns = []; // Default to empty array
    }
  }
  return parsed;
}

/**
 * Custom views routes
 */
export function setupCustomViewsRoutes(app, backend) {
  const { userRateLimiter } = backend;

  // GET /api/custom-views - List all custom views
  app.get(
    '/api/custom-views',
    validateAuthIdMiddleware,
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
        const views = userDb.db
          .prepare(
            `
          SELECT id, name, filters, sort_field, sort_direction, visible_columns, asset_type, created_at, updated_at
          FROM custom_views
          ORDER BY created_at DESC
        `
          )
          .all();

        // Parse JSON fields for all views
        const parsedViews = views.map(parseViewJsonFields);

        res.json({ success: true, views: parsedViews });
      } catch (error) {
        logger.error('Error fetching custom views', error, {
          endpoint: '/api/custom-views',
          method: 'GET',
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // POST /api/custom-views - Create custom view
  app.post(
    '/api/custom-views',
    validateAuthIdMiddleware,
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

        const { name, filters, sort_field, sort_direction, visible_columns, asset_type } =
          req.body;

        if (!name || !filters) {
          return res.status(400).json({
            success: false,
            error: 'name and filters are required',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);

        const result = userDb.db
          .prepare(
            `
          INSERT INTO custom_views (name, filters, sort_field, sort_direction, visible_columns, asset_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            name,
            JSON.stringify(filters),
            sort_field || null,
            sort_direction || null,
            visible_columns ? JSON.stringify(visible_columns) : null,
            asset_type || null
          );

        const view = userDb.db
          .prepare(
            `
          SELECT id, name, filters, sort_field, sort_direction, visible_columns, asset_type, created_at, updated_at
          FROM custom_views
          WHERE id = ?
        `
          )
          .get(result.lastInsertRowid);

        const parsedView = parseViewJsonFields(view);
        res.json({ success: true, view: parsedView });
      } catch (error) {
        logger.error('Error creating custom view', error, {
          endpoint: '/api/custom-views',
          method: 'POST',
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // GET /api/custom-views/:id - Get single custom view
  app.get(
    '/api/custom-views/:id',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const viewId = req.validatedIds.id;

        if (!backend.userDatabaseManager) {
          return res.status(503).json({
            success: false,
            error: 'Service is initializing, please try again in a moment',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);

        const view = userDb.db
          .prepare(
            `
          SELECT id, name, filters, sort_field, sort_direction, visible_columns, asset_type, created_at, updated_at
          FROM custom_views
          WHERE id = ?
        `
          )
          .get(viewId);

        if (!view) {
          return res.status(404).json({
            success: false,
            error: 'Custom view not found',
          });
        }

        const parsedView = parseViewJsonFields(view);
        res.json({ success: true, view: parsedView });
      } catch (error) {
        logger.error('Error fetching custom view', error, {
          endpoint: `/api/custom-views/${req.params.id}`,
          method: 'GET',
          viewId: req.validatedIds?.id,
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // PUT /api/custom-views/:id - Update custom view
  app.put(
    '/api/custom-views/:id',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const viewId = req.validatedIds.id;
        const { name, filters, sort_field, sort_direction, visible_columns, asset_type } =
          req.body;

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
          SELECT id FROM custom_views WHERE id = ?
        `
          )
          .get(viewId);

        if (!existing) {
          return res.status(404).json({
            success: false,
            error: 'Custom view not found',
          });
        }

        // Build update query dynamically with validated column names
        const updates = {};
        const allowedColumns = [
          'name',
          'filters',
          'sort_field',
          'sort_direction',
          'visible_columns',
          'asset_type',
        ];

        if (name !== undefined) {
          updates.name = name;
        }
        if (filters !== undefined) {
          updates.filters = JSON.stringify(filters);
        }
        if (sort_field !== undefined) {
          updates.sort_field = sort_field || null;
        }
        if (sort_direction !== undefined) {
          updates.sort_direction = sort_direction || null;
        }
        if (visible_columns !== undefined) {
          updates.visible_columns = visible_columns ? JSON.stringify(visible_columns) : null;
        }
        if (asset_type !== undefined) {
          updates.asset_type = asset_type || null;
        }

        // Build SET clause with validated column names and parameterized values
        const validKeys = Object.keys(updates).filter((key) => allowedColumns.includes(key));
        const setClause = validKeys.map((key) => `${key} = ?`).join(', ');
        const values = validKeys.map((key) => updates[key]);

        // Add updated_at and viewId
        const finalSetClause = setClause
          ? `${setClause}, updated_at = CURRENT_TIMESTAMP`
          : 'updated_at = CURRENT_TIMESTAMP';
        values.push(viewId);

        userDb.db
          .prepare(
            `
          UPDATE custom_views
          SET ${finalSetClause}
          WHERE id = ?
        `
          )
          .run(...values);

        const view = userDb.db
          .prepare(
            `
          SELECT id, name, filters, sort_field, sort_direction, visible_columns, asset_type, created_at, updated_at
          FROM custom_views
          WHERE id = ?
        `
          )
          .get(viewId);

        const parsedView = parseViewJsonFields(view);
        res.json({ success: true, view: parsedView });
      } catch (error) {
        logger.error('Error updating custom view', error, {
          endpoint: `/api/custom-views/${req.params.id}`,
          method: 'PUT',
          viewId: req.validatedIds?.id,
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // DELETE /api/custom-views/:id - Delete custom view
  app.delete(
    '/api/custom-views/:id',
    validateAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const viewId = req.validatedIds.id;

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
          SELECT id FROM custom_views WHERE id = ?
        `
          )
          .get(viewId);

        if (!existing) {
          return res.status(404).json({
            success: false,
            error: 'Custom view not found',
          });
        }

        // Delete
        userDb.db
          .prepare(
            `
          DELETE FROM custom_views WHERE id = ?
        `
          )
          .run(viewId);

        res.json({
          success: true,
          message: 'Custom view deleted successfully',
        });
      } catch (error) {
        logger.error('Error deleting custom view', error, {
          endpoint: `/api/custom-views/${req.params.id}`,
          method: 'DELETE',
          viewId: req.validatedIds?.id,
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );
}
