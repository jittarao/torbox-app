'use client';

import { useTranslations } from 'next-intl';
export default function ReferralConfirmDialog({ isOpen, onClose, onConfirm, isLoading = false }) {
  const t = useTranslations('Referral.apply');

  if (!isOpen) return null;

  return (
    <>
      <div className="z-overlay-backdrop fixed inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <dialog
        className="z-overlay-dialog fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          bg-surface dark:bg-surface-dark border border-border dark:border-border-dark
          rounded-lg shadow-xl w-[calc(100vw-2rem)] sm:max-w-md p-6"
        aria-labelledby="referral-confirm-title"
        open
      >
        <div onClick={(e) => e.stopPropagation()}>
          <h2
            id="referral-confirm-title"
            className="text-lg font-semibold text-primary-text dark:text-primary-text-dark mb-2"
          >
            {t('confirmTitle')}
          </h2>
          <p className="text-sm text-muted dark:text-muted-dark mb-4">{t('confirmBody')}</p>
          <ul className="text-xs text-muted dark:text-muted-dark space-y-1.5 mb-6 list-disc pl-4">
            <li>{t('confirmBullet1')}</li>
            <li>{t('confirmBullet2')}</li>
            <li>{t('confirmBullet3')}</li>
          </ul>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="ui-btn-ghost justify-center"
              disabled={isLoading}
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="ui-btn-primary justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {t('applying')}
                </>
              ) : (
                t('confirm')
              )}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
