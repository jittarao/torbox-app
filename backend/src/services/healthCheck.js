import fs from 'fs';
import ApiClient from '../api/ApiClient.js';
import torboxApiOutageCoordinator from '../api/TorboxApiOutageCoordinator.js';
import { decrypt } from '../utils/crypto.js';
import logger from '../utils/logger.js';

/**
 * Health check service
 */
export class HealthCheckService {
  constructor(masterDatabase, automationEngines, pollingScheduler) {
    this.masterDatabase = masterDatabase;
    this.automationEngines = automationEngines;
    this.pollingScheduler = pollingScheduler;
  }

  /**
   * Check database health
   */
  async checkDatabase() {
    try {
      if (!this.masterDatabase || !this.masterDatabase.db) {
        return { status: 'unhealthy', error: 'Database not initialized' };
      }

      // Test database connection with a simple query
      const startTime = Date.now();
      const result = this.masterDatabase.db.prepare('SELECT 1 as test').get();
      const responseTime = Date.now() - startTime;

      if (result && result.test === 1) {
        // Get database file size if possible
        let dbSize = null;
        try {
          const dbPath = this.masterDatabase.dbPath;
          const stats = fs.statSync(dbPath);
          dbSize = stats.size;
        } catch (e) {
          // Ignore errors getting file size
        }

        return {
          status: 'healthy',
          responseTime: `${responseTime}ms`,
          dbSize: dbSize ? `${(dbSize / 1024 / 1024).toFixed(2)} MB` : null,
        };
      } else {
        return {
          status: 'unhealthy',
          error: 'Database query returned unexpected result',
        };
      }
    } catch (error) {
      logger.error('Database health check failed', error);
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * Check TorBox API health
   */
  async checkTorBoxAPI() {
    try {
      const outage = torboxApiOutageCoordinator.getSnapshot();

      if (outage.automationPaused) {
        return {
          status: 'unhealthy',
          message: `TorBox API automation paused (${outage.pauseReason || 'outage'})`,
          tested: true,
          automationPaused: true,
          torboxApi: outage,
        };
      }

      const activeUsers = this.masterDatabase ? this.masterDatabase.getActiveUsers() : [];

      if (activeUsers.length === 0) {
        return {
          status: 'not_configured',
          message: 'No active users to test API connection',
          torboxApi: outage,
        };
      }

      let apiClient = null;
      if (this.pollingScheduler?.cachedApiClients?.size > 0) {
        apiClient = this.pollingScheduler.cachedApiClients.values().next().value;
      }

      if (!apiClient) {
        const probeUser = activeUsers.find((u) => u.encrypted_key);
        if (probeUser?.encrypted_key) {
          try {
            apiClient = new ApiClient(decrypt(probeUser.encrypted_key), {
              authId: probeUser.auth_id,
            });
          } catch (decryptError) {
            logger.warn('Health check: could not decrypt probe API key', {
              errorMessage: decryptError.message,
            });
          }
        }
      }

      if (apiClient) {
        try {
          const startTime = Date.now();
          const probeResult = await apiClient.probeUserMe();
          const responseTime = Date.now() - startTime;

          if (probeResult.ok) {
            return {
              status: 'healthy',
              message: `API connection successful (${activeUsers.length} active user(s))`,
              activeUsers: activeUsers.length,
              responseTime: `${responseTime}ms`,
              tested: true,
              probe: 'user/me',
              torboxApi: outage,
            };
          }
          return {
            status: 'unhealthy',
            message: `API probe failed (${probeResult.kind || 'unknown'})`,
            activeUsers: activeUsers.length,
            tested: true,
            probe: 'user/me',
            error: probeResult.error,
            torboxApi: outage,
          };
        } catch (testError) {
          logger.warn('Failed to probe API during health check', testError);
          return {
            status: 'configured',
            message: `${activeUsers.length} active user(s) registered, but API probe failed`,
            activeUsers: activeUsers.length,
            tested: false,
            testError: testError.message,
            torboxApi: outage,
          };
        }
      }

      return {
        status: 'configured',
        message: `${activeUsers.length} active user(s) registered`,
        activeUsers: activeUsers.length,
        tested: false,
        torboxApi: outage,
      };
    } catch (error) {
      logger.error('TorBox API health check failed', error);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`,
      arrayBuffers: `${(usage.arrayBuffers / 1024 / 1024).toFixed(2)} MB`,
    };
  }

  /**
   * Get system information
   */
  getSystemInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: `${Math.floor(process.uptime())}s`,
      uptimeFormatted: this.formatUptime(process.uptime()),
      cpuUsage: process.cpuUsage
        ? {
            user: `${(process.cpuUsage().user / 1000).toFixed(2)}ms`,
            system: `${(process.cpuUsage().system / 1000).toFixed(2)}ms`,
          }
        : null,
    };
  }

  /**
   * Format uptime in human-readable format
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Get detailed health status
   */
  async getDetailedHealth(userDatabaseManager) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.1.0',
        uptime: process.uptime(),
        database: await this.checkDatabase(),
        api: await this.checkTorBoxAPI(),
        pollers: this.pollingScheduler ? this.pollingScheduler.getStatus() : null,
        torboxApi: torboxApiOutageCoordinator.getSnapshot(),
        memory: this.getMemoryUsage(),
        system: this.getSystemInfo(),
        services: {
          masterDatabase: this.masterDatabase ? 'initialized' : 'not initialized',
          userDatabaseManager: userDatabaseManager ? 'initialized' : 'not initialized',
          pollingScheduler: this.pollingScheduler ? 'running' : 'not running',
        },
        connectionPool: userDatabaseManager ? userDatabaseManager.getPoolStats() : null,
      };

      // Determine overall status
      const hasErrors =
        health.database.status !== 'healthy' ||
        (health.api && health.api.status === 'unhealthy') ||
        (health.connectionPool && ['critical', 'emergency'].includes(health.connectionPool.status));

      if (hasErrors) {
        health.status = 'degraded';
      } else if (health.api && health.api.status === 'not_configured') {
        // If API is not configured but everything else is healthy, status is still healthy
        // (not_configured is not an error, just informational)
      } else if (health.connectionPool && health.connectionPool.status === 'warning') {
        // Pool warning doesn't degrade overall health, but indicates potential issue
      }

      return health;
    } catch (error) {
      logger.error('Error in detailed health check', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}
