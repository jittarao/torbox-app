const STORAGE_PREFIX = 'torbox-referral-dismiss:';

/**
 * @param {string} key
 * @returns {Date|null}
 */
export function getDismissUntil(key) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.until) return null;
    const until = new Date(parsed.until);
    if (Number.isNaN(until.getTime())) return null;
    return until;
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {number} [days=30]
 */
export function dismissReferralReminder(key, days = 30) {
  if (typeof localStorage === 'undefined') return;
  const until = new Date();
  until.setDate(until.getDate() + days);
  localStorage.setItem(
    `${STORAGE_PREFIX}${key}`,
    JSON.stringify({ until: until.toISOString(), dismissedAt: new Date().toISOString() })
  );
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isReferralReminderDismissed(key) {
  const until = getDismissUntil(key);
  if (!until) return false;
  if (until.getTime() > Date.now()) return true;
  clearReferralDismissal(key);
  return false;
}

/**
 * @param {string} key
 */
export function clearReferralDismissal(key) {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
}

export const REFERRAL_CALLOUT_DISMISS_KEY = 'referral-callout';
export const REFERRAL_PANEL_DISMISS_KEY = 'referral-panel-promo';
