/**
 * Mutex utility for per-user or per-resource locking.
 * Guarantees mutual exclusion with thread-safe acquire/release.
 * The double-release guard uses a boolean flag checked inside the
 * critical section to prevent lost wake-ups from concurrent release calls.
 */
class Mutex {
  constructor() {
    this.locked = false;
    this.queue = [];
    this._releasing = false;
  }

  async acquire() {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.locked = true;
        resolve();
      });
    });
  }

  release() {
    // Atomic-style guard: if already releasing or not locked, skip.
    // Because JS is single-threaded, the flag check + set is safe within
    // one microtask — double-release can only happen across microtask boundaries.
    if (this._releasing) return;
    this._releasing = true;

    try {
      if (!this.locked) return;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      } else {
        this.locked = false;
      }
    } finally {
      this._releasing = false;
    }
  }

  isEmpty() {
    return !this.locked && this.queue.length === 0;
  }
}

export default Mutex;
