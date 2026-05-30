/**
 * Shared semaphore utility for limiting concurrent async operations.
 * Used by PollingScheduler and the startup sync in index.js.
 */
export class Semaphore {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  async acquire(timeoutMs = 0) {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }

    if (timeoutMs <= 0) {
      return new Promise((resolve) => {
        this.queue.push(resolve);
      });
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const idx = this.queue.indexOf(wrapper);
        if (idx >= 0) this.queue.splice(idx, 1);
        reject(new Error('Semaphore acquisition timed out'));
      }, timeoutMs);
      const wrapper = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      this.queue.push(wrapper);
    });
  }

  release() {
    this.running = Math.max(0, this.running - 1);
    if (this.queue.length > 0) {
      this.running++;
      const next = this.queue.shift();
      next();
    }
  }
}

export default Semaphore;
