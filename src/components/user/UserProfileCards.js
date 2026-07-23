'use client';

import { CreditCard, BarChart3, Download } from '@/components/icons';

export function UserProfileAccountStatus({ userData, t, getPlanName, formatDate }) {
  return (
    <div className="bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="size-5 text-accent dark:text-accent-dark" />
        <h3 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
          {t('profile.accountStatus')}
        </h3>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
          <span className="text-sm text-muted dark:text-muted-dark">{t('profile.plan')}</span>
          <span className="text-primary-text dark:text-primary-text-dark font-semibold">
            {getPlanName(userData.plan)}
          </span>
        </div>

        {userData.plan > 0 && (
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
            <span className="text-sm text-muted dark:text-muted-dark">
              {t('profile.planExpiry')}
            </span>
            <span className="text-primary-text dark:text-primary-text-dark font-medium">
              {formatDate(userData.premium_expires_at)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function UserProfileUsageStats({ userData, t, formatTransferBytes }) {
  return (
    <div className="bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="size-5 text-accent dark:text-accent-dark" />
        <h3 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
          {t('profile.usage')}
        </h3>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
          <span className="text-sm text-muted dark:text-muted-dark">
            {t('profile.totalDownloads')}
          </span>
          <span className="text-primary-text dark:text-primary-text-dark font-semibold text-lg">
            {userData.total_downloaded || 0}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
          <span className="text-sm text-muted dark:text-muted-dark">{t('profile.totalSize')}</span>
          <span className="text-primary-text dark:text-primary-text-dark font-semibold">
            {formatTransferBytes(userData.total_bytes_downloaded || 0)}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
          <span className="text-sm text-muted dark:text-muted-dark">
            {t('profile.totalUploaded')}
          </span>
          <span className="text-primary-text dark:text-primary-text-dark font-semibold">
            {formatTransferBytes(userData.total_bytes_uploaded || 0)}
          </span>
        </div>

        <div className="pt-2 border-t border-border dark:border-border-dark">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
            <span className="text-sm text-muted dark:text-muted-dark">{t('profile.ratio')}</span>
            <span className="text-primary-text dark:text-primary-text-dark font-semibold text-lg">
              {(() => {
                const downloaded = userData.total_bytes_downloaded || 0;
                const uploaded = userData.total_bytes_uploaded || 0;
                if (downloaded === 0) return '∞';
                const ratio = uploaded / downloaded;
                return ratio.toFixed(2);
              })()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UserProfileDownloadBreakdown({ userData, t }) {
  return (
    <div className="bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <Download className="size-5 text-accent dark:text-accent-dark" />
        <h3 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
          {t('profile.downloadBreakdown')}
        </h3>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
          <span className="text-sm text-muted dark:text-muted-dark">
            {t('profile.torrentDownloads')}
          </span>
          <span className="text-primary-text dark:text-primary-text-dark font-semibold">
            {userData.torrents_downloaded || 0}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
          <span className="text-sm text-muted dark:text-muted-dark">
            {t('profile.webDownloads')}
          </span>
          <span className="text-primary-text dark:text-primary-text-dark font-semibold">
            {userData.web_downloads_downloaded || 0}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
          <span className="text-sm text-muted dark:text-muted-dark">
            {t('profile.usenetDownloads')}
          </span>
          <span className="text-primary-text dark:text-primary-text-dark font-semibold">
            {userData.usenet_downloads_downloaded || 0}
          </span>
        </div>
      </div>
    </div>
  );
}
