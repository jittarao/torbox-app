import { timeAgo } from '@/components/downloads/utils/formatters';

/**
 * Get expiration date from generated date
 * Links expire 4 hours after generation
 * @param {string} generatedAt - UTC datetime string in SQLite or ISO format
 * @param {Function} t - Translation function
 * @param {Function} linkHistoryT - LinkHistory translation function
 * @returns {string} Formatted expiration date or "expired" message
 */
export const getExpirationDate = (generatedAt, t, linkHistoryT) => {
  // Backend returns UTC datetime strings in SQLite format "YYYY-MM-DD HH:MM:SS"
  // JavaScript's Date constructor interprets strings without timezone as local time
  // We need to explicitly parse it as UTC by converting to ISO format with 'Z' suffix
  let utcDateString;
  if (generatedAt.includes('T')) {
    // Already in ISO format, ensure it has 'Z' for UTC
    utcDateString = generatedAt.endsWith('Z') ? generatedAt : `${generatedAt}Z`;
  } else {
    // SQLite format "YYYY-MM-DD HH:MM:SS" - convert to ISO "YYYY-MM-DDTHH:MM:SSZ"
    utcDateString = `${generatedAt.replace(' ', 'T')}Z`;
  }

  const generatedDate = new Date(utcDateString);
  const expirationDate = new Date(generatedDate.getTime() + 4 * 60 * 60 * 1000);
  const now = new Date();

  if (expirationDate < now) {
    return linkHistoryT('expired');
  }
  return timeAgo(expirationDate, t);
};

/**
 * Generate page numbers for pagination with ellipsis
 * @param {number} currentPage - Current page number
 * @param {number} totalPages - Total number of pages
 * @returns {Array<number|string>} Array of page numbers with ellipsis
 */
export const getPageNumbers = (currentPage, totalPages) => {
  const pages = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    if (currentPage <= 3) {
      for (let i = 1; i <= 4; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 3; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    }
  }
  return pages;
};
