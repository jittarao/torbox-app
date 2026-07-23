import { readJsonFromResponse } from '@/utils/fetchResponse';
import { phEvent } from '@/utils/sa';
import { resolveItemAssetType } from '@/store/torboxDownloadsSelectors';
import { AIRLOCK_LIMIT_REACHED_ERROR } from '@/config/errors';
import { runWithConcurrency } from '@/utils/runWithConcurrency';
import {
  CONCURRENT_AIRLOCKS,
  normalizeBooleanValue,
  normalizeUiAssetType,
} from './actionButtonsUtils';

export async function performBulkAirlock({
  apiKey,
  activeType,
  selectedAirlockableItems,
  nextAirlocked,
  patchItem,
  setToast,
  t,
}) {
  const items = selectedAirlockableItems.map((item) => ({
    item,
    assetType: resolveItemAssetType(item, activeType),
    uiAssetType: normalizeUiAssetType(resolveItemAssetType(item, activeType)),
    previousAirlocked: normalizeBooleanValue(item.airlocked),
  }));

  for (const { uiAssetType, item } of items) {
    patchItem(uiAssetType, item.id, { airlocked: nextAirlocked });
  }

  const results = new Array(items.length);
  let failedSizeThreshold = Infinity;
  await runWithConcurrency(items, CONCURRENT_AIRLOCKS, async (entry, index) => {
    const { item, assetType } = entry;
    const size = Number(item.size) || 0;

    if (nextAirlocked && size > 0 && size >= failedSizeThreshold) {
      const error = new Error(t('bulkAirlockLimitReached'));
      error.code = AIRLOCK_LIMIT_REACHED_ERROR;
      error.skipped = true;
      results[index] = { status: 'rejected', reason: error };
      return;
    }

    try {
      const response = await fetch('/api/downloads/airlock', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          assetType,
          id: item.id,
          airlocked: nextAirlocked,
        }),
      });
      const { ok: responseOk, data } = await readJsonFromResponse(response);

      if (!responseOk || data.success === false) {
        const error = new Error(data.detail || data.error || 'Airlock update failed');
        error.code = data.error;
        throw error;
      }
      results[index] = { status: 'fulfilled' };
    } catch (error) {
      if (
        nextAirlocked &&
        error.code === AIRLOCK_LIMIT_REACHED_ERROR &&
        size > 0 &&
        size < failedSizeThreshold
      ) {
        failedSizeThreshold = size;
      }
      results[index] = { status: 'rejected', reason: error };
    }
  });

  let successCount = 0;
  let failCount = 0;
  let limitReachedCount = 0;

  results.forEach((result, index) => {
    const { uiAssetType } = items[index];
    if (result.status === 'fulfilled') {
      successCount++;
    } else {
      failCount++;
      if (result.reason?.code === AIRLOCK_LIMIT_REACHED_ERROR) {
        limitReachedCount++;
      }
      patchItem(uiAssetType, items[index].item.id, {
        airlocked: items[index].previousAirlocked,
      });
    }
  });

  if (successCount > 0 && failCount === 0) {
    setToast({
      message: nextAirlocked
        ? t('bulkAirlockLocked', { count: successCount })
        : t('bulkAirlockUnlocked', { count: successCount }),
      type: 'success',
    });
    phEvent(nextAirlocked ? 'bulk_airlock_lock' : 'bulk_airlock_unlock', {
      count: successCount,
    });
  } else if (successCount > 0) {
    setToast({
      message: t('bulkAirlockPartial', { success: successCount, failed: failCount }),
      type: 'warning',
    });
    phEvent(nextAirlocked ? 'bulk_airlock_lock' : 'bulk_airlock_unlock', {
      count: successCount,
      failed: failCount,
    });
  } else if (limitReachedCount > 0) {
    setToast({
      message: t('bulkAirlockLimitReached'),
      type: 'error',
    });
  } else {
    setToast({
      message: t('bulkAirlockFailed'),
      type: 'error',
    });
  }
}
