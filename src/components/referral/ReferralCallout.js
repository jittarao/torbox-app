'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Gift, X } from '@/components/icons';
import { useReferralEligibility } from '@/hooks/useReferralEligibility';
import { dismissReferralReminder, REFERRAL_CALLOUT_DISMISS_KEY } from '@/utils/referralDismissal';
import { markReferralCalloutShownThisSession } from '@/utils/referralEligibility';
import ReferralConfirmDialog from '@/components/referral/ReferralConfirmDialog';
import { useReferralActions } from '@/components/referral/useReferralActions';

/**
 * @param {Object} props
 * @param {string} props.apiKey
 * @param {'slim'|'compact'} [props.variant]
 * @param {Function} [props.onToast]
 * @param {Function} [props.onDismiss]
 * @param {Function} [props.onApplied]
 * @param {boolean} [props.promptFromQuery]
 */
export default function ReferralCallout({
  apiKey,
  variant = 'compact',
  onToast,
  onDismiss,
  onApplied,
  promptFromQuery = false,
}) {
  const t = useTranslations('Referral');
  const { eligibility, loading, refresh } = useReferralEligibility(apiKey, { promptFromQuery });

  const actions = useReferralActions({
    apiKey,
    onToast,
    onApplied: () => {
      onApplied?.();
      refresh();
    },
    t,
  });

  useEffect(() => {
    if (!loading && eligibility.showCallout) {
      markReferralCalloutShownThisSession();
    }
  }, [loading, eligibility.showCallout]);

  if (loading || !eligibility.showCallout) {
    return (
      <ReferralConfirmDialog
        isOpen={actions.showConfirm}
        onClose={() => actions.setShowConfirm(false)}
        onConfirm={actions.runApply}
        isLoading={actions.isApplying}
      />
    );
  }

  const handleDismiss = () => {
    dismissReferralReminder(REFERRAL_CALLOUT_DISMISS_KEY, 30);
    onDismiss?.();
    refresh();
  };

  const isSlim = variant === 'slim';

  return (
    <>
      <output
        className={
          isSlim
            ? 'mb-2 flex flex-col gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between'
            : 'mb-2 flex flex-col gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between'
        }
      >
        <div className="flex items-start gap-2 min-w-0">
          <Gift className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p className="text-sm text-zinc-800 dark:text-zinc-200">
            {isSlim ? t('callout.slimMessage') : t('callout.compactMessage')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {eligibility.canAutoApply && (
            <button
              type="button"
              onClick={actions.requestApply}
              className="ui-btn-primary !py-1.5 !px-3 !text-xs"
            >
              {t('callout.apply')}
            </button>
          )}
          <a
            href={actions.referralLink}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-btn-ghost !py-1.5 !px-3 !text-xs"
          >
            {t('callout.subscribe')}
          </a>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded"
            aria-label={t('callout.dismiss')}
          >
            <X className="size-4" />
          </button>
        </div>
      </output>

      <ReferralConfirmDialog
        isOpen={actions.showConfirm}
        onClose={() => actions.setShowConfirm(false)}
        onConfirm={actions.runApply}
        isLoading={actions.isApplying}
      />
    </>
  );
}
