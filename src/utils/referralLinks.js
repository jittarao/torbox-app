/**
 * TorBox subscription/referral URLs (must match torbox.app subscription page behavior).
 * @param {string} referralCode
 * @returns {string}
 */
export function buildTorboxSubscriptionReferralUrl(referralCode) {
  const code = String(referralCode || '').trim();
  if (!code) return 'https://torbox.app/subscription';
  return `https://torbox.app/subscription?referral=${encodeURIComponent(code)}`;
}

/**
 * Login URL that returns to subscription with referral after sign-in (new users).
 * @param {string} referralCode
 * @returns {string}
 */
export function buildTorboxSignupReferralUrl(referralCode) {
  const code = String(referralCode || '').trim();
  if (!code) return 'https://torbox.app/login';
  const next = `/subscription?referral=${code}`;
  return `https://torbox.app/login?next=${encodeURIComponent(next)}`;
}
