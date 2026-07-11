const HAS_TIMEZONE_SUFFIX = /(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Parse SQLite / ISO timestamps stored as UTC without a timezone suffix.
 * JavaScript's Date constructor treats "YYYY-MM-DD HH:MM:SS" as local time.
 *
 * @param {string|number|Date|null|undefined} dateString
 * @returns {Date}
 */
export function parseUtcDate(dateString) {
  if (dateString == null || dateString === '') {
    return new Date();
  }

  if (dateString instanceof Date) {
    return dateString;
  }

  if (typeof dateString === 'number') {
    return new Date(dateString);
  }

  const value = String(dateString);

  if (value.includes('T')) {
    if (HAS_TIMEZONE_SUFFIX.test(value)) {
      return new Date(value);
    }
    return new Date(`${value}Z`);
  }

  return new Date(`${value.replace(' ', 'T')}Z`);
}
