'use client';

import { useState, useRef, useCallback } from 'react';
import useHeaderDropdownDismiss from '@/hooks/useHeaderDropdownDismiss';
import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';
import HeaderDropdownPanel from '@/components/shared/HeaderDropdownPanel';
import ReferralBenefitChips from '@/components/referral/ReferralBenefitChips';
import ReferralConfirmDialog from '@/components/referral/ReferralConfirmDialog';
import { useReferralActions } from '@/components/referral/useReferralActions';
import { useReferralEligibility } from '@/hooks/useReferralEligibility';
import {
  dismissReferralReminder,
  REFERRAL_PANEL_DISMISS_KEY,
  clearReferralDismissal,
  REFERRAL_CALLOUT_DISMISS_KEY,
} from '@/utils/referralDismissal';
import { REFERRAL_HELP_URL } from '@/components/constants';

export default function ReferralDropdown({ apiKey, onToast }) {
  const t = useTranslations('Referral');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { eligibility, refresh } = useReferralEligibility(apiKey);

  const actions = useReferralActions({
    apiKey,
    onToast,
    onApplied: refresh,
    t,
  });

  const closeDropdown = useCallback(() => setIsOpen(false), []);
  useHeaderDropdownDismiss({ isOpen, onClose: closeDropdown, anchorRef: dropdownRef });

  const handleSnooze = () => {
    dismissReferralReminder(REFERRAL_CALLOUT_DISMISS_KEY, 30);
    dismissReferralReminder(REFERRAL_PANEL_DISMISS_KEY, 30);
    refresh();
  };

  const handleResetSnooze = () => {
    clearReferralDismissal(REFERRAL_CALLOUT_DISMISS_KEY);
    clearReferralDismissal(REFERRAL_PANEL_DISMISS_KEY);
    refresh();
  };

  const truncateCode = (code) => {
    if (code.length <= 20) return code;
    return `${code.slice(0, 8)}…${code.slice(-8)}`;
  };

  return (
    <div className="relative z-[260] shrink-0" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="ui-btn-ghost !gap-2"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Icons.Gift className="w-4 h-4" />
        <span className="text-sm hidden lg:inline">{t('referral')}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <HeaderDropdownPanel
        open={isOpen}
        widthClass="w-[min(100vw-2rem,22rem)]"
        className="!py-0"
        onBackdropClick={() => setIsOpen(false)}
      >
        <div className="ui-dropdown-header border-t-2 border-amber-500/50">
          <div className="flex items-center gap-2">
            <Icons.Gift className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t('panel.heroTitle')}</h3>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{t('panel.heroSubtitle')}</p>
        </div>

        <div className="ui-dropdown-body space-y-4">
          <ReferralBenefitChips />

          {actions.statusMessage && (
            <p
              className={`text-xs ${
                actions.statusMessage.type === 'error'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400'
              }`}
              aria-live="polite"
            >
              {actions.statusMessage.message}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {apiKey && eligibility.canAutoApply && (
              <button
                type="button"
                onClick={actions.requestApply}
                className="ui-btn-primary w-full justify-center !text-sm"
              >
                {t('apply.button')}
              </button>
            )}
            <button
              type="button"
              onClick={actions.copyLink}
              className="ui-btn-ghost w-full justify-center !text-sm gap-2 border border-zinc-200 dark:border-zinc-700"
            >
              {actions.copiedItem === 'link' ? (
                <Icons.Check className="w-4 h-4" />
              ) : (
                <Icons.Copy className="w-4 h-4" />
              )}
              {t('copyLink')}
            </button>
            <a
              href={actions.referralLink}
              target="_blank"
              rel="noopener noreferrer"
              className="ui-btn-ghost w-full justify-center !text-sm gap-2 border border-zinc-200 dark:border-zinc-700"
            >
              <Icons.ExternalLink className="w-4 h-4" />
              {t('panel.openSubscription')}
            </a>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t('referralCode')}
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-border dark:border-border-dark bg-surface-alt dark:bg-surface-alt-dark px-3 py-2">
              <code className="flex-1 min-w-0 text-xs font-mono text-zinc-800 dark:text-zinc-200 truncate">
                {truncateCode(actions.referralCode)}
              </code>
              <button
                type="button"
                onClick={actions.copyCode}
                className="ui-header-icon-btn shrink-0"
                title={t('copyCode')}
              >
                {actions.copiedItem === 'code' ? (
                  <Icons.Check className="w-4 h-4" />
                ) : (
                  <Icons.Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <details className="text-xs text-zinc-600 dark:text-zinc-400 group">
            <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300 list-none flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform inline-block">›</span>
              {t('steps.title')}
            </summary>
            <ol className="mt-2 space-y-1.5 pl-4 list-decimal">
              <li>{t('steps.step1')}</li>
              <li>{t('steps.step2')}</li>
              <li>{t('steps.step3')}</li>
            </ol>
            <p className="mt-2 text-zinc-500 dark:text-zinc-500">{t('steps.popupNote')}</p>
          </details>

          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-500">{t('disclaimer.supportsDevelopment')}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">{t('disclaimer.firstPurchase')}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">{t('disclaimer.giftCards')}</p>
            <a
              href={REFERRAL_HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-700 dark:text-amber-400 underline hover:no-underline inline-flex items-center gap-1"
            >
              {t('panel.helpLink')}
              <Icons.ExternalLink className="w-3 h-3" />
            </a>
            <div className="flex flex-wrap gap-3 pt-1">
              <button type="button" onClick={handleSnooze} className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline">
                {t('settings.snoozeReminders')}
              </button>
              <button
                type="button"
                onClick={handleResetSnooze}
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline"
              >
                {t('settings.resetSnooze')}
              </button>
            </div>
          </div>
        </div>
      </HeaderDropdownPanel>

      <ReferralConfirmDialog
        isOpen={actions.showConfirm}
        onClose={() => actions.setShowConfirm(false)}
        onConfirm={actions.runApply}
        isLoading={actions.isApplying}
      />
    </div>
  );
}
