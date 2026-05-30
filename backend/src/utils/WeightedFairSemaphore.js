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
   * @param {object} [options]
   * @param {number} [options.timeoutMs] - Max ms to wait; rejects with error if exceeded
   * @returns {Promise<() => void>} - Release function
   */
  async acquire(userId, permits = 1, options = {}) {
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

    const { timeoutMs } = options;

    // Queue the request
    return new Promise((resolve, reject) => {
      const entry = { resolve, reject, permits };

      if (timeoutMs && timeoutMs > 0) {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          const idx = userState.queue.indexOf(entry);
          if (idx >= 0) {
            userState.queue.splice(idx, 1);
          }
          if (userState.active === 0 && userState.queue.length === 0) {
            this._perUser.delete(userId);
          }
          reject(new Error(`Semaphore acquire timed out after ${timeoutMs}ms for user ${userId}`));
        }, timeoutMs);
        entry._timer = timer;
        entry._cleanup = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
        };
      }

      userState.queue.push(entry);
    });
  }

  /**
   * Process the queue. Called after a release.
   * Uses cursor-based round-robin: walks the user map starting from
   * the last-serviced position, granting at most one queued request per
   * user per cycle. This prevents starvation when one user has a deep queue
   * and another has a shallow queue.
   * @private
   */
  _processQueue() {
    let progressed = true;
    while (progressed) {
      const entries = [...this._perUser.entries()];
      if (entries.length === 0) return;

      // Start from the last cursor position to ensure round-robin fairness
      this._cursor = (this._cursor ?? 0) % entries.length;

      progressed = false;
      for (let i = 0; i < entries.length; i++) {
        const idx = (this._cursor + i) % entries.length;
        const [userId, state] = entries[idx];
        if (state.queue.length === 0) continue;
        const entry = state.queue[0];
        if (this._available >= entry.permits && state.active < this.maxPermitsPerUser) {
          state.queue.shift();
          if (entry._cleanup) entry._cleanup();
          this._available -= entry.permits;
          state.active += entry.permits;
          entry.resolve(this._createRelease(userId, entry.permits));
          progressed = true;
          this._cursor = (idx + 1) % entries.length;
          break; // one grant per cycle to avoid starving other users
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
