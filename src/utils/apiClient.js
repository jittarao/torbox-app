import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';

class ApiClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      ...(apiKey && { 'x-api-key': apiKey }),
    };
  }

  // Generic request method with error handling
  async request(endpoint, options = {}) {
    // For client-side requests, use relative URLs to go through Next.js API routes
    const url = endpoint.startsWith('/api/') ? endpoint : `${API_BASE}/${API_VERSION}${endpoint}`;
    const config = {
      headers: {
        ...this.baseHeaders,
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // GET request helper
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    
    return this.request(url, { method: 'GET' });
  }

  // POST request helper
  async post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // DELETE request helper
  async delete(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      body: JSON.stringify(body),
    });
  }

  // PUT request helper
  async put(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // Torrents API methods
  async getTorrents(bypassCache = false) {
    return this.get('/api/torrents/mylist', { bypass_cache: bypassCache });
  }

  async getQueuedTorrents(bypassCache = false) {
    return this.get('/api/queued/getqueued', { 
      type: 'torrent',
      bypass_cache: bypassCache 
    });
  }

  async createTorrent(formData) {
    const response = await fetch('/api/torrents', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
      },
      body: formData,
    });
    return response.json();
  }

  async controlTorrent(torrentId, operation) {
    return this.post('/api/torrents/controltorrent', {
      torrent_id: torrentId,
      operation,
    });
  }

  async controlQueuedTorrent(queuedId, operation) {
    return this.post('/api/queued/controlqueued', {
      queued_id: queuedId,
      operation,
      type: 'torrent',
    });
  }

  async exportTorrentData(torrentId, type) {
    return this.get('/api/torrents/exportdata', {
      torrent_id: torrentId,
      type,
    });
  }

  async checkCachedTorrents(hashes, format = 'object', listFiles = false) {
    const hashParam = Array.isArray(hashes) ? hashes.join(',') : hashes;
    return this.get('/api/torrents/checkcached', {
      hash: hashParam,
      format,
      list_files: listFiles,
    });
  }

  async getTorrentInfo(hash, timeout = 10) {
    return this.get('/api/torrents/torrentinfo', {
      hash,
      timeout,
    });
  }

  // Usenet API methods
  async getUsenetDownloads(bypassCache = false) {
    return this.get('/api/usenet/mylist', { bypass_cache: bypassCache });
  }

  async getQueuedUsenet(bypassCache = false) {
    return this.get('/api/queued/getqueued', { 
      type: 'usenet',
      bypass_cache: bypassCache 
    });
  }

  async createUsenetDownload(formData) {
    const response = await fetch('/api/usenet', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
      },
      body: formData,
    });
    return response.json();
  }

  async controlUsenetDownload(usenetId, operation) {
    return this.post('/api/usenet/controlusenetdownload', {
      usenet_id: usenetId,
      operation,
    });
  }

  // Web Downloads API methods
  async getWebDownloads(bypassCache = false) {
    return this.get('/api/webdl/mylist', { bypass_cache: bypassCache });
  }

  async getQueuedWebDownloads(bypassCache = false) {
    return this.get('/api/queued/getqueued', { 
      type: 'webdl',
      bypass_cache: bypassCache 
    });
  }

  async createWebDownload(formData) {
    const response = await fetch('/api/webdl', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
      },
      body: formData,
    });
    return response.json();
  }

  async controlWebDownload(webdlId, operation) {
    return this.post('/api/webdl/controlwebdownload', {
      webdl_id: webdlId,
      operation,
    });
  }

  // Notifications API methods
  async getNotifications() {
    try {
      const response = await this.get('/api/notifications');
      // Return the response directly without wrapping it in a data property
      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async clearAllNotifications() {
    try {
      const response = await this.post('/api/notifications', { action: 'clear_all' });
      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async clearNotification(notificationId) {
    try {
      const response = await this.post(`/api/notifications/clear/${notificationId}`);
      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testNotification() {
    try {
      const response = await this.post('/api/notifications', { action: 'test' });
      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // RSS API methods
  async getRssFeeds() {
    return this.get('/api/rss/getfeeds');
  }

  async addRssFeed(feedData) {
    return this.post('/api/rss/addrss', feedData);
  }

  async modifyRssFeed(feedData) {
    return this.post('/api/rss/modifyrss', feedData);
  }

  async controlRssFeed(feedId, operation) {
    return this.post('/api/rss/controlrss', {
      feed_id: feedId,
      operation,
    });
  }

  async getRssFeedItems(feedId, offset = 0, limit = 100) {
    return this.get('/api/rss/getfeeditems', {
      feed_id: feedId,
      offset,
      limit,
    });
  }

  // User API methods
  async getUserProfile() {
    return this.get('/api/user/me');
  }

  async getSubscriptions() {
    return this.get('/api/user/subscriptions');
  }

  async getTransactions() {
    return this.get('/api/user/transactions');
  }

  async getReferralData() {
    return this.get('/api/user/referraldata');
  }

  async addReferral(referralCode) {
    return this.post('/api/user/addreferral', { referral_code: referralCode });
  }

  // Search Engine API methods
  async getSearchEngines() {
    return this.get('/api/user/settings/searchengines');
  }

  async addSearchEngine(engineData) {
    return this.put('/api/user/settings/addsearchengines', engineData);
  }

  async modifySearchEngine(engineData) {
    return this.post('/api/user/settings/modifysearchengines', engineData);
  }

  async controlSearchEngine(engineId, operation) {
    return this.post('/api/user/settings/controlsearchengines', {
      engine_id: engineId,
      operation,
    });
  }

  // Statistics API methods
  async getStats() {
    return this.get('/api/stats');
  }

  async getStats30Days() {
    return this.get('/api/stats/30days');
  }

  async getSpeedtestFiles() {
    return this.get('/api/speedtest');
  }

  // Health check
  async getHealth() {
    return this.get('/');
  }

  // Integration API methods
  async getIntegrationJobs() {
    return this.get('/api/integration/jobs');
  }

  async getIntegrationJobByHash(hash) {
    return this.get(`/api/integration/jobs/${hash}`);
  }

  async cancelIntegrationJob(jobId) {
    return this.delete(`/api/integration/job/${jobId}`);
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

// Factory function to create API client
export const createApiClient = (apiKey) => {
  return new ApiClient(apiKey);
};

// Default export for backward compatibility
export default ApiClient;
