/**
 * Parse a SQLite timestamp string as UTC.
 * SQLite stores CURRENT_TIMESTAMP as "YYYY-MM-DD HH:MM:SS" with no timezone indicator.
 * JavaScript's Date constructor interprets strings without a timezone as local time, which
 * causes interval calculations to be off by the server's UTC offset.
 * @param {string|null} dateStr
 * @returns {Date}
 */
export function parseDbTimestamp(dateStr) {
  if (!dateStr) return new Date(NaN);
  if (typeof dateStr !== 'string') return new Date(dateStr);
  // Already has timezone indicator — parse as-is
  if (dateStr.includes('T') || dateStr.includes('Z') || dateStr.includes('+')) {
    return new Date(dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`);
  }
  // SQLite "YYYY-MM-DD HH:MM:SS" format — treat as UTC
  return new Date(`${dateStr.replace(' ', 'T')}Z`);
}
