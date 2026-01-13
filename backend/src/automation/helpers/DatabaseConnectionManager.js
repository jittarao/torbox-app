import StateDiffEngine from '../StateDiffEngine.js';
import DerivedFieldsEngine from '../DerivedFieldsEngine.js';
import SpeedAggregator from '../SpeedAggregator.js';
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
   * Check if an error is a closed database error
   * @param {Error} error - Error to check
   * @returns {boolean} - True if error indicates closed database
   */
  static isClosedDatabaseError(error) {
    return (
      error.name === 'RangeError' ||
      (error.message &&
        (error.message.includes('closed database') ||
          error.message.includes('Cannot use a closed database')))
    );
  }

  /**
   * Check if database connection is closed and refresh if needed
   * @returns {Promise<void>}
   */
  async ensureConnection() {
    // Check if database is still valid by attempting a simple query
    try {
      this.userDb.prepare('SELECT 1').get();
      // Connection is valid, no need to refresh
      return;
    } catch (error) {
      // Database is closed or invalid, need to refresh
      if (DatabaseConnectionManager.isClosedDatabaseError(error)) {
        logger.warn('Database connection is closed, refreshing connection', {
          authId: this.authId,
          errorName: error.name,
          errorMessage: error.message,
        });

        if (!this.userDatabaseManager) {
          throw new Error('Cannot refresh database connection: userDatabaseManager not available');
        }

        // Re-acquire database connection
        const dbConnection = await this.userDatabaseManager.getUserDatabase(this.authId);
        this.userDb = dbConnection.db;

        // Update all engines with the new connection
        this.stateDiffEngine = new StateDiffEngine(this.userDb);
        this.derivedFieldsEngine = new DerivedFieldsEngine(this.userDb);
        this.speedAggregator = new SpeedAggregator(this.userDb);

        logger.info('Database connection refreshed successfully', {
          authId: this.authId,
        });
      } else {
        // Some other error, re-throw it
        throw error;
      }
    }
  }

  /**
   * Execute a database operation with automatic retry on closed database error
   * @param {Function} operation - Async function to execute
   * @param {string} operationName - Name of operation for logging
   * @returns {Promise<any>} - Result of the operation
   */
  async executeWithRetry(operation, operationName) {
    try {
      return await operation();
    } catch (error) {
      // Check if this is a closed database error and retry with fresh connection
      if (DatabaseConnectionManager.isClosedDatabaseError(error) && this.userDatabaseManager) {
        logger.warn(`Database connection closed during ${operationName}, refreshing and retrying`, {
          authId: this.authId,
          errorName: error.name,
          errorMessage: error.message,
        });

        // Refresh connection and retry
        await this.ensureConnection();
        return await operation();
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
