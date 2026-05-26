'use client';

import { useState, useCallback } from 'react';
import { REFERRAL_CODE, REFERRAL_LINK } from '@/components/constants';
import { applyReferralToAccount } from '@/utils/referralEligibility';
import { markReferralAppliedForKey } from '@/utils/referralApplied';

/**
 * @param {Object} params
 * @param {string} [params.apiKey]
 * @param {Function} [params.onToast]
 * @param {Function} [params.onApplied]
 * @param {Function} [params.t] - useTranslations('Referral')
 */
export function useReferralActions({ apiKey, onToast, onApplied, t }) {
  const [copiedItem, setCopiedItem] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const notify = useCallback(
    (message, type = 'success') => {
      if (onToast) {
        onToast({ message, type });
      } else {
        setStatusMessage({ message, type });
        setTimeout(() => setStatusMessage(null), 3000);
      }
    },
    [onToast]
  );

  const copyToClipboard = useCallback(
    async (text, item) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedItem(item);
        setTimeout(() => setCopiedItem(null), 2000);
        notify(t('copied'), 'success');
      } catch (err) {
        console.error('Failed to copy:', err);
        notify(t('error'), 'error');
      }
    },
    [notify, t]
  );

  const runApply = useCallback(async () => {
    if (!apiKey) return;
    setIsApplying(true);
    try {
      const result = await applyReferralToAccount(apiKey, REFERRAL_CODE);
      if (result.success) {
        markReferralAppliedForKey(apiKey);
        notify(t('apply.success'), 'success');
        setShowConfirm(false);
        onApplied?.();
      } else if (result.alreadyHasReferrer) {
        markReferralAppliedForKey(apiKey);
        notify(t('apply.alreadyHasReferrer'), 'info');
        setShowConfirm(false);
        onApplied?.();
      } else {
        notify(result.error || t('apply.error'), 'error');
      }
    } catch (err) {
      console.error('Apply referral failed:', err);
      notify(t('apply.error'), 'error');
    } finally {
      setIsApplying(false);
    }
  }, [apiKey, notify, onApplied, t]);

  const requestApply = useCallback(() => {
    if (!apiKey) {
      notify(t('apply.needApiKey'), 'error');
      return;
    }
    setShowConfirm(true);
  }, [apiKey, notify, t]);

  return {
    copiedItem,
    isApplying,
    showConfirm,
    setShowConfirm,
    statusMessage,
    copyToClipboard,
    runApply,
    requestApply,
    copyLink: () => copyToClipboard(REFERRAL_LINK, 'link'),
    copyCode: () => copyToClipboard(REFERRAL_CODE, 'code'),
    referralLink: REFERRAL_LINK,
    referralCode: REFERRAL_CODE,
  };
}
