import { TTLCache } from '@isaacs/ttlcache';
import logger from './logger.js';

/**
 * In-memory TTL cache for frequently accessed data
 */
class Cache {
  constructor() {
    // Cache for active rules count per user (5 seconds TTL)
    this.activeRulesCache = new TTLCache({
      max: 1000, // Max 1000 users
      ttl: 5000, // 5 seconds
    });

    // Cache for user registry info per user (10 seconds TTL)
    this.userRegistryCache = new TTLCache({
      max: 1000, // Max 1000 users
      ttl: 10000, // 10 seconds
    });

    // Cache for active users list (60 seconds TTL)
    // Explicit invalidateActiveUsers() is called on every mutation, so a longer TTL is safe
    // and avoids unnecessary DB re-queries under polling load.
    this.activeUsersCache = new TTLCache({
      max: 2, // Two different query variations
      ttl: 60000, // 60 seconds
    });

    // Cache for "has recent rule executions" per user (5 minutes TTL)
    // Reduces DB queries when no rules executed in current cycle (idle users).
    this.recentRuleExecutionsCache = new TTLCache({
      max: 1000,
      ttl: 300000, // 5 minutes
    });
  }

  /**
   * Get cached active rules count for a user
   * @param {string} authId - User authentication ID
   * @returns {boolean|undefined} - Cached value or undefined if not cached
   */
  getActiveRules(authId) {
    return this.activeRulesCache.get(`activeRules:${authId}`);
  }

  /**
   * Set cached active rules count for a user
   * @param {string} authId - User authentication ID
   * @param {boolean} hasActiveRules - Whether user has active rules
   */
  setActiveRules(authId, hasActiveRules) {
    this.activeRulesCache.set(`activeRules:${authId}`, hasActiveRules);
    logger.debug('Cached active rules count', { authId, hasActiveRules });
  }

  /**
   * Invalidate active rules cache for a user
   * @param {string} authId - User authentication ID
   */
  invalidateActiveRules(authId) {
    this.activeRulesCache.delete(`activeRules:${authId}`);
    logger.debug('Invalidated active rules cache', { authId });
  }

  /**
   * Get cached user registry info for a user
   * @param {string} authId - User authentication ID
   * @returns {Object|undefined} - Cached value or undefined if not cached
   */
  getUserRegistry(authId) {
    return this.userRegistryCache.get(`userRegistry:${authId}`);
  }

  /**
   * Set cached user registry info for a user
   * @param {string} authId - User authentication ID
   * @param {Object} userInfo - User registry info
   */
  setUserRegistry(authId, userInfo) {
    this.userRegistryCache.set(`userRegistry:${authId}`, userInfo);
    logger.debug('Cached user registry info', { authId });
  }

  /**
   * Invalidate user registry cache for a user
   * @param {string} authId - User authentication ID (optional, if not provided invalidates all)
   */
  invalidateUserRegistry(authId = null) {
    if (authId) {
      this.userRegistryCache.delete(`userRegistry:${authId}`);
      logger.debug('Invalidated user registry cache', { authId });
    } else {
      // Invalidate all user registry entries
      this.userRegistryCache.clear();
      logger.debug('Invalidated all user registry cache');
    }
  }

  /**
   * Get cached active users list
   * @param {string} variant - Cache variant ('default' or 'withNullKeys')
   * @returns {Array|undefined} - Cached value or undefined if not cached
   */
  getActiveUsers(variant = 'default') {
    return this.activeUsersCache.get(`activeUsers:${variant}`);
  }

  /**
   * Set cached active users list
   * @param {Array} users - Active users list
   * @param {string} variant - Cache variant ('default' or 'withNullKeys')
   */
  setActiveUsers(users, variant = 'default') {
    this.activeUsersCache.set(`activeUsers:${variant}`, users);
    logger.debug('Cached active users list', {
      count: users?.length || 0,
      variant,
    });
  }

  /**
   * Invalidate active users list cache
   * @param {string} variant - Cache variant to invalidate (optional, invalidates all if not provided)
   */
  invalidateActiveUsers(variant = null) {
    if (variant) {
      this.activeUsersCache.delete(`activeUsers:${variant}`);
      logger.debug('Invalidated active users cache', { variant });
    } else {
      // Invalidate all variants
      this.activeUsersCache.delete('activeUsers:default');
      this.activeUsersCache.delete('activeUsers:withNullKeys');
      logger.debug('Invalidated all active users cache');
    }
  }

  /**
   * Get cached "has recent rule executions" for a user
   * @param {string} authId - User authentication ID
   * @returns {boolean|undefined} - Cached value or undefined if not cached
   */
  getRecentRuleExecutions(authId) {
    return this.recentRuleExecutionsCache.get(`recentRuleExecutions:${authId}`);
  }

  /**
   * Set cached "has recent rule executions" for a user
   * @param {string} authId - User authentication ID
   * @param {boolean} hasRecent - Whether user has recent rule executions
   */
  setRecentRuleExecutions(authId, hasRecent) {
    this.recentRuleExecutionsCache.set(`recentRuleExecutions:${authId}`, hasRecent);
  }

  /**
   * Invalidate recent rule executions cache for a user (call when actions are successfully executed)
   * @param {string} authId - User authentication ID
   */
  invalidateRecentRuleExecutions(authId) {
    this.recentRuleExecutionsCache.delete(`recentRuleExecutions:${authId}`);
  }

  /**
   * Clear all caches
   */
  clear() {
    this.activeRulesCache.clear();
    this.userRegistryCache.clear();
    this.activeUsersCache.clear();
    this.recentRuleExecutionsCache.clear();
    logger.debug('Cleared all caches');
  }
}

// Export singleton instance
const cache = new Cache();
export default cache;
