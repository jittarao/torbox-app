'use client';

import { useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSessionStore } from '@/store/sessionStore';
import {
  selectReferralCoreEligibility,
  useReferralEligibilityStore,
} from '@/store/referralEligibilityStore';

/**
 * @param {string} apiKey
 * @param {{ promptFromQuery?: boolean }} [options]
 */
export function useReferralEligibility(apiKey, options = {}) {
  const { promptFromQuery = false } = options;
  const { userData, permissionsLoading } = useSessionStore(
    useShallow((state) => ({
      userData: state.userData,
      permissionsLoading: state.permissionsLoading,
    }))
  );

  const { subscriptions, eligibility, loading } = useReferralEligibilityStore(
    useShallow((state) => ({
      subscriptions: state.subscriptions,
      eligibility: state.eligibility,
      loading: state.loading,
    }))
  );

  const userDataId = userData?.id ?? null;

  useEffect(() => {
    const store = useReferralEligibilityStore.getState();
    const sessionUserData = useSessionStore.getState().userData;

    if (!apiKey) {
      store.reset();
      return;
    }

    if (!userDataId || !sessionUserData) {
      return;
    }

    const abortController = new AbortController();
    store.ensureLoaded(apiKey, sessionUserData, { promptFromQuery }, abortController.signal);

    return () => abortController.abort();
  }, [apiKey, userDataId, promptFromQuery]);

  const refresh = useCallback(async () => {
    const abortController = new AbortController();
    const sessionStore = useSessionStore.getState();
    await sessionStore.loadPermissions(apiKey);
    const latestUserData = useSessionStore.getState().userData;
    await useReferralEligibilityStore
      .getState()
      .refresh(apiKey, latestUserData, { promptFromQuery }, abortController.signal);
  }, [apiKey, promptFromQuery]);

  const coreEligibility = selectReferralCoreEligibility({ subscriptions }, apiKey, userData);

  return {
    loading: permissionsLoading || loading || (!userData && Boolean(apiKey)),
    userData,
    subscriptions,
    eligibility,
    coreEligibility,
    refresh,
    isFreePlan: coreEligibility.reason === 'eligible' || coreEligibility.reason === 'dismissed',
  };
}
