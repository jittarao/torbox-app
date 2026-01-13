import logger from '../../utils/logger.js';

/**
 * Helper class for database operations with retry logic
 */
class DatabaseRetryHelper {
  /**
   * Retry a function with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {Object} options - Retry options
   * @param {number} options.maxRetries - Maximum number of retries (default: 3)
   * @param {number} options.initialDelayMs - Initial delay in milliseconds (default: 100)
   * @param {string} options.context - Context for logging (e.g., authId)
   * @returns {Promise} - Result of the function
   */
  static async retryWithBackoff(fn, options = {}) {
    const { maxRetries = 3, initialDelayMs = 100, context = {} } = options;

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if error is transient (SQLite busy, connection errors)
        const isTransient = this.isTransientError(error);

        if (!isTransient || attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff: 100ms, 200ms, 400ms
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        logger.warn('Database operation failed, retrying', {
          ...context,
          attempt: attempt + 1,
          maxRetries,
          delayMs,
          errorMessage: error.message,
        });

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw lastError;
  }

  /**
   * Check if an error is transient and should be retried
   * @param {Error} error - Error to check
   * @returns {boolean} - True if error is transient
   */
  static isTransientError(error) {
    return (
      error.message?.includes('SQLITE_BUSY') ||
      error.message?.includes('database is locked') ||
      error.message?.includes('connection') ||
      error.code === 'SQLITE_BUSY' ||
      error.code === 'SQLITE_LOCKED'
    );
  }
}

export default DatabaseRetryHelper;
