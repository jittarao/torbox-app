import {
  validateAuthIdMiddleware,
  validateNumericIdMiddleware,
  validateNumericId,
} from '../middleware/validation.js';
import logger from '../utils/logger.js';
import {
  deleteUploadFile,
  saveUploadFile,
  getUploadFilePath,
  validateFilePathOwnership,
} from '../utils/fileStorage.js';
import { hashApiKey } from '../utils/crypto.js';
import rateLimit from 'express-rate-limit';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * Validate file extension for upload type
 * @param {string} type - Upload type (torrent, usenet, webdl)
 * @param {string} upload_type - Upload method (file, magnet, link)
 * @param {string} filePathOrName - File path or filename to validate
 * @returns {string|null} Error message if validation fails, null if valid
 */
function validateFileExtension(type, upload_type, filePathOrName) {
  // Only validate if upload_type is 'file'
  if (upload_type !== 'file' || !filePathOrName) {
    return null;
  }

  // WebDL does not support file uploads
  if (type === 'webdl') {
    return 'WebDL type does not support file uploads. Use link upload_type instead.';
  }

  // Validate file extension matches the type
  const fileExtension = path.extname(filePathOrName).toLowerCase();

  if (type === 'torrent' && fileExtension !== '.torrent') {
    return 'Invalid file extension. Torrent type requires .torrent file extension';
  }

  if (type === 'usenet' && fileExtension !== '.nzb') {
    return 'Invalid file extension. Usenet type requires .nzb file extension';
  }

  return null;
}

/**
 * Middleware to extract authId from API key if authId not provided
 */
function extractAuthIdMiddleware(req, res, next) {
  // If authId already validated, use it
  if (req.validatedAuthId) {
    return next();
  }

  // Try to get authId from API key
  const apiKey =
    req.headers['x-api-key'] ||
    req.headers['authorization']?.replace('Bearer ', '') ||
    req.body?.apiKey;
  if (apiKey) {
    req.validatedAuthId = hashApiKey(apiKey);
    return next();
  }

  // Fall back to validateAuthIdMiddleware
  return validateAuthIdMiddleware(req, res, next);
}

/**
 * Upload routes
 * Handles queued uploads for torrents, usenet, and webdl
 */
export function setupUploadsRoutes(app, backend) {
  const { userRateLimiter } = backend;

  // Create a more permissive rate limiter for upload endpoints
  // Allows 1000 requests per 15 minutes (vs 200 for general endpoints)
  const uploadRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || '1000', 10),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.validatedAuthId || req.ip;
    },
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Too many upload requests, please try again later.',
        detail: 'Upload rate limit exceeded. Please wait before making more requests.',
      });
    },
  });

  // POST /api/uploads/file - Upload file to storage
  app.post('/api/uploads/file', uploadRateLimiter, async (req, res) => {
    try {
      // Get authId from header
      const apiKey =
        req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API key is required',
        });
      }

      const authId = hashApiKey(apiKey);

      const { file_data, filename, type } = req.body; // file_data is base64 string

      if (!file_data || !filename || !type) {
        return res.status(400).json({
          success: false,
          error: 'file_data (base64), filename, and type are required',
        });
      }

      // Validate type against allowed values to prevent path traversal
      if (!['torrent', 'usenet', 'webdl'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid type. Must be torrent, usenet, or webdl',
        });
      }

      // Validate file extension matches the type to prevent unauthorized file uploads
      const extensionError = validateFileExtension(type, 'file', filename);
      if (extensionError) {
        return res.status(400).json({
          success: false,
          error: extensionError,
        });
      }

      // Convert base64 to buffer
      const fileBuffer = Buffer.from(file_data, 'base64');

      // Save file
      const filePath = await saveUploadFile(authId, fileBuffer, filename, type);

      res.json({
        success: true,
        data: {
          file_path: filePath,
        },
      });
    } catch (error) {
      logger.error('Error uploading file', error, {
        endpoint: '/api/uploads/file',
        method: 'POST',
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/uploads/file - Delete file from storage by file_path
  app.delete('/api/uploads/file', uploadRateLimiter, async (req, res) => {
    try {
      // Get authId from header
      const apiKey =
        req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API key is required',
        });
      }

      const authId = hashApiKey(apiKey);

      const { file_path } = req.body;

      if (!file_path) {
        return res.status(400).json({
          success: false,
          error: 'file_path is required',
        });
      }

      // Delete file (with authId for security validation)
      await deleteUploadFile(authId, file_path);

      res.json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting file', error, {
        endpoint: '/api/uploads/file',
        method: 'DELETE',
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/uploads/batch - Create multiple upload entries efficiently
  app.post('/api/uploads/batch', extractAuthIdMiddleware, uploadRateLimiter, async (req, res) => {
    try {
      const authId = req.validatedAuthId;

      if (!backend.userDatabaseManager) {
        return res.status(503).json({
          success: false,
          error: 'Service is initializing, please try again in a moment',
        });
      }

      const { uploads } = req.body; // Array of upload objects

      if (!Array.isArray(uploads) || uploads.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'uploads array is required and must not be empty',
        });
      }

      if (uploads.length > 1000) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 1000 uploads per batch request',
        });
      }

      const userDb = await backend.userDatabaseManager.getUserDatabase(authId);

      // Get max queue_order once for the entire batch (optimization)
      const maxOrderResult = userDb.db
        .prepare('SELECT MAX(queue_order) as max_order FROM uploads WHERE status = ?')
        .get('queued');

      let currentQueueOrder = (maxOrderResult?.max_order ?? -1) + 1;

      // Prepare insert statement
      const insertStmt = userDb.db.prepare(
        `
          INSERT INTO uploads (
            type, upload_type, file_path, url, name, status,
            seed, allow_zip, as_queued, password, queue_order,
            next_attempt_at, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `
      );

      const selectStmt = userDb.db.prepare(
        `
          SELECT id, type, upload_type, file_path, url, name, status,
                 error_message, retry_count, seed, allow_zip, as_queued, password,
                 queue_order, last_processed_at, completed_at, created_at, updated_at, next_attempt_at
          FROM uploads
          WHERE id = ?
        `
      );

      const createdUploads = [];
      const errors = [];

      // Use transaction for batch insert
      const insertMany = userDb.db.transaction((uploads) => {
        const results = [];
        for (const upload of uploads) {
          const { type, upload_type, file_path, url, name, seed, allow_zip, as_queued, password } =
            upload;

          // Validation
          if (!type || !['torrent', 'usenet', 'webdl'].includes(type)) {
            errors.push({ upload, error: 'Invalid type. Must be torrent, usenet, or webdl' });
            continue;
          }

          if (!upload_type || !['file', 'magnet', 'link'].includes(upload_type)) {
            errors.push({
              upload,
              error: 'Invalid upload_type. Must be file, magnet, or link',
            });
            continue;
          }

          if (!name) {
            errors.push({ upload, error: 'name is required' });
            continue;
          }

          if (upload_type === 'file' && !file_path) {
            errors.push({ upload, error: 'file_path is required for file uploads' });
            continue;
          }

          // Validate file extension when upload_type is 'file' to prevent unauthorized file types
          const extensionError = validateFileExtension(type, upload_type, file_path);
          if (extensionError) {
            errors.push({
              upload,
              error: extensionError,
            });
            continue;
          }

          // Security: Validate that file_path belongs to the authenticated user
          if (upload_type === 'file' && file_path) {
            if (!validateFilePathOwnership(authId, file_path)) {
              logger.error('File path ownership validation failed', {
                authId,
                file_path,
                endpoint: '/api/uploads/batch',
                method: 'POST',
              });
              errors.push({
                upload,
                error: 'Invalid file path: file must belong to authenticated user',
              });
              continue;
            }
          }

          if ((upload_type === 'magnet' || upload_type === 'link') && !url) {
            errors.push({ upload, error: 'url is required for magnet/link uploads' });
            continue;
          }

          try {
            const result = insertStmt.run(
              type,
              upload_type,
              file_path || null,
              url || null,
              name,
              seed || null,
              allow_zip !== undefined ? allow_zip : true,
              as_queued !== undefined ? as_queued : false,
              password || null,
              currentQueueOrder++
            );

            const createdUpload = selectStmt.get(result.lastInsertRowid);
            results.push(createdUpload);
          } catch (error) {
            errors.push({ upload, error: error.message });
          }
        }
        return results;
      });

      const successfulUploads = insertMany(uploads);

      logger.info('Batch upload created', {
        authId,
        total: uploads.length,
        successful: successfulUploads.length,
        errors: errors.length,
      });

      // Update upload counter in master DB (recalculate for accuracy after batch)
      if (successfulUploads.length > 0) {
        await backend.masterDatabase.updateUploadCounters(authId, userDb);
      }

      res.json({
        success: true,
        data: {
          uploads: successfulUploads,
          errors: errors.length > 0 ? errors : undefined,
        },
        meta: {
          total: uploads.length,
          successful: successfulUploads.length,
          failed: errors.length,
        },
      });
    } catch (error) {
      logger.error('Error creating batch upload', error, {
        endpoint: '/api/uploads/batch',
        method: 'POST',
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/uploads - Create upload entry
  app.post('/api/uploads', extractAuthIdMiddleware, uploadRateLimiter, async (req, res) => {
    try {
      const authId = req.validatedAuthId;

      if (!backend.userDatabaseManager) {
        return res.status(503).json({
          success: false,
          error: 'Service is initializing, please try again in a moment',
        });
      }

      const { type, upload_type, file_path, url, name, seed, allow_zip, as_queued, password } =
        req.body;

      // Validation
      if (!type || !['torrent', 'usenet', 'webdl'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid type. Must be torrent, usenet, or webdl',
        });
      }

      if (!upload_type || !['file', 'magnet', 'link'].includes(upload_type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid upload_type. Must be file, magnet, or link',
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'name is required',
        });
      }

      if (upload_type === 'file' && !file_path) {
        return res.status(400).json({
          success: false,
          error: 'file_path is required for file uploads',
        });
      }

      // Validate file extension when upload_type is 'file' to prevent unauthorized file types
      const extensionError = validateFileExtension(type, upload_type, file_path);
      if (extensionError) {
        return res.status(400).json({
          success: false,
          error: extensionError,
        });
      }

      // Security: Validate that file_path belongs to the authenticated user
      if (upload_type === 'file' && file_path) {
        if (!validateFilePathOwnership(authId, file_path)) {
          logger.error('File path ownership validation failed', {
            authId,
            file_path,
            endpoint: '/api/uploads',
            method: 'POST',
          });
          return res.status(403).json({
            success: false,
            error: 'Invalid file path: file must belong to authenticated user',
          });
        }
      }

      if ((upload_type === 'magnet' || upload_type === 'link') && !url) {
        return res.status(400).json({
          success: false,
          error: 'url is required for magnet/link uploads',
        });
      }

      const userDb = await backend.userDatabaseManager.getUserDatabase(authId);

      // Get max queue_order for this user to append to end
      const maxOrderResult = userDb.db
        .prepare('SELECT MAX(queue_order) as max_order FROM uploads WHERE status = ?')
        .get('queued');

      const queueOrder = (maxOrderResult?.max_order ?? -1) + 1;

      // Insert upload entry
      const result = userDb.db
        .prepare(
          `
            INSERT INTO uploads (
              type, upload_type, file_path, url, name, status,
              seed, allow_zip, as_queued, password, queue_order,
              next_attempt_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run(
          type,
          upload_type,
          file_path || null,
          url || null,
          name,
          seed || null,
          allow_zip !== undefined ? allow_zip : true,
          as_queued !== undefined ? as_queued : false,
          password || null,
          queueOrder
        );

      // Get created upload
      const upload = userDb.db
        .prepare(
          `
            SELECT id, type, upload_type, file_path, url, name, status,
                   error_message, retry_count, seed, allow_zip, as_queued, password,
                   queue_order, last_processed_at, completed_at, created_at, updated_at, next_attempt_at
            FROM uploads
            WHERE id = ?
          `
        )
        .get(result.lastInsertRowid);

      logger.info('Upload created', {
        authId,
        uploadId: upload.id,
        type,
        upload_type,
        name,
      });

      // Update upload counter in master DB (optimized increment)
      backend.masterDatabase.incrementUploadCounter(authId, null);

      res.json({ success: true, data: upload });
    } catch (error) {
      logger.error('Error creating upload', error, {
        endpoint: '/api/uploads',
        method: 'POST',
        authId: req.validatedAuthId,
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/uploads - List uploads for user
  app.get('/api/uploads', extractAuthIdMiddleware, userRateLimiter, async (req, res) => {
    try {
      const authId = req.validatedAuthId;

      if (!backend.userDatabaseManager) {
        return res.status(503).json({
          success: false,
          error: 'Service is initializing, please try again in a moment',
        });
      }

      const userDb = await backend.userDatabaseManager.getUserDatabase(authId);

      // Query parameters
      const status = req.query.status; // optional filter
      const type = req.query.type; // optional filter
      const search = req.query.search; // optional search filter
      const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 1000));
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const offset = (page - 1) * limit;

      // Build WHERE clause
      const conditions = [];
      const params = [];

      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }

      if (type) {
        conditions.push('type = ?');
        params.push(type);
      }

      if (search) {
        // Search across name, type, status, and error_message
        // Use LIKE with wildcards for case-insensitive search
        const searchPattern = `%${search}%`;
        conditions.push(
          '(LOWER(name) LIKE LOWER(?) OR LOWER(type) LIKE LOWER(?) OR LOWER(status) LIKE LOWER(?) OR LOWER(error_message) LIKE LOWER(?))'
        );
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM uploads ${whereClause}`;
      const totalCount = userDb.db.prepare(countQuery).get(...params);

      // Get status counts for all statuses (for tab display)
      const statusCounts = userDb.db
        .prepare(
          `
          SELECT status, COUNT(*) as count
          FROM uploads
          ${type ? 'WHERE type = ?' : ''}
          GROUP BY status
        `
        )
        .all(...(type ? [type] : []));

      // Convert to object for easier access
      const statusCountsMap = {};
      statusCounts.forEach((row) => {
        statusCountsMap[row.status] = row.count;
      });

      // Get upload statistics for rate limit display
      // Count API attempts in the last hour from upload_attempts table
      // This is more accurate than counting completed uploads since it tracks all attempts
      const uploadStats = userDb.db
        .prepare(
          `
          SELECT 
            COUNT(*) as uploads_last_hour,
            SUM(CASE WHEN type = 'torrent' THEN 1 ELSE 0 END) as torrents_last_hour,
            SUM(CASE WHEN type = 'usenet' THEN 1 ELSE 0 END) as usenets_last_hour,
            SUM(CASE WHEN type = 'webdl' THEN 1 ELSE 0 END) as webdls_last_hour
          FROM upload_attempts
          WHERE datetime(attempted_at) >= datetime('now', '-1 hour')
        `
        )
        .get();

      const uploadStatistics = {
        lastHour: {
          total: uploadStats?.uploads_last_hour || 0,
          torrents: uploadStats?.torrents_last_hour || 0,
          usenets: uploadStats?.usenets_last_hour || 0,
          webdls: uploadStats?.webdls_last_hour || 0,
        },
        rateLimit: {
          perMinute: 10,
          perHour: 60,
        },
      };

      // Build ORDER BY - queued items by queue_order, others by created_at DESC
      // When no status filter, show queued first (by queue_order), then others (by created_at DESC)
      const orderBy =
        status === 'queued'
          ? 'ORDER BY queue_order ASC'
          : status
            ? 'ORDER BY created_at DESC'
            : 'ORDER BY CASE WHEN status = "queued" THEN 0 ELSE 1 END, queue_order ASC, created_at DESC';

      // Get paginated results
      const query = `
          SELECT id, type, upload_type, file_path, url, name, status,
                 error_message, retry_count, seed, allow_zip, as_queued, password,
                 queue_order, last_processed_at, completed_at, created_at, updated_at
          FROM uploads
          ${whereClause}
          ${orderBy}
          LIMIT ? OFFSET ?
        `;
      params.push(limit, offset);

      const uploads = userDb.db.prepare(query).all(...params);

      res.json({
        success: true,
        data: uploads,
        pagination: {
          page,
          limit,
          total: totalCount.count,
          totalPages: Math.ceil(totalCount.count / limit),
        },
        statusCounts: statusCountsMap,
        uploadStatistics,
      });
    } catch (error) {
      logger.error('Error fetching uploads', error, {
        endpoint: '/api/uploads',
        method: 'GET',
        authId: req.validatedAuthId,
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/uploads/:id - Get single upload details
  app.get(
    '/api/uploads/:id',
    extractAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const uploadId = req.validatedIds.id;

        if (!backend.userDatabaseManager) {
          return res.status(503).json({
            success: false,
            error: 'Service is initializing, please try again in a moment',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);

        const upload = userDb.db
          .prepare(
            `
            SELECT id, type, upload_type, file_path, url, name, status,
                   error_message, retry_count, seed, allow_zip, as_queued, password,
                   queue_order, last_processed_at, completed_at, created_at, updated_at
            FROM uploads
            WHERE id = ?
          `
          )
          .get(uploadId);

        if (!upload) {
          return res.status(404).json({
            success: false,
            error: 'Upload not found',
          });
        }

        res.json({ success: true, data: upload });
      } catch (error) {
        logger.error('Error fetching upload', error, {
          endpoint: `/api/uploads/${req.params.id}`,
          method: 'GET',
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // GET /api/uploads/:id/download - Download original file
  app.get(
    '/api/uploads/:id/download',
    extractAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const uploadId = req.validatedIds.id;

        if (!backend.userDatabaseManager) {
          return res.status(503).json({
            success: false,
            error: 'Service is initializing, please try again in a moment',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);

        const upload = userDb.db
          .prepare(
            `
            SELECT id, type, upload_type, file_path, url, name, status
            FROM uploads
            WHERE id = ?
          `
          )
          .get(uploadId);

        if (!upload) {
          return res.status(404).json({
            success: false,
            error: 'Upload not found',
          });
        }

        // Only allow download for file uploads
        if (upload.upload_type !== 'file' || !upload.file_path) {
          return res.status(400).json({
            success: false,
            error: 'This upload does not have a downloadable file',
          });
        }

        try {
          const filePath = getUploadFilePath(upload.file_path);
          const fileBuffer = await readFile(filePath);
          const filename = upload.name || path.basename(upload.file_path);

          // Determine content type based on file extension
          const ext = path.extname(filename).toLowerCase();
          const contentTypeMap = {
            '.torrent': 'application/x-bittorrent',
            '.nzb': 'application/x-nzb',
          };
          const contentType = contentTypeMap[ext] || 'application/octet-stream';

          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.send(fileBuffer);
        } catch (fileError) {
          logger.error('Error reading upload file', fileError, {
            authId,
            uploadId,
            filePath: upload.file_path,
          });
          res.status(404).json({
            success: false,
            error: 'File not found on server',
          });
        }
      } catch (error) {
        logger.error('Error downloading upload file', error, {
          endpoint: `/api/uploads/${req.params.id}/download`,
          method: 'GET',
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // POST /api/uploads/bulk/retry - Bulk retry failed uploads
  // NOTE: This must be defined BEFORE /api/uploads/:id/retry to avoid route conflict
  app.post(
    '/api/uploads/bulk/retry',
    extractAuthIdMiddleware,
    uploadRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const { ids } = req.body; // Array of upload IDs

        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'ids array is required and must not be empty',
          });
        }

        // Validate all IDs are positive integers
        const invalidIds = ids.filter((id) => !validateNumericId(id));
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

        // Get uploads to check status
        const placeholders = numericIds.map(() => '?').join(',');
        const uploads = userDb.db
          .prepare(`SELECT id, status FROM uploads WHERE id IN (${placeholders})`)
          .all(...numericIds);

        if (uploads.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'No uploads found',
          });
        }

        // Filter to only failed uploads
        const failedUploads = uploads.filter((u) => u.status === 'failed');

        if (failedUploads.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No failed uploads found to retry',
          });
        }

        // Get max queue_order to append to end
        const maxOrderResult = userDb.db
          .prepare('SELECT MAX(queue_order) as max_order FROM uploads WHERE status = ?')
          .get('queued');

        let currentQueueOrder = (maxOrderResult?.max_order ?? -1) + 1;
        const retriedUploads = [];

        // Reset failed uploads to queued status
        for (const upload of failedUploads) {
          try {
            const updateResult = userDb.db
              .prepare(
                `
                UPDATE uploads
                SET status = 'queued',
                    error_message = NULL,
                    retry_count = 0,
                    next_attempt_at = NULL,
                    queue_order = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `
              )
              .run(currentQueueOrder++, upload.id);

            // Only add to retriedUploads and increment counter if the update actually modified a row
            // This prevents counter drift if the upload was deleted between SELECT and UPDATE
            if (updateResult.changes > 0) {
              retriedUploads.push(upload.id);
              backend.masterDatabase.incrementUploadCounter(authId, null);
            }
          } catch (error) {
            logger.error('Error retrying upload in bulk operation', error, {
              authId,
              uploadId: upload.id,
            });
          }
        }

        logger.info('Bulk upload retry', {
          authId,
          requested: numericIds.length,
          retried: retriedUploads.length,
        });

        res.json({
          success: true,
          message: `Retried ${retriedUploads.length} upload(s)`,
          data: {
            retried: retriedUploads.length,
            requested: numericIds.length,
            uploadIds: retriedUploads,
          },
        });
      } catch (error) {
        logger.error('Error bulk retrying uploads', error, {
          endpoint: '/api/uploads/bulk/retry',
          method: 'POST',
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // POST /api/uploads/:id/retry - Retry failed upload
  app.post(
    '/api/uploads/:id/retry',
    extractAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const uploadId = req.validatedIds.id;

        if (!backend.userDatabaseManager) {
          return res.status(503).json({
            success: false,
            error: 'Service is initializing, please try again in a moment',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);

        // Check if upload exists and is failed
        const upload = userDb.db
          .prepare('SELECT id, status FROM uploads WHERE id = ?')
          .get(uploadId);

        if (!upload) {
          return res.status(404).json({
            success: false,
            error: 'Upload not found',
          });
        }

        if (upload.status !== 'failed') {
          return res.status(400).json({
            success: false,
            error: 'Can only retry failed uploads',
          });
        }

        // Get max queue_order to append to end
        const maxOrderResult = userDb.db
          .prepare('SELECT MAX(queue_order) as max_order FROM uploads WHERE status = ?')
          .get('queued');

        const queueOrder = (maxOrderResult?.max_order ?? -1) + 1;

        // Reset to queued status
        const updateResult = userDb.db
          .prepare(
            `
            UPDATE uploads
            SET status = 'queued',
                error_message = NULL,
                retry_count = 0,
                next_attempt_at = NULL,
                queue_order = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `
          )
          .run(queueOrder, uploadId);

        // Only update counter if the update actually modified a row
        // This prevents counter drift if the upload was deleted between SELECT and UPDATE
        if (updateResult.changes > 0) {
          backend.masterDatabase.incrementUploadCounter(authId, null);
        } else {
          // Upload was deleted between SELECT and UPDATE, return 404
          return res.status(404).json({
            success: false,
            error: 'Upload not found or was deleted',
          });
        }

        // Get updated upload
        const updatedUpload = userDb.db
          .prepare(
            `
            SELECT id, type, upload_type, file_path, url, name, status,
                   error_message, retry_count, seed, allow_zip, as_queued, password,
                   queue_order, last_processed_at, completed_at, created_at, updated_at, next_attempt_at
            FROM uploads
            WHERE id = ?
          `
          )
          .get(uploadId);

        logger.info('Upload retried', { authId, uploadId });

        res.json({ success: true, data: updatedUpload });
      } catch (error) {
        logger.error('Error retrying upload', error, {
          endpoint: `/api/uploads/${req.params.id}/retry`,
          method: 'POST',
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // PATCH /api/uploads/reorder - Update queue order for a single item
  app.patch('/api/uploads/reorder', extractAuthIdMiddleware, userRateLimiter, async (req, res) => {
    try {
      const authId = req.validatedAuthId;

      if (!backend.userDatabaseManager) {
        return res.status(503).json({
          success: false,
          error: 'Service is initializing, please try again in a moment',
        });
      }

      const { id, old_order, new_order } = req.body;

      // Validate required fields
      if (id === undefined || old_order === undefined || new_order === undefined) {
        return res.status(400).json({
          success: false,
          error: 'id, old_order, and new_order are required',
        });
      }

      if (!validateNumericId(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid id. Must be a positive integer.',
        });
      }

      const uploadId = parseInt(id, 10);
      const oldOrder = parseInt(old_order, 10);
      const newOrder = parseInt(new_order, 10);

      if (oldOrder === newOrder) {
        return res.status(400).json({
          success: false,
          error: 'old_order and new_order must be different',
        });
      }

      const userDb = await backend.userDatabaseManager.getUserDatabase(authId);

      // Validate upload exists, belongs to user, and is queued
      const upload = userDb.db
        .prepare('SELECT id, status, queue_order FROM uploads WHERE id = ?')
        .get(uploadId);

      if (!upload) {
        return res.status(404).json({
          success: false,
          error: 'Upload not found',
        });
      }

      if (upload.status !== 'queued') {
        return res.status(400).json({
          success: false,
          error: 'Can only reorder queued uploads',
        });
      }

      // Verify old_order matches current queue_order
      if (upload.queue_order !== oldOrder) {
        return res.status(400).json({
          success: false,
          error: 'old_order does not match current queue_order',
        });
      }

      // Update queue_order in transaction
      // If moving down (new_order > old_order), shift items up
      // If moving up (new_order < old_order), shift items down
      userDb.db.transaction(() => {
        if (newOrder > oldOrder) {
          // Moving down: shift items between old_order+1 and new_order up by 1
          userDb.db
            .prepare(
              `
                UPDATE uploads
                SET queue_order = queue_order - 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE status = 'queued'
                  AND queue_order > ?
                  AND queue_order <= ?
              `
            )
            .run(oldOrder, newOrder);
        } else {
          // Moving up: shift items between new_order and old_order-1 down by 1
          userDb.db
            .prepare(
              `
                UPDATE uploads
                SET queue_order = queue_order + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE status = 'queued'
                  AND queue_order >= ?
                  AND queue_order < ?
              `
            )
            .run(newOrder, oldOrder);
        }

        // Update the moved item's queue_order
        userDb.db
          .prepare(
            'UPDATE uploads SET queue_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
          )
          .run(newOrder, uploadId);
      })();

      // Get updated upload
      const updatedUpload = userDb.db
        .prepare(
          `
            SELECT id, type, upload_type, file_path, url, name, status,
                   error_message, retry_count, seed, allow_zip, as_queued, password,
                   queue_order, last_processed_at, completed_at, created_at, updated_at, next_attempt_at
            FROM uploads
            WHERE id = ?
          `
        )
        .get(uploadId);

      logger.info('Queue order updated', {
        authId,
        uploadId,
        oldOrder,
        newOrder,
      });

      res.json({ success: true, data: updatedUpload });
    } catch (error) {
      logger.error('Error reordering uploads', error, {
        endpoint: '/api/uploads/reorder',
        method: 'PATCH',
        authId: req.validatedAuthId,
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/uploads/bulk - Bulk delete uploads
  // NOTE: This must be defined BEFORE /api/uploads/:id to avoid route conflict
  app.delete('/api/uploads/bulk', extractAuthIdMiddleware, uploadRateLimiter, async (req, res) => {
    try {
      const authId = req.validatedAuthId;
      const { ids } = req.body; // Array of upload IDs

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'ids array is required and must not be empty',
        });
      }

      // Validate all IDs are positive integers
      const invalidIds = ids.filter((id) => !validateNumericId(id));
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

      // Get uploads to check status and file_paths
      const placeholders = numericIds.map(() => '?').join(',');
      const uploads = userDb.db
        .prepare(`SELECT id, file_path, status FROM uploads WHERE id IN (${placeholders})`)
        .all(...numericIds);

      if (uploads.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No uploads found',
        });
      }

      let deletedCount = 0;
      let queuedDeletedCount = 0;

      // Delete files and records
      for (const upload of uploads) {
        try {
          // Delete file if exists (with authId for security validation)
          if (upload.file_path) {
            await deleteUploadFile(authId, upload.file_path);
          }

          // Re-read status after async file deletion to check if UploadProcessor
          // completed the upload during the file deletion (race condition fix)
          const currentUpload = userDb.db
            .prepare('SELECT status FROM uploads WHERE id = ?')
            .get(upload.id);

          // Delete from database
          userDb.db.prepare('DELETE FROM uploads WHERE id = ?').run(upload.id);
          deletedCount++;

          // Decrement counter only if status was still queued or processing
          // at the time of deletion (not if UploadProcessor completed it)
          if (
            currentUpload &&
            (currentUpload.status === 'queued' || currentUpload.status === 'processing')
          ) {
            queuedDeletedCount++;
          }
        } catch (error) {
          logger.error('Error deleting upload in bulk operation', error, {
            authId,
            uploadId: upload.id,
          });
        }
      }

      // Update counter (decrement for each queued or processing upload deleted)
      for (let i = 0; i < queuedDeletedCount; i++) {
        backend.masterDatabase.decrementUploadCounter(authId);
      }

      logger.info('Bulk upload delete', {
        authId,
        requested: numericIds.length,
        deleted: deletedCount,
        queuedDeleted: queuedDeletedCount,
      });

      res.json({
        success: true,
        message: `Deleted ${deletedCount} upload(s)`,
        data: {
          deleted: deletedCount,
          requested: numericIds.length,
        },
      });
    } catch (error) {
      logger.error('Error bulk deleting uploads', error, {
        endpoint: '/api/uploads/bulk',
        method: 'DELETE',
        authId: req.validatedAuthId,
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/uploads/:id - Delete upload
  app.delete(
    '/api/uploads/:id',
    extractAuthIdMiddleware,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const uploadId = req.validatedIds.id;

        if (!backend.userDatabaseManager) {
          return res.status(503).json({
            success: false,
            error: 'Service is initializing, please try again in a moment',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);

        // Get upload to check file_path and status
        const upload = userDb.db
          .prepare('SELECT id, file_path, status FROM uploads WHERE id = ?')
          .get(uploadId);

        if (!upload) {
          return res.status(404).json({
            success: false,
            error: 'Upload not found',
          });
        }

        // Delete file if exists (with authId for security validation)
        if (upload.file_path) {
          await deleteUploadFile(authId, upload.file_path);
        }

        // Re-read status after async file deletion to check if UploadProcessor
        // completed the upload during the file deletion (race condition fix)
        const currentUpload = userDb.db
          .prepare('SELECT status FROM uploads WHERE id = ?')
          .get(uploadId);

        // Delete from database
        userDb.db.prepare('DELETE FROM uploads WHERE id = ?').run(uploadId);

        // Update counter only if status was still queued or processing
        // at the time of deletion (not if UploadProcessor completed it)
        if (
          currentUpload &&
          (currentUpload.status === 'queued' || currentUpload.status === 'processing')
        ) {
          backend.masterDatabase.decrementUploadCounter(authId);
        }

        logger.info('Upload deleted', { authId, uploadId });

        res.json({
          success: true,
          message: 'Upload deleted successfully',
        });
      } catch (error) {
        logger.error('Error deleting upload', error, {
          endpoint: `/api/uploads/${req.params.id}`,
          method: 'DELETE',
          authId: req.validatedAuthId,
        });
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );
}
