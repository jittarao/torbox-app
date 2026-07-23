'use client';

import { User, Check, Copy } from '@/components/icons';
import { buildTorboxSubscriptionReferralUrl } from '@/utils/referralLinks';

export default function UserProfileBasicInfo({
  userData,
  t,
  copiedLink,
  onCopyReferralLink,
  formatDate,
}) {
  return (
    <div className="bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <User className="size-5 text-accent dark:text-accent-dark" />
        <h3 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
          {t('profile.basicInfo')}
        </h3>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
          <span className="text-sm text-muted dark:text-muted-dark">{t('profile.email')}</span>
          <span className="text-primary-text dark:text-primary-text-dark font-medium break-all">
            {userData.email || 'N/A'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
          <span className="text-sm text-muted dark:text-muted-dark">
            {t('profile.referralCode')}
          </span>
          <span className="text-primary-text dark:text-primary-text-dark font-medium font-mono text-sm">
            {userData.user_referral || 'N/A'}
          </span>
        </div>

        {userData.user_referral && (
          <div className="pt-2 border-t border-border dark:border-border-dark">
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted dark:text-muted-dark">{t('referralLink')}</span>
              <div className="flex items-center gap-2 p-3 bg-surface-alt dark:bg-surface-alt-dark rounded-lg border border-border dark:border-border-dark">
                <span className="text-primary-text dark:text-primary-text-dark font-mono text-xs break-all flex-1">
                  {buildTorboxSubscriptionReferralUrl(userData.user_referral)}
                </span>
                <button
                  type="button"
                  onClick={onCopyReferralLink}
                  className="p-2 text-accent dark:text-accent-dark hover:bg-accent/10 dark:hover:bg-accent-dark/10 rounded transition-colors flex-shrink-0"
                  title={t('copyLink')}
                  aria-label={t('copyLink')}
                >
                  {copiedLink ? <Check className="size-5" /> : <Copy className="size-5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
          <span className="text-sm text-muted dark:text-muted-dark">{t('profile.createdAt')}</span>
          <span className="text-primary-text dark:text-primary-text-dark font-medium">
            {formatDate(userData.created_at)}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
          <span className="text-sm text-muted dark:text-muted-dark">{t('profile.lastLogin')}</span>
          <span className="text-primary-text dark:text-primary-text-dark font-medium">
            {formatDate(userData.updated_at)}
          </span>
        </div>
      </div>
    </div>
  );
}
