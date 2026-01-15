import ApiClient from '../api/ApiClient.js';
import { decrypt } from '../utils/crypto.js';
import logger from '../utils/logger.js';
import { getUploadFilePath, fileExists } from '../utils/fileStorage.js';
import FormData from 'form-data';
import { readFileSync } from 'fs';

// Rate limits: 10 per minute, 60 per hour per type
const RATE_LIMIT_PER_MINUTE = 10;
const RATE_LIMIT_PER_HOUR = 60;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const PROCESSOR_INTERVAL_MS = parseInt(process.env.UPLOAD_PROCESSOR_INTERVAL_MS || '5000', 10);
const MAX_RETRIES = 3;

/**
 * Upload Processor
 * Processes queued uploads in the background, respecting rate limits
 */
class UploadProcessor {
  constructor(userDatabaseManager, masterDatabase) {
    this.userDatabaseManager = userDatabaseManager;
    this.masterDatabase = masterDatabase;
    this.isRunning = false;
    this.intervalId = null;
    this.lastCleanupAt = null;
    this.cleanupIntervalMs = 24 * 60 * 60 * 1000; // Cleanup once per day

    // API clients cache: { authId: ApiClient }
    this.apiClients = new Map();
  }

  /**
   * Get or create API client for a user
   * @param {string} authId - User authentication ID
   * @returns {Promise<ApiClient>} API client instance
   */
  async getApiClient(authId) {
    if (this.apiClients.has(authId)) {
      return this.apiClients.get(authId);
    }

    // Get encrypted API key from master database
    const apiKeyData = this.masterDatabase.getApiKey(authId);
    if (!apiKeyData) {
      throw new Error(`API key not found for user ${authId}`);
    }

    const apiKey = decrypt(apiKeyData.encrypted_key);
    const apiClient = new ApiClient(apiKey);
    this.apiClients.set(authId, apiClient);

    return apiClient;
  }

  /**
   * Calculate wait time based on rate limits from database
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type (torrent, usenet, webdl)
   * @returns {number} Wait time in milliseconds
   */
  calculateWaitTime(userDb, type) {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - MINUTE_MS)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);
    const oneHourAgo = new Date(now.getTime() - HOUR_MS)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);

    // Count attempts in last minute
    const minuteCount = userDb.db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM upload_attempts
        WHERE type = ? AND attempted_at >= ?
      `
      )
      .get(type, oneMinuteAgo);

    // Count attempts in last hour
    const hourCount = userDb.db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM upload_attempts
        WHERE type = ? AND attempted_at >= ?
      `
      )
      .get(type, oneHourAgo);

    let waitTime = 0;

    // Check per-minute limit
    if ((minuteCount?.count || 0) >= RATE_LIMIT_PER_MINUTE) {
      // Get oldest attempt in last minute
      const oldestMinute = userDb.db
        .prepare(
          `
          SELECT MIN(attempted_at) as oldest
          FROM upload_attempts
          WHERE type = ? AND attempted_at >= ?
        `
        )
        .get(type, oneMinuteAgo);

      if (oldestMinute?.oldest) {
        const oldestDate = new Date(oldestMinute.oldest.replace(' ', 'T') + 'Z');
        const timeUntilOldestExpires = MINUTE_MS - (now.getTime() - oldestDate.getTime());
        waitTime = Math.max(waitTime, timeUntilOldestExpires + 1000); // Add 1 second buffer
      }
    }

    // Check per-hour limit
    if ((hourCount?.count || 0) >= RATE_LIMIT_PER_HOUR) {
      // Get oldest attempt in last hour
      const oldestHour = userDb.db
        .prepare(
          `
          SELECT MIN(attempted_at) as oldest
          FROM upload_attempts
          WHERE type = ? AND attempted_at >= ?
        `
        )
        .get(type, oneHourAgo);

      if (oldestHour?.oldest) {
        const oldestDate = new Date(oldestHour.oldest.replace(' ', 'T') + 'Z');
        const timeUntilOldestExpires = HOUR_MS - (now.getTime() - oldestDate.getTime());
        waitTime = Math.max(waitTime, timeUntilOldestExpires + 1000); // Add 1 second buffer
      }
    }

    return waitTime;
  }

  /**
   * Check if we're currently at the rate limit (without waiting)
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @returns {boolean} True if at rate limit
   */
  isAtRateLimit(userDb, type) {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - MINUTE_MS)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);
    const oneHourAgo = new Date(now.getTime() - HOUR_MS)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);

    // Count attempts in last minute
    const minuteCount = userDb.db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM upload_attempts
        WHERE type = ? AND attempted_at >= ?
      `
      )
      .get(type, oneMinuteAgo);

    // Count attempts in last hour
    const hourCount = userDb.db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM upload_attempts
        WHERE type = ? AND attempted_at >= ?
      `
      )
      .get(type, oneHourAgo);

    return (
      (minuteCount?.count || 0) >= RATE_LIMIT_PER_MINUTE ||
      (hourCount?.count || 0) >= RATE_LIMIT_PER_HOUR
    );
  }

  /**
   * Check if we're too close to rate limit (within 1 of the limit)
   * This helps prevent hitting the limit by processing one more upload
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @returns {boolean} True if too close to limit
   */
  isTooCloseToRateLimit(userDb, type) {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - MINUTE_MS)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);
    const oneHourAgo = new Date(now.getTime() - HOUR_MS)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);

    // Count attempts in last minute
    const minuteCount = userDb.db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM upload_attempts
        WHERE type = ? AND attempted_at >= ?
      `
      )
      .get(type, oneMinuteAgo);

    // Count attempts in last hour
    const hourCount = userDb.db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM upload_attempts
        WHERE type = ? AND attempted_at >= ?
      `
      )
      .get(type, oneHourAgo);

    // If we're within 1 of the limit, we're too close
    // This prevents processing one more upload that would hit the limit
    return (
      (minuteCount?.count || 0) >= RATE_LIMIT_PER_MINUTE - 1 ||
      (hourCount?.count || 0) >= RATE_LIMIT_PER_HOUR - 1
    );
  }

  /**
   * Log API attempt to database for rate limit tracking
   * @param {Object} userDb - User database instance
   * @param {number} uploadId - Upload ID (can be null for orphaned attempts)
   * @param {string} type - Upload type
   * @param {number|null} statusCode - HTTP status code
   * @param {boolean} success - Whether the attempt was successful
   * @param {string|null} errorCode - Error code if failed
   * @param {string|null} errorMessage - Error message if failed
   */
  logUploadAttempt(
    userDb,
    uploadId,
    type,
    statusCode,
    success,
    errorCode = null,
    errorMessage = null
  ) {
    try {
      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, error_code, error_message)
          VALUES (?, ?, ?, ?, ?, ?)
        `
        )
        .run(uploadId, type, statusCode, success ? 1 : 0, errorCode, errorMessage);
    } catch (error) {
      // Don't throw - logging shouldn't break upload processing
      logger.error('Failed to log upload attempt', error, {
        uploadId,
        type,
        statusCode,
        success,
      });
    }
  }

  /**
   * Calculate minimum time until next upload can be processed
   * Only enforces spacing when approaching the rate limit to maximize throughput
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @returns {number} Minimum wait time in milliseconds before next upload
   */
  calculateMinTimeUntilNextUpload(userDb, type) {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - MINUTE_MS)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);

    // Count attempts in last minute
    const minuteCount = userDb.db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM upload_attempts
        WHERE type = ? AND attempted_at >= ?
      `
      )
      .get(type, oneMinuteAgo);

    const count = minuteCount?.count || 0;

    // Only enforce spacing when we're approaching the limit (7+ in last minute)
    // This allows processing every 5 seconds when we have capacity (up to 12/min),
    // but slows down to 6-second spacing when approaching the 10/minute limit
    if (count >= 7) {
      // Get the most recent upload attempt in the last minute
      const recentAttempt = userDb.db
        .prepare(
          `
          SELECT attempted_at
          FROM upload_attempts
          WHERE type = ? AND attempted_at >= ?
          ORDER BY attempted_at DESC
          LIMIT 1
        `
        )
        .get(type, oneMinuteAgo);

      if (recentAttempt?.attempted_at) {
        const lastAttemptDate = new Date(recentAttempt.attempted_at.replace(' ', 'T') + 'Z');
        const timeSinceLastAttempt = now.getTime() - lastAttemptDate.getTime();

        // Minimum interval between uploads: 60s / 10 = 6 seconds
        // Only enforce this when approaching the limit
        const minIntervalMs = MINUTE_MS / RATE_LIMIT_PER_MINUTE; // 6000ms = 6 seconds

        if (timeSinceLastAttempt < minIntervalMs) {
          return minIntervalMs - timeSinceLastAttempt;
        }
      }
    }

    return 0; // No wait needed - we have capacity (fewer than 7 in last minute)
  }

  /**
   * Wait for rate limit if needed
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @returns {Promise<void>}
   */
  async waitForRateLimit(userDb, type) {
    // First, ensure minimum spacing between uploads (6 seconds for 10/minute limit)
    const minWaitTime = this.calculateMinTimeUntilNextUpload(userDb, type);
    if (minWaitTime > 0) {
      logger.debug('Waiting for minimum interval between uploads', {
        type,
        waitTimeMs: minWaitTime,
      });
      await new Promise((resolve) => setTimeout(resolve, minWaitTime));
    }

    // Then check if we're at the rate limit and wait if needed
    const waitTime = this.calculateWaitTime(userDb, type);
    if (waitTime > 0) {
      logger.debug('Waiting for rate limit', { type, waitTimeMs: waitTime });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Process a single upload
   * @param {Object} upload - Upload record from database
   * @param {Object} userDb - User database instance
   * @returns {Promise<boolean>} True if successful
   */
  async processUpload(upload, userDb) {
    const { id, type, upload_type, file_path, url, name, seed, allow_zip, as_queued, password } =
      upload;

    try {
      // Get API client - authId should be passed in upload object
      if (!upload.authId) {
        throw new Error('authId is required for processing upload');
      }
      const apiClient = await this.getApiClient(upload.authId);

      // Check rate limit BEFORE making the request
      // If at limit or too close to limit, defer instead of making a request that will fail
      // "Too close" means we're within 1 of the limit, which prevents hitting the limit
      if (this.isAtRateLimit(userDb, type) || this.isTooCloseToRateLimit(userDb, type)) {
        const waitTime = this.calculateWaitTime(userDb, type);
        const nextAttemptAt = new Date(Date.now() + waitTime)
          .toISOString()
          .replace('T', ' ')
          .substring(0, 19);

        logger.debug('At rate limit, deferring upload', {
          uploadId: id,
          type,
          waitTimeMs: waitTime,
          nextAttemptAt,
        });

        // Don't set error_message for rate limits - next_attempt_at handles the deferral
        // Update upload to defer (no error message needed)
        userDb.db
          .prepare(
            `
            UPDATE uploads
            SET status = 'queued',
                error_message = NULL,
                next_attempt_at = ?,
                last_processed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `
          )
          .run(nextAttemptAt, id);

        // Update master DB counter
        await this.masterDatabase.updateUploadCounters(upload.authId, userDb);

        return false; // Not processed, will retry later
      }

      // Wait for rate limit if needed
      // This ensures minimum spacing (6 seconds) between uploads and waits if at limit
      await this.waitForRateLimit(userDb, type);

      // Create FormData for TorBox API
      const formData = new FormData();

      if (upload_type === 'file') {
        // Read file from storage
        const absolutePath = getUploadFilePath(file_path);
        const exists = await fileExists(file_path);
        if (!exists) {
          throw new Error(`File not found: ${file_path}`);
        }

        // Read file as buffer and append to FormData
        // Using buffer instead of stream for better compatibility with axios
        try {
          const fileBuffer = readFileSync(absolutePath);
          // form-data library: append(name, value, filename)
          formData.append('file', fileBuffer, name);

          logger.debug('File read and appended to FormData', {
            uploadId: id,
            filePath: absolutePath,
            fileSize: fileBuffer.length,
            filename: name,
          });
        } catch (fileError) {
          logger.error('Error reading file for upload', fileError, {
            uploadId: id,
            filePath: absolutePath,
          });
          throw new Error(`Failed to read file: ${fileError.message}`);
        }
      } else if (upload_type === 'magnet') {
        formData.append('magnet', url);
      } else {
        // link type
        formData.append('link', url);
      }

      // Add type-specific options
      // For torrents, seed and allow_zip are required by TorBox API
      // Always send them with defaults if not provided
      let seedValue, allowZipValue;
      if (type === 'torrent' || upload_type === 'magnet') {
        // seed: default to 1 if null/undefined (1 = Auto/seed after download completes)
        // Note: TorBox API accepts 1 (Auto), 2 (Seed), 3 (Don't Seed)
        seedValue = seed !== null && seed !== undefined ? seed : 1;
        formData.append('seed', seedValue);

        // allow_zip: default to true (1) if null/undefined
        allowZipValue = allow_zip !== null && allow_zip !== undefined ? allow_zip : 1;
        formData.append('allow_zip', allowZipValue);
      }

      if (as_queued) {
        formData.append('as_queued', 'true');
      }

      if (password) {
        formData.append('password', password);
      }

      if (name) {
        formData.append('name', name);
      }

      // Make API call based on type
      let response;
      const baseURL = process.env.TORBOX_API_BASE || 'https://api.torbox.app';
      const apiVersion = process.env.TORBOX_API_VERSION || 'v1';
      const endpoint = `${baseURL}/${apiVersion}/api/${type === 'torrent' ? 'torrents/createtorrent' : type === 'usenet' ? 'usenet/createusenetdownload' : 'webdl/createwebdownload'}`;

      // Merge FormData headers with Authorization header
      // FormData headers include the correct Content-Type with boundary
      const formDataHeaders = formData.getHeaders();
      const requestHeaders = {
        ...formDataHeaders,
        // Preserve Authorization header from apiClient
        Authorization: apiClient.client.defaults.headers['Authorization'],
        'User-Agent': apiClient.client.defaults.headers['User-Agent'],
      };

      // Log FormData contents for debugging
      logger.debug('Sending upload to TorBox API', {
        uploadId: id,
        endpoint,
        upload_type,
        hasFile: upload_type === 'file',
        filePath: upload_type === 'file' ? file_path : null,
        seed: seedValue,
        allow_zip: allowZipValue,
        name,
      });

      // Make the API call
      response = await apiClient.client.post(endpoint, formData, {
        headers: requestHeaders,
        timeout: 30000,
        // Important: Don't let axios set Content-Type, let form-data handle it
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      // Log successful API attempt to database for rate limit tracking
      this.logUploadAttempt(userDb, id, type, response.status, true, null, null);

      // Update upload status to completed
      userDb.db
        .prepare(
          `
          UPDATE uploads
          SET status = 'completed',
              error_message = NULL,
              completed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
        )
        .run(id);

      // Update counter (queued -> completed means decrement)
      this.masterDatabase.decrementUploadCounter(upload.authId);

      logger.info('Upload processed successfully', {
        uploadId: id,
        type,
        upload_type,
        name,
      });

      return true;
    } catch (error) {
      // Log failed API attempt to database for rate limit tracking (if the API call was actually made)
      // TorBox counts both successful and failed attempts towards their rate limits
      // Only log if error.response exists (meaning the API call was made and got a response)
      // Don't log for pre-flight errors like file not found or authId missing
      if (error.response) {
        const errorData = error.response?.data;
        const errorCode = errorData?.error || null;
        const errorMessage = errorData?.detail || error.message || null;
        this.logUploadAttempt(
          userDb,
          id,
          type,
          error.response.status,
          false,
          errorCode,
          errorMessage
        );
      }

      // Check if it's a rate limit error (429)
      const isRateLimit = error.response?.status === 429 || error.message?.includes('429');

      // Check if it's a non-retryable error
      const errorData = error.response?.data;
      const errorCode = errorData?.error;
      const nonRetryableErrors = [
        'DATABASE_ERROR',
        'NO_AUTH',
        'BAD_TOKEN',
        'AUTH_ERROR',
        'INVALID_OPTION',
        'MISSING_REQUIRED_OPTION',
        'BOZO_NZB',
        'DOWNLOAD_TOO_LARGE',
        'MONTHLY_LIMIT',
        'ACTIVE_LIMIT',
      ];

      const isNonRetryable =
        nonRetryableErrors.includes(errorCode) ||
        error.message?.includes('File not found') ||
        error.message?.includes('Invalid') ||
        // TorBox returns this when request has no file/magnet/link; retrying won't help
        error.response?.data?.detail?.includes('You must provide either a file or magnet link.') ||
        // Private torrent downloading is disabled - no point retrying
        error.response?.data?.detail?.includes(
          'Private torrent downloading is currently disabled'
        ) ||
        error.message?.includes('Private torrent downloading is currently disabled');

      // Compute retry/backoff decisions
      const newRetryCount = (upload.retry_count ?? 0) + 1;

      // For TorBox rate limits, we always keep the upload queued and defer via next_attempt_at
      // (do NOT mark failed, and do NOT increment retry_count).
      const shouldRetry = !isNonRetryable && newRetryCount < MAX_RETRIES && !isRateLimit;
      const finalRetryCount = isRateLimit ? (upload.retry_count ?? 0) : newRetryCount;

      // Determine status + deferral
      const finalStatus = isRateLimit ? 'queued' : shouldRetry ? 'queued' : 'failed';

      // Calculate exponential backoff delay for regular retries (30s, 60s, 120s, ... capped at 5m)
      const backoffDelayMs = shouldRetry
        ? Math.min(30000 * Math.pow(2, Math.max(finalRetryCount - 1, 0)), 300000)
        : 0;

      // For rate limits, calculate wait time based on which limit was hit (per-minute or per-hour)
      // This ensures we wait the correct amount of time instead of defaulting to 1 hour
      let rateLimitDelayMs = 0;
      if (isRateLimit) {
        // Prefer Retry-After header if present
        const retryAfterHeader =
          error.response?.headers?.['retry-after'] ?? error.response?.headers?.['Retry-After'];
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;

        if (Number.isFinite(retryAfterSeconds)) {
          // Use Retry-After header if provided
          rateLimitDelayMs = Math.max(0, retryAfterSeconds) * 1000;
        } else {
          // Calculate wait time based on actual rate limit state (per-minute or per-hour)
          // This will determine if we hit the 10/minute or 60/hour limit
          rateLimitDelayMs = this.calculateWaitTime(userDb, type);

          // If calculateWaitTime returns 0 (shouldn't happen if we got 429, but safety check),
          // default to waiting until oldest request in last minute expires
          if (rateLimitDelayMs === 0) {
            const now = new Date();
            const oneMinuteAgo = new Date(now.getTime() - MINUTE_MS)
              .toISOString()
              .replace('T', ' ')
              .substring(0, 19);

            const oldestMinute = userDb.db
              .prepare(
                `
                SELECT MIN(attempted_at) as oldest
                FROM upload_attempts
                WHERE type = ? AND attempted_at >= ?
              `
              )
              .get(type, oneMinuteAgo);

            if (oldestMinute?.oldest) {
              const oldestDate = new Date(oldestMinute.oldest.replace(' ', 'T') + 'Z');
              rateLimitDelayMs = Math.max(
                0,
                MINUTE_MS - (now.getTime() - oldestDate.getTime()) + 1000
              );
            } else {
              // Fallback: wait 1 minute if we can't determine
              rateLimitDelayMs = MINUTE_MS;
            }
          }
        }
      }

      const deferMs = isRateLimit ? rateLimitDelayMs : backoffDelayMs;
      const nextAttemptAt =
        deferMs > 0
          ? new Date(Date.now() + deferMs).toISOString().replace('T', ' ').substring(0, 19)
          : null;

      // Get current status to check if counter needs updating
      const currentUpload = userDb.db.prepare('SELECT status FROM uploads WHERE id = ?').get(id);
      const wasQueued = currentUpload?.status === 'queued';

      // Create user-friendly error message
      let userFriendlyError = error.response?.data?.detail || error.message || 'Unknown error';

      // Replace technical error messages with user-friendly ones
      // Don't set error_message for rate limits - next_attempt_at handles the deferral
      if (isRateLimit) {
        // Clear error message - rate limit is handled via next_attempt_at
        userFriendlyError = null;
      } else if (error.message?.includes('Request failed with status code 429')) {
        // Clear error message - rate limit is handled via next_attempt_at
        userFriendlyError = null;
      } else if (error.message?.includes('File not found')) {
        userFriendlyError = 'File not found. The upload file may have been deleted.';
      } else if (errorCode === 'MISSING_REQUIRED_OPTION') {
        userFriendlyError = 'Missing required option. Please check upload settings.';
      } else if (errorCode === 'INVALID_OPTION') {
        userFriendlyError = 'Invalid option. Please check upload settings.';
      } else if (
        error.response?.data?.detail?.includes('You must provide either a file or magnet link')
      ) {
        userFriendlyError = 'Invalid upload: file or magnet link is required.';
      }

      userDb.db
        .prepare(
          `
          UPDATE uploads
          SET status = ?,
              error_message = ?,
              retry_count = ?,
              next_attempt_at = ?,
              last_processed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
        )
        .run(finalStatus, userFriendlyError, finalRetryCount, nextAttemptAt, id);

      // Update counter if status changed from queued to failed
      // (queued -> queued with next_attempt_at doesn't change count, but we need to update next_upload_attempt_at)
      if (finalStatus === 'failed' && wasQueued) {
        this.masterDatabase.decrementUploadCounter(upload.authId);
      } else if (finalStatus === 'queued') {
        // Status stayed queued but next_attempt_at changed - update master DB counter
        // Use full recalculation for accuracy (handles next_upload_attempt_at properly)
        await this.masterDatabase.updateUploadCounters(upload.authId, userDb);
      }

      if (isRateLimit) {
        logger.warn('Rate limit hit, will retry later', {
          uploadId: id,
          type,
          waitTimeMs: deferMs,
        });
      } else if (shouldRetry) {
        logger.warn('Upload failed, will retry', {
          uploadId: id,
          type,
          retryCount: finalRetryCount,
          maxRetries: MAX_RETRIES,
          backoffDelayMs: deferMs,
          error: error.message,
        });
      } else {
        logger.error('Upload failed permanently', {
          uploadId: id,
          type,
          retryCount: finalRetryCount,
          error: error.message,
          errorCode,
          isNonRetryable,
        });
      }

      return false;
    }
  }

  /**
   * Get queued uploads for a user, ordered by queue_order
   * @param {Object} userDb - User database instance
   * @param {string} authId - User authentication ID
   * @param {string} type - Optional type filter
   * @returns {Array} Array of upload records
   */
  getQueuedUploads(userDb, authId, type = null) {
    let query = `
      SELECT id, type, upload_type, file_path, url, name, status,
             error_message, retry_count, seed, allow_zip, as_queued, password,
             queue_order, last_processed_at, completed_at, created_at, updated_at, next_attempt_at
      FROM uploads
      WHERE status = 'queued'
        AND (next_attempt_at IS NULL OR datetime(next_attempt_at) <= datetime('now'))
    `;

    const params = [];
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY queue_order ASC LIMIT 1';

    return userDb.db.prepare(query).all(...params);
  }

  /**
   * Process uploads for all active users
   * Uses optimized query to only process users with queued uploads
   */
  async processUploads() {
    if (!this.userDatabaseManager) {
      return;
    }

    try {
      // Use optimized query to only get users with queued uploads ready for processing
      const usersWithUploads = this.masterDatabase.getUsersWithQueuedUploads();

      // Cleanup old attempts periodically (once per day for all active users)
      const now = Date.now();
      const shouldCleanup =
        !this.lastCleanupAt || now - this.lastCleanupAt >= this.cleanupIntervalMs;

      for (const user of usersWithUploads) {
        const { auth_id, encrypted_key } = user;

        try {
          const userDb = await this.userDatabaseManager.getUserDatabase(auth_id);

          // Cleanup old attempts if needed (once per day)
          if (shouldCleanup) {
            this.cleanupOldAttempts(userDb);
          }

          // Process one upload per type per cycle to respect rate limits
          const types = ['torrent', 'usenet', 'webdl'];

          for (const type of types) {
            const queuedUploads = this.getQueuedUploads(userDb, auth_id, type);

            if (queuedUploads.length > 0) {
              const upload = queuedUploads[0]; // Get first (highest priority)

              // Check if upload is currently being processed (avoid concurrent processing)
              const currentStatus = userDb.db
                .prepare('SELECT status FROM uploads WHERE id = ?')
                .get(upload.id);

              if (currentStatus?.status === 'queued') {
                // Mark as processing
                userDb.db
                  .prepare(
                    `
                    UPDATE uploads
                    SET status = 'processing',
                        last_processed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                  `
                  )
                  .run(upload.id);

                // Process upload
                await this.processUpload({ ...upload, authId: auth_id }, userDb);
              }
            }
          }
        } catch (error) {
          logger.error('Error processing uploads for user', error, {
            authId: auth_id,
          });
        }
      }

      // Update cleanup timestamp after processing all users
      if (shouldCleanup) {
        this.lastCleanupAt = now;
      }
    } catch (error) {
      logger.error('Error in upload processing cycle', error);
    }
  }

  /**
   * Cleanup old upload attempts (keep last 7 days for rate limit tracking)
   * @param {Object} userDb - User database instance
   */
  cleanupOldAttempts(userDb) {
    try {
      // Keep last 7 days of attempts for rate limit tracking
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .replace('T', ' ')
        .substring(0, 19);

      const result = userDb.db
        .prepare(
          `
          DELETE FROM upload_attempts
          WHERE attempted_at < ?
        `
        )
        .run(sevenDaysAgo);

      if (result.changes > 0) {
        logger.debug('Cleaned up old upload attempts', {
          deletedCount: result.changes,
          cutoffDate: sevenDaysAgo,
        });
      }
    } catch (error) {
      logger.error('Failed to cleanup old upload attempts', error);
      // Don't throw - cleanup failures shouldn't break processing
    }
  }

  /**
   * Start the upload processor
   */
  start() {
    if (this.isRunning) {
      logger.warn('Upload processor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting upload processor', {
      intervalMs: PROCESSOR_INTERVAL_MS,
    });

    // Process immediately on start
    this.processUploads();

    // Then process at intervals
    this.intervalId = setInterval(() => {
      this.processUploads();
    }, PROCESSOR_INTERVAL_MS);
  }

  /**
   * Stop the upload processor
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Clear API clients cache
    this.apiClients.clear();

    logger.info('Upload processor stopped');
  }
}

export default UploadProcessor;
