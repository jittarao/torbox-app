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
// Backend stores dates in UTC (from SQLite CURRENT_TIMESTAMP), so we need to parse them as UTC
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    // SQLite returns dates as "YYYY-MM-DD HH:MM:SS" in UTC (without timezone indicator)
    // We need to explicitly treat them as UTC by appending 'Z' or using UTC parsing
    let date;
    if (typeof dateString === 'string') {
      // If it's already in ISO format with 'Z', use it directly
      if (dateString.includes('T') && dateString.includes('Z')) {
        date = new Date(dateString);
      } else if (dateString.includes('T')) {
        // ISO format without Z - assume UTC
        date = new Date(dateString + 'Z');
      } else {
        // SQLite format: "YYYY-MM-DD HH:MM:SS" - replace space with T and add Z for UTC
        const utcString = dateString.replace(' ', 'T') + 'Z';
        date = new Date(utcString);
      }
    } else {
      date = new Date(dateString);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) return 'Invalid date';

    // Format with locale-specific options for consistent display in local timezone
    // toLocaleString automatically converts from UTC to local timezone
    // Use a more human-readable format: "Jan 15, 2026, 2:41:23 PM"
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch (error) {
    return 'Invalid date';
  }
};
