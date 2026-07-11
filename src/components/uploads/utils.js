import { parseUtcDate } from '@/utils/parseUtcDate';
import { timeAgo } from '@/components/downloads/utils/formatters';

/** Stable numeric id for Set lookups and API payloads (SQLite/json may use number or string). */
export function normalizeUploadId(id) {
  if (id == null || id === '') return null;
  const numId = typeof id === 'string' ? parseInt(id, 10) : Number(id);
  if (!Number.isFinite(numId) || numId <= 0) return null;
  return numId;
}

// Format error messages for better user experience
export const formatErrorMessage = (errorMessage) => {
  if (!errorMessage) return null;

  // File not found
  if (errorMessage.includes('File not found')) {
    return 'File not found. The upload file may have been deleted.';
  }

  // Missing required option
  if (
    errorMessage.includes('MISSING_REQUIRED_OPTION') ||
    errorMessage.includes('Missing required option')
  ) {
    return 'Missing required option. Please check upload settings.';
  }

  // Invalid option
  if (errorMessage.includes('INVALID_OPTION') || errorMessage.includes('Invalid option')) {
    return 'Invalid option. Please check upload settings.';
  }

  // File or magnet link required
  if (errorMessage.includes('You must provide either a file or magnet link')) {
    return 'Invalid upload: file or magnet link is required.';
  }

  // Return original message if no match
  return errorMessage;
};

// Format date in local browser timezone with consistent formatting
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseUtcDate(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';

    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Invalid date';
  }
};

export const formatTimeAgo = (dateString, t) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseUtcDate(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return timeAgo(date, t);
  } catch {
    return 'N/A';
  }
};
