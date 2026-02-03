import { TTLCache } from '@isaacs/ttlcache';
import ApiClient from '../api/ApiClient.js';
import { decrypt } from '../utils/crypto.js';
import logger from '../utils/logger.js';
import {
  getUploadFilePath,
  fileExists,
  deleteUploadFile,
  calculateUserUploadDirSize,
  getUserUploadFiles,
  validateFilePathOwnership,
} from '../utils/fileStorage.js';
import FormData from 'form-data';
import { readFileSync } from 'fs';
import path from 'path';

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
const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes - if processing longer, consider stuck
const MAX_UPLOAD_DIR_SIZE_BYTES = parseInt(process.env.MAX_UPLOAD_DIR_SIZE_BYTES || '52428800', 10); // 50MB default
const UPLOAD_FILE_RETENTION_DAYS = parseInt(process.env.UPLOAD_FILE_RETENTION_DAYS || '30', 10); // 30 days default
const FILE_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // Cleanup files every 6 hours
const API_CLIENT_CACHE_MAX = parseInt(process.env.UPLOAD_API_CLIENT_CACHE_MAX || '300', 10);
const API_CLIENT_CACHE_TTL_MS = parseInt(
  process.env.UPLOAD_API_CLIENT_CACHE_TTL_MS || String(30 * 60 * 1000),
  10
); // 30 minutes default

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
    this.lastRecoveryAt = null;
    this.lastFileCleanupAt = null;
    this.cleanupIntervalMs = 24 * 60 * 60 * 1000; // Cleanup once per day

    // API clients cache: bounded TTL to prevent unbounded memory growth
    this.apiClients = new TTLCache({
      max: API_CLIENT_CACHE_MAX,
      ttl: API_CLIENT_CACHE_TTL_MS,
    });
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
   * @param {boolean} forceRefresh - If true, invalidate cache and create new client
   * @returns {Promise<ApiClient>} API client instance
   */
  async getApiClient(authId, forceRefresh = false) {
    if (forceRefresh) {
      this.apiClients.delete(authId);
    } else if (this.apiClients.has(authId)) {
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
   * Invalidate API client cache for a specific user
   * This should be called when an API key is updated or when auth errors occur
   * @param {string} authId - User authentication ID
   */
  invalidateApiClient(authId) {
    if (this.apiClients.has(authId)) {
      this.apiClients.delete(authId);
      logger.debug('Invalidated API client cache', { authId });
    }
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
   * @param {string} authId - User authentication ID (required for security validation)
   * @returns {Promise<FormData>} FormData with file appended
   */
  async buildFileFormData(filePath, name, authId) {
    // Security: Validate that file_path belongs to the authenticated user
    if (!authId || !validateFilePathOwnership(authId, filePath)) {
      logger.error('File path ownership validation failed in processor', {
        authId,
        filePath,
      });
      throw new Error('Invalid file path: file must belong to authenticated user');
    }

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
   * @param {Object} upload - Upload record (must include authId)
   * @returns {Promise<FormData>} FormData ready for API request
   */
  async buildFormData(upload) {
    const {
      upload_type,
      file_path,
      url,
      name,
      seed,
      allow_zip,
      as_queued,
      password,
      type,
      authId,
    } = upload;
    let formData;

    if (upload_type === 'file') {
      if (!authId) {
        throw new Error('authId is required for file uploads');
      }
      formData = await this.buildFileFormData(file_path, name, authId);
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
    // Note: upload_type='magnet' is validated to only work with type='torrent' in the route
    if (type === 'torrent') {
      const seedValue = seed !== null && seed !== undefined ? seed : 1;
      const allowZipValue = allow_zip !== null && allow_zip !== undefined ? allow_zip : 1;
      formData.append('seed', seedValue);
      formData.append('allow_zip', allowZipValue);
    }

    // Only include as_queued if it's true (handle both boolean true and SQLite integer 1)
    if (as_queued === true || as_queued === 1) {
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
   * Check if TorBox API response body indicates failure.
   * TorBox can return HTTP 200 with { success: false, error, detail } for business logic failures.
   * We must not mark uploads as completed when the torrent was not actually created.
   * @param {Object} response - Axios response (response.data, response.status)
   * @returns {boolean} True if response indicates API-side failure
   */
  isApiResponseFailure(response) {
    const data = response?.data;
    if (!data || typeof data !== 'object') return false;
    if (data.success === false) return true;
    if (data.error != null && data.error !== '') return true;
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
   * Files are kept after successful upload and will be cleaned up by periodic cleanup
   * based on size limits (50MB) or retention period (30 days)
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
    // Note: Files are NOT deleted here - they are kept and cleaned up periodically
    // by cleanupUserFiles() based on size limits and retention period
    const updateResult = userDb.db
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

    // Update counter only if the upload still exists (wasn't deleted during processing)
    // If the upload was deleted, the UPDATE returns 0 rows affected, so we skip decrement
    if (updateResult.changes > 0) {
      this.masterDatabase.decrementUploadCounter(upload.authId);
    }

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
   * Check if error is an authentication error
   * @param {Error} error - Error object
   * @returns {boolean} True if authentication error
   */
  isAuthError(error) {
    const errorData = error.response?.data;
    const errorCode = errorData?.error;
    return errorCode === 'BAD_TOKEN' || errorCode === 'AUTH_ERROR' || errorCode === 'NO_AUTH';
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
   * @param {string} originalStatus - Original status before processing started (optional, defaults to upload.status)
   */
  async handleFailedUpload(upload, userDb, type, error, originalStatus = null) {
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

    // Check if upload was queued before processing started
    // Use the explicitly passed originalStatus parameter to ensure we get the correct
    // status before processUploads() changed it to 'processing'. This prevents counter drift.
    const wasQueued = (originalStatus ?? upload.status) === 'queued';

    // Create user-friendly error message
    const userFriendlyError = this.createUserFriendlyError(error, isRateLimit);

    // Update upload record
    const updateResult = userDb.db
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

    // When API returns 429, defer all other queued uploads of this type so we don't keep
    // making API calls for the rest of the queue (our pre-check uses local limits and may
    // not match the API's stricter limit, so 554, 555, ... would otherwise each get tried
    // and each get 429 until the window passes).
    if (isRateLimit && nextAttemptAt) {
      const deferOthersResult = userDb.db
        .prepare(
          `
          UPDATE uploads
          SET next_attempt_at = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE status = 'queued'
            AND type = ?
            AND id != ?
        `
        )
        .run(nextAttemptAt, type, id);
      if (deferOthersResult.changes > 0) {
        logger.debug('Deferred other queued uploads due to API rate limit', {
          type,
          deferredCount: deferOthersResult.changes,
          nextAttemptAt,
        });
      }
    }

    // Update counters only if the upload still exists (wasn't deleted during processing)
    // If the upload was deleted, the UPDATE returns 0 rows affected, so we skip counter updates
    if (updateResult.changes > 0) {
      if (finalStatus === 'failed' && wasQueued) {
        this.masterDatabase.decrementUploadCounter(upload.authId);
      } else if (finalStatus === 'queued') {
        await this.masterDatabase.updateUploadCounters(upload.authId, userDb);
      }
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
   * @param {string} originalStatus - Original status before processing (optional, defaults to upload.status)
   * @param {boolean} isRetryAfterAuthError - Internal flag to prevent infinite retry loops
   * @returns {Promise<boolean>} True if successful
   */
  async processUpload(upload, userDb, originalStatus = null, isRetryAfterAuthError = false) {
    const { id, type } = upload;
    // Use provided originalStatus or fall back to upload.status
    const originalStatusValue = originalStatus ?? upload.status;

    try {
      // Validate authId
      if (!upload.authId) {
        throw new Error('authId is required for processing upload');
      }

      // Get API client (force refresh if this is a retry after auth error)
      const apiClient = await this.getApiClient(upload.authId, isRetryAfterAuthError);

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
        isRetryAfterAuthError,
      });

      // Make API request
      const response = await this.makeApiRequest(apiClient, endpoint, formData);

      // TorBox can return HTTP 200 with { success: false, error, detail } when the torrent was not created.
      // Treat that as failure so we do not mark the upload as completed.
      if (this.isApiResponseFailure(response)) {
        const data = response.data || {};
        const syntheticError = Object.assign(
          new Error(data.detail || data.error || 'TorBox API returned failure'),
          {
            response: {
              status: response.status ?? 200,
              data: { error: data.error, detail: data.detail },
            },
          }
        );
        await this.handleFailedUpload(upload, userDb, type, syntheticError, originalStatusValue);
        return false;
      }

      // API call succeeded - now handle the database update
      // If handleSuccessfulUpload throws (e.g., SQLITE_BUSY, closed database), we must NOT re-queue
      // since the upload already succeeded on TorBox
      try {
        this.handleSuccessfulUpload(upload, userDb, type, response);
        return true;
      } catch (dbError) {
        // Database error after successful API call - retry the database update
        // but do NOT re-queue the upload since it already succeeded on TorBox
        const isClosedDbError =
          dbError.message?.includes('closed database') ||
          dbError.message?.includes('Cannot use a closed database') ||
          dbError.name === 'RangeError';

        logger.error('Database error after successful API call, retrying database update', {
          uploadId: id,
          type,
          error: dbError.message,
          errorCode: dbError.code,
          isClosedDbError,
        });

        // Retry the database update with exponential backoff
        // Re-fetch database connection if it's closed
        const maxDbRetries = 3;
        let lastDbError = dbError;
        let currentUserDb = userDb;

        for (let attempt = 0; attempt < maxDbRetries; attempt++) {
          try {
            // If database connection is closed, re-fetch it
            if (isClosedDbError || attempt > 0) {
              // Check if connection is closed (for retries after first attempt)
              try {
                currentUserDb.db.prepare('SELECT 1').get();
              } catch (checkError) {
                // Connection is closed, re-fetch it
                if (
                  checkError.message?.includes('closed database') ||
                  checkError.message?.includes('Cannot use a closed database') ||
                  checkError.name === 'RangeError'
                ) {
                  logger.warn('Database connection closed during retry, re-fetching connection', {
                    uploadId: id,
                    attempt: attempt + 1,
                  });
                  currentUserDb = await this.userDatabaseManager.getUserDatabase(upload.authId);
                }
              }
            }

            // Re-attempt the database update
            this.handleSuccessfulUpload(upload, currentUserDb, type, response);
            logger.info('Successfully completed database update after retry', {
              uploadId: id,
              attempt: attempt + 1,
            });
            return true;
          } catch (retryError) {
            lastDbError = retryError;
            const isRetryClosedDbError =
              retryError.message?.includes('closed database') ||
              retryError.message?.includes('Cannot use a closed database') ||
              retryError.name === 'RangeError';

            if (attempt < maxDbRetries - 1) {
              const delayMs = 100 * Math.pow(2, attempt); // 100ms, 200ms, 400ms
              logger.warn('Database update retry failed, will retry again', {
                uploadId: id,
                attempt: attempt + 1,
                maxRetries: maxDbRetries,
                delayMs,
                error: retryError.message,
                isClosedDbError: isRetryClosedDbError,
              });
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
          }
        }

        // All database retries failed - log critical error but don't re-queue
        // The upload already succeeded on TorBox, so we must not retry the API call
        logger.error(
          'CRITICAL: Failed to update database after successful API call - upload succeeded on TorBox but database update failed',
          {
            uploadId: id,
            type,
            error: lastDbError.message,
            errorCode: lastDbError.code,
            maxRetries: maxDbRetries,
          }
        );

        // Mark as completed manually to prevent re-queuing
        // This is a best-effort attempt - if this also fails, the upload will be stuck
        // but at least it won't cause duplicate uploads
        // Use retry logic for the final attempt as well
        const finalMaxRetries = 3;
        let finalAttemptSuccess = false;

        for (let finalAttempt = 0; finalAttempt < finalMaxRetries; finalAttempt++) {
          try {
            // Ensure we have a valid database connection for the final attempt
            let finalUserDb = currentUserDb;

            // Always re-fetch connection for final attempts to ensure it's fresh
            if (finalAttempt === 0) {
              // First attempt: check if current connection is valid
              try {
                finalUserDb.db.prepare('SELECT 1').get();
              } catch (checkError) {
                // Connection is closed or invalid, re-fetch it
                const isClosedError =
                  checkError.message?.includes('closed database') ||
                  checkError.message?.includes('Cannot use a closed database') ||
                  checkError.name === 'RangeError';

                if (isClosedError) {
                  logger.warn(
                    'Database connection closed for final attempt, re-fetching connection',
                    {
                      uploadId: id,
                      attempt: finalAttempt + 1,
                    }
                  );
                  finalUserDb = await this.userDatabaseManager.getUserDatabase(upload.authId);
                } else {
                  // Other error during check - re-fetch anyway to be safe
                  logger.warn('Database connection check failed, re-fetching connection', {
                    uploadId: id,
                    attempt: finalAttempt + 1,
                    error: checkError.message,
                  });
                  finalUserDb = await this.userDatabaseManager.getUserDatabase(upload.authId);
                }
              }
            } else {
              // Subsequent attempts: always re-fetch to get a fresh connection
              logger.warn('Re-fetching database connection for final attempt retry', {
                uploadId: id,
                attempt: finalAttempt + 1,
              });
              finalUserDb = await this.userDatabaseManager.getUserDatabase(upload.authId);
            }

            const updateResult = finalUserDb.db
              .prepare(
                `
                UPDATE uploads
                SET status = 'completed',
                    error_message = ?,
                    completed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `
              )
              .run(`Database update failed after successful upload: ${lastDbError.message}`, id);

            if (updateResult.changes > 0) {
              this.masterDatabase.decrementUploadCounter(upload.authId);
              logger.warn('Manually marked upload as completed to prevent duplicate uploads', {
                uploadId: id,
                attempt: finalAttempt + 1,
              });
              finalAttemptSuccess = true;
              break; // Success - exit retry loop
            } else {
              // No rows updated - upload might have been deleted
              logger.warn('No rows updated in final attempt - upload may have been deleted', {
                uploadId: id,
                attempt: finalAttempt + 1,
              });
              finalAttemptSuccess = true; // Consider this success (upload doesn't exist)
              break;
            }
          } catch (finalError) {
            const isFinalClosedError =
              finalError.message?.includes('closed database') ||
              finalError.message?.includes('Cannot use a closed database') ||
              finalError.name === 'RangeError';

            if (finalAttempt < finalMaxRetries - 1) {
              const delayMs = 200 * Math.pow(2, finalAttempt); // 200ms, 400ms, 800ms
              logger.warn('Final attempt failed, will retry', {
                uploadId: id,
                attempt: finalAttempt + 1,
                maxRetries: finalMaxRetries,
                delayMs,
                error: finalError.message,
                errorCode: finalError.code,
                isClosedError: isFinalClosedError,
              });
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            } else {
              // All final attempts failed
              logger.error(
                'CRITICAL: Failed to manually mark upload as completed after all retries',
                {
                  uploadId: id,
                  maxRetries: finalMaxRetries,
                  error: finalError.message,
                  errorCode: finalError.code,
                  isClosedError: isFinalClosedError,
                }
              );
            }
          }
        }

        if (!finalAttemptSuccess) {
          logger.error('CRITICAL: All final attempts to mark upload as completed failed', {
            uploadId: id,
            type,
            note: 'Upload succeeded on TorBox but database update failed - upload may be stuck in processing state',
          });
        }

        // Return true since the API call succeeded, even though database update failed
        return true;
      }
    } catch (error) {
      // Check if this is an authentication error and we haven't retried yet
      if (this.isAuthError(error) && !isRetryAfterAuthError) {
        logger.warn('Authentication error detected, invalidating cache and retrying once', {
          uploadId: id,
          authId: upload.authId,
          errorCode: error.response?.data?.error,
        });

        // Invalidate the cached API client
        this.invalidateApiClient(upload.authId);

        // Retry once with a fresh client
        return await this.processUpload(upload, userDb, originalStatusValue, true);
      }

      // Handle failure (including auth errors on retry)
      // This catch block only handles errors from makeApiRequest, not from handleSuccessfulUpload
      await this.handleFailedUpload(upload, userDb, type, error, originalStatusValue);
      return false;
    }
  }

  // ==================== Upload Queue Management ====================

  /**
   * Recover stuck 'processing' uploads by resetting them to 'queued'
   * Uploads that have been 'processing' for more than PROCESSING_TIMEOUT_MS are considered stuck
   * This handles cases where the processor crashed or restarted during processing
   * @param {Object} userDb - User database instance
   * @param {string} authId - User authentication ID
   * @returns {number} Number of uploads recovered
   */
  recoverStuckProcessingUploads(userDb, authId) {
    try {
      const timeoutThreshold = this.formatDateForSQL(new Date(Date.now() - PROCESSING_TIMEOUT_MS));

      const result = userDb.db
        .prepare(
          `
          UPDATE uploads
          SET status = 'queued',
              error_message = NULL,
              last_processed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE status = 'processing'
            AND (
              last_processed_at IS NULL
              OR datetime(last_processed_at) <= datetime(?)
            )
        `
        )
        .run(timeoutThreshold);

      if (result.changes > 0) {
        logger.info('Recovered stuck processing uploads', {
          authId,
          recoveredCount: result.changes,
          timeoutThreshold,
        });

        // Update counters after recovery
        this.masterDatabase.updateUploadCounters(authId, userDb).catch((error) => {
          logger.error('Failed to update counters after recovery', error, { authId });
        });
      }

      return result.changes;
    } catch (error) {
      logger.error('Failed to recover stuck processing uploads', error, { authId });
      return 0;
    }
  }

  /**
   * Recover stuck 'processing' uploads for all active users
   * Called on startup and periodically to ensure no uploads are permanently stuck
   * @returns {Promise<number>} Total number of uploads recovered across all users
   */
  async recoverStuckUploadsForAllUsers() {
    if (!this.userDatabaseManager) {
      return 0;
    }

    try {
      const activeUsers = this.masterDatabase.getActiveUsers();
      let totalRecovered = 0;

      for (const user of activeUsers) {
        try {
          const userDb = await this.userDatabaseManager.getUserDatabase(user.auth_id);
          const recovered = this.recoverStuckProcessingUploads(userDb, user.auth_id);
          totalRecovered += recovered;
        } catch (error) {
          logger.error('Error recovering stuck uploads for user', error, {
            authId: user.auth_id,
          });
        }
      }

      if (totalRecovered > 0) {
        logger.info('Recovery completed for all users', {
          totalRecovered,
          userCount: activeUsers.length,
        });
      }

      return totalRecovered;
    } catch (error) {
      logger.error('Error in recovery process', error);
      return 0;
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
        AND (file_deleted IS NULL OR file_deleted = false)
        AND (next_attempt_at IS NULL OR datetime(next_attempt_at) <= datetime('now'))
    `;

    const params = [];
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY queue_order ASC LIMIT 1';

    try {
      return userDb.db.prepare(query).all(...params);
    } catch (error) {
      // Handle closed database error - connection may have been evicted from pool
      if (
        error.message?.includes('closed database') ||
        error.message?.includes('Cannot use a closed database') ||
        error.name === 'RangeError'
      ) {
        logger.warn('Database connection closed, will retry with fresh connection', {
          authId,
          error: error.message,
        });
        // Re-throw to let caller handle re-fetching the connection
        throw new Error('DATABASE_CLOSED');
      }
      throw error;
    }
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

      // Recover stuck uploads periodically (every hour)
      // This ensures uploads stuck in 'processing' state are recovered even if startup recovery missed them
      const shouldRecover = !this.lastRecoveryAt || now - this.lastRecoveryAt >= 60 * 60 * 1000;

      // Cleanup files periodically (every 6 hours)
      const shouldCleanupFiles =
        !this.lastFileCleanupAt || now - this.lastFileCleanupAt >= FILE_CLEANUP_INTERVAL_MS;

      for (const user of usersWithUploads) {
        const { auth_id } = user;

        try {
          const userDb = await this.userDatabaseManager.getUserDatabase(auth_id);
          this.userDatabaseManager.pool.markActive(auth_id);

          // Cleanup old attempts if needed
          if (shouldCleanup) {
            this.cleanupOldAttempts(userDb);
          }

          // Recover stuck processing uploads if needed
          if (shouldRecover) {
            this.recoverStuckProcessingUploads(userDb, auth_id);
          }

          // Cleanup files if needed (size limits and retention period)
          if (shouldCleanupFiles) {
            await this.cleanupUserFiles(userDb, auth_id);
          }

          // Process one upload per type per cycle to respect rate limits
          const types = ['torrent', 'usenet', 'webdl'];

          for (const type of types) {
            let queuedUploads;
            let currentUserDb = userDb;

            try {
              queuedUploads = this.getQueuedUploads(currentUserDb, auth_id, type);
            } catch (error) {
              // If database was closed, re-fetch the connection and retry
              if (error.message === 'DATABASE_CLOSED') {
                try {
                  currentUserDb = await this.userDatabaseManager.getUserDatabase(auth_id);
                  queuedUploads = this.getQueuedUploads(currentUserDb, auth_id, type);
                } catch (retryError) {
                  logger.error('Failed to re-fetch database connection', retryError, {
                    authId: auth_id,
                  });
                  continue; // Skip this type for this user
                }
              } else {
                throw error; // Re-throw other errors
              }
            }

            if (queuedUploads.length > 0) {
              const upload = queuedUploads[0]; // Get first (highest priority)

              // Check if upload is currently being processed (avoid concurrent processing)
              let currentStatus;
              try {
                currentStatus = currentUserDb.db
                  .prepare('SELECT status FROM uploads WHERE id = ?')
                  .get(upload.id);
              } catch (error) {
                // If database was closed, re-fetch the connection and retry
                if (
                  error.message?.includes('closed database') ||
                  error.message?.includes('Cannot use a closed database') ||
                  error.name === 'RangeError'
                ) {
                  try {
                    currentUserDb = await this.userDatabaseManager.getUserDatabase(auth_id);
                    currentStatus = currentUserDb.db
                      .prepare('SELECT status FROM uploads WHERE id = ?')
                      .get(upload.id);
                  } catch (retryError) {
                    logger.error('Failed to re-fetch database connection', retryError, {
                      authId: auth_id,
                    });
                    continue; // Skip this upload
                  }
                } else {
                  throw error; // Re-throw other errors
                }
              }

              if (currentStatus?.status === 'queued') {
                // Capture original status before updating (needed for counter management)
                const originalStatus = currentStatus.status;

                // Mark as processing - use atomic UPDATE with status check to prevent race conditions
                // Only proceed if the UPDATE actually changed a row (result.changes > 0)
                let result;
                try {
                  result = currentUserDb.db
                    .prepare(
                      `
                      UPDATE uploads
                      SET status = 'processing',
                          last_processed_at = CURRENT_TIMESTAMP,
                          updated_at = CURRENT_TIMESTAMP
                      WHERE id = ? AND status = 'queued'
                    `
                    )
                    .run(upload.id);
                } catch (error) {
                  // If database was closed, re-fetch the connection and retry
                  if (
                    error.message?.includes('closed database') ||
                    error.message?.includes('Cannot use a closed database') ||
                    error.name === 'RangeError'
                  ) {
                    try {
                      currentUserDb = await this.userDatabaseManager.getUserDatabase(auth_id);
                      result = currentUserDb.db
                        .prepare(
                          `
                          UPDATE uploads
                          SET status = 'processing',
                              last_processed_at = CURRENT_TIMESTAMP,
                              updated_at = CURRENT_TIMESTAMP
                          WHERE id = ? AND status = 'queued'
                        `
                        )
                        .run(upload.id);
                    } catch (retryError) {
                      logger.error('Failed to re-fetch database connection', retryError, {
                        authId: auth_id,
                      });
                      continue; // Skip this upload
                    }
                  } else {
                    throw error; // Re-throw other errors
                  }
                }

                // Only process if the UPDATE succeeded (another thread didn't claim it first)
                if (result.changes > 0) {
                  // Process upload (pass original status to ensure counter updates work correctly)
                  await this.processUpload(
                    { ...upload, authId: auth_id },
                    currentUserDb,
                    originalStatus
                  );
                }
              }
            }
          }
        } catch (error) {
          logger.error('Error processing uploads for user', error, {
            authId: auth_id,
          });
        } finally {
          this.userDatabaseManager.pool?.markInactive(auth_id);
        }
      }

      // Update cleanup and recovery timestamps after processing all users
      if (shouldCleanup) {
        this.lastCleanupAt = now;
      }
      if (shouldRecover) {
        this.lastRecoveryAt = now;
      }
      if (shouldCleanupFiles) {
        this.lastFileCleanupAt = now;
      }
    } catch (error) {
      logger.error('Error in upload processing cycle', error);
    }
  }

  /**
   * Cleanup old files for a user based on size limits and retention period
   * @param {Object} userDb - User database instance
   * @param {string} authId - User authentication ID
   */
  async cleanupUserFiles(userDb, authId) {
    try {
      const now = Date.now();
      const retentionCutoff = new Date(now - UPLOAD_FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      let deletedCount = 0;
      let freedBytes = 0;

      // Get all files with their stats, sorted by oldest first
      const files = await getUserUploadFiles(authId);

      // First, delete files older than retention period
      for (const file of files) {
        if (file.mtime < retentionCutoff) {
          try {
            await deleteUploadFile(authId, file.relativePath);
            deletedCount++;
            freedBytes += file.size;

            // Mark corresponding upload record as file_deleted if it exists
            // file.relativePath is already relative to storage root
            // First check if upload exists and was queued (to decrement counter)
            const uploadBeforeDelete = userDb.db
              .prepare(
                `
                SELECT status
                FROM uploads
                WHERE file_path = ? AND file_deleted = false
              `
              )
              .get(file.relativePath);

            const wasQueued = uploadBeforeDelete?.status === 'queued';

            // Mark as file_deleted
            userDb.db
              .prepare(
                `
                UPDATE uploads
                SET file_deleted = true
                WHERE file_path = ? AND file_deleted = false
              `
              )
              .run(file.relativePath);

            // Decrement counter if upload was queued (since getQueuedUploads filters out file_deleted = true)
            if (wasQueued) {
              this.masterDatabase.decrementUploadCounter(authId);
            }

            logger.debug('Deleted file due to retention period', {
              authId,
              filePath: file.relativePath,
              ageDays: Math.floor((now - file.mtime.getTime()) / (24 * 60 * 60 * 1000)),
              wasQueued,
            });
          } catch (error) {
            logger.error('Error deleting old file', error, {
              authId,
              filePath: file.relativePath,
            });
          }
        }
      }

      // Then, check size limit and delete oldest files if needed
      // Recalculate size after retention cleanup
      const currentSize = await calculateUserUploadDirSize(authId);
      if (currentSize > MAX_UPLOAD_DIR_SIZE_BYTES) {
        // Get remaining files (after retention cleanup) sorted by oldest first
        const remainingFiles = await getUserUploadFiles(authId);
        let sizeToFree = currentSize - MAX_UPLOAD_DIR_SIZE_BYTES;

        for (const file of remainingFiles) {
          if (sizeToFree <= 0) break;

          try {
            await deleteUploadFile(authId, file.relativePath);
            deletedCount++;
            freedBytes += file.size;
            sizeToFree -= file.size;

            // Mark corresponding upload record as file_deleted if it exists
            // file.relativePath is already relative to storage root
            // First check if upload exists and was queued (to decrement counter)
            const uploadBeforeDelete = userDb.db
              .prepare(
                `
                SELECT status
                FROM uploads
                WHERE file_path = ? AND file_deleted = false
              `
              )
              .get(file.relativePath);

            const wasQueued = uploadBeforeDelete?.status === 'queued';

            // Mark as file_deleted
            userDb.db
              .prepare(
                `
                UPDATE uploads
                SET file_deleted = true
                WHERE file_path = ? AND file_deleted = false
              `
              )
              .run(file.relativePath);

            // Decrement counter if upload was queued (since getQueuedUploads filters out file_deleted = true)
            if (wasQueued) {
              this.masterDatabase.decrementUploadCounter(authId);
            }

            logger.debug('Deleted file due to size limit', {
              authId,
              filePath: file.relativePath,
              fileSize: file.size,
              remainingToFree: sizeToFree,
              wasQueued,
            });
          } catch (error) {
            logger.error('Error deleting file for size limit', error, {
              authId,
              filePath: file.relativePath,
            });
          }
        }
      }

      if (deletedCount > 0) {
        logger.info('File cleanup completed', {
          authId,
          deletedCount,
          freedBytes,
          freedMB: (freedBytes / (1024 * 1024)).toFixed(2),
        });
      }

      return { deletedCount, freedBytes };
    } catch (error) {
      logger.error('Error cleaning up user files', error, { authId });
      return { deletedCount: 0, freedBytes: 0 };
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

    // Note: Recovery is called separately before start() in initializeServices()
    // to ensure it completes before syncUploadCountersForAllUsers()

    // Process immediately on start (to process any recovered uploads)
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
