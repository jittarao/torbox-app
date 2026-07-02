import { create } from 'zustand';
import { fetchUserSubscriptions } from '@/utils/userProfile';
import {
  getReferralEligibility,
  getReferralEligibilityCore,
  isOwnReferralCode,
} from '@/utils/referralEligibility';
import { markReferralAppliedForKey } from '@/utils/referralApplied';

const DEFAULT_ELIGIBILITY = {
  showCallout: false,
  canAutoApply: false,
  reason: 'loading',
};

function buildOptionsKey(options = {}) {
  return options.promptFromQuery ? 'prompt' : 'default';
}

export const useReferralEligibilityStore = create((set, get) => ({
  subscriptions: null,
  loading: false,
  eligibility: DEFAULT_ELIGIBILITY,
  _loadKey: null,
  _loadPromise: null,
  _completedLoadKey: null,

  reset: () => {
    set({
      subscriptions: null,
      loading: false,
      eligibility: DEFAULT_ELIGIBILITY,
      _loadKey: null,
      _loadPromise: null,
      _completedLoadKey: null,
    });
  },

  refresh: async (apiKey, userData, options = {}, signal) => {
    get().reset();
    return get().ensureLoaded(apiKey, userData, options, signal, { force: true });
  },

  ensureLoaded: async (apiKey, userData, options = {}, signal, { force = false } = {}) => {
    if (!apiKey || apiKey.length < 20) {
      set({
        subscriptions: null,
        loading: false,
        eligibility: { showCallout: false, canAutoApply: false, reason: 'no_api_key' },
        _loadKey: null,
        _loadPromise: null,
      });
      return;
    }

    if (!userData) {
      set({ loading: true, eligibility: DEFAULT_ELIGIBILITY });
      return;
    }

    const loadKey = `${apiKey}:${buildOptionsKey(options)}`;
    const { _loadPromise, _loadKey, _completedLoadKey } = get();

    if (!force && _completedLoadKey === loadKey) {
      return;
    }

    if (!force && _loadPromise && _loadKey === loadKey) {
      return _loadPromise;
    }

    set({ loading: true, _loadKey: loadKey });

    const promise = (async () => {
      try {
        const subscriptions = await fetchUserSubscriptions(apiKey, { signal, force });
        if (signal?.aborted) return;

        if (isOwnReferralCode(userData)) {
          markReferralAppliedForKey(apiKey);
        }

        const eligibility = getReferralEligibility({
          apiKey,
          userData,
          subscriptions,
          ignoreDismissal: options.promptFromQuery,
          ignoreSessionCap: options.promptFromQuery,
        });

        if (get()._loadKey !== loadKey) return;

        set({
          subscriptions,
          eligibility,
          loading: false,
          _completedLoadKey: loadKey,
        });
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') return;
        console.error('Error loading referral eligibility:', error);
        if (get()._loadKey === loadKey) {
          set({
            loading: false,
            eligibility: { showCallout: false, canAutoApply: false, reason: 'error' },
          });
        }
      } finally {
        if (get()._loadKey === loadKey) {
          set({ _loadPromise: null });
        }
      }
    })();

    set({ _loadPromise: promise });
    return promise;
  },
}));

export function selectReferralCoreEligibility(state, apiKey, userData) {
  return getReferralEligibilityCore({
    apiKey,
    userData,
    subscriptions: state.subscriptions,
  });
}
