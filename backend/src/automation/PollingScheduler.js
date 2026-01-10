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
      logger.warn('PollingScheduler already running, ignoring start request');
      return;
    }

    logger.info('Starting PollingScheduler (cron-like mode)', {
      pollCheckInterval: `${this.pollCheckInterval / 1000}s`,
      refreshInterval: `${this.refreshInterval / 1000}s`,
      timestamp: new Date().toISOString()
    });
    this.isRunning = true;

    // Initial load of active users
    logger.info('Performing initial poller refresh');
    await this.refreshPollers();

    // Start periodic check for users due for polling (cron-like)
    this.intervalId = setInterval(() => {
      this.pollDueUsers().catch(err => {
        logger.error('Unhandled error in pollDueUsers interval', err, {
          errorMessage: err.message,
          errorStack: err.stack
        });
      });
    }, this.pollCheckInterval);
    
    logger.info('Polling scheduler started successfully', {
      pollCheckInterval: `${this.pollCheckInterval / 1000}s`,
      refreshInterval: `${this.refreshInterval / 1000}s`,
      activePollers: this.pollers.size,
      timestamp: new Date().toISOString()
    });

    // Start periodic check for new users
    this.refreshIntervalId = setInterval(() => {
      this.refreshPollers().catch(err => {
        logger.error('Unhandled error in refreshPollers interval', err, {
          errorMessage: err.message,
          errorStack: err.stack
        });
      });
    }, this.refreshInterval);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      logger.debug('PollingScheduler not running, ignoring stop request');
      return;
    }

    logger.info('Stopping PollingScheduler', {
      activePollers: this.pollers.size,
      timestamp: new Date().toISOString()
    });
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.debug('Polling interval cleared');
    }

    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
      logger.debug('Refresh interval cleared');
    }

    // Clear all pollers
    const pollerCount = this.pollers.size;
    this.pollers.clear();
    logger.info('PollingScheduler stopped', {
      clearedPollers: pollerCount,
      timestamp: new Date().toISOString()
    });
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
      logger.debug('Polling scheduler not running, skipping poll check');
      return;
    }

    const checkStartTime = Date.now();
    logger.debug('Checking for users due for polling', {
      activePollers: this.pollers.size,
      timestamp: new Date().toISOString()
    });

    try {
      // Query master DB for users due for polling
      const dueUsers = this.masterDb.getUsersDueForPolling();

      if (dueUsers.length === 0) {
        logger.debug('No users due for polling at this time', {
          checkDuration: `${((Date.now() - checkStartTime) / 1000).toFixed(2)}s`
        });
        return; // No users due for polling
      }

      logger.info('Found users due for polling', { 
        count: dueUsers.length,
        authIds: dueUsers.map(u => u.auth_id),
        hasActiveRulesFlags: dueUsers.map(u => ({ authId: u.auth_id, hasActiveRules: u.has_active_rules }))
      });

      let successCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      // Poll each user
      for (const user of dueUsers) {
        const { auth_id, encrypted_key, has_active_rules: dbHasActiveRules } = user;
        const userPollStartTime = Date.now();

        if (!encrypted_key) {
          logger.warn('User has no API key, skipping poll', { 
            authId: auth_id,
            hasActiveRules: dbHasActiveRules
          });
          errorCount++;
          continue;
        }

        try {
          // Get or create poller for this user
          let poller = this.pollers.get(auth_id);
          const wasNewPoller = !poller;
          
          if (!poller) {
            logger.info('Creating poller for user', { authId: auth_id });
            // Create poller if it doesn't exist
            const userDb = await this.userDatabaseManager.getUserDatabase(auth_id);
            
            // Get or create automation engine
            let automationEngine;
            if (this.automationEnginesMap && this.automationEnginesMap.has(auth_id)) {
              automationEngine = this.automationEnginesMap.get(auth_id);
              logger.debug('Using existing automation engine', { authId: auth_id });
            } else {
              logger.info('Creating new automation engine', { authId: auth_id });
              automationEngine = new AutomationEngine(auth_id, encrypted_key, userDb.db, this.masterDb);
              await automationEngine.initialize();
              if (this.automationEnginesMap) {
                this.automationEnginesMap.set(auth_id, automationEngine);
              }
            }
            
            poller = new UserPoller(auth_id, encrypted_key, userDb.db, automationEngine, this.masterDb);
            this.pollers.set(auth_id, poller);
            logger.info('Poller created successfully', { authId: auth_id, wasNewPoller: true });
          }

          // Check actual active rules state (not just the flag)
          const hasActiveRules = poller.automationEngine ? poller.automationEngine.hasActiveRules() : false;
          
          // Log flag sync if there's a mismatch
          if (dbHasActiveRules !== (hasActiveRules ? 1 : 0)) {
            logger.warn('Active rules flag mismatch detected, will sync after poll', {
              authId: auth_id,
              dbFlag: dbHasActiveRules,
              actualState: hasActiveRules
            });
          }
          
          logger.debug('Starting poll for user', {
            authId: auth_id,
            hasActiveRules,
            dbHasActiveRules,
            wasNewPoller
          });
          
          // Poll the user (this will update next_poll_at in master DB)
          // Add stagger offset to next poll calculation
          const result = await poller.poll();
          
          const pollDuration = ((Date.now() - userPollStartTime) / 1000).toFixed(2);
          
          // Update has_active_rules flag in master DB based on actual state
          // This ensures the flag stays in sync even if it was incorrect before
          if (poller.automationEngine) {
            const actualHasActiveRules = poller.automationEngine.hasActiveRules();
            const previousFlag = dbHasActiveRules;
            this.masterDb.updateActiveRulesFlag(auth_id, actualHasActiveRules);
            
            if (previousFlag !== (actualHasActiveRules ? 1 : 0)) {
              logger.info('Synced active rules flag in master DB', {
                authId: auth_id,
                previousFlag,
                newFlag: actualHasActiveRules ? 1 : 0,
                actualHasActiveRules
              });
            }
          }
          
          // Recalculate next_poll_at with stagger if poll was successful
          if (result && result.success && !result.skipped) {
            const nextPollAt = poller.calculateNextPollAt(
              result.nonTerminalCount || 0,
              hasActiveRules,
              (authId, baseIntervalMinutes) => this.calculateStaggerOffset(authId, baseIntervalMinutes)
            );
            this.masterDb.updateNextPollAt(auth_id, nextPollAt, result.nonTerminalCount || 0);
            
            logger.info('Poll completed successfully', {
              authId: auth_id,
              duration: `${pollDuration}s`,
              rulesEvaluated: result.ruleResults?.evaluated || 0,
              rulesExecuted: result.ruleResults?.executed || 0,
              nonTerminalCount: result.nonTerminalCount || 0,
              nextPollAt: nextPollAt.toISOString(),
              changes: result.changes ? {
                new: result.changes.new?.length || 0,
                updated: result.changes.updated?.length || 0,
                removed: result.changes.removed?.length || 0
              } : null
            });
            successCount++;
          } else if (result && result.skipped) {
            // If poll was skipped (no active rules), set next poll to 1 hour from now
            const nextPollAt = new Date(Date.now() + 60 * 60 * 1000);
            this.masterDb.updateNextPollAt(auth_id, nextPollAt, 0);
            
            logger.info('Poll skipped - no active rules', {
              authId: auth_id,
              reason: result.reason || 'No active automation rules',
              duration: `${pollDuration}s`,
              nextPollAt: nextPollAt.toISOString()
            });
            skippedCount++;
          } else {
            logger.warn('Poll returned unexpected result', {
              authId: auth_id,
              result,
              duration: `${pollDuration}s`
            });
            errorCount++;
          }
        } catch (error) {
          const pollDuration = ((Date.now() - userPollStartTime) / 1000).toFixed(2);
          logger.error('Error polling user', error, { 
            authId: auth_id,
            duration: `${pollDuration}s`,
            errorMessage: error.message,
            errorStack: error.stack
          });
          // Set next poll to 5 minutes from now on error
          const nextPollAt = new Date(Date.now() + 5 * 60 * 1000);
          this.masterDb.updateNextPollAt(auth_id, nextPollAt, 0);
          logger.info('Set next poll time after error', {
            authId: auth_id,
            nextPollAt: nextPollAt.toISOString(),
            retryIn: '5 minutes'
          });
          errorCount++;
        }
      }

      const totalDuration = ((Date.now() - checkStartTime) / 1000).toFixed(2);
      logger.info('Poll cycle completed', {
        totalUsers: dueUsers.length,
        successCount,
        skippedCount,
        errorCount,
        totalDuration: `${totalDuration}s`,
        averageDuration: dueUsers.length > 0 ? `${(totalDuration / dueUsers.length).toFixed(2)}s` : '0s'
      });
    } catch (error) {
      const totalDuration = ((Date.now() - checkStartTime) / 1000).toFixed(2);
      logger.error('Error in pollDueUsers', error, {
        duration: `${totalDuration}s`,
        errorMessage: error.message,
        errorStack: error.stack
      });
    }
  }

  /**
   * Refresh pollers based on active users
   * Ensures pollers exist for users with active rules
   */
  async refreshPollers() {
    const refreshStartTime = Date.now();
    logger.debug('Refreshing pollers', {
      currentPollers: this.pollers.size,
      timestamp: new Date().toISOString()
    });

    try {
      const activeUsers = this.userDatabaseManager.getActiveUsers();
      const currentAuthIds = new Set(this.pollers.keys());
      
      logger.debug('Active users found', {
        activeUserCount: activeUsers.length,
        currentPollerCount: this.pollers.size
      });

      let addedCount = 0;
      let removedCount = 0;
      let errorCount = 0;

      for (const user of activeUsers) {
        const { auth_id, encrypted_key } = user;

        if (!encrypted_key) {
          logger.warn('User has no API key, skipping poller creation', { authId: auth_id });
          errorCount++;
          continue;
        }

        if (!this.pollers.has(auth_id)) {
          // Create new poller if needed (will be used when user is due for polling)
          try {
            logger.info('Creating poller for new user', { authId: auth_id });
            const userDb = await this.userDatabaseManager.getUserDatabase(auth_id);
            
            // Get or create automation engine for this user
            let automationEngine;
            if (this.automationEnginesMap && this.automationEnginesMap.has(auth_id)) {
              automationEngine = this.automationEnginesMap.get(auth_id);
              logger.debug('Using existing automation engine for new poller', { authId: auth_id });
            } else {
              logger.info('Creating new automation engine for user', { authId: auth_id });
              automationEngine = new AutomationEngine(auth_id, encrypted_key, userDb.db, this.masterDb);
              await automationEngine.initialize();
              if (this.automationEnginesMap) {
                this.automationEnginesMap.set(auth_id, automationEngine);
              }
            }
            
            // Create poller (will be used when due for polling)
            const poller = new UserPoller(auth_id, encrypted_key, userDb.db, automationEngine, this.masterDb);
            this.pollers.set(auth_id, poller);
            logger.info('Poller added successfully', { 
              authId: auth_id,
              hasActiveRules: automationEngine.hasActiveRules()
            });
            addedCount++;
          } catch (error) {
            logger.error('Failed to create poller for user', error, { 
              authId: auth_id,
              errorMessage: error.message,
              errorStack: error.stack
            });
            errorCount++;
          }
        }
      }

      // Remove pollers for users that are no longer active
      for (const authId of currentAuthIds) {
        const stillActive = activeUsers.some(u => u.auth_id === authId);
        if (!stillActive) {
          this.pollers.delete(authId);
          logger.info('Removed poller for inactive user', { authId });
          removedCount++;
        }
      }

      const refreshDuration = ((Date.now() - refreshStartTime) / 1000).toFixed(2);
      logger.info('Poller refresh completed', {
        activeUsers: activeUsers.length,
        addedCount,
        removedCount,
        errorCount,
        totalPollers: this.pollers.size,
        duration: `${refreshDuration}s`
      });
    } catch (error) {
      const refreshDuration = ((Date.now() - refreshStartTime) / 1000).toFixed(2);
      logger.error('Error refreshing pollers', error, {
        duration: `${refreshDuration}s`,
        errorMessage: error.message,
        errorStack: error.stack
      });
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
    logger.info('Manually triggering poll for user', {
      authId,
      timestamp: new Date().toISOString()
    });

    const poller = this.pollers.get(authId);
    if (!poller) {
      logger.error('No poller found for user', {
        authId,
        availablePollers: Array.from(this.pollers.keys())
      });
      throw new Error(`No poller found for user ${authId}`);
    }

    try {
      const result = await poller.poll();
      logger.info('Manual poll completed', {
        authId,
        success: result.success,
        skipped: result.skipped,
        rulesEvaluated: result.ruleResults?.evaluated || 0,
        rulesExecuted: result.ruleResults?.executed || 0
      });
      return result;
    } catch (error) {
      logger.error('Manual poll failed', error, {
        authId,
        errorMessage: error.message
      });
      throw error;
    }
  }
}

export default PollingScheduler;
