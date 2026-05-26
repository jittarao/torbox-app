'use client';

import { useTranslations } from 'next-intl';

export default function ReferralBenefitChips({ className = '' }) {
  const t = useTranslations('Referral.examples');

  const chips = [
    { label: t('oneMonth') },
    { label: t('threeMonths') },
    { label: t('twelveMonths') },
  ];

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200"
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}
