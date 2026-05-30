import { getItem, setItem } from '@/utils/storage';

const APPLIED_PREFIX = 'torbox-referral-applied:';

function getApiKeyFingerprint(apiKey) {
  if (!apiKey || apiKey.length < 12) return apiKey || '';
  return `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`;
}

export function isReferralAppliedForKey(apiKey) {
  if (typeof localStorage === 'undefined' || !apiKey) return false;
  return getItem(`${APPLIED_PREFIX}${getApiKeyFingerprint(apiKey)}`) === 'true';
}

export function markReferralAppliedForKey(apiKey) {
  if (typeof localStorage === 'undefined' || !apiKey) return;
  setItem(`${APPLIED_PREFIX}${getApiKeyFingerprint(apiKey)}`, 'true');
}
