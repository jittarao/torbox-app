import { REFERRAL_CODE } from '@/components/constants';
import { isReferralAppliedForKey } from '@/utils/referralApplied';
import {
  isReferralReminderDismissed,
  REFERRAL_CALLOUT_DISMISS_KEY,
} from '@/utils/referralDismissal';

/**
 * @param {Object|null} userData
 * @returns {number|null}
 */
function getPlanId(userData) {
  if (!userData || userData.plan == null) return null;
  return typeof userData.plan === 'object' ? userData.plan?.id : userData.plan;
}

/**
 * @param {Object|null} userData
 * @returns {boolean}
 */
function userHasReferrerAttached(userData) {
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
 * Account owns the configured app referral code (e.g. developer using their own code).
 * @param {Object|null} userData
 * @param {string} [referralCode]
 * @returns {boolean}
 */
export function isOwnReferralCode(userData, referralCode = REFERRAL_CODE) {
  if (!userData?.user_referral || !referralCode) return false;
  return String(userData.user_referral).toLowerCase() === String(referralCode).toLowerCase();
}

/**
 * @param {Object} data - TorBox addreferral error payload
 * @returns {{ alreadyHasReferrer: boolean, isSelfReferral: boolean }}
 */
function classifyReferralApplyError(data) {
  const detail = String(data.detail || data.error || '').toLowerCase();
  const errorCode = String(data.error || '').toUpperCase();

  const isSelfReferral =
    errorCode === 'WHY_ARE_YOU_LIKE_THIS' ||
    detail.includes('cannot refer yourself') ||
    detail.includes("can't refer yourself");

  const alreadyHasReferrer =
    !isSelfReferral &&
    (detail.includes('already') ||
      detail.includes('existing referrer') ||
      errorCode === 'DUPLICATE_ITEM');

  return { alreadyHasReferrer, isSelfReferral };
}

/**
 * @param {Array|null|undefined} subscriptions
 * @returns {boolean}
 */
function hasPaidSubscriptionHistory(subscriptions) {
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

  if (isOwnReferralCode(userData)) {
    return { eligible: false, canAutoApply: false, reason: 'own_referral_code' };
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
 * @returns {Promise<{ success: boolean, error?: string, detail?: string, alreadyHasReferrer?: boolean, isSelfReferral?: boolean, skipFutureAttempts?: boolean }>}
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

  // TorBox API: { success: true, error: null, detail: "Successfully added referral.", data: null }
  if (response.ok && data.success === true) {
    return { success: true, detail: data.detail };
  }

  const { alreadyHasReferrer, isSelfReferral } = classifyReferralApplyError(data);
  const skipFutureAttempts = alreadyHasReferrer || isSelfReferral || response.status === 409;

  return {
    success: false,
    error: data.detail || data.error || 'Failed to apply referral code',
    detail: data.detail,
    alreadyHasReferrer,
    isSelfReferral,
    skipFutureAttempts,
  };
}
