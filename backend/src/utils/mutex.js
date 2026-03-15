/**
 * Mutex utility for per-user or per-resource locking
 */
class Mutex {
  constructor() {
    this.locked = false;
    this.queue = [];
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
    if (!this.locked) return; // Guard against double-release
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.locked = false;
    }
  }

  isEmpty() {
    return !this.locked && this.queue.length === 0;
  }
}

export default Mutex;
