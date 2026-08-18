import axios from 'axios';
import logger from '../utils/logger.js';
import WeightedFairSemaphore from '../utils/WeightedFairSemaphore.js';
import { fetchMyList, mergeMyListWithQueued } from './mylistPagination.js';
import torboxApiOutageCoordinator from './TorboxApiOutageCoordinator.js';

/**
 * Simple circuit breaker for upstream API calls.
 * Opens after FAILURE_THRESHOLD consecutive failures, then allows
 * requests through again after COOLDOWN_MS (half-open).
 */
class CircuitBreaker {
  constructor(name, failureThreshold = 5, cooldownMs = 60000) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.failures = 0;
    this.lastFailureAt = 0;
    this.state = 'closed'; // closed, open, half-open
  }

  isOpen() {
    if (this.state === 'closed') return false;
    if (this.state === 'open' && Date.now() - this.lastFailureAt > this.cooldownMs) {
      this.state = 'half-open';
      return false;
    }
    return true;
  }

  recordFailure() {
    this.failures++;
    this.lastFailureAt = Date.now();
    if (this.failures >= this.failureThreshold && this.state !== 'open') {
      this.state = 'open';
      logger.warn('Circuit breaker opened', { name: this.name, failures: this.failures });
      torboxApiOutageCoordinator.notifyCircuitBreakerOpened();
    }
  }

  recordSuccess() {
    if (this.state === 'half-open' || this.state === 'open') {
      logger.info('Circuit breaker closed', {
        name: this.name,
        previousFailures: this.failures,
      });
    }
    this.failures = 0;
    this.lastFailureAt = 0;
    this.state = 'closed';
  }
}

const _globalCircuitBreaker = new CircuitBreaker('torbox-api');

/** Reset global TorBox circuit breaker after platform recovery (coordinator only). */
export function resetTorboxCircuitBreaker() {
  _globalCircuitBreaker.recordSuccess();
}

// Constants
const DEFAULT_TIMEOUT = 30000;
// Fetch (getTorrents) timeout; shorter than default to leave headroom in per-user poll budget (POLL_KICKOUT_MS).
const DEFAULT_FETCH_TIMEOUT = parseInt(process.env.TORBOX_FETCH_TIMEOUT_MS || '20000', 10);
// Action calls (controlTorrent, controlQueuedTorrent) use a shorter timeout so that
// a hung TorBox response on one torrent does not consume the per-user 180s poll budget.
const DEFAULT_ACTION_TIMEOUT = parseInt(process.env.TORBOX_ACTION_TIMEOUT_MS || '15000', 10);
const DEFAULT_BASE_URL = 'https://api.torbox.app';
const DEFAULT_API_VERSION = 'v1';
const DEFAULT_PACKAGE_VERSION = '0.1.0';

const AUTH_ERROR_CODES = ['AUTH_ERROR', 'NO_AUTH', 'BAD_TOKEN'];
const CONNECTION_ERROR_CODES = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNABORTED',
];
const RECOVERY_PROBE_TIMEOUT_MS = Math.max(
  1000,
  parseInt(process.env.TORBOX_RECOVERY_PROBE_TIMEOUT_MS || '10000', 10)
);
const CONNECTION_ERROR_MESSAGES = ['Network Error', 'timeout'];

/**
 * TorBox sometimes returns HTTP 500 for application/business errors (quota,
 * plan limits, etc.). Those must not trip the global circuit breaker or be
 * logged as "API is down".
 */
const APPLICATION_500_MESSAGE_PATTERNS = [
  /active download limit/i,
  /upgrade your plan/i,
  /monthly limit/i,
  /too many/i,
  /already exists/i,
  /duplicate/i,
];

/**
 * Extract a human-readable TorBox error string from a response body.
 * @param {*} data
 * @returns {string}
 */
function torboxErrorText(data) {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  if (typeof data !== 'object') return String(data);
  const parts = [data.detail, data.data, data.error, data.message]
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim());
  return parts.join(' ');
}

/**
 * True when a 5xx response body looks like a TorBox application error rather
 * than an infrastructure outage.
 * @param {*} data
 * @returns {boolean}
 */
export function isTorboxApplicationServerError(data) {
  const text = torboxErrorText(data);
  if (!text) return false;
  return APPLICATION_500_MESSAGE_PATTERNS.some((re) => re.test(text));
}

const ACTIVE_DOWNLOAD_LIMIT_RE = /active download limit/i;

/**
 * True when an error (thrown or response-shaped) is TorBox "active download limit".
 * @param {Error|*} error
 * @returns {boolean}
 */
export function isActiveDownloadLimitError(error) {
  if (!error || typeof error !== 'object') return false;
  if (error.isActiveDownloadLimit === true) return true;
  const text =
    (typeof error.message === 'string' && error.message) ||
    torboxErrorText(error.response?.data) ||
    torboxErrorText(error.responseData) ||
    '';
  return ACTIVE_DOWNLOAD_LIMIT_RE.test(text);
}

/** Normalize API active field to boolean (API may return true, 1, or 'true') */
function normalizeActive(value) {
  return value === true || value === 1 || value === 'true';
}

function normalizeAssetTypeForEdit(download) {
  const rawType = download?.assetType || download?.asset_type || 'torrent';
  if (rawType === 'torrents') return 'torrent';
  if (rawType === 'webdownload' || rawType === 'webdl') return 'webdl';
  return rawType;
}

function getAirlockEditConfig(assetType) {
  switch (assetType) {
    case 'torrent':
      return { endpoint: '/api/torrents/edittorrent', idField: 'torrent_id' };
    case 'usenet':
      return { endpoint: '/api/usenet/editusenetdownload', idField: 'usenet_id' };
    case 'webdl':
      return { endpoint: '/api/webdl/editwebdownload', idField: 'webdl_id' };
    default:
      throw new Error(`Unsupported asset type for airlock edit: ${assetType}`);
  }
}

function getAirlockListEndpoint(assetType) {
  switch (assetType) {
    case 'torrent':
      return '/api/torrents/mylist';
    case 'usenet':
      return '/api/usenet/mylist';
    case 'webdl':
      return '/api/webdl/mylist';
    default:
      throw new Error(`Unsupported asset type for airlock list fetch: ${assetType}`);
  }
}

function findDownloadInListData(data, id) {
  const items = Array.isArray(data?.data) ? data.data : data?.data ? [data.data] : [];
  const matchFields = ['id', 'torrent_id', 'usenet_id', 'webdl_id', 'web_id'];
  return (
    items.find((item) =>
      matchFields.some((field) => item?.[field] != null && String(item[field]) === String(id))
    ) || null
  );
}

function normalizeEditTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => {
      if (typeof tag === 'string') return tag.trim();
      if (tag && typeof tag === 'object' && typeof tag.name === 'string') return tag.name.trim();
      return '';
    })
    .filter((tag) => tag.length > 0);
}

function normalizeEditName(name, resourceId) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length > 0) return trimmed;
  return `Download ${resourceId}`;
}

function resolveEditResourceId(download, idField, requestId) {
  const candidates =
    idField === 'torrent_id'
      ? ['torrent_id', 'id']
      : idField === 'usenet_id'
        ? ['usenet_id', 'id']
        : idField === 'webdl_id'
          ? ['webdl_id', 'web_id', 'id']
          : [idField, 'id'];
  for (const field of candidates) {
    const value = download?.[field];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return requestId;
}

function normalizeEditableArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildAirlockEditPayload(download, airlocked) {
  const assetType = normalizeAssetTypeForEdit(download);
  const { idField } = getAirlockEditConfig(assetType);
  const alternativeHashes = download.alternative_hashes ?? download.alternativeHashes;
  const requestId = download.id;
  const resourceId = resolveEditResourceId(download, idField, requestId);

  return {
    [idField]: resourceId,
    name: normalizeEditName(download.name, resourceId),
    tags: normalizeEditTags(download.tags),
    alternative_hashes: normalizeEditableArray(alternativeHashes),
    airlocked,
  };
}

const _fetchConcurrency = Math.max(1, parseInt(process.env.TORBOX_FETCH_CONCURRENCY || '20', 10));
const _actionConcurrency = Math.max(1, parseInt(process.env.TORBOX_ACTION_CONCURRENCY || '12', 10));

const _fetchSemaphore = new WeightedFairSemaphore(_fetchConcurrency);
const _actionSemaphore = new WeightedFairSemaphore(_actionConcurrency);

class ApiClient {
  constructor(apiKey, options = {}) {
    this.authId = options.authId || 'anonymous';
    this.apiKey = apiKey;
    this.baseURL = process.env.TORBOX_API_BASE || DEFAULT_BASE_URL;
    this.apiVersion = process.env.TORBOX_API_VERSION || DEFAULT_API_VERSION;
    this.userAgent = `TorBoxManager-Backend/${process.env.npm_package_version || DEFAULT_PACKAGE_VERSION}`;

    // Create axios client with versioned baseURL
    // Structure: {{api_base}}/{{api_version}} + /api/endpoint
    // Example: https://api.torbox.app/v1 + /api/torrents/controltorrent
    // Result: https://api.torbox.app/v1/api/torrents/controltorrent
    this.client = axios.create({
      baseURL: `${this.baseURL}/${this.apiVersion}`,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'User-Agent': this.userAgent,
        'Content-Type': 'application/json',
      },
      timeout: DEFAULT_TIMEOUT,
    });
  }

  // ============================================================================
  // Configuration Methods
  // ============================================================================

  /**
   * Update API key dynamically
   * @param {string} newApiKey - New API key to use
   */
  updateApiKey(newApiKey) {
    this.apiKey = newApiKey;
    this.client.defaults.headers['Authorization'] = `Bearer ${newApiKey}`;
  }

  // ============================================================================
  // Error Detection Methods
  // ============================================================================

  /**
   * Check if an error is an authentication error
   * @param {Error} error - Axios error to check
   * @returns {boolean} - True if error is an authentication error
   */
  isAuthError(error) {
    if (!error.response) {
      return false;
    }

    const status = error.response.status;
    const data = error.response.data;

    // Check for 403 status with AUTH_ERROR codes
    if (status === 403 && data?.error && AUTH_ERROR_CODES.includes(data.error)) {
      return true;
    }

    // Check for 401 status (unauthorized)
    return status === 401;
  }

  /**
   * Check if an error is a connection/server error
   * @param {Error} error - Axios error to check
   * @returns {boolean} - True if error indicates connection/server issues
   */
  isConnectionError(error) {
    // Check for network errors (no response)
    if (!error.response) {
      return (
        CONNECTION_ERROR_CODES.includes(error.code) ||
        CONNECTION_ERROR_MESSAGES.some((msg) => error.message?.includes(msg))
      );
    }

    const status = error.response.status;
    if (status < 500) {
      return false;
    }

    // Gateway / unavailable — treat as outage regardless of body.
    if (status === 502 || status === 503 || status === 504) {
      return true;
    }

    // TorBox application 500s (quota/plan/etc.) are not connection failures.
    if (isTorboxApplicationServerError(error.response.data)) {
      return false;
    }

    return true;
  }

  // ============================================================================
  // Error Creation Methods
  // ============================================================================

  /**
   * Create a custom authentication error
   * @param {Error} originalError - Original axios error
   * @returns {Error} - Custom authentication error
   */
  createAuthError(originalError) {
    const error = new Error(
      originalError.response?.data?.detail ||
        originalError.response?.data?.error ||
        'Authentication failed'
    );
    error.name = 'AuthenticationError';
    error.status = originalError.response?.status || 403;
    error.responseData = originalError.response?.data;
    error.isAuthError = true;
    return error;
  }

  /**
   * Build error details object for logging
   * @param {Error} error - Axios error
   * @param {Object} context - Additional context information
   * @returns {Object} - Error details object
   */
  buildErrorDetails(error, context = {}) {
    return {
      ...context,
      errorCode: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      serverError: error.response?.data?.error,
      serverMessage: error.response?.data?.data || error.response?.data?.detail,
    };
  }

  /**
   * Build connection error response
   * @param {Error} error - Axios error
   * @param {Object} context - Additional context to include in response
   * @returns {Object} - Connection error response object
   */
  buildConnectionErrorResponse(error, context = {}) {
    return {
      success: false,
      error: 'CONNECTION_ERROR',
      message:
        error.response?.data?.data ||
        error.response?.data?.detail ||
        `TorBox API connection failed: ${error.response?.status || error.code || 'Connection failed'}`,
      isConnectionError: true,
      ...context,
    };
  }

  // ============================================================================
  // Error Handling Wrapper
  // ============================================================================

  /**
   * Wrapper method to handle errors consistently across all API calls
   * @param {Function} apiCall - Async function that makes the API call
   * @param {Object} options - Error handling options
   * @param {string} options.endpoint - Endpoint name for logging
   * @param {string} options.operation - Operation name for logging
   * @param {'fetch'|'action'} options.semaphore - Which pool to use: 'fetch' for getTorrents, 'action' for control/delete and other endpoints
   * @param {Function|*} options.connectionErrorFallback - Function(error) or value to return on connection errors (default: throws)
   * @param {Object} options.context - Additional context for error logging
   * @returns {Promise<*>} - Result of the API call or fallback value
   */
  async handleApiCall(apiCall, options = {}) {
    const {
      endpoint,
      operation,
      semaphore = 'action',
      connectionErrorFallback = null,
      context = {},
    } = options;

    const automationPaused = !torboxApiOutageCoordinator.isAutomationAllowed();

    // Fast-fail if circuit breaker is open (unless automation already paused — coordinator owns recovery)
    if (_globalCircuitBreaker.isOpen() && !automationPaused) {
      const cbError = new Error(
        `Circuit breaker open for TorBox API (${_globalCircuitBreaker.state})`
      );
      cbError.isCircuitBreakerOpen = true;
      cbError.isConnectionError = true;
      if (connectionErrorFallback !== null) {
        return typeof connectionErrorFallback === 'function'
          ? connectionErrorFallback(cbError)
          : connectionErrorFallback;
      }
      throw cbError;
    }

    if (automationPaused) {
      const pausedError = new Error('TorBox API automation paused');
      pausedError.isConnectionError = true;
      pausedError.isAutomationPaused = true;
      if (connectionErrorFallback !== null) {
        return typeof connectionErrorFallback === 'function'
          ? connectionErrorFallback(pausedError)
          : connectionErrorFallback;
      }
      throw pausedError;
    }

    const pool = semaphore === 'fetch' ? _fetchSemaphore : _actionSemaphore;
    const throttled = async () => {
      const release = await pool.acquire(this.authId);
      try {
        return await apiCall();
      } finally {
        release();
      }
    };

    try {
      const result = await throttled();
      _globalCircuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      // Handle authentication errors (debug — expected for revoked/bad keys;
      // UserPoller.handleAuthenticationError emits the actionable warn + deactivation)
      if (this.isAuthError(error)) {
        const authError = this.createAuthError(error);
        logger.debug(`Authentication error ${operation || 'in API call'}`, {
          authId: this.authId,
          endpoint,
          ...context,
          status: authError.status,
          errorCode: error.response?.data?.error,
          message: authError.message,
        });
        throw authError;
      }

      // Handle connection/server errors — record failure for circuit breaker
      if (this.isConnectionError(error)) {
        if (torboxApiOutageCoordinator.isAutomationAllowed()) {
          _globalCircuitBreaker.recordFailure();
        }
        const errorDetails = this.buildErrorDetails(error, { endpoint, ...context });
        const serverText = torboxErrorText(error.response?.data);
        const logMessage =
          connectionErrorFallback !== null
            ? `TorBox API connection error ${operation || 'in API call'} - handling gracefully`
            : `TorBox API connection error ${operation || 'in API call'}`;

        // While the outage coordinator already paused automation, further per-call warns are noise.
        if (torboxApiOutageCoordinator.isAutomationAllowed()) {
          logger.warn(logMessage, {
            ...errorDetails,
            torboxDetail:
              serverText ||
              (connectionErrorFallback !== null
                ? 'TorBox API is down or not responding. Operation skipped.'
                : 'TorBox API connection failed.'),
          });
        } else {
          logger.debug(logMessage, {
            endpoint,
            ...context,
            status: error.response?.status,
          });
        }

        // Return fallback value if provided (function or value)
        if (connectionErrorFallback !== null) {
          return typeof connectionErrorFallback === 'function'
            ? connectionErrorFallback(error)
            : connectionErrorFallback;
        }

        // Tag the error so callers (e.g. UserPoller.fetchTorrents) can detect it and skip
        // shadow-state processing rather than treating a connection failure as "0 torrents".
        error.isConnectionError = true;
        throw error;
      }

      // Application-level TorBox 500s (e.g. active download limit) — do not trip CB.
      // Never use connectionErrorFallback: callers must see business errors (limit/quota),
      // not a synthetic CONNECTION_ERROR that looks like success to action executors.
      if (error.response?.status >= 500 && isTorboxApplicationServerError(error.response?.data)) {
        const appMessage = torboxErrorText(error.response.data);
        error.isTorboxApplicationError = true;
        error.isActiveDownloadLimit = ACTIVE_DOWNLOAD_LIMIT_RE.test(appMessage);
        // Plan/quota limits are expected and can fire once per queued item without abort —
        // log at debug; RuleExecutor aborts force_start batches and warns once.
        const logFn = error.isActiveDownloadLimit
          ? logger.debug.bind(logger)
          : logger.warn.bind(logger);
        logFn(`TorBox API application error ${operation || 'in API call'}`, {
          authId: this.authId,
          endpoint,
          ...context,
          status: error.response.status,
          errorCode: error.response?.data?.error,
          torboxErrorCode: error.response?.data?.error,
          errorKind: error.isActiveDownloadLimit ? 'active_download_limit' : 'application_500',
          torboxDetail: appMessage,
          isActiveDownloadLimit: error.isActiveDownloadLimit || undefined,
        });
        throw error;
      }

      // Plan-restricted (403) — log as info so prod logs are not polluted
      const isPlanRestricted =
        error.response?.status === 403 && error.response?.data?.error === 'PLAN_RESTRICTED_FEATURE';
      if (isPlanRestricted) {
        error.isPlanRestrictedFeature = true;
        logger.info(`Error ${operation || 'in API call'}`, {
          endpoint,
          ...context,
          status: 403,
          errorCode: 'PLAN_RESTRICTED_FEATURE',
          torboxDetail: error.response?.data?.detail || error.message,
        });
      } else {
        logger.error(`Error ${operation || 'in API call'}`, error, {
          endpoint,
          ...context,
          status: error.response?.status,
          errorCode: error.response?.data?.error,
        });
      }
      throw error;
    }
  }

  // ============================================================================
  // Torrent Methods
  // ============================================================================

  /**
   * Load mylist + queued rows for an asset type.
   * @param {Object} options
   * @param {boolean} options.bypassCache
   * @param {string} options.mylistEndpoint
   * @param {string} options.queuedType
   * @param {string} options.logLabel
   * @param {(item: object, options?: { queued?: boolean }) => object} options.normalizeItem
   * @returns {Promise<object[]>}
   */
  async _fetchMyListWithQueued({
    bypassCache,
    mylistEndpoint,
    queuedType,
    logLabel,
    normalizeItem,
    forAutomationRules = false,
  }) {
    const fetchTimeout = Number.isFinite(DEFAULT_FETCH_TIMEOUT) ? DEFAULT_FETCH_TIMEOUT : 20000;
    const [myListResult, queuedResponse] = await Promise.all([
      fetchMyList({
        client: this.client,
        endpoint: mylistEndpoint,
        bypassCache,
        timeout: fetchTimeout,
        forAutomationRules,
      }),
      this.client.get('/api/queued/getqueued', {
        params: { type: queuedType, bypass_cache: bypassCache },
        timeout: fetchTimeout,
      }),
    ]);

    if (myListResult.pageCount > 1) {
      logger.debug(`Fetched paginated ${logLabel} mylist`, {
        pageCount: myListResult.pageCount,
        itemCount: myListResult.items.length,
      });
    }

    return mergeMyListWithQueued(myListResult.items, queuedResponse.data.data || [], normalizeItem);
  }

  async getTorrents(bypassCache = false, options = {}) {
    const { forAutomationRules = false } = options;
    return this.handleApiCall(
      async () => {
        const normalizeTorrent = (t, { queued = false } = {}) => ({
          ...t,
          active: normalizeActive(t.active),
          assetType: 'torrent',
          ...(queued ? { status: 'queued' } : {}),
        });

        return this._fetchMyListWithQueued({
          bypassCache,
          mylistEndpoint: '/api/torrents/mylist',
          queuedType: 'torrent',
          logLabel: 'torrent',
          normalizeItem: normalizeTorrent,
          forAutomationRules,
        });
      },
      {
        endpoint: '/api/torrents/mylist',
        operation: 'fetching torrents',
        semaphore: 'fetch',
        // No connectionErrorFallback: connection failures throw with error.isConnectionError = true
        // so UserPoller can skip shadow-state processing instead of treating an outage as "0 torrents".
        context: { bypassCache },
      }
    );
  }

  async controlTorrent(torrentId, operation) {
    return this.handleApiCall(
      async () => {
        const response = await this.client.post(
          '/api/torrents/controltorrent',
          {
            torrent_id: torrentId,
            operation: operation,
          },
          { timeout: DEFAULT_ACTION_TIMEOUT }
        );
        return response.data;
      },
      {
        endpoint: '/api/torrents/controltorrent',
        operation: 'controlling torrent',
        connectionErrorFallback: (error) =>
          this.buildConnectionErrorResponse(error, { torrentId, operation }),
        context: { torrentId, operation },
      }
    );
  }

  async controlQueuedTorrent(queuedId, operation) {
    return this.handleApiCall(
      async () => {
        const response = await this.client.post(
          '/api/queued/controlqueued',
          {
            queued_id: queuedId,
            operation: operation,
            type: 'torrent',
          },
          { timeout: DEFAULT_ACTION_TIMEOUT }
        );
        return response.data;
      },
      {
        endpoint: '/api/queued/controlqueued',
        operation: 'controlling queued torrent',
        connectionErrorFallback: (error) =>
          this.buildConnectionErrorResponse(error, { queuedId, operation }),
        context: { queuedId, operation },
      }
    );
  }

  async deleteTorrent(torrentId, options = {}) {
    const isQueued = options.isQueued;
    if (isQueued === undefined) {
      throw new Error(
        'deleteTorrent requires options.isQueued (true for queued, false for active). Callers must pass it explicitly.'
      );
    }
    return this.handleApiCall(
      async () => {
        if (isQueued) {
          const response = await this.client.post(
            '/api/queued/controlqueued',
            {
              queued_id: torrentId,
              operation: 'delete',
              type: 'torrent',
            },
            { timeout: DEFAULT_ACTION_TIMEOUT }
          );
          return response.data;
        } else {
          const response = await this.client.post(
            '/api/torrents/controltorrent',
            {
              torrent_id: torrentId,
              operation: 'delete',
            },
            { timeout: DEFAULT_ACTION_TIMEOUT }
          );
          return response.data;
        }
      },
      {
        endpoint: '/api/torrents/delete',
        operation: 'deleting torrent',
        connectionErrorFallback: (error) => this.buildConnectionErrorResponse(error, { torrentId }),
        context: { torrentId },
      }
    );
  }

  // ============================================================================
  // Download Methods
  // ============================================================================

  async getUsenetDownloads(bypassCache = false, options = {}) {
    const { forAutomationRules = false } = options;
    return this.handleApiCall(
      async () => {
        const normalizeUsenet = (t, { queued = false } = {}) => ({
          ...t,
          active: normalizeActive(t.active),
          ...(queued ? { status: 'queued' } : {}),
        });

        return this._fetchMyListWithQueued({
          bypassCache,
          mylistEndpoint: '/api/usenet/mylist',
          queuedType: 'usenet',
          logLabel: 'usenet',
          normalizeItem: normalizeUsenet,
          forAutomationRules,
        });
      },
      {
        endpoint: '/api/usenet/mylist',
        operation: 'fetching usenet downloads',
        semaphore: 'fetch',
        context: { bypassCache },
      }
    );
  }

  async getWebDownloads(bypassCache = false, options = {}) {
    const { forAutomationRules = false } = options;
    return this.handleApiCall(
      async () => {
        const normalizeWebdl = (t, { queued = false } = {}) => ({
          ...t,
          active: normalizeActive(t.active),
          ...(queued ? { status: 'queued' } : {}),
        });

        return this._fetchMyListWithQueued({
          bypassCache,
          mylistEndpoint: '/api/webdl/mylist',
          queuedType: 'webdl',
          logLabel: 'webdl',
          normalizeItem: normalizeWebdl,
          forAutomationRules,
        });
      },
      {
        endpoint: '/api/webdl/mylist',
        operation: 'fetching web downloads',
        semaphore: 'fetch',
        context: { bypassCache },
      }
    );
  }

  async controlQueuedDownload(queuedId, operation, type = 'torrent') {
    return this.handleApiCall(
      async () => {
        const response = await this.client.post(
          '/api/queued/controlqueued',
          {
            queued_id: queuedId,
            operation,
            type,
          },
          { timeout: DEFAULT_ACTION_TIMEOUT }
        );
        return response.data;
      },
      {
        endpoint: '/api/queued/controlqueued',
        operation: 'controlling queued download',
        connectionErrorFallback: (error) =>
          this.buildConnectionErrorResponse(error, { queuedId, operation, type }),
        context: { queuedId, operation, type },
      }
    );
  }

  async controlUsenetDownload(usenetId, operation) {
    return this.handleApiCall(
      async () => {
        const response = await this.client.post(
          '/api/usenet/controlusenetdownload',
          { usenet_id: usenetId, operation },
          { timeout: DEFAULT_ACTION_TIMEOUT }
        );
        return response.data;
      },
      {
        endpoint: '/api/usenet/controlusenetdownload',
        operation: 'controlling usenet download',
        connectionErrorFallback: (error) =>
          this.buildConnectionErrorResponse(error, { usenetId, operation }),
        context: { usenetId, operation },
      }
    );
  }

  async controlWebDownload(webdlId, operation) {
    return this.handleApiCall(
      async () => {
        const response = await this.client.post(
          '/api/webdl/controlwebdownload',
          { webdl_id: webdlId, operation },
          { timeout: DEFAULT_ACTION_TIMEOUT }
        );
        return response.data;
      },
      {
        endpoint: '/api/webdl/controlwebdownload',
        operation: 'controlling web download',
        connectionErrorFallback: (error) =>
          this.buildConnectionErrorResponse(error, { webdlId, operation }),
        context: { webdlId, operation },
      }
    );
  }

  /**
   * @param {Object} download - Item with id, assetType
   * @returns {Promise<*>}
   */
  async deleteDownload(download) {
    const assetType = download.assetType || 'torrent';
    const id = download.id;
    const isQueued = String(download.status).toLowerCase() === 'queued';

    if (assetType === 'usenet') {
      if (isQueued) {
        return this.controlQueuedDownload(id, 'delete', 'usenet');
      }
      return this.controlUsenetDownload(id, 'delete');
    }
    if (assetType === 'webdl') {
      if (isQueued) {
        return this.controlQueuedDownload(id, 'delete', 'webdl');
      }
      return this.controlWebDownload(id, 'delete');
    }
    return this.deleteTorrent(id, { isQueued });
  }

  async setAirlock(download, airlocked) {
    const assetType = normalizeAssetTypeForEdit(download);
    const listEndpoint = getAirlockListEndpoint(assetType);
    const { endpoint } = getAirlockEditConfig(assetType);
    const downloadId = download.id;

    return this.handleApiCall(
      async () => {
        const listResponse = await this.client.get(listEndpoint, {
          params: { id: downloadId, bypass_cache: true },
          timeout: DEFAULT_FETCH_TIMEOUT,
        });
        const currentItem = findDownloadInListData(listResponse.data, downloadId);
        if (!currentItem) {
          const notFoundError = new Error('Download not found');
          notFoundError.response = { status: 404, data: { error: 'Download not found' } };
          throw notFoundError;
        }

        const payload = buildAirlockEditPayload(
          { ...download, ...currentItem, id: currentItem.id ?? downloadId },
          airlocked
        );
        const response = await this.client.put(endpoint, payload, {
          timeout: DEFAULT_ACTION_TIMEOUT,
        });
        return response.data;
      },
      {
        endpoint,
        operation: airlocked ? 'adding airlock' : 'removing airlock',
        connectionErrorFallback: (error) =>
          this.buildConnectionErrorResponse(error, {
            downloadId: download.id,
            assetType,
            airlocked,
          }),
        context: {
          downloadId: download.id,
          assetType,
          airlocked,
          listEndpoint,
        },
      }
    );
  }

  // ============================================================================
  // Stats Methods
  // ============================================================================

  async getStats() {
    return this.handleApiCall(
      async () => {
        const response = await this.client.get('/api/stats');
        return response.data;
      },
      {
        endpoint: '/api/stats',
        operation: 'fetching stats',
        connectionErrorFallback: (error) => this.buildConnectionErrorResponse(error),
      }
    );
  }

  // ============================================================================
  // Health Check Methods
  // ============================================================================

  /**
   * Lightweight recovery / liveness probe (matches frontend /api/health/torbox).
   * Does not use handleApiCall, semaphores, or circuit breaker.
   * @returns {Promise<{ ok: boolean, kind?: 'auth'|'connection'|'api', status?: number, error?: string }>}
   */
  async probeUserMe() {
    try {
      const response = await this.client.get('/api/user/me', {
        timeout: RECOVERY_PROBE_TIMEOUT_MS,
      });
      const data = response.data ?? {};

      if (response.status >= 200 && response.status < 300 && data.success === true) {
        return { ok: true };
      }

      if (
        response.status === 401 ||
        response.status === 403 ||
        (data.error && AUTH_ERROR_CODES.includes(data.error))
      ) {
        return { ok: false, kind: 'auth', status: response.status, error: data.error };
      }

      return {
        ok: false,
        kind: 'api',
        status: response.status,
        error: data.error || data.detail,
      };
    } catch (error) {
      if (error.response && this.isAuthError(error)) {
        return {
          ok: false,
          kind: 'auth',
          status: error.response.status,
          error: error.response?.data?.error,
        };
      }
      if (this.isConnectionError(error)) {
        return { ok: false, kind: 'connection', error: error.code || error.message };
      }
      return { ok: false, kind: 'connection', error: error.message };
    }
  }

  async testConnection() {
    try {
      // Hit the root API endpoint for health check (Get Up Status)
      const response = await axios.get(this.baseURL, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'User-Agent': this.userAgent,
          'Content-Type': 'application/json',
        },
        timeout: DEFAULT_TIMEOUT,
      });
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('TorBox API connection test failed', error, {
        endpoint: this.baseURL,
      });
      return { success: false, error: error.message };
    }
  }

  async healthCheck() {
    const result = await this.testConnection();
    if (result.success) {
      return { status: 'healthy', apiKey: this.apiKey ? 'configured' : 'missing' };
    }
    return { status: 'unhealthy', error: result.error || 'Connection failed' };
  }
}

export default ApiClient;
