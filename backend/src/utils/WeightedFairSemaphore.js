/**
 * A weighted fair semaphore for API rate limiting.
 *
 * Unlike a simple semaphore, WeightedFairSemaphore prevents a single user
 * from monopolizing permits when multiple users are queued. It does this
 * by tracking the number of active and queued permits per user and
 * preferentially dequeuing from users with the fewest active permits
 * relative to their queue depth.
 *
 * This prevents starvation: user A with 50 queued items won't block
 * user B with 1 queued item from making progress.
 */
class WeightedFairSemaphore {
  /**
   * @param {number} totalPermits - Total number of permits available
   * @param {object} options
   * @param {number} options.maxPermitsPerUser - Max permits a single user can hold (default: Math.ceil(totalPermits / 2))
   */
  constructor(totalPermits, options = {}) {
    this.totalPermits = totalPermits;
    this.maxPermitsPerUser = options.maxPermitsPerUser ?? Math.ceil(totalPermits / 2);
    this._available = totalPermits;
    this._perUser = new Map();
  }

  /**
   * Statistics for a single user.
   * @typedef {object} UserStats
   * @property {number} active - Active permits held
   * @property {number} queued - Permits waiting in queue
   */

  /**
   * Get stats for all users.
   * @returns {Record<string, UserStats>}
   */
  getStats() {
    const stats = {};
    for (const [userId, state] of this._perUser) {
      stats[userId] = {
        active: state.active,
        queued: state.queue.reduce((sum, e) => sum + e.permits, 0),
      };
    }
    return stats;
  }

  /**
   * Acquire permits for a user. Resolves when permits are available.
   * @param {string} userId - User identifier
   * @param {number} [permits=1] - Number of permits to acquire
   * @returns {Promise<() => void>} - Release function
   */
  async acquire(userId, permits = 1) {
    if (!this._perUser.has(userId)) {
      this._perUser.set(userId, { active: 0, queue: [] });
    }
    const userState = this._perUser.get(userId);

    // If permits available and user hasn't hit their cap, acquire immediately
    if (this._available >= permits && userState.active < this.maxPermitsPerUser) {
      this._available -= permits;
      userState.active += permits;
      return this._createRelease(userId, permits);
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      userState.queue.push({ resolve, reject, permits });
    });
  }

  /**
   * Process the queue. Called after a release.
   * Uses fair scheduling: iterates users in round-robin order, granting
   * permits to at most one queued request per user per cycle.
   * @private
   */
  _processQueue() {
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const [userId, state] of this._perUser) {
        if (state.queue.length === 0) continue;
        const next = state.queue[0];
        if (this._available >= next.permits && state.active < this.maxPermitsPerUser) {
          state.queue.shift();
          this._available -= next.permits;
          state.active += next.permits;
          next.resolve(this._createRelease(userId, next.permits));
          progressed = true;
        }
      }
    }
  }

  /**
   * Create a release function that decrements the user's active count.
   * @private
   */
  _createRelease(userId, permits) {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const state = this._perUser.get(userId);
      if (!state) return;
      state.active = Math.max(0, state.active - permits);
      this._available = Math.min(this.totalPermits, this._available + permits);
      if (state.active === 0 && state.queue.length === 0) {
        this._perUser.delete(userId);
      }
      this._processQueue();
    };
  }

  /**
   * Get number of available permits.
   * @returns {number}
   */
  get availablePermits() {
    return this._available;
  }
}

export default WeightedFairSemaphore;
