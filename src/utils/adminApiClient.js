/**
 * Admin API Client
 * Handles all admin API requests to the backend
 */

// Get backend URL - try environment variable first, then detect from window location
const getBackendUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side: try to detect backend from current location
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    }
    // In production/Docker, backend might be on same host
    return process.env.NEXT_PUBLIC_BACKEND_URL || `http://${hostname}:3001`;
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
};

const BACKEND_URL = getBackendUrl();

class AdminApiClient {
  constructor() {
    this.baseUrl = `${BACKEND_URL}/api/admin`;
    this.adminKey = null;
  }

  /**
   * Set admin API key
   */
  setAdminKey(key) {
    this.adminKey = key;
    if (typeof window !== 'undefined') {
      localStorage.setItem('adminKey', key);
    }
  }

  /**
   * Get admin API key from localStorage
   */
  getAdminKey() {
    if (this.adminKey) {
      return this.adminKey;
    }
    if (typeof window !== 'undefined') {
      return localStorage.getItem('adminKey');
    }
    return null;
  }

  /**
   * Clear admin key
   */
  clearAdminKey() {
    this.adminKey = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('adminKey');
    }
  }

  /**
   * Make authenticated request
   */
  async request(endpoint, options = {}) {
    const adminKey = this.getAdminKey();
    if (!adminKey) {
      throw new Error('Admin key not set');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      if (error.message.includes('Admin key not set')) {
        throw error;
      }
      throw new Error(error.message || 'Request failed');
    }
  }

  // ===== Authentication =====

  async authenticate(adminKey) {
    this.setAdminKey(adminKey);
    return this.request('/auth', { method: 'POST' });
  }

  async verify() {
    return this.request('/verify');
  }

  // ===== User Management =====

  async getUsers(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.status) queryParams.append('status', params.status);
    if (params.search) queryParams.append('search', params.search);

    const query = queryParams.toString();
    return this.request(`/users${query ? `?${query}` : ''}`);
  }

  async getUser(authId) {
    return this.request(`/users/${authId}`);
  }

  async deleteUser(authId) {
    return this.request(`/users/${authId}`, { method: 'DELETE' });
  }

  async updateUserStatus(authId, status) {
    return this.request(`/users/${authId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async getUserDatabase(authId) {
    return this.request(`/users/${authId}/database`);
  }

  async getUserAutomation(authId) {
    return this.request(`/users/${authId}/automation`);
  }

  // ===== System Metrics =====

  async getOverviewMetrics() {
    return this.request('/metrics/overview');
  }

  async getDatabaseMetrics() {
    return this.request('/metrics/database');
  }

  async getPollingMetrics() {
    return this.request('/metrics/polling');
  }

  async getAutomationMetrics() {
    return this.request('/metrics/automation');
  }

  async getPerformanceMetrics() {
    return this.request('/metrics/performance');
  }

  // ===== Database Management =====

  async getDatabases() {
    return this.request('/databases');
  }

  async getPoolStats() {
    return this.request('/databases/pool');
  }

  async backupDatabase(authId) {
    return this.request(`/databases/${authId}/backup`, { method: 'POST' });
  }

  async listBackups(authId) {
    return this.request(`/databases/${authId}/backups`);
  }

  async downloadBackup(authId, filename) {
    const adminKey = this.getAdminKey();
    if (!adminKey) {
      throw new Error('Admin key not set');
    }

    // Get backend URL
    const getBackendUrl = () => {
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        }
        return process.env.NEXT_PUBLIC_BACKEND_URL || `http://${hostname}:3001`;
      }
      return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    };

    const backendUrl = getBackendUrl();
    const downloadUrl = `${backendUrl}/api/admin/databases/${authId}/backup/${filename}?adminKey=${encodeURIComponent(adminKey)}`;

    // Return URL for download
    return downloadUrl;
  }

  async vacuumDatabase(authId) {
    return this.request(`/databases/${authId}/vacuum`, { method: 'POST' });
  }

  async getMasterDatabaseStats() {
    return this.request('/databases/master/stats');
  }

  // ===== Automation Monitoring =====

  async getAutomationRules() {
    return this.request('/automation/rules');
  }

  async getAutomationExecutions(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.authId) queryParams.append('authId', params.authId);
    if (params.success !== undefined) queryParams.append('success', params.success);

    const query = queryParams.toString();
    return this.request(`/automation/executions${query ? `?${query}` : ''}`);
  }

  async getAutomationErrors(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit);

    const query = queryParams.toString();
    return this.request(`/automation/errors${query ? `?${query}` : ''}`);
  }

  async getAutomationStats() {
    return this.request('/automation/stats');
  }

  // ===== System Configuration =====

  async getConfig() {
    return this.request('/config');
  }

  // ===== Logs =====

  async getLogs(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.container) queryParams.append('container', params.container);
    if (params.tail) queryParams.append('tail', params.tail);
    if (params.since) queryParams.append('since', params.since);

    const query = queryParams.toString();
    return this.request(`/logs${query ? `?${query}` : ''}`);
  }

  async getErrorLogs(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.container) queryParams.append('container', params.container);
    if (params.tail) queryParams.append('tail', params.tail);

    const query = queryParams.toString();
    return this.request(`/logs/errors${query ? `?${query}` : ''}`);
  }

  /**
   * Stream logs using Server-Sent Events
   * @param {Object} params - Stream parameters
   * @param {Function} onMessage - Callback for log messages
   * @param {Function} onError - Callback for errors
   * @returns {Function} Cleanup function to stop streaming
   */
  streamLogs(params = {}, onMessage, onError) {
    const adminKey = this.getAdminKey();
    if (!adminKey) {
      throw new Error('Admin key not set');
    }

    const queryParams = new URLSearchParams();
    queryParams.append('adminKey', adminKey); // Pass via query param for SSE
    if (params.container) queryParams.append('container', params.container);
    if (params.tail) queryParams.append('tail', params.tail);
    const query = queryParams.toString();

    // Use Next.js API route as proxy for SSE (EventSource doesn't support custom headers)
    const url = `/api/admin/logs/stream?${query}`;
    
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage) {
          onMessage(data);
        }
      } catch (error) {
        if (onError) {
          onError(error);
        }
      }
    };

    eventSource.onerror = (error) => {
      if (onError) {
        onError(error);
      }
      eventSource.close();
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }
}

// Export singleton instance
const adminApiClient = new AdminApiClient();
export default adminApiClient;
