import { useMemo } from 'react';
import { findItemBySelectionId } from '@/utils/downloadSelectionId';
import { resolveItemAssetType } from '@/store/torboxDownloadsSelectors';
import { isTorrentQueued, isTorrentSeeding } from '../utils/statusHelpers';
import { canRetryDownload } from '@/utils/retryDownload';
import { isItemProtected } from '@/utils/downloadProtectionUtils';
import { isQueuedItem } from '@/utils/utility';
import { normalizeBooleanValue } from './actionButtonsUtils';

export function useActionButtonsSelection({
  allItems,
  activeType,
  hasSelectedFiles,
  selectedItemCount,
  bulkAirlockPendingAction,
  isBackendAvailable,
  getSelectedItems,
}) {
  const selectedSeedingTorrents = useMemo(() => {
    if (hasSelectedFiles || selectedItemCount === 0) return [];
    if (activeType !== 'torrents' && activeType !== 'all') return [];

    const selectionIds = Array.from(getSelectedItems().items || []);
    const resolved = selectionIds.flatMap((selectionId) => {
      const item = findItemBySelectionId(allItems, selectionId);
      return item ? [item] : [];
    });

    if (resolved.length !== selectionIds.length) return [];

    const allSeedingTorrents = resolved.every(
      (item) => resolveItemAssetType(item, activeType) === 'torrents' && isTorrentSeeding(item)
    );
    return allSeedingTorrents ? resolved.filter((item) => !isItemProtected(item)) : [];
  }, [activeType, allItems, getSelectedItems, hasSelectedFiles, selectedItemCount]);

  const showBulkStopSeeding = selectedSeedingTorrents.length > 0;

  const selectedResolvedItems = useMemo(() => {
    if (hasSelectedFiles || selectedItemCount === 0) return [];
    const selectionIds = Array.from(getSelectedItems().items || []);
    return selectionIds.flatMap((selectionId) => {
      const item = findItemBySelectionId(allItems, selectionId);
      return item ? [item] : [];
    });
  }, [allItems, getSelectedItems, hasSelectedFiles, selectedItemCount]);

  const selectedUnprotectedItems = useMemo(
    () => selectedResolvedItems.filter((item) => !isItemProtected(item)),
    [selectedResolvedItems]
  );
  const selectedProtectedItems = useMemo(
    () => selectedResolvedItems.filter((item) => isItemProtected(item)),
    [selectedResolvedItems]
  );
  const showBulkProtect =
    isBackendAvailable && selectedUnprotectedItems.length > 0 && !hasSelectedFiles;
  const showBulkUnprotect =
    isBackendAvailable && selectedProtectedItems.length > 0 && !hasSelectedFiles;
  const deleteSelectionBlocked =
    selectedResolvedItems.length > 0 && selectedUnprotectedItems.length === 0;

  const selectedQueuedTorrents = useMemo(() => {
    if (hasSelectedFiles || selectedItemCount === 0) return [];
    if (activeType !== 'torrents' && activeType !== 'all') return [];

    const selectionIds = Array.from(getSelectedItems().items || []);
    const resolved = selectionIds.flatMap((selectionId) => {
      const item = findItemBySelectionId(allItems, selectionId);
      return item ? [item] : [];
    });

    if (resolved.length !== selectionIds.length) return [];

    const allQueuedTorrents = resolved.every(
      (item) => resolveItemAssetType(item, activeType) === 'torrents' && isTorrentQueued(item)
    );
    return allQueuedTorrents ? resolved : [];
  }, [activeType, allItems, getSelectedItems, hasSelectedFiles, selectedItemCount]);

  const showBulkForceStart = selectedQueuedTorrents.length > 0;

  const selectedRetryable = useMemo(() => {
    if (hasSelectedFiles || selectedItemCount === 0) return [];
    if (activeType !== 'torrents' && activeType !== 'webdl' && activeType !== 'all') return [];

    const selectionIds = Array.from(getSelectedItems().items || []);
    const resolved = selectionIds.flatMap((selectionId) => {
      const item = findItemBySelectionId(allItems, selectionId);
      return item ? [item] : [];
    });

    if (resolved.length !== selectionIds.length) return [];

    const allRetryable = resolved.every((item) => canRetryDownload(item, activeType));
    return allRetryable ? resolved : [];
  }, [activeType, allItems, getSelectedItems, hasSelectedFiles, selectedItemCount]);

  const showBulkRetry = selectedRetryable.length > 0;

  const selectedAirlockableItems = useMemo(() => {
    if (hasSelectedFiles || selectedItemCount === 0) return [];
    if (
      activeType !== 'torrents' &&
      activeType !== 'usenet' &&
      activeType !== 'webdl' &&
      activeType !== 'all'
    )
      return [];

    const selectionIds = Array.from(getSelectedItems().items || []);
    const resolved = selectionIds.flatMap((selectionId) => {
      const item = findItemBySelectionId(allItems, selectionId);
      return item ? [item] : [];
    });

    if (resolved.length !== selectionIds.length) return [];
    if (resolved.some((item) => isQueuedItem(item))) return [];

    return resolved;
  }, [activeType, allItems, getSelectedItems, hasSelectedFiles, selectedItemCount]);

  const showBulkAirlock = selectedAirlockableItems.length > 0;
  const showBulkAirlockLock =
    bulkAirlockPendingAction === 'lock' ||
    (bulkAirlockPendingAction === null &&
      showBulkAirlock &&
      selectedAirlockableItems.every((item) => !normalizeBooleanValue(item.airlocked)));
  const showBulkAirlockUnlock =
    bulkAirlockPendingAction === 'unlock' ||
    (bulkAirlockPendingAction === null &&
      showBulkAirlock &&
      selectedAirlockableItems.every((item) => normalizeBooleanValue(item.airlocked)));

  const selectedArchivableTorrents = useMemo(() => {
    if (hasSelectedFiles || selectedItemCount === 0) return [];
    if (activeType !== 'torrents' && activeType !== 'all') return [];

    const selectionIds = Array.from(getSelectedItems().items || []);
    const resolved = selectionIds.flatMap((selectionId) => {
      const item = findItemBySelectionId(allItems, selectionId);
      return item ? [item] : [];
    });

    if (resolved.length !== selectionIds.length) return [];

    const allArchivable = resolved.every(
      (item) => resolveItemAssetType(item, activeType) === 'torrents' && Boolean(item.hash)
    );
    return allArchivable ? resolved.filter((item) => !isItemProtected(item)) : [];
  }, [activeType, allItems, getSelectedItems, hasSelectedFiles, selectedItemCount]);

  const showBulkArchive = isBackendAvailable && selectedArchivableTorrents.length > 0;

  return {
    selectedSeedingTorrents,
    showBulkStopSeeding,
    selectedResolvedItems,
    selectedUnprotectedItems,
    selectedProtectedItems,
    showBulkProtect,
    showBulkUnprotect,
    deleteSelectionBlocked,
    selectedQueuedTorrents,
    showBulkForceStart,
    selectedRetryable,
    showBulkRetry,
    selectedAirlockableItems,
    showBulkAirlockLock,
    showBulkAirlockUnlock,
    selectedArchivableTorrents,
    showBulkArchive,
  };
}
