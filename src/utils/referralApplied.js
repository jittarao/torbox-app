const APPLIED_PREFIX = 'torbox-referral-applied:';

/**
 * @param {string} apiKey
 * @returns {string}
 */
export function getApiKeyFingerprint(apiKey) {
  if (!apiKey || apiKey.length < 12) return apiKey || '';
  return `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`;
}

/**
 * @param {string} apiKey
 * @returns {boolean}
 */
export function isReferralAppliedForKey(apiKey) {
  if (typeof localStorage === 'undefined' || !apiKey) return false;
  return localStorage.getItem(`${APPLIED_PREFIX}${getApiKeyFingerprint(apiKey)}`) === 'true';
}

/**
 * @param {string} apiKey
 */
export function markReferralAppliedForKey(apiKey) {
  if (typeof localStorage === 'undefined' || !apiKey) return;
  localStorage.setItem(`${APPLIED_PREFIX}${getApiKeyFingerprint(apiKey)}`, 'true');
}

/**
 * @param {string} apiKey
 */
export function clearReferralAppliedForKey(apiKey) {
  if (typeof localStorage === 'undefined' || !apiKey) return;
  localStorage.removeItem(`${APPLIED_PREFIX}${getApiKeyFingerprint(apiKey)}`);
}
