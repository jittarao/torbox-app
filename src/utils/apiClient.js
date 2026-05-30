import {
  API_BASE,
  API_VERSION,
  FETCH_TIMEOUT_MS,
  TORBOX_MANAGER_VERSION,
} from '@/config/apiConstants';

function parseRetryAfterMs(retryAfter) {
  if (!retryAfter) return null;
  const seconds = Number(retryAfter);
  if (!Number.isNaN(seconds)) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(retryAfter);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return null;
}

class ApiClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.etags = new Map();
    this.etagMaxSize = 100;
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      ...(apiKey && { 'x-api-key': apiKey }),
    };
  }

  /** Shared fetch core — handles timeout, response parsing, error normalization */
  async _fetch(url, options = {}) {
    const timeout = options.timeout || FETCH_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const { onResponse, ...fetchOptions } = options;
    const config = {
      ...fetchOptions,
      signal: options.signal || controller.signal,
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      if (onResponse) {
        onResponse(response);
      }

      if (response.status === 304) {
        return { success: true, notModified: true };
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        data = { error: `HTTP ${response.status}`, detail: 'Invalid response format' };
      }

      if (!response.ok) {
        if (
          data.error === 'AUTH_ERROR' ||
          data.error === 'NO_AUTH' ||
          data.error?.includes('auth')
        ) {
          throw new Error(`AUTH_ERROR: ${data.detail || 'Authentication required'}`);
        }

        if (response.status === 422) {
          throw new Error(
            `AUTH_ERROR: Provider not connected. Please connect to the cloud provider first.`
          );
        }

        if (response.status === 404) {
          throw new Error(`NOT_FOUND: ${data.detail || 'Resource not found'}`);
        }

        if (response.status === 429) {
          const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'));
          const rateLimitError = new Error(
            retryAfterMs
              ? `Rate limited. Retry after ${Math.ceil(retryAfterMs / 1000)}s`
              : 'Too many requests'
          );
          rateLimitError.isRateLimited = true;
          rateLimitError.retryAfterMs = retryAfterMs;
          throw rateLimitError;
        }

        if (response.status === 502 || response.status === 503) {
          const serviceError = new Error(
            data.detail || `TorBox API unavailable (HTTP ${response.status})`
          );
          serviceError.isServiceUnavailable = true;
          throw serviceError;
        }

        throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        const timeoutError = new Error('Request timeout');
        timeoutError.isTimeout = true;
        throw timeoutError;
      }

      if (error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || error.message?.includes('timeout')) {
        const timeoutError = new Error('Connection timeout - TorBox API is unreachable');
        timeoutError.isTimeout = true;
        throw timeoutError;
      }

      if (!error.isRateLimited) {
        console.error(`API request failed for ${url}:`, error);
      }
      throw error;
    }
  }

  /** Generic request with JSON headers and ETag support */
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('/api/') ? endpoint : `${API_BASE}/${API_VERSION}${endpoint}`;

    const headers = {
      ...this.baseHeaders,
      ...options.headers,
    };

    const etag = this.etags.get(endpoint);
    if (etag) {
      headers['If-None-Match'] = etag;
    }

    let responseForEtag = null;
    const data = await this._fetch(url, {
      ...options,
      headers,
      onResponse: (res) => {
        responseForEtag = res;
      },
    });

    if (data?.notModified) {
      return data;
    }

    const responseETag = responseForEtag?.headers?.get?.('ETag');
    if (responseETag) {
      if (!this.etags.has(endpoint) && this.etags.size >= this.etagMaxSize) {
        const oldest = this.etags.keys().next().value;
        if (oldest !== undefined) this.etags.delete(oldest);
      }
      this.etags.set(endpoint, responseETag);
    }

    return data;
  }

  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;

    return this.request(url, { method: 'GET' });
  }

  async post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async delete(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      body: JSON.stringify(body),
    });
  }

  async getNotifications() {
    try {
      return await this.get('/api/notifications');
    } catch (error) {
      return {
        success: false,
        error: error.message,
        isRateLimited: error.isRateLimited,
        retryAfterMs: error.retryAfterMs,
      };
    }
  }

  async clearAllNotifications() {
    try {
      return await this.post('/api/notifications', { action: 'clear_all' });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async clearNotification(notificationId) {
    try {
      return await this.post(`/api/notifications/clear/${notificationId}`);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testNotification() {
    try {
      return await this.post('/api/notifications', { action: 'test' });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getIntegrationJobs() {
    return this.get('/api/integration/jobs');
  }

  async addToGoogleDrive(data) {
    return this.post('/api/integration/googledrive', data);
  }

  async addToDropbox(data) {
    return this.post('/api/integration/dropbox', data);
  }

  async addToOneDrive(data) {
    return this.post('/api/integration/onedrive', data);
  }

  async addToGofile(data) {
    return this.post('/api/integration/gofile', data);
  }

  async addTo1Fichier(data) {
    return this.post('/api/integration/1fichier', data);
  }

  async addToPixeldrain(data) {
    return this.post('/api/integration/pixeldrain', data);
  }
}

export const createApiClient = (apiKey) => new ApiClient(apiKey);
