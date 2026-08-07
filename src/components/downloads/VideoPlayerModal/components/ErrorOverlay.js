'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle, X } from '@/components/icons';

export default function ErrorOverlay({ error, onRetry, onClose }) {
  const t = useTranslations('VideoPlayer');

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-xs z-20 px-4 pb-[env(safe-area-inset-bottom,0px)]">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="group absolute z-30
            top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))]
            size-11 flex items-center justify-center
            rounded-full
            bg-black/40 hover:bg-black/70
            backdrop-blur-xs
            text-white/90 hover:text-white
            transition-all duration-300 ease-out
            hover:scale-110 active:scale-95
            border border-white/10 hover:border-white/30
            shadow-lg
            focus:outline-hidden focus:ring-2 focus:ring-white/50
            touch-manipulation"
          aria-label={t('close')}
        >
          <X className="size-5 transition-transform duration-300 group-hover:rotate-90" />
        </button>
      )}
      <div className="text-center px-6 max-w-md">
        <div className="inline-flex p-4 rounded-full bg-red-500/20 mb-4">
          <AlertCircle className="size-10 text-red-400" />
        </div>
        <p className="text-lg font-medium text-white mb-2">{error}</p>
        <p className="text-sm text-white/70 mb-4">{t('errorHint')}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 px-6 py-2.5 rounded-lg
                bg-white/10 hover:bg-white/20
                text-white border border-white/20
                transition-colors text-sm font-medium touch-manipulation"
            >
              {t('close')}
            </button>
          )}
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
    </div>
  );
}
