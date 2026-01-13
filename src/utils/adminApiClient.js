/**
 * Admin API Client
 * Handles all admin API requests through Next.js API routes
 * Next.js routes proxy to the backend server
 */

class AdminApiClient {
  constructor() {
    // Use Next.js API routes instead of direct backend calls
    this.baseUrl = '/api/admin';
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

    const downloadUrl = `/api/admin/databases/${authId}/backup/${filename}?adminKey=${encodeURIComponent(adminKey)}`;

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
}

// Export singleton instance
const adminApiClient = new AdminApiClient();
export default adminApiClient;
