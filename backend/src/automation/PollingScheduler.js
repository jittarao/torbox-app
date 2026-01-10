import UserPoller from './UserPoller.js';
import AutomationEngine from './AutomationEngine.js';
import logger from '../utils/logger.js';

/**
 * Polling Scheduler
 * Manages per-user polling cycles using cron-like approach
 */
class PollingScheduler {
  constructor(userDatabaseManager, masterDb, automationEnginesMap = null) {
    this.userDatabaseManager = userDatabaseManager;
    this.masterDb = masterDb;
    this.automationEnginesMap = automationEnginesMap; // Shared map of authId -> AutomationEngine
    this.pollers = new Map(); // Map of authId -> UserPoller
    this.isRunning = false;
    this.intervalId = null;
    this.pollCheckInterval = 30000; // Check for users due for polling every 30 seconds
    this.refreshInterval = 60000; // Check for new users every minute
    this.refreshIntervalId = null;
  }

  /**
   * Start the scheduler (cron-like approach)
   */
  async start() {
    if (this.isRunning) {
      logger.warn('PollingScheduler already running');
      return;
    }

    logger.info('Starting PollingScheduler (cron-like mode)');
    this.isRunning = true;

    // Initial load of active users
    await this.refreshPollers();

    // Start periodic check for users due for polling (cron-like)
    this.intervalId = setInterval(() => {
      this.pollDueUsers().catch(err => {
        logger.error('Error polling due users', err);
      });
    }, this.pollCheckInterval);

    // Start periodic check for new users
    this.refreshIntervalId = setInterval(() => {
      this.refreshPollers().catch(err => {
        logger.error('Error refreshing pollers', err);
      });
    }, this.refreshInterval);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping PollingScheduler');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }

    // Clear all pollers
    this.pollers.clear();
  }

  /**
   * Calculate stagger offset for a user based on authId hash
   * Spreads users across 10% of base interval to prevent simultaneous polling
   * @param {string} authId - User authentication ID
   * @param {number} baseIntervalMinutes - Base polling interval in minutes
   * @returns {number} - Stagger offset in milliseconds
   */
  calculateStaggerOffset(authId, baseIntervalMinutes) {
    // Simple hash function for consistent offset
    let hash = 0;
    for (let i = 0; i < authId.length; i++) {
      const char = authId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Get value between 0 and 1
    const normalizedHash = Math.abs(hash % 100) / 100;
    
    // Return offset as 10% of base interval
    const baseIntervalMs = baseIntervalMinutes * 60 * 1000;
    return normalizedHash * baseIntervalMs * 0.1;
  }

  /**
   * Poll users that are due for polling (cron-like)
   */
  async pollDueUsers() {
    if (!this.isRunning) {
      return;
    }

    try {
      // Query master DB for users due for polling
      const dueUsers = this.masterDb.getUsersDueForPolling();

      if (dueUsers.length === 0) {
        return; // No users due for polling
      }

      logger.debug('Found users due for polling', { count: dueUsers.length });

      // Poll each user
      for (const user of dueUsers) {
        const { auth_id, encrypted_key, has_active_rules } = user;

        if (!encrypted_key) {
          logger.warn('User has no API key, skipping', { authId: auth_id });
          continue;
        }

        // Skip if no active rules (will be updated by poller)
        if (!has_active_rules) {
          // Set next poll to 1 hour from now
          const nextPollAt = new Date(Date.now() + 60 * 60 * 1000);
          this.masterDb.updateNextPollAt(auth_id, nextPollAt, 0);
          continue;
        }

        try {
          // Get or create poller for this user
          let poller = this.pollers.get(auth_id);
          
          if (!poller) {
            // Create poller if it doesn't exist
            const userDb = await this.userDatabaseManager.getUserDatabase(auth_id);
            
            // Get or create automation engine
            let automationEngine;
            if (this.automationEnginesMap && this.automationEnginesMap.has(auth_id)) {
              automationEngine = this.automationEnginesMap.get(auth_id);
            } else {
              automationEngine = new AutomationEngine(auth_id, encrypted_key, userDb.db, this.masterDb);
              await automationEngine.initialize();
              if (this.automationEnginesMap) {
                this.automationEnginesMap.set(auth_id, automationEngine);
              }
            }
            
            poller = new UserPoller(auth_id, encrypted_key, userDb.db, automationEngine, this.masterDb);
            this.pollers.set(auth_id, poller);
          }

          // Poll the user (this will update next_poll_at in master DB)
          // Add stagger offset to next poll calculation
          const result = await poller.poll();
          
          // Recalculate next_poll_at with stagger if poll was successful
          if (result && result.success && !result.skipped) {
            const hasActiveRules = poller.automationEngine ? poller.automationEngine.hasActiveRules() : false;
            const nextPollAt = poller.calculateNextPollAt(
              result.nonTerminalCount || 0,
              hasActiveRules,
              (authId, baseIntervalMinutes) => this.calculateStaggerOffset(authId, baseIntervalMinutes)
            );
            this.masterDb.updateNextPollAt(auth_id, nextPollAt, result.nonTerminalCount || 0);
          }
        } catch (error) {
          logger.error('Error polling user', error, { authId: auth_id });
          // Set next poll to 5 minutes from now on error
          const nextPollAt = new Date(Date.now() + 5 * 60 * 1000);
          this.masterDb.updateNextPollAt(auth_id, nextPollAt, 0);
        }
      }
    } catch (error) {
      logger.error('Error in pollDueUsers', error);
    }
  }

  /**
   * Refresh pollers based on active users
   * Ensures pollers exist for users with active rules
   */
  async refreshPollers() {
    const activeUsers = this.userDatabaseManager.getActiveUsers();
    const currentAuthIds = new Set(this.pollers.keys());

    for (const user of activeUsers) {
      const { auth_id, encrypted_key } = user;

      if (!encrypted_key) {
        logger.warn('User has no API key, skipping', { authId: auth_id });
        continue;
      }

      if (!this.pollers.has(auth_id)) {
        // Create new poller if needed (will be used when user is due for polling)
        try {
          const userDb = await this.userDatabaseManager.getUserDatabase(auth_id);
          
          // Get or create automation engine for this user
          let automationEngine;
          if (this.automationEnginesMap && this.automationEnginesMap.has(auth_id)) {
            automationEngine = this.automationEnginesMap.get(auth_id);
          } else {
            automationEngine = new AutomationEngine(auth_id, encrypted_key, userDb.db, this.masterDb);
            await automationEngine.initialize();
            if (this.automationEnginesMap) {
              this.automationEnginesMap.set(auth_id, automationEngine);
            }
          }
          
          // Create poller (will be used when due for polling)
          const poller = new UserPoller(auth_id, encrypted_key, userDb.db, automationEngine, this.masterDb);
          this.pollers.set(auth_id, poller);
          logger.info('Added poller for user', { authId: auth_id });
        } catch (error) {
          logger.error('Failed to create poller for user', error, { authId: auth_id });
        }
      }
    }

    // Remove pollers for users that are no longer active
    for (const authId of currentAuthIds) {
      const stillActive = activeUsers.some(u => u.auth_id === authId);
      if (!stillActive) {
        this.pollers.delete(authId);
        logger.info('Removed poller for user', { authId });
      }
    }
  }


  /**
   * Get scheduler status
   */
  getStatus() {
    const pollerStatuses = Array.from(this.pollers.entries()).map(([authId, poller]) => ({
      authId,
      ...poller.getStatus()
    }));

    return {
      isRunning: this.isRunning,
      activePollers: this.pollers.size,
      pollers: pollerStatuses
    };
  }

  /**
   * Manually trigger a poll for a specific user
   */
  async triggerPoll(authId) {
    const poller = this.pollers.get(authId);
    if (!poller) {
      throw new Error(`No poller found for user ${authId}`);
    }

    return await poller.poll();
  }
}

export default PollingScheduler;
