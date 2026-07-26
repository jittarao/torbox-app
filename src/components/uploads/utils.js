import { parseUtcDate } from '@/utils/parseUtcDate';
import { timeAgo } from '@/components/downloads/utils/formatters';

/** Keep in sync with backend/src/automation/uploadDeferral.js */
export const UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE =
  'Uncached rate limit reached. Will retry automatically.';
export const CONNECTION_DEFERRAL_MESSAGE = 'TorBox API unavailable. Will retry automatically.';
export const EXTERNAL_TORBOX_RATE_LIMIT_DEFERRAL_MESSAGE =
  'Rate limit reached. Will retry automatically.';
export const TRANSIENT_TORBOX_DEFERRAL_MESSAGE =
  'TorBox is still processing a queued upload. Will retry automatically.';

const TRANSIENT_DEFERRAL_MESSAGES = [
  UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE,
  CONNECTION_DEFERRAL_MESSAGE,
  EXTERNAL_TORBOX_RATE_LIMIT_DEFERRAL_MESSAGE,
  TRANSIENT_TORBOX_DEFERRAL_MESSAGE,
];

/** Stable numeric id for Set lookups and API payloads (SQLite/json may use number or string). */
export function normalizeUploadId(id) {
  if (id == null || id === '') return null;
  const numId = typeof id === 'string' ? parseInt(id, 10) : Number(id);
  if (!Number.isFinite(numId) || numId <= 0) return null;
  return numId;
}

export function isTransientDeferralMessage(errorMessage) {
  if (!errorMessage || typeof errorMessage !== 'string') return false;
  return TRANSIENT_DEFERRAL_MESSAGES.includes(errorMessage);
}

export function isUploadDeferred(nextAttemptAt) {
  if (!nextAttemptAt) return false;
  const date = parseUtcDate(nextAttemptAt);
  return !isNaN(date.getTime()) && date.getTime() > Date.now();
}

function getDeferralReasonKey(errorMessage) {
  switch (errorMessage) {
    case UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE:
      return 'deferralReasonHourlyLimit';
    case EXTERNAL_TORBOX_RATE_LIMIT_DEFERRAL_MESSAGE:
      return 'deferralReasonExternalRateLimit';
    case CONNECTION_DEFERRAL_MESSAGE:
      return 'deferralReasonConnection';
    case TRANSIENT_TORBOX_DEFERRAL_MESSAGE:
      return 'deferralReasonTransient';
    default:
      return 'deferralReasonGeneric';
  }
}

/** Row hint for queued uploads waiting on next_attempt_at. */
export function getUploadRowDeferralHint(upload, tUploads, tCommon) {
  if (upload?.status !== 'queued' || !isUploadDeferred(upload.next_attempt_at)) {
    return null;
  }

  const reasonKey = getDeferralReasonKey(upload.error_message);
  const resumeTime = formatTimeAgo(upload.next_attempt_at, tCommon);
  return tUploads('deferralRowHint', {
    reason: tUploads(reasonKey),
    time: resumeTime,
  });
}

export function getUploadRowErrorMessage(upload) {
  if (!upload?.error_message) return null;
  if (upload.status === 'queued' && isTransientDeferralMessage(upload.error_message)) {
    return null;
  }
  return formatErrorMessage(upload.error_message);
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
