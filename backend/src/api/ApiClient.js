import axios from 'axios';
import logger from '../utils/logger.js';

class ApiClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = process.env.TORBOX_API_BASE || 'https://api.torbox.app';
    this.apiVersion = process.env.TORBOX_API_VERSION || 'v1';
    this.userAgent = `TorBoxManager-Backend/${process.env.npm_package_version || '0.1.0'}`;
    
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
      timeout: 30000 // 30 second timeout
    });
  }

  // Method to update API key dynamically
  updateApiKey(newApiKey) {
    this.apiKey = newApiKey;
    this.client.defaults.headers['Authorization'] = `Bearer ${newApiKey}`;
  }

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
    
    // Check for 403 status with AUTH_ERROR
    if (status === 403 && data && (data.error === 'AUTH_ERROR' || data.error === 'NO_AUTH' || data.error === 'BAD_TOKEN')) {
      return true;
    }
    
    // Check for 401 status (unauthorized)
    if (status === 401) {
      return true;
    }
    
    return false;
  }

  /**
   * Create a custom authentication error
   * @param {Error} originalError - Original axios error
   * @returns {Error} - Custom authentication error
   */
  createAuthError(originalError) {
    const error = new Error(originalError.response?.data?.detail || originalError.response?.data?.error || 'Authentication failed');
    error.name = 'AuthenticationError';
    error.status = originalError.response?.status || 403;
    error.responseData = originalError.response?.data;
    error.isAuthError = true;
    return error;
  }

  async getTorrents(bypassCache = false) {
    try {
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
    } catch (error) {
      // Check if this is an authentication error
      if (this.isAuthError(error)) {
        const authError = this.createAuthError(error);
        logger.error('Authentication error fetching torrents', authError, {
          endpoint: '/api/torrents/mylist',
          bypassCache,
          status: authError.status,
          errorCode: error.response?.data?.error,
        });
        throw authError;
      }
      
      logger.error('Error fetching torrents', error, {
        endpoint: '/api/torrents/mylist',
        bypassCache,
      });
      throw error;
    }
  }

  async controlTorrent(torrentId, operation) {
    try {
      const response = await this.client.post('/api/torrents/controltorrent', {
        torrent_id: torrentId,
        operation: operation
      });
      return response.data;
    } catch (error) {
      if (this.isAuthError(error)) {
        const authError = this.createAuthError(error);
        logger.error('Authentication error controlling torrent', authError, {
          endpoint: '/api/torrents/controltorrent',
          torrentId,
          operation,
          status: authError.status,
          errorCode: error.response?.data?.error,
        });
        throw authError;
      }
      logger.error('Error controlling torrent', error, {
        endpoint: '/api/torrents/controltorrent',
        torrentId,
        operation,
      });
      throw error;
    }
  }

  async controlQueuedTorrent(queuedId, operation) {
    try {
      const response = await this.client.post('/api/queued/controlqueued', {
        queued_id: queuedId,
        operation: operation,
        type: 'torrent'
      });
      return response.data;
    } catch (error) {
      if (this.isAuthError(error)) {
        const authError = this.createAuthError(error);
        logger.error('Authentication error controlling queued torrent', authError, {
          endpoint: '/api/queued/controlqueued',
          queuedId,
          operation,
          status: authError.status,
          errorCode: error.response?.data?.error,
        });
        throw authError;
      }
      logger.error('Error controlling queued torrent', error, {
        endpoint: '/api/queued/controlqueued',
        queuedId,
        operation,
      });
      throw error;
    }
  }

  async deleteTorrent(torrentId) {
    try {
      // First check if it's queued or active
      const torrents = await this.getTorrents();
      const isQueued = torrents.some(t => t.id === torrentId && !t.download_state);
      
      if (isQueued) {
        return await this.controlQueuedTorrent(torrentId, 'delete');
      } else {
        return await this.controlTorrent(torrentId, 'delete');
      }
    } catch (error) {
      logger.error('Error deleting torrent', error, {
        torrentId,
      });
      throw error;
    }
  }

  async getUsenetDownloads(bypassCache = false) {
    try {
      const response = await this.client.get('/api/usenet/mylist', {
        params: { bypass_cache: bypassCache }
      });
      return response.data.data || [];
    } catch (error) {
      if (this.isAuthError(error)) {
        const authError = this.createAuthError(error);
        logger.error('Authentication error fetching usenet downloads', authError, {
          endpoint: '/api/usenet/mylist',
          bypassCache,
          status: authError.status,
          errorCode: error.response?.data?.error,
        });
        throw authError;
      }
      logger.error('Error fetching usenet downloads', error, {
        endpoint: '/api/usenet/mylist',
        bypassCache,
      });
      throw error;
    }
  }

  async getWebDownloads(bypassCache = false) {
    try {
      const response = await this.client.get('/api/webdl/mylist', {
        params: { bypass_cache: bypassCache }
      });
      return response.data.data || [];
    } catch (error) {
      if (this.isAuthError(error)) {
        const authError = this.createAuthError(error);
        logger.error('Authentication error fetching web downloads', authError, {
          endpoint: '/api/webdl/mylist',
          bypassCache,
          status: authError.status,
          errorCode: error.response?.data?.error,
        });
        throw authError;
      }
      logger.error('Error fetching web downloads', error, {
        endpoint: '/api/webdl/mylist',
        bypassCache,
      });
      throw error;
    }
  }

  async getStats() {
    try {
      const response = await this.client.get('/api/stats');
      return response.data;
    } catch (error) {
      if (this.isAuthError(error)) {
        const authError = this.createAuthError(error);
        logger.error('Authentication error fetching stats', authError, {
          endpoint: '/api/stats',
          status: authError.status,
          errorCode: error.response?.data?.error,
        });
        throw authError;
      }
      logger.error('Error fetching stats', error, {
        endpoint: '/api/stats',
      });
      throw error;
    }
  }

  async testConnection() {
    try {
      // Hit the root API endpoint for health check (Get Up Status)
      const response = await axios.get(this.baseURL, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': this.userAgent,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('TorBox API connection test failed', error, {
        endpoint: this.baseURL,
      });
      return { success: false, error: error.message };
    }
  }

  // Health check method
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
