'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchUserProfile } from '@/utils/userProfile';
import {
  getReferralEligibility,
  getReferralEligibilityCore,
  isOwnReferralCode,
} from '@/utils/referralEligibility';
import { markReferralAppliedForKey } from '@/utils/referralApplied';

/**
 * @param {string} apiKey
 * @param {{ promptFromQuery?: boolean }} [options]
 */
export function useReferralEligibility(apiKey, options = {}) {
  const { promptFromQuery = false } = options;
  const [userData, setUserData] = useState(null);
  const [subscriptions, setSubscriptions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [eligibility, setEligibility] = useState({
    showCallout: false,
    canAutoApply: false,
    reason: 'loading',
  });

  const refresh = useCallback(async () => {
    if (!apiKey || apiKey.length < 20) {
      setUserData(null);
      setSubscriptions(null);
      setEligibility({ showCallout: false, canAutoApply: false, reason: 'no_api_key' });
      return;
    }

    setLoading(true);
    try {
      const [profile, subsResponse] = await Promise.all([
        fetchUserProfile(apiKey),
        fetch('/api/user/subscriptions', {
          headers: { 'x-api-key': apiKey },
        }).then((r) => (r.ok ? r.json() : null)),
      ]);

      const subs = subsResponse?.success ? subsResponse.data : null;
      setUserData(profile);
      setSubscriptions(subs);

      if (isOwnReferralCode(profile)) {
        markReferralAppliedForKey(apiKey);
      }

      const next = getReferralEligibility({
        apiKey,
        userData: profile,
        subscriptions: subs,
        ignoreDismissal: promptFromQuery,
        ignoreSessionCap: promptFromQuery,
      });
      setEligibility(next);
    } catch (error) {
      console.error('Error loading referral eligibility:', error);
      setEligibility({ showCallout: false, canAutoApply: false, reason: 'error' });
    } finally {
      setLoading(false);
    }
  }, [apiKey, promptFromQuery]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const coreEligibility = getReferralEligibilityCore({
    apiKey,
    userData,
    subscriptions,
  });

  return {
    loading,
    userData,
    subscriptions,
    eligibility,
    coreEligibility,
    refresh,
    isFreePlan: coreEligibility.reason === 'eligible' || coreEligibility.reason === 'dismissed',
  };
}
