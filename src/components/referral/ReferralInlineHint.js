'use client';

import { useTranslations } from 'next-intl';
import { REFERRAL_LINK } from '@/components/constants';
import { useReferralEligibility } from '@/hooks/useReferralEligibility';

export default function ReferralInlineHint({ apiKey }) {
  const t = useTranslations('Referral.callout');
  const { eligibility, loading } = useReferralEligibility(apiKey);

  if (!apiKey || loading || !eligibility.showCallout) {
    return null;
  }

  return (
    <p className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 mt-4">
      {t('rssHint')}{' '}
      <a
        href={REFERRAL_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="text-amber-600 dark:text-amber-400 underline hover:no-underline"
      >
        {t('subscribe')}
      </a>
    </p>
  );
}
