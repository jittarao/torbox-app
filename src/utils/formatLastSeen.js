import { parseUtcDate } from './parseUtcDate';

const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Format last-seen timestamp for admin display.
 * @param {string | null | undefined} lastSeenAt - ISO or SQLite datetime
 * @param {{ isOnline?: boolean, now?: Date }} [options]
 * @returns {string}
 */
export function formatLastSeen(lastSeenAt, options = {}) {
  const { isOnline = false, now = new Date() } = options;

  if (isOnline) {
    return 'Online';
  }

  if (!lastSeenAt) {
    return 'Never';
  }

  const seen = parseUtcDate(lastSeenAt);
  if (Number.isNaN(seen.getTime())) {
    return '—';
  }

  const diffMs = now.getTime() - seen.getTime();
  if (diffMs < ONLINE_WINDOW_MS) {
    return 'Online';
  }

  if (diffMs < MINUTE_MS) {
    return 'Just now';
  }

  const minutes = Math.floor(diffMs / MINUTE_MS);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(diffMs / HOUR_MS);
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }

  const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startYesterday = new Date(startToday.getTime() - DAY_MS);
  const seenUtc = new Date(Date.UTC(seen.getUTCFullYear(), seen.getUTCMonth(), seen.getUTCDate()));

  if (seenUtc.getTime() === startToday.getTime() - DAY_MS) {
    return 'Yesterday';
  }

  if (diffMs < 7 * DAY_MS) {
    const days = Math.floor(diffMs / DAY_MS);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }

  return seen.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
