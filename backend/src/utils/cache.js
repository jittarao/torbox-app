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

    // Cache for active users list (5 seconds TTL)
    // Separate caches for different query variations
    this.activeUsersCache = new TTLCache({
      max: 2, // Two different query variations
      ttl: 5000, // 5 seconds
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
    logger.verbose('Cached active rules count', { authId, hasActiveRules });
  }

  /**
   * Invalidate active rules cache for a user
   * @param {string} authId - User authentication ID
   */
  invalidateActiveRules(authId) {
    this.activeRulesCache.delete(`activeRules:${authId}`);
    logger.verbose('Invalidated active rules cache', { authId });
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
    logger.verbose('Cached user registry info', { authId });
  }

  /**
   * Invalidate user registry cache for a user
   * @param {string} authId - User authentication ID (optional, if not provided invalidates all)
   */
  invalidateUserRegistry(authId = null) {
    if (authId) {
      this.userRegistryCache.delete(`userRegistry:${authId}`);
      logger.verbose('Invalidated user registry cache', { authId });
    } else {
      // Invalidate all user registry entries
      this.userRegistryCache.clear();
      logger.verbose('Invalidated all user registry cache');
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
    logger.verbose('Cached active users list', {
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
      logger.verbose('Invalidated active users cache', { variant });
    } else {
      // Invalidate all variants
      this.activeUsersCache.delete('activeUsers:default');
      this.activeUsersCache.delete('activeUsers:withNullKeys');
      logger.verbose('Invalidated all active users cache');
    }
  }

  /**
   * Clear all caches
   */
  clear() {
    this.activeRulesCache.clear();
    this.userRegistryCache.clear();
    this.activeUsersCache.clear();
    logger.verbose('Cleared all caches');
  }
}

// Export singleton instance
const cache = new Cache();
export default cache;
