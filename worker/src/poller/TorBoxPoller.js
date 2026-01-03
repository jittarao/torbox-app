import axios from 'axios';
import { decrypt } from '../../../src/database/encryption.js';
import SnapshotManager from './SnapshotManager.js';

class TorBoxPoller {
  constructor(database) {
    this.database = database;
    this.snapshotManager = new SnapshotManager(database);
    
    // Configuration from environment variables
    this.targetIntervalMinutes = parseInt(
      process.env.POLLING_INTERVAL_MINUTES || '30',
      10
    );
    this.internalIntervalMinutes = parseInt(
      process.env.POLLING_INTERVAL_INTERNAL_MINUTES || '2',
      10
    );
    
    this.baseURL = process.env.TORBOX_API_BASE || 'https://api.torbox.app';
    this.apiVersion = process.env.TORBOX_API_VERSION || 'v1';
    this.userAgent = `TorBoxManager-Worker/${process.env.npm_package_version || '0.1.0'}`;
    
    // Rate limiting
    this.maxConcurrentPolls = 10; // Process max 10 users concurrently
    this.pollDelayMs = 1000; // 1 second delay between polls
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
   * Poll TorBox API for a single user
   */
  async pollUser(user) {
    try {
      const apiKey = decrypt(user.torbox_api_key);
      const client = this.createApiClient(apiKey);

      // Fetch torrents and queued items
      const [torrentsResponse, queuedResponse] = await Promise.all([
        client.get('/api/torrents/mylist', {
          params: { bypass_cache: true }
        }),
        client.get('/api/queued/getqueued', {
          params: { 
            type: 'torrent',
            bypass_cache: true 
          }
        })
      ]);

      const torrents = torrentsResponse.data.data || [];
      const queued = queuedResponse.data.data || [];
      const allItems = [...torrents, ...queued];

      // Get last snapshots for state change detection
      const lastSnapshots = await this.snapshotManager.getLastSnapshots(
        user.id,
        allItems.map(item => item.id)
      );

      // Create snapshots with smart filtering
      const snapshotsToCreate = [];
      
      for (const item of allItems) {
        const shouldSnapshot = await this.snapshotManager.shouldCreateSnapshot(
          user.id,
          item,
          lastSnapshots[item.id]
        );

        if (shouldSnapshot) {
          snapshotsToCreate.push(
            this.snapshotManager.createSnapshotData(user.id, item)
          );
        }
      }

      // Batch insert snapshots
      if (snapshotsToCreate.length > 0) {
        await this.database.batchInsertSnapshots(snapshotsToCreate);
      }

      // Update user's last_polled_at and next_poll_at
      const now = new Date();
      const nextPollAt = new Date(
        now.getTime() + this.targetIntervalMinutes * 60 * 1000
      );

      await this.database.query(
        `UPDATE users 
         SET last_polled_at = $1, next_poll_at = $2, updated_at = $1
         WHERE id = $3`,
        [now, nextPollAt, user.id]
      );

      return {
        success: true,
        itemsProcessed: allItems.length,
        snapshotsCreated: snapshotsToCreate.length,
      };
    } catch (error) {
      console.error(`Error polling user ${user.id}:`, error.message);
      
      // Update next_poll_at even on error (retry later)
      const now = new Date();
      const retryAt = new Date(now.getTime() + 5 * 60 * 1000); // Retry in 5 minutes
      
      await this.database.query(
        `UPDATE users 
         SET next_poll_at = $1, updated_at = $2
         WHERE id = $3`,
        [retryAt, now, user.id]
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Poll all users that are due for polling
   */
  async pollDueUsers() {
    try {
      // Get users that need polling
      const users = await this.database.queryAll(
        `SELECT id, torbox_api_key, next_poll_at
         FROM users
         WHERE is_active = true 
           AND next_poll_at <= NOW()
         ORDER BY next_poll_at ASC
         LIMIT $1`,
        [this.getUsersPerPoll()]
      );

      if (users.length === 0) {
        console.log('No users due for polling');
        return { processed: 0, success: 0, errors: 0 };
      }

      console.log(`Polling ${users.length} users...`);

      // Process users in batches with concurrency limit
      const results = await this.processUsersInBatches(users);

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      console.log(
        `Polling complete: ${successCount} successful, ${errorCount} failed`
      );

      return {
        processed: users.length,
        success: successCount,
        errors: errorCount,
      };
    } catch (error) {
      console.error('Error in pollDueUsers:', error);
      throw error;
    }
  }

  /**
   * Process users in batches with concurrency control
   */
  async processUsersInBatches(users) {
    const results = [];
    
    for (let i = 0; i < users.length; i += this.maxConcurrentPolls) {
      const batch = users.slice(i, i + this.maxConcurrentPolls);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (user, index) => {
          // Stagger requests slightly
          if (index > 0) {
            await new Promise(resolve => 
              setTimeout(resolve, this.pollDelayMs * index)
            );
          }
          return await this.pollUser(user);
        })
      );

      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : { success: false, error: result.reason?.message }
      ));
    }

    return results;
  }

  /**
   * Calculate how many users to poll per cycle
   */
  getUsersPerPoll() {
    // This will be calculated based on total active users
    // For now, return a reasonable default
    // In production, this could query the total count and calculate dynamically
    const totalUsers = parseInt(process.env.ESTIMATED_TOTAL_USERS || '1000', 10);
    const pollsPerTargetInterval = this.targetIntervalMinutes / this.internalIntervalMinutes;
    return Math.ceil(totalUsers / pollsPerTargetInterval);
  }

  /**
   * Get polling statistics
   */
  async getStats() {
    const stats = await this.database.queryOne(
      `SELECT 
         COUNT(*) as total_users,
         COUNT(*) FILTER (WHERE is_active = true) as active_users,
         COUNT(*) FILTER (WHERE next_poll_at <= NOW() AND is_active = true) as due_users
       FROM users`
    );

    return {
      totalUsers: parseInt(stats.total_users, 10),
      activeUsers: parseInt(stats.active_users, 10),
      dueUsers: parseInt(stats.due_users, 10),
      targetIntervalMinutes: this.targetIntervalMinutes,
      internalIntervalMinutes: this.internalIntervalMinutes,
      usersPerPoll: this.getUsersPerPoll(),
    };
  }
}

export default TorBoxPoller;

