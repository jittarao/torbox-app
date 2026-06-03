/**
 * Parse SQLite / ISO timestamps stored as UTC without a timezone suffix.
 * JavaScript's Date constructor treats "YYYY-MM-DD HH:MM:SS" as local time.
 *
 * @param {string|number|null|undefined} dateString
 * @returns {Date}
 */
export function parseUtcDate(dateString) {
  if (dateString == null || dateString === '') {
    return new Date();
  }

  if (typeof dateString === 'number') {
    return new Date(dateString);
  }

  const value = String(dateString);

  if (value.includes('T')) {
    const utcDateString = value.endsWith('Z') ? value : `${value}Z`;
    return new Date(utcDateString);
  }

  return new Date(`${value.replace(' ', 'T')}Z`);
}
