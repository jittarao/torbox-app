import { getItem, setItem, removeItem } from '@/utils/storage';

const STORAGE_PREFIX = 'torbox-referral-dismiss:';

function getDismissUntil(key) {
  try {
    const raw = getItem(`${STORAGE_PREFIX}${key}`);
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

export function dismissReferralReminder(key, days = 30) {
  const until = new Date();
  until.setDate(until.getDate() + days);
  setItem(
    `${STORAGE_PREFIX}${key}`,
    JSON.stringify({ until: until.toISOString(), dismissedAt: new Date().toISOString() })
  );
}

export function isReferralReminderDismissed(key) {
  const until = getDismissUntil(key);
  if (!until) return false;
  if (until.getTime() > Date.now()) return true;
  clearReferralDismissal(key);
  return false;
}

export function clearReferralDismissal(key) {
  removeItem(`${STORAGE_PREFIX}${key}`);
}

export const REFERRAL_CALLOUT_DISMISS_KEY = 'referral-callout';
export const REFERRAL_PANEL_DISMISS_KEY = 'referral-panel-promo';
