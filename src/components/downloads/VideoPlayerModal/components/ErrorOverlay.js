'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle } from '@/components/icons';

export default function ErrorOverlay({ error, onRetry }) {
  const t = useTranslations('VideoPlayer');

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm z-20 px-4 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="text-center px-6 max-w-md">
        <div className="inline-flex p-4 rounded-full bg-red-500/20 mb-4">
          <AlertCircle className="size-10 text-red-400" />
        </div>
        <p className="text-lg font-medium text-white mb-2">{error}</p>
        <p className="text-sm text-white/70 mb-4">{t('errorHint')}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 px-6 py-2.5 rounded-lg bg-accent dark:bg-accent-dark 
              text-white hover:bg-accent/90 dark:hover:bg-accent-dark/90 
              transition-colors text-sm font-medium touch-manipulation"
          >
            {t('retry')}
          </button>
        )}
      </div>
    </div>
  );
}
