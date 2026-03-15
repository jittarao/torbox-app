import StateDiffEngine from '../StateDiffEngine.js';
import DerivedFieldsEngine from '../DerivedFieldsEngine.js';
import SpeedAggregator from '../SpeedAggregator.js';
import { isClosedDatabaseError } from '../../utils/dbErrors.js';
import logger from '../../utils/logger.js';

/**
 * Manages database connections and engine reinitialization for UserPoller
 */
class DatabaseConnectionManager {
  constructor(authId, userDb, userDatabaseManager) {
    this.authId = authId;
    this.userDb = userDb;
    this.userDatabaseManager = userDatabaseManager;
    this.stateDiffEngine = new StateDiffEngine(userDb);
    this.derivedFieldsEngine = new DerivedFieldsEngine(userDb);
    this.speedAggregator = new SpeedAggregator(userDb);
  }

  /**
   * Resolve current connection from pool at use time (avoids stale references and closed-DB path).
   * Sub-engines (StateDiffEngine etc.) are only re-created when the underlying db reference
   * changes, preserving their prepared statement cache across polls on the same connection.
   * @returns {Promise<void>}
   */
  async ensureConnection() {
    if (!this.userDatabaseManager) {
      throw new Error('Cannot resolve database connection: userDatabaseManager not available');
    }

    const dbConnection = await this.userDatabaseManager.getUserDatabase(this.authId);
    const newDb = dbConnection.db;

    // Only recreate sub-engines when the db reference actually changes (e.g. pool eviction +
    // reconnect). Keeping the same instances preserves their compiled prepared statements.
    if (newDb !== this.userDb) {
      this.userDb = newDb;
      this.stateDiffEngine = new StateDiffEngine(this.userDb);
      this.derivedFieldsEngine = new DerivedFieldsEngine(this.userDb);
      this.speedAggregator = new SpeedAggregator(this.userDb);
    }
  }

  /**
   * Mark connection as active to prevent eviction
   * @private
   */
  _markActive() {
    if (this.userDatabaseManager && typeof this.userDatabaseManager.markActive === 'function') {
      this.userDatabaseManager.markActive(this.authId);
    }
  }

  /**
   * Mark connection as inactive (operation completed)
   * @private
   */
  _markInactive() {
    if (this.userDatabaseManager && typeof this.userDatabaseManager.markInactive === 'function') {
      this.userDatabaseManager.markInactive(this.authId);
    }
  }

  /**
   * Execute a database operation with automatic retry on closed database error
   * Marks connection as active during operation to prevent eviction
   * @param {Function} operation - Async function to execute
   * @param {string} operationName - Name of operation for logging
   * @returns {Promise<any>} - Result of the operation
   */
  async executeWithRetry(operation, operationName) {
    // Ensure connection is valid before starting operation
    try {
      await this.ensureConnection();
    } catch (error) {
      logger.error(`Failed to ensure database connection before ${operationName}`, error, {
        authId: this.authId,
      });
      throw error;
    }

    // Mark connection as active to prevent eviction during operation
    this._markActive();

    try {
      const result = await operation();
      // Mark inactive on success
      this._markInactive();
      return result;
    } catch (error) {
      // Mark inactive before retry logic
      this._markInactive();

      if (isClosedDatabaseError(error) && this.userDatabaseManager) {
        logger.warn(`Database connection closed during ${operationName}, refreshing and retrying`, {
          authId: this.authId,
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
        });

        try {
          // Refresh connection and retry
          await this.ensureConnection();
          // Mark new connection as active for retry
          this._markActive();
          const result = await operation();
          // Mark inactive on success
          this._markInactive();
          return result;
        } catch (retryError) {
          // Mark inactive on retry failure
          this._markInactive();
          // If retry also fails with closed database error, log and re-throw
          if (isClosedDatabaseError(retryError)) {
            logger.error(`Database connection still closed after refresh during ${operationName}`, retryError, {
              authId: this.authId,
              errorName: retryError.name,
              errorMessage: retryError.message,
            });
          }
          throw retryError;
        }
      } else {
        // Re-throw if not a closed database error or can't retry
        throw error;
      }
    }
  }

  /**
   * Get the current database connection
   * @returns {Object} - Database connection
   */
  getDatabase() {
    return this.userDb;
  }

  /**
   * Get the state diff engine
   * @returns {StateDiffEngine} - State diff engine instance
   */
  getStateDiffEngine() {
    return this.stateDiffEngine;
  }

  /**
   * Get the derived fields engine
   * @returns {DerivedFieldsEngine} - Derived fields engine instance
   */
  getDerivedFieldsEngine() {
    return this.derivedFieldsEngine;
  }

  /**
   * Get the speed aggregator
   * @returns {SpeedAggregator} - Speed aggregator instance
   */
  getSpeedAggregator() {
    return this.speedAggregator;
  }
}

export default DatabaseConnectionManager;
