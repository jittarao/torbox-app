'use client';

import { useTranslations } from 'next-intl';
import ModalSheet from '@/components/shared/ModalSheet';

export default function ReferralConfirmDialog({ isOpen, onClose, onConfirm, isLoading = false }) {
  const t = useTranslations('Referral.apply');

  return (
    <ModalSheet
      open={isOpen}
      onClose={onClose}
      closeLabel={t('cancel')}
      aria-labelledby="referral-confirm-title"
    >
      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <h2
          id="referral-confirm-title"
          className="text-lg font-semibold text-primary-text dark:text-primary-text-dark"
        >
          {t('confirmTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted dark:text-muted-dark">{t('confirmBody')}</p>
        <ul className="mt-4 list-disc space-y-1.5 pl-4 text-xs text-muted dark:text-muted-dark">
          <li>{t('confirmBullet1')}</li>
          <li>{t('confirmBullet2')}</li>
          <li>{t('confirmBullet3')}</li>
        </ul>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
    </ModalSheet>
  );
}
