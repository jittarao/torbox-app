import axios from 'axios';
import logger from '../utils/logger.js';

// Constants
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_BASE_URL = 'https://api.torbox.app';
const DEFAULT_API_VERSION = 'v1';
const DEFAULT_PACKAGE_VERSION = '0.1.0';

const AUTH_ERROR_CODES = ['AUTH_ERROR', 'NO_AUTH', 'BAD_TOKEN'];
const CONNECTION_ERROR_CODES = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];
const CONNECTION_ERROR_MESSAGES = ['Network Error', 'timeout'];
const SERVER_ERROR_MESSAGES = ['disconnected', 'connection'];

class ApiClient {
  constructor(apiKey) {
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
        'Authorization': `Bearer ${this.apiKey}`,
        'User-Agent': this.userAgent,
        'Content-Type': 'application/json'
      },
      timeout: DEFAULT_TIMEOUT
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
      return CONNECTION_ERROR_CODES.includes(error.code) ||
             CONNECTION_ERROR_MESSAGES.some(msg => error.message?.includes(msg));
    }
    
    // Check for server errors (5xx)
    if (error.response.status >= 500) {
      const data = error.response.data;
      // Check for specific server error messages
      if (data && (
        data.data === 'Server disconnected' ||
        data.error === 'UNKNOWN_ERROR' ||
        SERVER_ERROR_MESSAGES.some(msg => data.detail?.includes(msg))
      )) {
        return true;
      }
      return true; // All 5xx errors are considered server errors
    }
    
    return false;
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
      message: error.response?.data?.data || 
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
   * @param {Function|*} options.connectionErrorFallback - Function(error) or value to return on connection errors (default: throws)
   * @param {Object} options.context - Additional context for error logging
   * @returns {Promise<*>} - Result of the API call or fallback value
   */
  async handleApiCall(apiCall, options = {}) {
    const {
      endpoint,
      operation,
      connectionErrorFallback = null,
      context = {}
    } = options;

    try {
      return await apiCall();
    } catch (error) {
      // Handle authentication errors
      if (this.isAuthError(error)) {
        const authError = this.createAuthError(error);
        logger.error(`Authentication error ${operation || 'in API call'}`, authError, {
          endpoint,
          ...context,
          status: authError.status,
          errorCode: error.response?.data?.error,
        });
        throw authError;
      }
      
      // Handle connection/server errors
      if (this.isConnectionError(error)) {
        const errorDetails = this.buildErrorDetails(error, { endpoint, ...context });
        const logMessage = connectionErrorFallback !== null
          ? `TorBox API connection error ${operation || 'in API call'} - handling gracefully`
          : `TorBox API connection error ${operation || 'in API call'}`;
        
        logger.warn(logMessage, {
          ...errorDetails,
          message: connectionErrorFallback !== null
            ? 'TorBox API is down or not responding. Operation skipped.'
            : 'TorBox API connection failed.',
        });
        
        // Return fallback value if provided (function or value)
        if (connectionErrorFallback !== null) {
          return typeof connectionErrorFallback === 'function'
            ? connectionErrorFallback(error)
            : connectionErrorFallback;
        }
        
        throw error;
      }
      
      // Handle other errors
      logger.error(`Error ${operation || 'in API call'}`, error, {
        endpoint,
        ...context,
        status: error.response?.status,
        errorCode: error.response?.data?.error,
      });
      throw error;
    }
  }

  // ============================================================================
  // Torrent Methods
  // ============================================================================

  async getTorrents(bypassCache = false) {
    return this.handleApiCall(
      async () => {
        const [torrentsResponse, queuedResponse] = await Promise.all([
          this.client.get('/api/torrents/mylist', {
            params: { bypass_cache: bypassCache }
          }),
          this.client.get('/api/queued/getqueued', {
            params: { 
              type: 'torrent',
              bypass_cache: bypassCache 
            }
          })
        ]);

        const torrents = torrentsResponse.data.data || [];
        const queued = queuedResponse.data.data || [];
        
        return [...torrents, ...queued];
      },
      {
        endpoint: '/api/torrents/mylist',
        operation: 'fetching torrents',
        connectionErrorFallback: [],
        context: { bypassCache }
      }
    );
  }

  async controlTorrent(torrentId, operation) {
    return this.handleApiCall(
      async () => {
        const response = await this.client.post('/api/torrents/controltorrent', {
          torrent_id: torrentId,
          operation: operation
        });
        return response.data;
      },
      {
        endpoint: '/api/torrents/controltorrent',
        operation: 'controlling torrent',
        connectionErrorFallback: (error) => this.buildConnectionErrorResponse(error, { torrentId, operation }),
        context: { torrentId, operation }
      }
    );
  }

  async controlQueuedTorrent(queuedId, operation) {
    return this.handleApiCall(
      async () => {
        const response = await this.client.post('/api/queued/controlqueued', {
          queued_id: queuedId,
          operation: operation,
          type: 'torrent'
        });
        return response.data;
      },
      {
        endpoint: '/api/queued/controlqueued',
        operation: 'controlling queued torrent',
        connectionErrorFallback: (error) => this.buildConnectionErrorResponse(error, { queuedId, operation }),
        context: { queuedId, operation }
      }
    );
  }

  async deleteTorrent(torrentId, options = {}) {
    return this.handleApiCall(
      async () => {
        let isQueued = options.isQueued;
        if (isQueued === undefined) {
          // Caller did not pass isQueued — fetch and derive (backward compatible)
          const torrents = await this.getTorrents();
          isQueued = torrents.some(t => t.id === torrentId && !t.download_state);
        }
        if (isQueued) {
          return await this.controlQueuedTorrent(torrentId, 'delete');
        } else {
          return await this.controlTorrent(torrentId, 'delete');
        }
      },
      {
        endpoint: '/api/torrents/delete',
        operation: 'deleting torrent',
        connectionErrorFallback: (error) => this.buildConnectionErrorResponse(error, { torrentId }),
        context: { torrentId }
      }
    );
  }

  // ============================================================================
  // Download Methods
  // ============================================================================

  async getUsenetDownloads(bypassCache = false) {
    return this.handleApiCall(
      async () => {
        const response = await this.client.get('/api/usenet/mylist', {
          params: { bypass_cache: bypassCache }
        });
        return response.data.data || [];
      },
      {
        endpoint: '/api/usenet/mylist',
        operation: 'fetching usenet downloads',
        connectionErrorFallback: [],
        context: { bypassCache }
      }
    );
  }

  async getWebDownloads(bypassCache = false) {
    return this.handleApiCall(
      async () => {
        const response = await this.client.get('/api/webdl/mylist', {
          params: { bypass_cache: bypassCache }
        });
        return response.data.data || [];
      },
      {
        endpoint: '/api/webdl/mylist',
        operation: 'fetching web downloads',
        connectionErrorFallback: [],
        context: { bypassCache }
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
        connectionErrorFallback: (error) => this.buildConnectionErrorResponse(error)
      }
    );
  }

  // ============================================================================
  // Health Check Methods
  // ============================================================================

  async testConnection() {
    try {
      // Hit the root API endpoint for health check (Get Up Status)
      const response = await axios.get(this.baseURL, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': this.userAgent,
          'Content-Type': 'application/json'
        },
        timeout: DEFAULT_TIMEOUT
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
    try {
      await this.testConnection();
      return { status: 'healthy', apiKey: this.apiKey ? 'configured' : 'missing' };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}

export default ApiClient;
