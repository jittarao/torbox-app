'use client';

import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';
import ReferralBenefitChips from '@/components/referral/ReferralBenefitChips';
import ReferralConfirmDialog from '@/components/referral/ReferralConfirmDialog';
import { useReferralEligibility } from '@/hooks/useReferralEligibility';
import { useReferralActions } from '@/components/referral/useReferralActions';
import { REFERRAL_HELP_URL } from '@/components/constants';

export default function ReferralUpgradeCard({ apiKey, onToast, onApplied }) {
  const t = useTranslations('Referral');
  const { eligibility, loading, refresh } = useReferralEligibility(apiKey);

  const actions = useReferralActions({
    apiKey,
    onToast,
    onApplied: () => {
      onApplied?.();
      refresh();
    },
    t,
  });

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

  return (
    <>
      <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-3">
          <Icons.Gift className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <h2 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
              {t('upgradeCard.title')}
            </h2>
            <p className="text-sm text-muted dark:text-muted-dark mt-1">{t('upgradeCard.description')}</p>
          </div>
        </div>
        <ReferralBenefitChips className="mb-4" />
        <div className="flex flex-wrap gap-2">
          {eligibility.canAutoApply && (
            <button type="button" onClick={actions.requestApply} className="ui-btn-primary !text-sm">
              {t('apply.button')}
            </button>
          )}
          <a
            href={actions.referralLink}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-btn-ghost !text-sm"
          >
            {t('panel.openSubscription')}
          </a>
          <button
            type="button"
            onClick={actions.copyLink}
            className="ui-btn-ghost !text-sm gap-1.5"
          >
            {actions.copiedItem === 'link' ? (
              <Icons.Check className="w-4 h-4" />
            ) : (
              <Icons.Copy className="w-4 h-4" />
            )}
            {t('copyLink')}
          </button>
        </div>
        <p className="text-xs text-muted dark:text-muted-dark mt-4">
          <a
            href={REFERRAL_HELP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-600 dark:hover:text-amber-400"
          >
            {t('panel.helpLink')}
          </a>
        </p>
      </div>

      <ReferralConfirmDialog
        isOpen={actions.showConfirm}
        onClose={() => actions.setShowConfirm(false)}
        onConfirm={actions.runApply}
        isLoading={actions.isApplying}
      />
    </>
  );
}
