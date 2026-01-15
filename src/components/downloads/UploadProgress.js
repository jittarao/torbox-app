'use client';

import { useTranslations } from 'next-intl';

export default function UploadProgress({ progress, uploading }) {
  const t = useTranslations('UploadProgress');

  if (!uploading) return null;

  const current = progress?.current || 0;
  const total = progress?.total || 0;
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const remaining = total - current;

  return (
    <div className="mt-4 space-y-2">
      {/* Progress bar */}
      <div className="w-full bg-surface-alt dark:bg-surface-alt-dark rounded-full overflow-hidden">
        <div
          className="bg-accent dark:bg-accent-dark rounded-full h-1.5 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>

      {/* Progress text */}
      <div className="text-center text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        {uploading ? (
          <>
            {t('uploading', { current, total })}
            {remaining > 0 && <span className="ml-2 text-xs">{t('remaining', { remaining })}</span>}
          </>
        ) : (
          <span>{t('preparingUploads')}</span>
        )}
      </div>
    </div>
  );
}
