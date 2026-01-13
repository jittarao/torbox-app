import { validateAuthIdMiddleware, validateNumericId } from '../middleware/validation.js';
import logger from '../utils/logger.js';

/**
 * Download tags routes
 */
export function setupDownloadTagsRoutes(app, backend) {
  const { userRateLimiter } = backend;

  // GET /api/downloads/tags - Get all download-tag mappings (bulk)
  app.get(
    '/api/downloads/tags',
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

        const query = `
          SELECT 
            dt.download_id,
            t.id as tag_id,
            t.name as tag_name
          FROM download_tags dt
          INNER JOIN tags t ON dt.tag_id = t.id
          ORDER BY dt.download_id, t.name
        `;

        const mappings = userDb.db.prepare(query).all();

        // Group by download_id
        const result = {};
        for (const mapping of mappings) {
          const downloadId = mapping.download_id;
          if (!result[downloadId]) {
            result[downloadId] = [];
          }
          result[downloadId].push({
            id: mapping.tag_id,
            name: mapping.tag_name,
          });
        }

        res.json({ success: true, mappings: result });
      } catch (error) {
        logger.error('Error fetching download tags', error, {
          endpoint: '/api/downloads/tags',
          method: 'GET',
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // POST /api/downloads/tags - Assign tags to downloads (bulk)
  app.post(
    '/api/downloads/tags',
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

        const { download_ids, tag_ids, operation = 'add' } = req.body;

        // Validate tag_ids are all valid integers
        if (Array.isArray(tag_ids) && tag_ids.length > 0) {
          const invalidTagIds = tag_ids.filter((id) => !validateNumericId(id));
          if (invalidTagIds.length > 0) {
            return res.status(400).json({
              success: false,
              error: 'Invalid tag_ids. All tag IDs must be positive integers.',
            });
          }
        }

        // Validate download_ids are all valid integers
        if (Array.isArray(download_ids) && download_ids.length > 0) {
          const invalidDownloadIds = download_ids.filter((id) => !validateNumericId(id));
          if (invalidDownloadIds.length > 0) {
            return res.status(400).json({
              success: false,
              error: 'Invalid download_ids. All download IDs must be positive integers.',
            });
          }
        }

        if (!Array.isArray(download_ids) || download_ids.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'download_ids must be a non-empty array',
          });
        }

        if (!Array.isArray(tag_ids)) {
          return res.status(400).json({
            success: false,
            error: 'tag_ids must be an array',
          });
        }

        // Validate maximum array sizes to prevent DoS
        const MAX_DOWNLOAD_IDS = 1000;
        const MAX_TAG_IDS = 100;

        if (download_ids.length > MAX_DOWNLOAD_IDS) {
          return res.status(400).json({
            success: false,
            error: `Maximum ${MAX_DOWNLOAD_IDS} download IDs allowed per request`,
          });
        }

        if (tag_ids.length > MAX_TAG_IDS) {
          return res.status(400).json({
            success: false,
            error: `Maximum ${MAX_TAG_IDS} tag IDs allowed per request`,
          });
        }

        // Validate no duplicate IDs in arrays
        const uniqueDownloadIds = new Set(download_ids);
        if (uniqueDownloadIds.size !== download_ids.length) {
          return res.status(400).json({
            success: false,
            error: 'download_ids array contains duplicate IDs',
          });
        }

        if (tag_ids.length > 0) {
          const uniqueTagIds = new Set(tag_ids);
          if (uniqueTagIds.size !== tag_ids.length) {
            return res.status(400).json({
              success: false,
              error: 'tag_ids array contains duplicate IDs',
            });
          }
        }

        if (operation !== 'add' && operation !== 'remove' && operation !== 'replace') {
          return res.status(400).json({
            success: false,
            error: 'operation must be one of: add, remove, replace',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);

        // Validate all tag IDs exist
        if (tag_ids.length > 0) {
          const placeholders = tag_ids.map(() => '?').join(',');
          const existingTags = userDb.db
            .prepare(
              `
            SELECT id FROM tags WHERE id IN (${placeholders})
          `
            )
            .all(...tag_ids);

          if (existingTags.length !== tag_ids.length) {
            return res.status(400).json({
              success: false,
              error: 'One or more tag IDs are invalid',
            });
          }
        }

        // Use transaction for atomicity
        const transaction = userDb.db.transaction(() => {
          if (operation === 'replace') {
            // Remove all existing tags for these downloads
            const deletePlaceholders = download_ids.map(() => '?').join(',');
            userDb.db
              .prepare(
                `
              DELETE FROM download_tags 
              WHERE download_id IN (${deletePlaceholders})
            `
              )
              .run(...download_ids);

            // Add new tags
            if (tag_ids.length > 0) {
              const insertStmt = userDb.db.prepare(`
                INSERT OR IGNORE INTO download_tags (tag_id, download_id)
                VALUES (?, ?)
              `);
              for (const downloadId of download_ids) {
                for (const tagId of tag_ids) {
                  insertStmt.run(tagId, downloadId);
                }
              }
            }
          } else if (operation === 'add') {
            // Add tags (ignore duplicates)
            const insertStmt = userDb.db.prepare(`
              INSERT OR IGNORE INTO download_tags (tag_id, download_id)
              VALUES (?, ?)
            `);
            for (const downloadId of download_ids) {
              for (const tagId of tag_ids) {
                insertStmt.run(tagId, downloadId);
              }
            }
          } else if (operation === 'remove') {
            // Remove tags
            const deletePlaceholders = download_ids.map(() => '?').join(',');
            const tagPlaceholders = tag_ids.map(() => '?').join(',');
            userDb.db
              .prepare(
                `
              DELETE FROM download_tags 
              WHERE download_id IN (${deletePlaceholders}) 
                AND tag_id IN (${tagPlaceholders})
            `
              )
              .run(...download_ids, ...tag_ids);
          }
        });

        transaction();

        res.json({
          success: true,
          message: `Tags ${operation === 'add' ? 'added' : operation === 'remove' ? 'removed' : 'replaced'} successfully`,
        });
      } catch (error) {
        logger.error('Error assigning tags to downloads', error, {
          endpoint: '/api/downloads/tags',
          method: 'POST',
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );
}
