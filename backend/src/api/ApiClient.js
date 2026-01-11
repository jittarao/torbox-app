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
