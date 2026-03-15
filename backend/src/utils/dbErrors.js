/**
 * Shared database error detection utilities.
 * Used by master Database and DatabaseConnectionManager to avoid duplicate logic.
 */

/**
 * Check if an error is a closed database error (SQLite / bun:sqlite).
 * @param {Error} error - Error to check
 * @returns {boolean} - True if error indicates closed database
 */
export function isClosedDatabaseError(error) {
  if (!error) return false;

  const message = (error.message && String(error.message).toLowerCase()) || '';
  if (
    message.includes('closed database') ||
    message.includes('database has closed') ||
    message.includes('database is closed') ||
    message.includes('cannot use a closed database') ||
    message.includes('database closed')
  ) {
    return true;
  }

  if (error.name === 'RangeError' || error.name === 'Error') {
    if (message.includes('closed') && message.includes('database')) {
      return true;
    }
  }

  return false;
}
