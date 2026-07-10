/**
 * Format a Date as SQLite datetime (YYYY-MM-DD HH:MM:SS) in UTC.
 * @param {Date} d
 * @returns {string}
 */
export function formatSqliteUtc(d) {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
