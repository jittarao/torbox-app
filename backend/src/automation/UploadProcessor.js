import { TTLCache } from '@isaacs/ttlcache';
import ApiClient from '../api/ApiClient.js';
import { decrypt } from '../utils/crypto.js';
import logger from '../utils/logger.js';
import { getUploadFilePath, fileExists, validateFilePathOwnership } from '../utils/fileStorage.js';
import { isClosedDatabaseError } from '../utils/dbErrors.js';
import {
  getUploadResourceId,
  isTorboxCachedUploadResponse,
  isTorboxDuplicateUploadResponse,
  isTorboxOutageResponse,
  isTorboxTransientQueuedResponse,
  isTorboxUploadApiFailure,
} from './uploadResponseValidation.js';
import { getExpectedTorrentHash, matchTorboxResource } from './uploadDuplicateResolve.js';
import { isConnectionError } from '../utils/torboxErrors.js';
import {
  UPLOAD_UNCACHED_LIMIT_PER_HOUR,
  UPLOAD_UNCACHED_WINDOW_SQL,
} from '../config/uploadRateLimits.js';
import {
  CREATE_UPLOAD_TIMEOUT_MS,
  UPLOAD_BATCH_FETCH_SIZE,
  UPLOAD_MAX_WORK_PER_DRAIN,
} from '../config/uploadProcessorConfig.js';
import { CLEAR_TRANSIENT_ERROR_EXPR, transientMessageBindParams } from './uploadDeferral.js';
import FormData from 'form-data';
import { readFileSync } from 'fs';

// Rate limit: 60 uncached creates per hour per type (cached responses are unlimited)
const UNCACHED_LIMIT_PER_HOUR = UPLOAD_UNCACHED_LIMIT_PER_HOUR;
const HOUR_MS = 60 * 60 * 1000;
const PROCESSOR_INTERVAL_MS = parseInt(process.env.UPLOAD_PROCESSOR_INTERVAL_MS || '5000', 10);

export function extractTorboxTorrentResult(response, type) {
  const torboxData =
    response?.data?.data && typeof response.data.data === 'object' ? response.data.data : {};

  return {
    torboxHash: torboxData.hash ?? null,
    torboxTorrentId: getUploadResourceId(torboxData, type),
    torboxAuthId: torboxData.auth_id ?? null,
  };
}
const RATE_LIMIT_BUFFER_MS = 1000; // 1 second buffer for rate limit calculations
const RATE_LIMIT_UNKNOWN_RETRY_MS = 60 * 1000; // fallback when 429 but no Retry-After and no local window data
const UPLOAD_TYPES_ROUND_ROBIN = ['torrent', 'usenet', 'webdl'];

function uploadProcessResult(success, stopTypeDrain = false) {
  return { success, stopTypeDrain };
}

/** In-memory FIFO buffer: fetch UPLOAD_BATCH_FETCH_SIZE rows when empty. */
class TypeQueueBuffer {
  constructor() {
    this.items = [];
    this.exhausted = false;
  }

  async next(processor, userDb, authId, type) {
    if (this.items.length === 0 && !this.exhausted) {
      const fetched = await processor._getQueuedUploadsWithRetry(
        userDb,
        authId,
        type,
        UPLOAD_BATCH_FETCH_SIZE
      );
      userDb = fetched.userDb;
      if (fetched.rows.length === 0) {
        this.exhausted = true;
      } else {
        this.items = fetched.rows;
        if (fetched.rows.length < UPLOAD_BATCH_FETCH_SIZE) {
          this.exhausted = true;
        }
      }
    }
    const upload = this.items.shift() ?? null;
    return { upload, userDb };
  }
}
const INITIAL_BACKOFF_MS = 30000; // 30 seconds
const MAX_BACKOFF_MS = 300000; // 5 minutes
const CONNECTION_DEFER_MS = parseInt(process.env.UPLOAD_CONNECTION_DEFER_MS || '900000', 10); // 15 min
const CLEANUP_RETENTION_DAYS = 7;
const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes - if processing longer, consider stuck
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
  'DUPLICATE_ITEM',
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
    this._processingInProgress = false;
    this.lastCleanupAt = null;
    this.lastRecoveryAt = null;
    this.cleanupIntervalMs = 24 * 60 * 60 * 1000; // Cleanup once per day

    // API clients cache: bounded TTL to prevent unbounded memory growth
    this.apiClients = new TTLCache({
      max: API_CLIENT_CACHE_MAX,
      ttl: API_CLIENT_CACHE_TTL_MS,
    });

    /** @type {Map<string, Promise<void>>} Per-user drain serialization (nudge + scheduler). */
    this._userDrainMutex = new Map();
  }

  /**
   * Run a per-user drain exclusively so nudge and scheduler drains do not double-spend budget.
   * @template T
   * @param {string} authId
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async _withUserDrainLock(authId, fn) {
    const previous = this._userDrainMutex.get(authId) ?? Promise.resolve();
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const tail = previous.finally(() => gate);
    this._userDrainMutex.set(authId, tail);

    await previous;
    try {
      return await fn();
    } finally {
      release();
      tail.finally(() => {
        if (this._userDrainMutex.get(authId) === tail) {
          this._userDrainMutex.delete(authId);
        }
      });
    }
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
   * Get current time for rate-limit wait calculations
   * @returns {{ now: Date }}
   */
  getRateLimitBoundaries() {
    return { now: new Date() };
  }

  /**
   * Count uncached upload attempts in the rolling hour window for a type
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @returns {number} Count of uncached attempts
   */
  countUncachedAttemptsSince(userDb, type) {
    const result = userDb.db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM upload_attempts
        WHERE type = ? AND is_cached = 0 AND attempted_at >= ${UPLOAD_UNCACHED_WINDOW_SQL}
      `
      )
      .get(type);
    return result?.count || 0;
  }

  /**
   * Get oldest uncached attempt in the rolling hour window
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @returns {string|null} Oldest attempt datetime or null
   */
  getOldestUncachedAttemptSince(userDb, type) {
    const result = userDb.db
      .prepare(
        `
        SELECT MIN(attempted_at) as oldest
        FROM upload_attempts
        WHERE type = ? AND is_cached = 0 AND attempted_at >= ${UPLOAD_UNCACHED_WINDOW_SQL}
      `
      )
      .get(type);
    return result?.oldest || null;
  }

  // ==================== Rate Limit Methods ====================

  /**
   * Calculate wait time until uncached hourly budget has capacity
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type (torrent, usenet, webdl)
   * @returns {number} Wait time in milliseconds
   */
  calculateWaitTime(userDb, type) {
    const { now } = this.getRateLimitBoundaries();
    const hourCount = this.countUncachedAttemptsSince(userDb, type);

    if (hourCount < UNCACHED_LIMIT_PER_HOUR) {
      return 0;
    }

    const oldestHour = this.getOldestUncachedAttemptSince(userDb, type);
    if (!oldestHour) {
      return HOUR_MS;
    }

    const oldestDate = this.parseSQLDate(oldestHour);
    const timeUntilOldestExpires = HOUR_MS - (now.getTime() - oldestDate.getTime());
    return Math.max(0, timeUntilOldestExpires + RATE_LIMIT_BUFFER_MS);
  }

  /**
   * Whether the per-type uncached hourly budget is exhausted (proactive gate before create API).
   */
  isAtUncachedHourlyLimit(userDb, type) {
    return this.countUncachedAttemptsSince(userDb, type) >= UNCACHED_LIMIT_PER_HOUR;
  }

  async handleRateLimitDeferral(upload, userDb, type) {
    const waitTime = this.calculateWaitTime(userDb, type);
    const nextAttemptAt = this.formatDateForSQL(new Date(Date.now() + waitTime));

    logger.debug('Uncached hourly limit reached, deferring upload', {
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

    const deferOthersResult = userDb.db
      .prepare(
        `
        UPDATE uploads
        SET next_attempt_at = ?,
            error_message = ${CLEAR_TRANSIENT_ERROR_EXPR},
            updated_at = CURRENT_TIMESTAMP
        WHERE status = 'queued'
          AND type = ?
          AND id != ?
      `
      )
      .run(nextAttemptAt, ...transientMessageBindParams(), type, upload.id);

    if (deferOthersResult.changes > 0) {
      logger.debug('Deferred other queued uploads due to uncached hourly limit', {
        type,
        deferredCount: deferOthersResult.changes,
        nextAttemptAt,
      });
    }

    await this.masterDatabase.updateUploadCounters(upload.authId, userDb);
    return false;
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
    const apiClient = new ApiClient(apiKey, { authId });
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
    errorMessage = null,
    isCached = false
  ) {
    try {
      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, error_code, error_message, is_cached)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          uploadId,
          type,
          statusCode,
          success ? 1 : 0,
          errorCode,
          errorMessage,
          isCached ? 1 : 0
        );
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
      add_only_if_cached,
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
      if (add_only_if_cached === true || add_only_if_cached === 1) {
        formData.append('add_only_if_cached', 'true');
      }
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
  /**
   * Defer upload when TorBox is unreachable (do not burn createtorrent retries).
   * @param {Object} upload
   * @param {Object} userDb
   * @param {string} type
   * @param {Error} [error]
   * @returns {Promise<boolean>}
   */
  async handleConnectionDeferral(upload, userDb, type, error = null) {
    const nextAttemptAt = this.formatDateForSQL(new Date(Date.now() + CONNECTION_DEFER_MS));

    logger.warn('TorBox API unavailable, deferring upload', {
      uploadId: upload.id,
      type,
      waitTimeMs: CONNECTION_DEFER_MS,
      nextAttemptAt,
      error: error?.message,
    });

    if (error) {
      logger.warn('TorBox connection error during upload deferral', {
        uploadId: upload.id,
        type,
        error: error.message,
      });
    }

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

    const deferOthersResult = userDb.db
      .prepare(
        `
        UPDATE uploads
        SET next_attempt_at = ?,
            error_message = ${CLEAR_TRANSIENT_ERROR_EXPR},
            updated_at = CURRENT_TIMESTAMP
        WHERE status = 'queued'
          AND type = ?
          AND id != ?
      `
      )
      .run(nextAttemptAt, ...transientMessageBindParams(), type, upload.id);

    if (deferOthersResult.changes > 0) {
      logger.debug('Deferred other queued uploads due to TorBox outage', {
        type,
        deferredCount: deferOthersResult.changes,
        nextAttemptAt,
      });
    }

    await this.masterDatabase.updateUploadCounters(upload.authId, userDb);
    return false;
  }

  /**
   * Handle TorBox transient "queued but failed" response.
   * TorBox sometimes returns `success: false` with detail "Torrent Queued Successfully"
   * when the upload was accepted but not yet fully processed. Defer and retry with
   * exponential backoff instead of marking as permanently failed.
   * @param {Object} upload - Upload record
   * @param {Object} userDb - User database instance
   * @param {string} type - Upload type
   * @param {Object} response - Axios response
   * @returns {Promise<boolean>} False (not processed)
   */
  async handleTransientTorboxDeferral(upload, userDb, type, response) {
    const data = response?.data && typeof response.data === 'object' ? response.data : {};
    const retryCount = (upload.retry_count ?? 0) + 1;
    const deferMs = this.calculateBackoffDelay(retryCount);
    const nextAttemptAt = this.formatDateForSQL(new Date(Date.now() + deferMs));

    logger.warn('TorBox returned transient queued response, will retry', {
      uploadId: upload.id,
      type,
      retryCount,
      waitTimeMs: deferMs,
      nextAttemptAt,
      detail: data.detail,
    });

    userDb.db
      .prepare(
        `
        UPDATE uploads
        SET status = 'queued',
            error_message = ?,
            retry_count = ?,
            next_attempt_at = ?,
            last_processed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      )
      .run(
        `TorBox queued this upload but did not return resource IDs. Retry ${retryCount} in ${Math.round(deferMs / 1000)}s.`,
        retryCount,
        nextAttemptAt,
        upload.id
      );

    // Defer other queued uploads of this type to avoid cascading transient failures
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
      .run(nextAttemptAt, type, upload.id);

    if (deferOthersResult.changes > 0) {
      logger.debug('Deferred other queued uploads due to TorBox transient response', {
        type,
        deferredCount: deferOthersResult.changes,
        nextAttemptAt,
      });
    }

    await this.masterDatabase.updateUploadCounters(upload.authId, userDb);
    return false;
  }

  async makeApiRequest(apiClient, endpoint, formData) {
    const formDataHeaders = formData.getHeaders();
    const requestHeaders = {
      ...formDataHeaders,
      Authorization: apiClient.client.defaults.headers['Authorization'],
      'User-Agent': apiClient.client.defaults.headers['User-Agent'],
    };

    return apiClient.client.post(endpoint, formData, {
      headers: requestHeaders,
      timeout: CREATE_UPLOAD_TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  }

  /**
   * Look up an existing TorBox torrent/queued item for idempotent duplicate handling.
   * @param {ApiClient} apiClient
   * @param {Object} upload
   * @param {string} type
   * @returns {Promise<{ hash: string|null, torrentId: string|number|null, authId: string|null }>}
   */
  async resolveExistingTorboxResource(apiClient, upload, type) {
    if (type !== 'torrent') {
      return { hash: null, torrentId: null, authId: null };
    }

    const expectedHash = await getExpectedTorrentHash(upload);
    const torrents = await apiClient.getTorrents(true);
    return matchTorboxResource(upload, torrents, expectedHash);
  }

  /**
   * Complete an upload when TorBox reports the item already exists/queued.
   * @param {Object} upload
   * @param {Object} userDb
   * @param {string} type
   * @param {Object} response - TorBox API response
   * @param {ApiClient} apiClient
   * @returns {Promise<boolean>}
   */
  async handleIdempotentDuplicate(upload, userDb, type, response, apiClient) {
    const { id } = upload;
    const data = response?.data && typeof response.data === 'object' ? response.data : {};

    this.logUploadAttempt(
      userDb,
      id,
      type,
      response?.status ?? 200,
      true,
      data.error ?? 'DUPLICATE_ITEM',
      data.detail ?? null,
      true
    );

    logger.info('TorBox reported duplicate upload; resolving existing resource', {
      uploadId: id,
      type,
      upload_type: upload.upload_type,
      name: upload.name,
      error: data.error,
      detail: data.detail,
    });

    let resolved = { hash: null, torrentId: null, authId: null };
    try {
      resolved = await this.resolveExistingTorboxResource(apiClient, upload, type);
    } catch (lookupError) {
      logger.warn('Failed to resolve existing TorBox resource for duplicate upload', {
        uploadId: id,
        type,
        error: lookupError.message,
      });
    }

    const syntheticResponse = {
      status: response?.status ?? 200,
      data: {
        success: true,
        error: null,
        detail: data.detail || 'Download already exists on TorBox',
        data: {
          hash: resolved.hash,
          torrent_id: resolved.torrentId,
          auth_id: resolved.authId,
        },
      },
    };

    if (resolved.hash || resolved.torrentId != null) {
      this.handleSuccessfulUpload(upload, userDb, type, syntheticResponse, {
        skipLogAttempt: true,
      });
      return true;
    }

    // Could not resolve ids, but TorBox already has the item — mark completed to avoid re-queue loops.
    // Preserve torbox_hash from the expected hash so the record isn't completely orphaned.
    const fallbackHash = await getExpectedTorrentHash(upload).catch(() => null);

    const updateResult = userDb.db
      .prepare(
        `
        UPDATE uploads
        SET status = 'completed',
            error_message = NULL,
            torbox_hash = ?,
            torbox_torrent_id = NULL,
            torbox_auth_id = NULL,
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      )
      .run(fallbackHash, id);

    if (updateResult.changes > 0 && upload.authId) {
      void this.masterDatabase.updateUploadCounters(upload.authId, userDb).catch((error) => {
        logger.error('Failed to update counters after duplicate completion', error, {
          authId: upload.authId,
          uploadId: id,
        });
      });
    }

    logger.warn('Marked duplicate upload completed without TorBox ids', {
      uploadId: id,
      type,
      name: upload.name,
      preservedHash: fallbackHash,
    });

    return true;
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
  handleSuccessfulUpload(upload, userDb, type, response, options = {}) {
    const { id } = upload;
    const { torboxHash, torboxTorrentId, torboxAuthId } = extractTorboxTorrentResult(
      response,
      type
    );

    if (!options.skipLogAttempt) {
      const isCached = isTorboxCachedUploadResponse(response);
      this.logUploadAttempt(userDb, id, type, response.status, true, null, null, isCached);
    }

    // Update upload status (staged files retained until tier quota eviction)
    const updateResult = userDb.db
      .prepare(
        `
        UPDATE uploads
        SET status = 'completed',
            error_message = NULL,
            torbox_hash = ?,
            torbox_torrent_id = ?,
            torbox_auth_id = ?,
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      )
      .run(torboxHash, torboxTorrentId, torboxAuthId, id);

    // Update counter only if the upload still exists (wasn't deleted during processing)
    if (updateResult.changes > 0 && upload.authId) {
      void this.masterDatabase.updateUploadCounters(upload.authId, userDb).catch((error) => {
        logger.error('Failed to update counters after successful upload', error, {
          authId: upload.authId,
          uploadId: id,
        });
      });
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
    const retryAfterHeader =
      error.response?.headers?.['retry-after'] ?? error.response?.headers?.['Retry-After'];
    const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;

    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return retryAfterSeconds * 1000;
    }

    // Rolling 60/hour: wait until the oldest tracked uncached attempt leaves the window
    const rollingWaitMs = this.calculateWaitTime(userDb, type);
    if (rollingWaitMs > 0) {
      return rollingWaitMs;
    }

    // External usage may have exhausted the limit without entries in our log — retry soon
    return RATE_LIMIT_UNKNOWN_RETRY_MS;
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
      return 'Rate limit reached. Will retry automatically.';
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

    const isRateLimit = this.isRateLimitError(error);
    const isConnection = isConnectionError(error);

    // Rate-limit attempts are not logged — they do not consume uncached budget and are retried after deferral.
    if (error.response && !isRateLimit) {
      logger.warn('TorBox API error response', {
        uploadId: id,
        type,
        status: error.response.status,
        statusText: error.response.statusText,
        retryAfter:
          error.response.headers?.['retry-after'] ?? error.response.headers?.['Retry-After'],
        data: error.response.data,
      });
    } else if (isRateLimit) {
      logger.warn('TorBox rate limit response', {
        uploadId: id,
        type,
        ...(error.response && {
          status: error.response.status,
          retryAfter:
            error.response.headers?.['retry-after'] ?? error.response.headers?.['Retry-After'],
          data: error.response.data,
        }),
        message: error.message,
      });
    } else if (isConnection) {
      logger.warn('TorBox connection error during upload', {
        uploadId: id,
        type,
        message: error.message,
        code: error.code,
      });
    }

    const isNonRetryable = this.isNonRetryableError(error);
    // Only defer (and call TorBox again later) for rate limits and platform outages.
    // All other API failures get a single createtorrent attempt; use manual Retry to try again.
    const shouldDefer = isConnection || isRateLimit;
    const finalRetryCount = shouldDefer
      ? (upload.retry_count ?? 0)
      : Math.max(1, (upload.retry_count ?? 0) + 1);
    const finalStatus = shouldDefer ? 'queued' : 'failed';

    const deferMs = isConnection
      ? CONNECTION_DEFER_MS
      : isRateLimit
        ? this.calculateRateLimitDelay(error, userDb, type)
        : 0;

    const nextAttemptAt =
      deferMs > 0 ? this.formatDateForSQL(new Date(Date.now() + deferMs)) : null;

    // Create user-friendly error message (deferrals use queue-level state, not per-row errors)
    const userFriendlyError = shouldDefer ? null : this.createUserFriendlyError(error, isRateLimit);

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

    // When API returns 429, defer all other queued uploads of this type so we don't hammer
    // TorBox for the rest of the queue (e.g. external tools may have exhausted the limit first).
    if ((isRateLimit || isConnection) && nextAttemptAt) {
      const deferOthersResult = userDb.db
        .prepare(
          `
          UPDATE uploads
          SET next_attempt_at = ?,
              error_message = ${CLEAR_TRANSIENT_ERROR_EXPR},
              updated_at = CURRENT_TIMESTAMP
          WHERE status = 'queued'
            AND type = ?
            AND id != ?
        `
        )
        .run(nextAttemptAt, ...transientMessageBindParams(), type, id);
      if (deferOthersResult.changes > 0) {
        logger.debug('Deferred other queued uploads due to TorBox backoff', {
          type,
          reason: isConnection ? 'connection_error' : 'rate_limit',
          deferredCount: deferOthersResult.changes,
          nextAttemptAt,
        });
      }
    }

    // Update counters only if the upload still exists (wasn't deleted during processing)
    // If the upload was deleted, the UPDATE returns 0 rows affected, so we skip counter updates
    if (updateResult.changes > 0 && upload.authId) {
      await this.masterDatabase.updateUploadCounters(upload.authId, userDb);
    }

    // Log appropriate message (include TorBox response in rate-limit log so prod sees it in one place)
    if (isConnection) {
      logger.warn('TorBox unavailable, will retry later', {
        uploadId: id,
        type,
        waitTimeMs: deferMs,
        error: error.message,
      });
    } else if (isRateLimit) {
      logger.warn('Rate limit hit, will retry later', {
        uploadId: id,
        type,
        waitTimeMs: deferMs,
        ...(error.response && {
          status: error.response.status,
          statusText: error.response.statusText,
          retryAfter:
            error.response.headers?.['retry-after'] ?? error.response.headers?.['Retry-After'],
          data: error.response.data,
        }),
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
   * @param {{ remainingUncachedBudget?: number }} [budgetCtx] - In-memory uncached budget during drain
   * @returns {Promise<{ success: boolean, stopTypeDrain: boolean }>}
   */
  async processUpload(
    upload,
    userDb,
    originalStatus = null,
    isRetryAfterAuthError = false,
    budgetCtx = null
  ) {
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

      const atUncachedLimit = budgetCtx
        ? budgetCtx.remainingUncachedBudget <= 0
        : this.isAtUncachedHourlyLimit(userDb, type);

      if (atUncachedLimit) {
        await this.handleRateLimitDeferral(upload, userDb, type);
        return uploadProcessResult(false, true);
      }

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
      let response;
      try {
        response = await this.makeApiRequest(apiClient, endpoint, formData);
      } catch (apiError) {
        if (isConnectionError(apiError)) {
          await this.handleConnectionDeferral(upload, userDb, type, apiError);
          return uploadProcessResult(false, true);
        }
        throw apiError;
      }

      // Duplicate submissions mean TorBox already has this item — treat as success.
      if (isTorboxDuplicateUploadResponse(response)) {
        const duplicateOk = await this.handleIdempotentDuplicate(
          upload,
          userDb,
          type,
          response,
          apiClient
        );
        return uploadProcessResult(duplicateOk);
      }

      // TorBox can return HTTP 200 with { success: false, error, detail } when the torrent was not created.
      if (isTorboxUploadApiFailure(response, type)) {
        if (isTorboxOutageResponse(response)) {
          await this.handleConnectionDeferral(
            upload,
            userDb,
            type,
            Object.assign(new Error('TorBox API returned an unexpected response'), {
              isConnectionError: true,
              response,
            })
          );
          return uploadProcessResult(false, true);
        }

        // TorBox may return success:false with contradictory detail like "Torrent Queued Successfully" —
        // a transient condition where the upload was accepted but not fully processed.
        if (isTorboxTransientQueuedResponse(response)) {
          await this.handleTransientTorboxDeferral(upload, userDb, type, response);
          return uploadProcessResult(false, true);
        }

        const data = response?.data && typeof response.data === 'object' ? response.data : {};
        const syntheticError = Object.assign(
          new Error(
            data.detail ||
              data.error ||
              'TorBox API did not confirm the upload was created (missing success or resource id)'
          ),
          {
            response: {
              status: response.status ?? 200,
              data: { error: data.error, detail: data.detail },
            },
          }
        );
        await this.handleFailedUpload(upload, userDb, type, syntheticError, originalStatusValue);
        return uploadProcessResult(false, false);
      }

      // TorBox may return success:true with detail "Torrent Queued Successfully" but no
      // resource IDs (hash, torrent_id, auth_id all null). This is a transient async
      // condition — the upload was accepted but not yet processed. Defer and retry
      // instead of marking as completed with nothing to track.
      if (type === 'torrent') {
        const { torboxHash, torboxTorrentId, torboxAuthId } = extractTorboxTorrentResult(
          response,
          type
        );
        if (torboxHash == null && torboxTorrentId == null && torboxAuthId == null) {
          await this.handleTransientTorboxDeferral(upload, userDb, type, response);
          return uploadProcessResult(false, true);
        }
      }

      // API call succeeded - now handle the database update
      // If handleSuccessfulUpload throws (e.g., SQLITE_BUSY, closed database), we must NOT re-queue
      // since the upload already succeeded on TorBox
      try {
        this.handleSuccessfulUpload(upload, userDb, type, response);
        if (budgetCtx && !isTorboxCachedUploadResponse(response)) {
          budgetCtx.remainingUncachedBudget--;
        }
        return uploadProcessResult(true);
      } catch (dbError) {
        // Database error after successful API call - retry the database update
        // but do NOT re-queue the upload since it already succeeded on TorBox
        const isClosedDbError = isClosedDatabaseError(dbError);

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
                if (isClosedDatabaseError(checkError)) {
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
            if (budgetCtx && !isTorboxCachedUploadResponse(response)) {
              budgetCtx.remainingUncachedBudget--;
            }
            logger.info('Successfully completed database update after retry', {
              uploadId: id,
              attempt: attempt + 1,
            });
            return uploadProcessResult(true);
          } catch (retryError) {
            lastDbError = retryError;
            const isRetryClosedDbError = isClosedDatabaseError(retryError);

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
                const isClosedError = isClosedDatabaseError(checkError);

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

            const {
              torboxHash: recoveryHash,
              torboxTorrentId: recoveryTorrentId,
              torboxAuthId: recoveryAuthId,
            } = extractTorboxTorrentResult(response, type);

            const updateResult = finalUserDb.db
              .prepare(
                `
                UPDATE uploads
                SET status = 'completed',
                    error_message = ?,
                    torbox_hash = ?,
                    torbox_torrent_id = ?,
                    torbox_auth_id = ?,
                    completed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `
              )
              .run(
                `Database update failed after successful upload: ${lastDbError.message}`,
                recoveryHash,
                recoveryTorrentId,
                recoveryAuthId,
                id
              );

            if (updateResult.changes > 0 && upload.authId) {
              void this.masterDatabase
                .updateUploadCounters(upload.authId, finalUserDb)
                .catch((error) => {
                  logger.error('Failed to update counters after recovery completion', error, {
                    authId: upload.authId,
                    uploadId: id,
                  });
                });
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
            const isFinalClosedError = isClosedDatabaseError(finalError);

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
        return uploadProcessResult(true);
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
        return await this.processUpload(upload, userDb, originalStatusValue, true, budgetCtx);
      }

      // Handle failure (including auth errors on retry)
      // This catch block only handles errors from makeApiRequest, not from handleSuccessfulUpload
      await this.handleFailedUpload(upload, userDb, type, error, originalStatusValue);
      const stopTypeDrain = this.isRateLimitError(error) || isConnectionError(error);
      return uploadProcessResult(false, stopTypeDrain);
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
  async recoverStuckProcessingUploads(userDb, authId) {
    try {
      const timeoutThreshold = this.formatDateForSQL(new Date(Date.now() - PROCESSING_TIMEOUT_MS));

      const stuckUploads = userDb.db
        .prepare(
          `
          SELECT id, type, upload_type, file_path, url, name, status
          FROM uploads
          WHERE status = 'processing'
            AND (
              last_processed_at IS NULL
              OR datetime(last_processed_at) <= datetime(?)
            )
        `
        )
        .all(timeoutThreshold);

      if (stuckUploads.length === 0) {
        return 0;
      }

      let recoveredToQueued = 0;
      let completedAfterApiSuccess = 0;

      for (const upload of stuckUploads) {
        const successAttempt = userDb.db
          .prepare(
            `
            SELECT 1 AS ok
            FROM upload_attempts
            WHERE upload_id = ?
              AND success = 1
            LIMIT 1
          `
          )
          .get(upload.id);

        if (successAttempt) {
          try {
            const apiClient = await this.getApiClient(authId);
            const completed = await this.handleIdempotentDuplicate(
              { ...upload, authId },
              userDb,
              upload.type,
              {
                status: 200,
                data: {
                  success: false,
                  error: 'DUPLICATE_ITEM',
                  detail: 'Recovered stuck upload after successful TorBox submission',
                },
              },
              apiClient
            );
            if (completed) {
              completedAfterApiSuccess++;
            }
          } catch (error) {
            logger.error('Failed to complete stuck upload after successful API attempt', error, {
              authId,
              uploadId: upload.id,
            });
          }
          continue;
        }

        const result = userDb.db
          .prepare(
            `
            UPDATE uploads
            SET status = 'queued',
                error_message = NULL,
                last_processed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND status = 'processing'
          `
          )
          .run(upload.id);

        if (result.changes > 0) {
          recoveredToQueued++;
        }
      }

      if (recoveredToQueued > 0 || completedAfterApiSuccess > 0) {
        logger.info('Recovered stuck processing uploads', {
          authId,
          recoveredToQueued,
          completedAfterApiSuccess,
          timeoutThreshold,
        });

        await this.masterDatabase.updateUploadCounters(authId, userDb).catch((error) => {
          logger.error('Failed to update counters after recovery', error, { authId });
        });
      }

      return recoveredToQueued + completedAfterApiSuccess;
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

      const recoveryResults = await Promise.allSettled(
        activeUsers.map(async (user) => {
          const userDb = await this.userDatabaseManager.getUserDatabase(user.auth_id);
          return this.recoverStuckProcessingUploads(userDb, user.auth_id);
        })
      );

      for (const r of recoveryResults) {
        if (r.status === 'fulfilled') {
          totalRecovered += r.value;
        } else {
          logger.error('Error recovering stuck uploads for user', r.reason);
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
  getQueuedUploads(userDb, authId, type = null, { limit = 1 } = {}) {
    let query = `
      SELECT id, type, upload_type, file_path, url, name, status,
             error_message, retry_count, seed, allow_zip, as_queued, add_only_if_cached, password,
             queue_order, torbox_hash, torbox_torrent_id, torbox_auth_id,
             last_processed_at, completed_at, created_at, updated_at, next_attempt_at
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

    query += ' ORDER BY queue_order ASC LIMIT ?';
    params.push(limit);

    try {
      return userDb.db.prepare(query).all(...params);
    } catch (error) {
      // Handle closed database error - connection may have been evicted from pool
      if (isClosedDatabaseError(error)) {
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
   * Fetch queued uploads, re-opening the user DB connection on DATABASE_CLOSED.
   */
  async _getQueuedUploadsWithRetry(userDb, authId, type, limit) {
    try {
      return { userDb, rows: this.getQueuedUploads(userDb, authId, type, { limit }) };
    } catch (error) {
      if (error.message === 'DATABASE_CLOSED') {
        const freshDb = await this.userDatabaseManager.getUserDatabase(authId);
        return { userDb: freshDb, rows: this.getQueuedUploads(freshDb, authId, type, { limit }) };
      }
      throw error;
    }
  }

  /**
   * Claim a queued upload and process it.
   * @returns {Promise<{ userDb: Object, outcome: { success: boolean, stopTypeDrain: boolean } | null }>}
   */
  async _claimAndProcessUpload(upload, authId, userDb, budgetCtx) {
    let currentUserDb = userDb;

    let currentStatus;
    try {
      currentStatus = currentUserDb.db
        .prepare('SELECT status FROM uploads WHERE id = ?')
        .get(upload.id);
    } catch (error) {
      if (isClosedDatabaseError(error)) {
        currentUserDb = await this.userDatabaseManager.getUserDatabase(authId);
        currentStatus = currentUserDb.db
          .prepare('SELECT status FROM uploads WHERE id = ?')
          .get(upload.id);
      } else {
        throw error;
      }
    }

    if (currentStatus?.status !== 'queued') {
      return { userDb: currentUserDb, outcome: null };
    }

    const originalStatus = currentStatus.status;
    let claimResult;
    try {
      claimResult = currentUserDb.db
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
      if (isClosedDatabaseError(error)) {
        currentUserDb = await this.userDatabaseManager.getUserDatabase(authId);
        claimResult = currentUserDb.db
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
      } else {
        throw error;
      }
    }

    if (claimResult.changes === 0) {
      return { userDb: currentUserDb, outcome: null };
    }

    let processOutcome = uploadProcessResult(false);
    try {
      processOutcome = await this.processUpload(
        { ...upload, authId },
        currentUserDb,
        originalStatus,
        false,
        budgetCtx
      );
    } finally {
      const after = currentUserDb.db
        .prepare('SELECT status FROM uploads WHERE id = ?')
        .get(upload.id);
      if (after?.status === 'processing' && !processOutcome.success) {
        logger.warn('Upload still processing after processUpload; resetting to queued', {
          uploadId: upload.id,
          authId,
        });
        currentUserDb.db
          .prepare(
            `
            UPDATE uploads
            SET status = 'queued',
                error_message = NULL,
                last_processed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'processing'
          `
          )
          .run(upload.id);
        await this.masterDatabase.updateUploadCounters(authId, currentUserDb);
      }
    }

    return { userDb: currentUserDb, outcome: processOutcome };
  }

  /**
   * Buffered true round-robin drain for one user invocation.
   */
  async _drainUserQueues(authId, userDb) {
    return this._withUserDrainLock(authId, () => this._drainUserQueuesUnlocked(authId, userDb));
  }

  async _drainUserQueuesUnlocked(authId, userDb) {
    const uncachedBudget = {
      torrent: UNCACHED_LIMIT_PER_HOUR - this.countUncachedAttemptsSince(userDb, 'torrent'),
      usenet: UNCACHED_LIMIT_PER_HOUR - this.countUncachedAttemptsSince(userDb, 'usenet'),
      webdl: UNCACHED_LIMIT_PER_HOUR - this.countUncachedAttemptsSince(userDb, 'webdl'),
    };

    const budgetCtxByType = {
      torrent: { remainingUncachedBudget: uncachedBudget.torrent },
      usenet: { remainingUncachedBudget: uncachedBudget.usenet },
      webdl: { remainingUncachedBudget: uncachedBudget.webdl },
    };

    const buffers = {
      torrent: new TypeQueueBuffer(),
      usenet: new TypeQueueBuffer(),
      webdl: new TypeQueueBuffer(),
    };

    const typeStopped = { torrent: false, usenet: false, webdl: false };
    let workRemaining = UPLOAD_MAX_WORK_PER_DRAIN;
    let totalProcessed = 0;
    let currentUserDb = userDb;

    while (workRemaining > 0) {
      let processedThisCycle = 0;

      for (const type of UPLOAD_TYPES_ROUND_ROBIN) {
        if (workRemaining <= 0) {
          break;
        }
        if (typeStopped[type]) {
          continue;
        }

        const { upload, userDb: dbAfterFetch } = await buffers[type].next(
          this,
          currentUserDb,
          authId,
          type
        );
        currentUserDb = dbAfterFetch;

        if (!upload) {
          continue;
        }

        const { userDb: dbAfterClaim, outcome } = await this._claimAndProcessUpload(
          upload,
          authId,
          currentUserDb,
          budgetCtxByType[type]
        );
        currentUserDb = dbAfterClaim;

        if (!outcome) {
          continue;
        }

        workRemaining--;
        totalProcessed++;
        processedThisCycle++;

        if (outcome.stopTypeDrain) {
          typeStopped[type] = true;
        }
      }

      if (processedThisCycle === 0) {
        break;
      }
    }

    return { userDb: currentUserDb, totalProcessed };
  }

  /**
   * Sync counters and process uploads for a single user (e.g. after manual retry).
   * @param {string} authId
   */
  async processUserUploads(authId) {
    if (!this.userDatabaseManager) {
      return;
    }

    const userDb = await this.userDatabaseManager.getUserDatabase(authId);
    try {
      await this.masterDatabase.updateUploadCounters(authId, userDb);
      await this.recoverStuckProcessingUploads(userDb, authId);

      const registry = this.masterDatabase.getUserRegistryInfo(authId);
      if ((registry?.queued_uploads_count ?? 0) <= 0) {
        return;
      }

      await this._processUserUploads(
        { auth_id: authId, queued_uploads_count: registry.queued_uploads_count },
        { shouldCleanup: false, shouldRecover: false }
      );
    } catch (error) {
      logger.error('Error processing uploads for user (nudged)', error, { authId });
    } finally {
      this.userDatabaseManager.closeConnection(authId);
    }
  }

  /**
   * Process queued uploads for one user.
   * @param {Object} user - Row from getUsersWithQueuedUploads (needs auth_id)
   * @param {{ shouldCleanup: boolean, shouldRecover: boolean }} options
   */
  async _processUserUploads(user, { shouldCleanup, shouldRecover }) {
    const { auth_id } = user;
    const userDb = await this.userDatabaseManager.getUserDatabase(auth_id);
    this.userDatabaseManager.pool.markActive(auth_id);

    try {
      if (shouldCleanup) {
        this.cleanupOldAttempts(userDb);
      }

      if (shouldRecover) {
        await this.recoverStuckProcessingUploads(userDb, auth_id).catch((error) => {
          logger.error('Recovery failed for user', error, { authId: auth_id });
        });
      }

      const { userDb: dbAfterDrain, totalProcessed } = await this._drainUserQueues(auth_id, userDb);

      if (totalProcessed === 0) {
        logger.debug('No queued uploads processed for user; recalculating counter', {
          authId: auth_id,
          reportedCount: user.queued_uploads_count,
        });
        await this.masterDatabase.updateUploadCounters(auth_id, dbAfterDrain).catch((error) => {
          logger.error('Failed to recalculate upload counter for user', error, {
            authId: auth_id,
          });
        });
      }
    } catch (error) {
      logger.error('Error processing uploads for user', error, {
        authId: auth_id,
      });
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

    if (this._processingInProgress) {
      logger.debug('Skipping upload processing cycle - previous run still in progress');
      return;
    }

    this._processingInProgress = true;

    try {
      const usersWithUploads = this.masterDatabase.getUsersWithQueuedUploads();

      // Cleanup old attempts periodically (once per day for all active users)
      const now = Date.now();
      const shouldCleanup =
        !this.lastCleanupAt || now - this.lastCleanupAt >= this.cleanupIntervalMs;

      // Recover stuck uploads periodically (every hour)
      // This ensures uploads stuck in 'processing' state are recovered even if startup recovery missed them
      const shouldRecover = !this.lastRecoveryAt || now - this.lastRecoveryAt >= 60 * 60 * 1000;

      // Process users concurrently with a bounded semaphore so that a user waiting on a rate-limit
      // sleep does not block uploads for all subsequent users in the same 5-second cycle.
      const UPLOAD_CONCURRENCY = Math.max(
        1,
        parseInt(process.env.UPLOAD_PROCESS_CONCURRENCY || '6', 10)
      );
      const uploadSemaphore = { running: 0, queue: [] };
      const acquireUploadSlot = () =>
        new Promise((resolve) => {
          if (uploadSemaphore.running < UPLOAD_CONCURRENCY) {
            uploadSemaphore.running++;
            resolve();
          } else {
            uploadSemaphore.queue.push(resolve);
          }
        });
      const releaseUploadSlot = () => {
        uploadSemaphore.running--;
        if (uploadSemaphore.queue.length > 0) {
          uploadSemaphore.running++;
          uploadSemaphore.queue.shift()();
        }
      };

      const processOneUser = async (user) => {
        const { auth_id } = user;
        await acquireUploadSlot();
        try {
          await this._processUserUploads(user, { shouldCleanup, shouldRecover });
        } finally {
          this.userDatabaseManager.closeConnection(auth_id);
          releaseUploadSlot();
        }
      };

      await Promise.allSettled(usersWithUploads.map((user) => processOneUser(user)));

      // Update cleanup and recovery timestamps after processing all users
      if (shouldCleanup) {
        this.lastCleanupAt = now;
        void this.masterDatabase
          .syncUploadCountersForAllUsers(this.userDatabaseManager)
          .catch((error) => {
            logger.error('Daily upload counter sync failed', error);
          });
      }
      if (shouldRecover) {
        this.lastRecoveryAt = now;
      }
    } catch (error) {
      logger.error('Error in upload processing cycle', error);
    } finally {
      this._processingInProgress = false;
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
