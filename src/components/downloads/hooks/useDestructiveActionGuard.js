'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { DOWNLOAD_PROTECTED_CODE, DOWNLOAD_PROTECTED_MESSAGE } from '@/config/downloadProtection';
import {
  formatProtectedSkipSuffix,
  isItemProtected,
  partitionItemsByProtection,
} from '@/utils/downloadProtectionUtils';

export function useDestructiveActionGuard(setToast) {
  const t = useTranslations('ItemActions.toast');

  const partition = useCallback((items) => partitionItemsByProtection(items), []);

  const toastAllBlocked = useCallback(() => {
    setToast?.({
      message: t('protectedBlocked'),
      type: 'error',
    });
  }, [setToast, t]);

  const skipSuffix = useCallback(
    (skippedCount) => {
      const suffix = formatProtectedSkipSuffix(skippedCount, t);
      return suffix ? ` ${suffix}` : '';
    },
    [t]
  );

  const mapProtectedError = useCallback(
    (error) => (error?.message === DOWNLOAD_PROTECTED_MESSAGE ? t('protectedBlocked') : null),
    [t]
  );

  const guardSingle = useCallback(
    (item) => {
      if (!isItemProtected(item)) {
        return true;
      }
      toastAllBlocked();
      return false;
    },
    [toastAllBlocked]
  );

  const isProtectedApiResult = useCallback(
    (result) =>
      result?.code === DOWNLOAD_PROTECTED_CODE || result?.error === DOWNLOAD_PROTECTED_MESSAGE,
    []
  );

  return {
    partition,
    toastAllBlocked,
    skipSuffix,
    mapProtectedError,
    guardSingle,
    isProtectedApiResult,
  };
}
