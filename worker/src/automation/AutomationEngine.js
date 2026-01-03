import axios from 'axios';
import { decrypt } from '../../../src/database/encryption.js';
import SnapshotManager from '../poller/SnapshotManager.js';

class AutomationEngine {
  constructor(database) {
    this.database = database;
    this.snapshotManager = new SnapshotManager(database);
    this.isInitialized = false;
    
    this.baseURL = process.env.TORBOX_API_BASE || 'https://api.torbox.app';
    this.apiVersion = process.env.TORBOX_API_VERSION || 'v1';
    this.userAgent = `TorBoxManager-Worker/${process.env.npm_package_version || '0.1.0'}`;
  }

  async initialize() {
    try {
      console.log('🔄 Initializing automation engine...');
      this.isInitialized = true;
      console.log('Automation engine initialized');
    } catch (error) {
      console.error('Failed to initialize automation engine:', error);
      throw error;
    }
  }

  /**
   * Create API client for a user
   */
  createApiClient(apiKey) {
    return axios.create({
      baseURL: `${this.baseURL}/${this.apiVersion}`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': this.userAgent,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Execute all rules for all users
   */
  async executeAllRules() {
    try {
      // Get all users with enabled rules
      const users = await this.database.queryAll(
        `SELECT DISTINCT u.id, u.torbox_api_key
         FROM users u
         INNER JOIN automation_rules r ON r.user_id = u.id
         WHERE u.is_active = true AND r.enabled = true`
      );

      console.log(`Executing rules for ${users.length} users...`);

      // Process users in parallel (with limit)
      const maxConcurrent = 5;
      for (let i = 0; i < users.length; i += maxConcurrent) {
        const batch = users.slice(i, i + maxConcurrent);
        await Promise.allSettled(
          batch.map(user => this.executeUserRules(user))
        );
      }
    } catch (error) {
      console.error('Error executing all rules:', error);
    }
  }

  /**
   * Execute rules for a single user
   */
  async executeUserRules(user) {
    try {
      const apiKey = decrypt(user.torbox_api_key);
      const client = this.createApiClient(apiKey);

      // Get enabled rules for this user
      const rules = await this.database.queryAll(
        `SELECT id, name, enabled, trigger_config, conditions, action_config
         FROM automation_rules
         WHERE user_id = $1 AND enabled = true`,
        [user.id]
      );

      if (rules.length === 0) {
        return;
      }

      // Fetch latest data from TorBox API
      const [torrentsResponse, queuedResponse] = await Promise.all([
        client.get('/api/torrents/mylist', { params: { bypass_cache: true } }),
        client.get('/api/queued/getqueued', { 
          params: { type: 'torrent', bypass_cache: true } 
        })
      ]);

      const torrents = torrentsResponse.data.data || [];
      const queued = queuedResponse.data.data || [];
      const allItems = [...torrents, ...queued];

      // Get snapshot metrics for all torrents
      const torrentIds = allItems.map(item => item.id);
      const metricsCache = await this.getMetricsForTorrents(user.id, torrentIds);

      // Execute each rule
      for (const rule of rules) {
        await this.executeRule(rule, user, allItems, metricsCache, client);
      }
    } catch (error) {
      console.error(`Error executing rules for user ${user.id}:`, error.message);
    }
  }

  /**
   * Get metrics for multiple torrents (cached)
   */
  async getMetricsForTorrents(userId, torrentIds) {
    const metrics = {};
    
    // Get metrics in parallel
    const metricsPromises = torrentIds.map(async (torrentId) => {
      try {
        const metric = await this.snapshotManager.calculateMetrics(userId, torrentId);
        return { torrentId, metric };
      } catch (error) {
        console.error(`Error calculating metrics for ${torrentId}:`, error);
        return { torrentId, metric: null };
      }
    });

    const results = await Promise.all(metricsPromises);
    for (const { torrentId, metric } of results) {
      if (metric) {
        metrics[torrentId] = metric;
      }
    }

    return metrics;
  }

  /**
   * Execute a single rule
   */
  async executeRule(rule, user, items, metricsCache, apiClient) {
    try {
      // Evaluate conditions using live data + snapshot metrics
      const matchingItems = this.evaluateConditions(rule, items, metricsCache);

      if (matchingItems.length === 0) {
        await this.logExecution(rule.id, user.id, rule.name, 0, true);
        return;
      }

      console.log(`Rule ${rule.name} (user ${user.id}) triggered for ${matchingItems.length} items`);

      // Execute actions on matching items using live API data
      let successCount = 0;
      let errorCount = 0;

      for (const item of matchingItems) {
        try {
          await this.executeAction(rule.action_config, item, apiClient);
          successCount++;
        } catch (error) {
          console.error(`Action failed for item ${item.name}:`, error);
          errorCount++;
        }
      }

      await this.logExecution(
        rule.id,
        user.id,
        rule.name,
        matchingItems.length,
        errorCount === 0,
        errorCount > 0 ? `${errorCount} actions failed` : null
      );

      console.log(
        `Rule ${rule.name} (user ${user.id}) completed: ${successCount} successful, ${errorCount} failed`
      );
    } catch (error) {
      console.error(`Rule execution failed for ${rule.name} (user ${user.id}):`, error);
      await this.logExecution(rule.id, user.id, rule.name, 0, false, error.message);
    }
  }

  /**
   * Evaluate conditions for items
   */
  evaluateConditions(rule, items, metricsCache) {
    const conditions = rule.conditions || [];
    const logicOperator = 'and'; // Default, can be added to schema later

    return items.filter(item => {
      const conditionResults = conditions.map(condition => {
        return this.evaluateCondition(condition, item, metricsCache[item.id]);
      });

      // Apply logic operator
      if (logicOperator === 'or') {
        return conditionResults.some(result => result);
      } else {
        return conditionResults.every(result => result);
      }
    });
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(condition, item, metrics) {
    const now = Date.now();
    let conditionValue = 0;

    switch (condition.type) {
      case 'seeding_time':
        // Use snapshot metrics if available
        if (metrics && metrics.seeding_time_hours !== undefined) {
          conditionValue = metrics.seeding_time_hours;
        } else {
          // Fallback to live data calculation
          if (item.download_state === 'uploading' && item.active) {
            conditionValue = (now - new Date(item.cached_at || item.created_at).getTime()) / (1000 * 60 * 60);
          } else {
            return false;
          }
        }
        break;

      case 'stalled_time':
        // Use snapshot metrics if available
        if (metrics && metrics.stalled_time_hours !== undefined) {
          conditionValue = metrics.stalled_time_hours;
        } else {
          // Fallback to live data
          if (['uploading (no peers)', 'downloading'].includes(item.download_state) && item.active) {
            conditionValue = (now - new Date(item.updated_at || item.created_at).getTime()) / (1000 * 60 * 60);
          } else {
            return false;
          }
        }
        break;

      case 'stuck_progress':
        // Use snapshot metrics
        if (metrics && metrics.stuck_progress !== undefined) {
          return metrics.stuck_progress;
        }
        return false;

      case 'seeding_ratio':
        conditionValue = item.ratio || 0;
        break;

      case 'seeds':
        conditionValue = item.seeds || 0;
        break;

      case 'peers':
        conditionValue = item.peers || 0;
        break;

      case 'inactive':
        const isInactive = item.download_state === 'expired';
        conditionValue = isInactive ? 1 : 0;
        break;

      case 'age':
        conditionValue = (now - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
        break;

      case 'download_speed':
        conditionValue = item.download_speed || 0;
        break;

      case 'upload_speed':
        conditionValue = item.upload_speed || 0;
        break;

      case 'file_size':
        conditionValue = (item.size || 0) / (1024 * 1024 * 1024);
        break;

      case 'tracker':
        const trackerMatch = item.tracker && item.tracker.includes(condition.value);
        return trackerMatch;

      case 'progress':
        conditionValue = item.progress || 0;
        break;

      case 'total_uploaded':
        conditionValue = (item.total_uploaded || 0) / (1024 * 1024 * 1024);
        break;

      case 'total_downloaded':
        conditionValue = (item.total_downloaded || 0) / (1024 * 1024 * 1024);
        break;

      case 'availability':
        conditionValue = item.availability || 0;
        break;

      case 'eta':
        conditionValue = item.eta || 0;
        break;

      case 'download_finished':
        conditionValue = item.download_finished ? 1 : 0;
        break;

      case 'cached':
        conditionValue = item.cached ? 1 : 0;
        break;

      case 'private':
        conditionValue = item.private ? 1 : 0;
        break;

      case 'long_term_seeding':
        conditionValue = item.long_term_seeding ? 1 : 0;
        break;

      case 'seed_torrent':
        conditionValue = item.seed_torrent ? 1 : 0;
        break;

      case 'download_state':
        const stateMatch = item.download_state === condition.value;
        return stateMatch;

      case 'name_contains':
        const nameMatch = item.name && item.name.toLowerCase().includes(condition.value.toLowerCase());
        return nameMatch;

      case 'file_count':
        conditionValue = item.files ? item.files.length : 0;
        break;

      case 'expires_at':
        if (item.expires_at) {
          const expirationTime = new Date(item.expires_at).getTime();
          conditionValue = (expirationTime - now) / (1000 * 60 * 60);
        } else {
          conditionValue = -1;
        }
        break;

      default:
        return false;
    }

    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  compareValues(value1, operator, value2) {
    switch (operator) {
      case 'gt': return value1 > value2;
      case 'lt': return value1 < value2;
      case 'gte': return value1 >= value2;
      case 'lte': return value1 <= value2;
      case 'eq': return value1 === value2;
      default: return false;
    }
  }

  /**
   * Execute action using live API client
   */
  async executeAction(action, item, apiClient) {
    switch (action.type) {
      case 'stop_seeding':
        return await apiClient.post('/api/torrents/controltorrent', {
          torrent_id: item.id,
          operation: 'stop_seeding'
        });

      case 'archive':
        // Archive and delete
        // Note: Archive functionality depends on TorBox API
        await apiClient.post('/api/torrents/controltorrent', {
          torrent_id: item.id,
          operation: 'archive'
        });
        return await this.deleteTorrent(item, apiClient);

      case 'delete':
        return await this.deleteTorrent(item, apiClient);

      case 'force_start':
        return await apiClient.post('/api/queued/controlqueued', {
          queued_id: item.id,
          operation: 'force_start',
          type: 'torrent'
        });

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Delete torrent (handles queued vs active)
   */
  async deleteTorrent(item, apiClient) {
    // Check if it's queued (no download_state)
    if (!item.download_state) {
      return await apiClient.post('/api/queued/controlqueued', {
        queued_id: item.id,
        operation: 'delete',
        type: 'torrent'
      });
    } else {
      return await apiClient.post('/api/torrents/controltorrent', {
        torrent_id: item.id,
        operation: 'delete'
      });
    }
  }

  /**
   * Log rule execution
   */
  async logExecution(ruleId, userId, ruleName, itemsProcessed, success, errorMessage) {
    try {
      await this.database.query(
        `INSERT INTO rule_execution_log 
         (rule_id, user_id, execution_type, items_processed, success, error_message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ruleId, userId, 'execution', itemsProcessed, success, errorMessage]
      );
    } catch (error) {
      console.error('Error logging rule execution:', error);
    }
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
    };
  }

  async shutdown() {
    console.log('Shutting down automation engine...');
    this.isInitialized = false;
    console.log('Automation engine shutdown complete');
  }
}

export default AutomationEngine;

