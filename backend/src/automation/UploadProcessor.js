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
const MIN_INTERVAL_THRESHOLD = 7; // Only enforce spacing when 7+ in last minute
const RATE_LIMIT_BUFFER_MS = 1000; // 1 second buffer for rate limit calculations
const API_TIMEOUT_MS = 30000;
const INITIAL_BACKOFF_MS = 30000; // 30 seconds
const MAX_BACKOFF_MS = 300000; // 5 minutes
const CLEANUP_RETENTION_DAYS = 7;

// Non-retryable error codes
const NON_RETRYABLE_ERRORS = [
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

  // ==================== Helper Methods ====================

  /**
   * Format date to SQL datetime string (YYYY-MM-DD HH:MM:SS)
   * @param {Date} date - Date to format
   * @returns {string} Formatted date string
   */
  formatDateForSQL(date) {
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }

  /**
   * Parse SQL datetime string to Date object
   * @param {string} sqlDate - SQL datetime string
   * @returns {Date} Parsed date
   */
  parseSQLDate(sqlDate) {
    return new Date(sqlDate.replace(' ', 'T') + 'Z');
  }

  /**
   * Get time boundaries for rate limit checking
   * @returns {Object} Object with now, oneMinuteAgo, oneHourAgo
   */
  getRateLimitBoundaries() {
    const now = new Date();
    return {
      now,
      oneMinuteAgo: this.formatDateForSQL(new Date(now.getTime() - MINUTE_MS)),
      oneHourAgo: this.formatDateForSQL(new Date(now.getTime() - HOUR_MS)),
    };
  }

  /**
   * Count upload attempts in a time window
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @param {string} sinceDate - SQL datetime string
   * @returns {number} Count of attempts
   */
  countAttemptsSince(userDb, type, sinceDate) {
    const result = userDb.db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM upload_attempts
        WHERE type = ? AND attempted_at >= ?
      `
      )
      .get(type, sinceDate);
    return result?.count || 0;
  }

  /**
   * Get oldest attempt in a time window
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @param {string} sinceDate - SQL datetime string
   * @returns {string|null} Oldest attempt datetime or null
   */
  getOldestAttemptSince(userDb, type, sinceDate) {
    const result = userDb.db
      .prepare(
        `
        SELECT MIN(attempted_at) as oldest
        FROM upload_attempts
        WHERE type = ? AND attempted_at >= ?
      `
      )
      .get(type, sinceDate);
    return result?.oldest || null;
  }

  /**
   * Get most recent attempt in a time window
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @param {string} sinceDate - SQL datetime string
   * @returns {string|null} Most recent attempt datetime or null
   */
  getMostRecentAttemptSince(userDb, type, sinceDate) {
    const result = userDb.db
      .prepare(
        `
        SELECT attempted_at
        FROM upload_attempts
        WHERE type = ? AND attempted_at >= ?
        ORDER BY attempted_at DESC
        LIMIT 1
      `
      )
      .get(type, sinceDate);
    return result?.attempted_at || null;
  }

  // ==================== Rate Limit Methods ====================

  /**
   * Calculate wait time based on rate limits from database
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type (torrent, usenet, webdl)
   * @returns {number} Wait time in milliseconds
   */
  calculateWaitTime(userDb, type) {
    const { now, oneMinuteAgo, oneHourAgo } = this.getRateLimitBoundaries();
    let waitTime = 0;

    // Check per-minute limit
    const minuteCount = this.countAttemptsSince(userDb, type, oneMinuteAgo);
    if (minuteCount >= RATE_LIMIT_PER_MINUTE) {
      const oldestMinute = this.getOldestAttemptSince(userDb, type, oneMinuteAgo);
      if (oldestMinute) {
        const oldestDate = this.parseSQLDate(oldestMinute);
        const timeUntilOldestExpires = MINUTE_MS - (now.getTime() - oldestDate.getTime());
        waitTime = Math.max(waitTime, timeUntilOldestExpires + RATE_LIMIT_BUFFER_MS);
      }
    }

    // Check per-hour limit
    const hourCount = this.countAttemptsSince(userDb, type, oneHourAgo);
    if (hourCount >= RATE_LIMIT_PER_HOUR) {
      const oldestHour = this.getOldestAttemptSince(userDb, type, oneHourAgo);
      if (oldestHour) {
        const oldestDate = this.parseSQLDate(oldestHour);
        const timeUntilOldestExpires = HOUR_MS - (now.getTime() - oldestDate.getTime());
        waitTime = Math.max(waitTime, timeUntilOldestExpires + RATE_LIMIT_BUFFER_MS);
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
    const { oneMinuteAgo, oneHourAgo } = this.getRateLimitBoundaries();
    const minuteCount = this.countAttemptsSince(userDb, type, oneMinuteAgo);
    const hourCount = this.countAttemptsSince(userDb, type, oneHourAgo);

    return minuteCount >= RATE_LIMIT_PER_MINUTE || hourCount >= RATE_LIMIT_PER_HOUR;
  }

  /**
   * Check if we're too close to rate limit (within 1 of the limit)
   * This helps prevent hitting the limit by processing one more upload
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @returns {boolean} True if too close to limit
   */
  isTooCloseToRateLimit(userDb, type) {
    const { oneMinuteAgo, oneHourAgo } = this.getRateLimitBoundaries();
    const minuteCount = this.countAttemptsSince(userDb, type, oneMinuteAgo);
    const hourCount = this.countAttemptsSince(userDb, type, oneHourAgo);

    return minuteCount >= RATE_LIMIT_PER_MINUTE - 1 || hourCount >= RATE_LIMIT_PER_HOUR - 1;
  }

  /**
   * Calculate minimum time until next upload can be processed
   * Only enforces spacing when approaching the rate limit to maximize throughput
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @returns {number} Minimum wait time in milliseconds before next upload
   */
  calculateMinTimeUntilNextUpload(userDb, type) {
    const { now, oneMinuteAgo } = this.getRateLimitBoundaries();
    const count = this.countAttemptsSince(userDb, type, oneMinuteAgo);

    // Only enforce spacing when we're approaching the limit (7+ in last minute)
    if (count >= MIN_INTERVAL_THRESHOLD) {
      const recentAttempt = this.getMostRecentAttemptSince(userDb, type, oneMinuteAgo);
      if (recentAttempt) {
        const lastAttemptDate = this.parseSQLDate(recentAttempt);
        const timeSinceLastAttempt = now.getTime() - lastAttemptDate.getTime();
        const minIntervalMs = MINUTE_MS / RATE_LIMIT_PER_MINUTE; // 6000ms = 6 seconds

        if (timeSinceLastAttempt < minIntervalMs) {
          return minIntervalMs - timeSinceLastAttempt;
        }
      }
    }

    return 0; // No wait needed - we have capacity
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

  // ==================== API Client Management ====================

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

  // ==================== Upload Attempt Logging ====================

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

  // ==================== FormData Building ====================

  /**
   * Build FormData for file upload
   * @param {string} filePath - Path to file
   * @param {string} name - Filename
   * @returns {Promise<FormData>} FormData with file appended
   */
  async buildFileFormData(filePath, name) {
    const absolutePath = getUploadFilePath(filePath);
    const exists = await fileExists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }

    try {
      const fileBuffer = readFileSync(absolutePath);
      const formData = new FormData();
      formData.append('file', fileBuffer, name);

      logger.debug('File read and appended to FormData', {
        filePath: absolutePath,
        fileSize: fileBuffer.length,
        filename: name,
      });

      return formData;
    } catch (fileError) {
      logger.error('Error reading file for upload', fileError, {
        filePath: absolutePath,
      });
      throw new Error(`Failed to read file: ${fileError.message}`);
    }
  }

  /**
   * Build FormData for upload request
   * @param {Object} upload - Upload record
   * @returns {Promise<FormData>} FormData ready for API request
   */
  async buildFormData(upload) {
    const { upload_type, file_path, url, name, seed, allow_zip, as_queued, password, type } =
      upload;
    let formData;

    if (upload_type === 'file') {
      formData = await this.buildFileFormData(file_path, name);
    } else {
      formData = new FormData();
      if (upload_type === 'magnet') {
        formData.append('magnet', url);
      } else {
        // link type
        formData.append('link', url);
      }
    }

    // Add type-specific options for torrents
    if (type === 'torrent' || upload_type === 'magnet') {
      const seedValue = seed !== null && seed !== undefined ? seed : 1;
      const allowZipValue = allow_zip !== null && allow_zip !== undefined ? allow_zip : 1;
      formData.append('seed', seedValue);
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

    return formData;
  }

  /**
   * Get API endpoint for upload type
   * @param {string} type - Upload type (torrent, usenet, webdl)
   * @returns {string} API endpoint URL
   */
  getApiEndpoint(type) {
    const baseURL = process.env.TORBOX_API_BASE || 'https://api.torbox.app';
    const apiVersion = process.env.TORBOX_API_VERSION || 'v1';
    const endpoints = {
      torrent: 'torrents/createtorrent',
      usenet: 'usenet/createusenetdownload',
      webdl: 'webdl/createwebdownload',
    };

    return `${baseURL}/${apiVersion}/api/${endpoints[type] || endpoints.torrent}`;
  }

  // ==================== Upload Processing ====================

  /**
   * Handle rate limit deferral
   * @param {Object} upload - Upload record
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @returns {Promise<boolean>} False (not processed)
   */
  async handleRateLimitDeferral(upload, userDb, type) {
    const waitTime = this.calculateWaitTime(userDb, type);
    const nextAttemptAt = this.formatDateForSQL(new Date(Date.now() + waitTime));

    logger.debug('At rate limit, deferring upload', {
      uploadId: upload.id,
      type,
      waitTimeMs: waitTime,
      nextAttemptAt,
    });

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
      .run(nextAttemptAt, upload.id);

    await this.masterDatabase.updateUploadCounters(upload.authId, userDb);
    return false;
  }

  /**
   * Make API request to TorBox
   * @param {ApiClient} apiClient - API client instance
   * @param {string} endpoint - API endpoint URL
   * @param {FormData} formData - FormData to send
   * @returns {Promise<Object>} API response
   */
  async makeApiRequest(apiClient, endpoint, formData) {
    const formDataHeaders = formData.getHeaders();
    const requestHeaders = {
      ...formDataHeaders,
      Authorization: apiClient.client.defaults.headers['Authorization'],
      'User-Agent': apiClient.client.defaults.headers['User-Agent'],
    };

    return apiClient.client.post(endpoint, formData, {
      headers: requestHeaders,
      timeout: API_TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  }

  /**
   * Handle successful upload
   * @param {Object} upload - Upload record
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @param {Object} response - API response
   */
  handleSuccessfulUpload(upload, userDb, type, response) {
    const { id } = upload;

    // Log successful attempt
    this.logUploadAttempt(userDb, id, type, response.status, true, null, null);

    // Update upload status
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

    // Update counter
    this.masterDatabase.decrementUploadCounter(upload.authId);

    logger.info('Upload processed successfully', {
      uploadId: id,
      type,
      upload_type: upload.upload_type,
      name: upload.name,
    });
  }

  /**
   * Check if error is a rate limit error
   * @param {Error} error - Error object
   * @returns {boolean} True if rate limit error
   */
  isRateLimitError(error) {
    return error.response?.status === 429 || error.message?.includes('429');
  }

  /**
   * Check if error is non-retryable
   * @param {Error} error - Error object
   * @returns {boolean} True if non-retryable
   */
  isNonRetryableError(error) {
    const errorData = error.response?.data;
    const errorCode = errorData?.error;

    if (NON_RETRYABLE_ERRORS.includes(errorCode)) {
      return true;
    }

    const errorMessage = error.message || '';
    const errorDetail = errorData?.detail || '';

    return (
      errorMessage.includes('File not found') ||
      errorMessage.includes('Invalid') ||
      errorMessage.includes('Private torrent downloading is currently disabled') ||
      errorDetail.includes('You must provide either a file or magnet link.') ||
      errorDetail.includes('Private torrent downloading is currently disabled')
    );
  }

  /**
   * Calculate rate limit delay from error response
   * @param {Error} error - Error object
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @returns {number} Delay in milliseconds
   */
  calculateRateLimitDelay(error, userDb, type) {
    // Prefer Retry-After header if present
    const retryAfterHeader =
      error.response?.headers?.['retry-after'] ?? error.response?.headers?.['Retry-After'];
    const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;

    if (Number.isFinite(retryAfterSeconds)) {
      return Math.max(0, retryAfterSeconds) * 1000;
    }

    // Calculate wait time based on actual rate limit state
    let rateLimitDelayMs = this.calculateWaitTime(userDb, type);

    // Fallback if calculateWaitTime returns 0
    if (rateLimitDelayMs === 0) {
      const { now, oneMinuteAgo } = this.getRateLimitBoundaries();
      const oldestMinute = this.getOldestAttemptSince(userDb, type, oneMinuteAgo);

      if (oldestMinute) {
        const oldestDate = this.parseSQLDate(oldestMinute);
        rateLimitDelayMs = Math.max(
          0,
          MINUTE_MS - (now.getTime() - oldestDate.getTime()) + RATE_LIMIT_BUFFER_MS
        );
      } else {
        rateLimitDelayMs = MINUTE_MS;
      }
    }

    return rateLimitDelayMs;
  }

  /**
   * Calculate exponential backoff delay
   * @param {number} retryCount - Current retry count
   * @returns {number} Delay in milliseconds
   */
  calculateBackoffDelay(retryCount) {
    return Math.min(INITIAL_BACKOFF_MS * Math.pow(2, Math.max(retryCount - 1, 0)), MAX_BACKOFF_MS);
  }

  /**
   * Create user-friendly error message
   * @param {Error} error - Error object
   * @param {boolean} isRateLimit - Whether this is a rate limit error
   * @returns {string|null} User-friendly error message or null
   */
  createUserFriendlyError(error, isRateLimit) {
    if (isRateLimit || error.message?.includes('Request failed with status code 429')) {
      return null; // Rate limit handled via next_attempt_at
    }

    const errorData = error.response?.data;
    const errorCode = errorData?.error;
    const errorMessage = error.message || '';
    const errorDetail = errorData?.detail || '';

    if (errorMessage.includes('File not found')) {
      return 'File not found. The upload file may have been deleted.';
    }

    if (errorCode === 'MISSING_REQUIRED_OPTION') {
      return 'Missing required option. Please check upload settings.';
    }

    if (errorCode === 'INVALID_OPTION') {
      return 'Invalid option. Please check upload settings.';
    }

    if (errorDetail.includes('You must provide either a file or magnet link')) {
      return 'Invalid upload: file or magnet link is required.';
    }

    return errorDetail || errorMessage || 'Unknown error';
  }

  /**
   * Handle failed upload
   * @param {Object} upload - Upload record
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @param {Error} error - Error object
   */
  async handleFailedUpload(upload, userDb, type, error) {
    const { id } = upload;

    // Log failed attempt if API call was made
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

    const isRateLimit = this.isRateLimitError(error);
    const isNonRetryable = this.isNonRetryableError(error);
    const newRetryCount = (upload.retry_count ?? 0) + 1;
    const shouldRetry = !isNonRetryable && newRetryCount < MAX_RETRIES && !isRateLimit;
    const finalRetryCount = isRateLimit ? (upload.retry_count ?? 0) : newRetryCount;
    const finalStatus = isRateLimit ? 'queued' : shouldRetry ? 'queued' : 'failed';

    // Calculate delay
    const deferMs = isRateLimit
      ? this.calculateRateLimitDelay(error, userDb, type)
      : shouldRetry
        ? this.calculateBackoffDelay(finalRetryCount)
        : 0;

    const nextAttemptAt =
      deferMs > 0 ? this.formatDateForSQL(new Date(Date.now() + deferMs)) : null;

    // Get current status for counter update
    const currentUpload = userDb.db.prepare('SELECT status FROM uploads WHERE id = ?').get(id);
    const wasQueued = currentUpload?.status === 'queued';

    // Create user-friendly error message
    const userFriendlyError = this.createUserFriendlyError(error, isRateLimit);

    // Update upload record
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

    // Update counters
    if (finalStatus === 'failed' && wasQueued) {
      this.masterDatabase.decrementUploadCounter(upload.authId);
    } else if (finalStatus === 'queued') {
      await this.masterDatabase.updateUploadCounters(upload.authId, userDb);
    }

    // Log appropriate message
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
        errorCode: error.response?.data?.error,
        isNonRetryable,
      });
    }
  }

  /**
   * Process a single upload
   * @param {Object} upload - Upload record from database
   * @param {Object} userDb - User database instance
   * @returns {Promise<boolean>} True if successful
   */
  async processUpload(upload, userDb) {
    const { id, type } = upload;

    try {
      // Validate authId
      if (!upload.authId) {
        throw new Error('authId is required for processing upload');
      }

      // Get API client
      const apiClient = await this.getApiClient(upload.authId);

      // Check rate limit before making request
      if (this.isAtRateLimit(userDb, type) || this.isTooCloseToRateLimit(userDb, type)) {
        return await this.handleRateLimitDeferral(upload, userDb, type);
      }

      // Wait for rate limit if needed
      await this.waitForRateLimit(userDb, type);

      // Build FormData
      const formData = await this.buildFormData(upload);

      // Get endpoint
      const endpoint = this.getApiEndpoint(type);

      // Log request
      logger.debug('Sending upload to TorBox API', {
        uploadId: id,
        endpoint,
        upload_type: upload.upload_type,
        hasFile: upload.upload_type === 'file',
        filePath: upload.upload_type === 'file' ? upload.file_path : null,
      });

      // Make API request
      const response = await this.makeApiRequest(apiClient, endpoint, formData);

      // Handle success
      this.handleSuccessfulUpload(upload, userDb, type, response);

      return true;
    } catch (error) {
      await this.handleFailedUpload(upload, userDb, type, error);
      return false;
    }
  }

  // ==================== Upload Queue Management ====================

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
      const usersWithUploads = this.masterDatabase.getUsersWithQueuedUploads();

      // Cleanup old attempts periodically (once per day for all active users)
      const now = Date.now();
      const shouldCleanup =
        !this.lastCleanupAt || now - this.lastCleanupAt >= this.cleanupIntervalMs;

      for (const user of usersWithUploads) {
        const { auth_id } = user;

        try {
          const userDb = await this.userDatabaseManager.getUserDatabase(auth_id);

          // Cleanup old attempts if needed
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
      const sevenDaysAgo = this.formatDateForSQL(
        new Date(Date.now() - CLEANUP_RETENTION_DAYS * 24 * 60 * 60 * 1000)
      );

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

  // ==================== Lifecycle Methods ====================

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
