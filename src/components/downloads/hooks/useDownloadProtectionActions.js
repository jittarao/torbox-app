'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useProtectedDownloads } from '@/components/shared/hooks/useProtectedDownloads';
import { isItemProtected } from '@/utils/downloadProtectionUtils';

export function useDownloadProtectionActions(apiKey, setToast) {
  const [isUpdatingProtection, setIsUpdatingProtection] = useState(false);
  const { setProtected } = useProtectedDownloads(apiKey);
  const t = useTranslations('ItemActions.toast');

  const setItemsProtection = useCallback(
    async (items, isProtected) => {
      if (!apiKey || !items?.length) return { success: false };

      const downloadIds = items.map((item) => String(item.id));
      try {
        setIsUpdatingProtection(true);
        await setProtected(downloadIds, isProtected);
        setToast?.({
          message: t(isProtected ? 'protectSuccess' : 'unprotectSuccess', {
            count: downloadIds.length,
          }),
          type: 'success',
        });
        return { success: true };
      } catch (error) {
        setToast?.({
          message: t(isProtected ? 'protectError' : 'unprotectError', { error: error.message }),
          type: 'error',
        });
        return { success: false, error: error.message };
      } finally {
        setIsUpdatingProtection(false);
      }
    },
    [apiKey, setProtected, setToast, t]
  );

  const protectItems = useCallback(
    (items) => setItemsProtection(items, true),
    [setItemsProtection]
  );

  const unprotectItems = useCallback(
    (items) => setItemsProtection(items, false),
    [setItemsProtection]
  );

  const toggleProtectionForItem = useCallback(
    async (item) => {
      if (!item) return { success: false };
      return isItemProtected(item) ? unprotectItems([item]) : protectItems([item]);
    },
    [protectItems, unprotectItems]
  );

  return {
    isUpdatingProtection,
    protectItems,
    unprotectItems,
    toggleProtectionForItem,
  };
}
