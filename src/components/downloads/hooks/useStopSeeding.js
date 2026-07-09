'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { controlTorrent } from '@/utils/uploadActions';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { resolveItemAssetType } from '@/store/torboxDownloadsSelectors';
import { isItemProtected } from '@/utils/downloadProtectionUtils';
import { useDestructiveActionGuard } from '@/components/downloads/hooks/useDestructiveActionGuard';

export function useStopSeeding({ apiKey, assetType = 'torrents', setToast }) {
  const [isStoppingSeeding, setIsStoppingSeeding] = useState(false);
  const patchItem = useTorboxDownloadsStore((state) => state.patchItem);
  const t = useTranslations('ItemActions.toast');
  const { toastAllBlocked, skipSuffix, guardSingle, isProtectedApiResult } =
    useDestructiveActionGuard(setToast);

  const stopSeedingItem = useCallback(
    async (item) => {
      if (!apiKey || !item) return { success: false };

      if (!guardSingle(item)) {
        return { success: false, protected: true };
      }

      try {
        setIsStoppingSeeding(true);
        const result = await controlTorrent(apiKey, item.id, 'stop_seeding');
        if (!result) {
          setToast?.({ message: t('seedingStopFailed'), type: 'error' });
          return { success: false };
        }

        if (isProtectedApiResult(result)) {
          setToast?.({ message: t('protectedBlocked'), type: 'error' });
          return { success: false, protected: true };
        }

        setToast?.({
          message: result.success
            ? t('seedingStopped')
            : result.userMessage || result.error || t('seedingStopFailed'),
          type: result.success ? 'success' : 'error',
        });

        if (result.success) {
          patchItem(resolveItemAssetType(item, assetType), item.id, {
            active: false,
            download_state: 'completed',
            download_present: true,
          });
        }

        return { success: result.success };
      } finally {
        setIsStoppingSeeding(false);
      }
    },
    [apiKey, assetType, guardSingle, isProtectedApiResult, patchItem, setToast, t]
  );

  const stopSeedingItems = useCallback(
    async (items) => {
      if (!apiKey || !items?.length) return { successCount: 0, skippedCount: 0 };

      const eligible = items.filter((item) => !isItemProtected(item));
      const skippedCount = items.length - eligible.length;

      if (eligible.length === 0) {
        toastAllBlocked();
        return { successCount: 0, skippedCount };
      }

      let successCount = 0;
      setIsStoppingSeeding(true);
      try {
        for (const item of eligible) {
          const result = await stopSeedingItem(item);
          if (result?.success) successCount++;
        }
      } finally {
        setIsStoppingSeeding(false);
      }

      if (successCount > 0) {
        setToast?.({
          message: `${t('seedingStopped')}${skipSuffix(skippedCount)}`,
          type: skippedCount > 0 ? 'warning' : 'success',
        });
      } else if (skippedCount > 0) {
        setToast?.({ message: t('protectedBlocked'), type: 'error' });
      }

      return { successCount, skippedCount };
    },
    [apiKey, setToast, skipSuffix, stopSeedingItem, t, toastAllBlocked]
  );

  return {
    isStoppingSeeding,
    stopSeedingItem,
    stopSeedingItems,
  };
}
