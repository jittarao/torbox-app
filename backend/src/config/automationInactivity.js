import { formatSqliteUtc } from '../utils/sqliteDatetime.js';

export const DEFAULT_AUTOMATION_INACTIVE_USER_DAYS = 30;

export const INACTIVITY_ELIGIBILITY_SQL = '(ur.last_seen_at IS NULL OR ur.last_seen_at >= ?)';
export const INACTIVITY_INELIGIBILITY_SQL = 'ur.last_seen_at IS NOT NULL AND ur.last_seen_at < ?';

/** How long to defer re-evaluation of pending actions for inactive users. */
export const INACTIVITY_RECHECK_INTERVAL_MS = 60 * 60 * 1000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getAutomationInactivityDays() {
  const raw = process.env.AUTOMATION_INACTIVE_USER_DAYS;
  const parsed = parseInt(raw ?? String(DEFAULT_AUTOMATION_INACTIVE_USER_DAYS), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_AUTOMATION_INACTIVE_USER_DAYS;
  }
  return Math.max(0, parsed);
}

export function isAutomationInactivityFilterEnabled() {
  return getAutomationInactivityDays() > 0;
}

/**
 * @param {number} [referenceMs] - reference time in ms (default: Date.now())
 * @returns {string|null} SQLite UTC datetime cutoff, or null when filter disabled
 */
export function computeAutomationInactivityCutoff(referenceMs = Date.now()) {
  const days = getAutomationInactivityDays();
  if (days === 0) return null;
  return formatSqliteUtc(new Date(referenceMs - days * MS_PER_DAY));
}

/**
 * @param {string|null|undefined} lastSeenAt
 * @param {string|null} cutoff
 * @returns {boolean}
 */
export function isUserEligibleForAutomation(lastSeenAt, cutoff) {
  if (!cutoff) return true;
  if (lastSeenAt == null || String(lastSeenAt).trim() === '') return true;
  return String(lastSeenAt) >= cutoff;
}

/**
 * Fast-persist activity for a returning user on manual automation paths so
 * authenticated requests are not blocked by ActivityTracker's 5-minute debounce.
 * @param {{ masterDatabase: import('../database/Database.js').default, activityTracker?: import('../services/ActivityTracker.js').default | null }} backend
 * @param {string} authId
 * @returns {boolean} true when the user is eligible after reactivation (or was already eligible)
 */
export function reactivateUserForManualAutomation(backend, authId) {
  const cutoff = computeAutomationInactivityCutoff();
  if (!cutoff) return true;

  let userInfo = backend.masterDatabase.getUserRegistryInfo(authId);
  if (isUserEligibleForAutomation(userInfo?.last_seen_at, cutoff)) return true;

  const now = new Date();
  if (backend.activityTracker) {
    backend.activityTracker.touch(authId, now, { forcePersist: true });
    backend.activityTracker.flush();
  } else {
    backend.masterDatabase.touchUserActivityBatch([{ authId, at: now }]);
  }

  userInfo = backend.masterDatabase.getUserRegistryInfo(authId);
  return isUserEligibleForAutomation(userInfo?.last_seen_at, cutoff);
}
