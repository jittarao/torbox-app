import { isReferralAppliedForKey } from '@/utils/referralApplied';
import { isReferralReminderDismissed, REFERRAL_CALLOUT_DISMISS_KEY } from '@/utils/referralDismissal';

/**
 * @param {Object|null} userData
 * @returns {number|null}
 */
export function getPlanId(userData) {
  if (!userData || userData.plan == null) return null;
  return typeof userData.plan === 'object' ? userData.plan?.id : userData.plan;
}

/**
 * @param {Object|null} userData
 * @returns {boolean}
 */
export function userHasReferrerAttached(userData) {
  if (!userData) return false;
  return Boolean(
    userData.referred_by ||
      userData.referral_used ||
      userData.referral_code_used ||
      userData.using_referral ||
      userData.has_referral
  );
}

/**
 * @param {Array|null|undefined} subscriptions
 * @returns {boolean}
 */
export function hasPaidSubscriptionHistory(subscriptions) {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) return false;

  return subscriptions.some((subscription) => {
    const status = String(subscription?.status || '').toLowerCase();
    const paidStatuses = ['active', 'completed', 'paid', 'success', 'succeeded'];
    if (paidStatuses.includes(status)) return true;
    const price = Number(subscription?.price);
    return Number.isFinite(price) && price > 0;
  });
}

/**
 * Core eligibility without dismissal / session checks.
 * @param {Object} params
 * @param {string} [params.apiKey]
 * @param {Object|null} [params.userData]
 * @param {Array|null} [params.subscriptions]
 * @returns {{ eligible: boolean, canAutoApply: boolean, reason: string }}
 */
export function getReferralEligibilityCore({ apiKey, userData, subscriptions }) {
  if (!apiKey) {
    return { eligible: false, canAutoApply: false, reason: 'no_api_key' };
  }

  if (isReferralAppliedForKey(apiKey)) {
    return { eligible: false, canAutoApply: false, reason: 'applied_locally' };
  }

  if (userHasReferrerAttached(userData)) {
    return { eligible: false, canAutoApply: false, reason: 'has_referrer' };
  }

  const planId = getPlanId(userData);
  if (planId != null && planId > 0) {
    return { eligible: false, canAutoApply: false, reason: 'has_paid_plan' };
  }

  if (hasPaidSubscriptionHistory(subscriptions)) {
    return { eligible: false, canAutoApply: false, reason: 'has_subscription_history' };
  }

  return { eligible: true, canAutoApply: true, reason: 'eligible' };
}

const SESSION_SHOWN_KEY = 'referral-callout-shown-session';

/**
 * @param {Object} params
 * @param {string} [params.apiKey]
 * @param {Object|null} [params.userData]
 * @param {Array|null} [params.subscriptions]
 * @param {boolean} [params.ignoreDismissal]
 * @param {boolean} [params.ignoreSessionCap]
 * @returns {{ showCallout: boolean, canAutoApply: boolean, reason: string }}
 */
export function getReferralEligibility({
  apiKey,
  userData,
  subscriptions,
  ignoreDismissal = false,
  ignoreSessionCap = false,
}) {
  const core = getReferralEligibilityCore({ apiKey, userData, subscriptions });

  if (!core.eligible) {
    return { showCallout: false, canAutoApply: false, reason: core.reason };
  }

  if (!ignoreDismissal && isReferralReminderDismissed(REFERRAL_CALLOUT_DISMISS_KEY)) {
    return { showCallout: false, canAutoApply: core.canAutoApply, reason: 'dismissed' };
  }

  if (!ignoreSessionCap && typeof sessionStorage !== 'undefined') {
    if (sessionStorage.getItem(SESSION_SHOWN_KEY) === 'true') {
      return { showCallout: false, canAutoApply: core.canAutoApply, reason: 'session_cap' };
    }
  }

  return { showCallout: true, canAutoApply: core.canAutoApply, reason: core.reason };
}

/**
 * Mark callout as shown this browser session (frequency cap).
 */
export function markReferralCalloutShownThisSession() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SESSION_SHOWN_KEY, 'true');
}

/**
 * @param {string} apiKey
 * @param {string} referralCode
 * @returns {Promise<{ success: boolean, error?: string, detail?: string, alreadyHasReferrer?: boolean }>}
 */
export async function applyReferralToAccount(apiKey, referralCode) {
  const response = await fetch('/api/user/addreferral', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ referral: referralCode }),
  });

  const data = await response.json().catch(() => ({}));

  if (response.ok && data.success !== false) {
    return { success: true };
  }

  const detail = String(data.detail || data.error || '').toLowerCase();
  const alreadyHasReferrer =
    detail.includes('already') ||
    detail.includes('referral') ||
    response.status === 409 ||
    data.error === 'DUPLICATE_ITEM';

  return {
    success: false,
    error: data.detail || data.error || 'Failed to apply referral code',
    detail: data.detail,
    alreadyHasReferrer,
  };
}
