import { useState, useCallback } from 'react';
import { phEvent } from '@/utils/sa';
import { useTranslations } from 'next-intl';
import {
  useDownloadsSelectionStore,
  selectSelectedItemCount,
} from '@/store/downloadsSelectionStore';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { useDownloadsUIContext } from '@/components/downloads/DownloadsUIContext';
import { useDownloadsContext } from '@/components/downloads/DownloadsContext';
import { useActionButtonsSelection } from './useActionButtonsSelection';
import { useActionButtonsHandlers } from './useActionButtonsHandlers';
import { useBulkCloudUpload } from './useBulkCloudUpload';
import ActionButtonsToolbar from './ActionButtonsToolbar';
import {
  createBulkActionVisibility,
  createBulkProgress,
  createConfirmDialogs,
} from './actionButtonsToolbarGroups';

const EMPTY_ALL_ITEMS = [];

export default function ActionButtons({
  setSelectedItems,
  hasSelectedFiles,
  bulkProgress,
  onBulkDownload,
  onBulkDelete,
  onBulkArchive,
  onBulkExport,
  itemTypeName,
  itemTypePlural,
  downloadPanel,
  activeType = 'torrents',
  apiKey,
  setToast,
  allItems = EMPTY_ALL_ITEMS,
}) {
  const {
    downloading: isDownloading,
    deleting: isDeleting,
    exporting: isExporting,
    archiving: isArchiving,
  } = bulkProgress;
  const { open: isDownloadPanelOpen, setOpen: setIsDownloadPanelOpen } = downloadPanel;

  const t = useTranslations('ActionButtons');
  const tItemActions = useTranslations('ItemActions.toast');
  const { isBackendAvailable } = useDownloadsUIContext();
  const {
    stopSeedingItems,
    isStoppingSeeding,
    protectItems,
    unprotectItems,
    isUpdatingProtection,
  } = useDownloadsContext();
  const selectedItemCount = useDownloadsSelectionStore(selectSelectedItemCount);
  const getSelectedItems = useCallback(
    () => useDownloadsSelectionStore.getState().selectedItems,
    []
  );
  const patchItem = useTorboxDownloadsStore((state) => state.patchItem);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [deleteParentDownloads, setDeleteParentDownloads] = useState(false);
  const [showTagAssignment, setShowTagAssignment] = useState(false);
  const [bulkAirlockPendingAction, setBulkAirlockPendingAction] = useState(null);

  const selection = useActionButtonsSelection({
    allItems,
    activeType,
    hasSelectedFiles,
    selectedItemCount,
    bulkAirlockPendingAction,
    isBackendAvailable,
    getSelectedItems,
  });

  const handlers = useActionButtonsHandlers({
    apiKey,
    activeType,
    selection,
    patchItem,
    setToast,
    t,
    tItemActions,
    stopSeedingItems,
    isStoppingSeeding,
    protectItems,
    unprotectItems,
    isUpdatingProtection,
    bulkAirlockPendingAction,
    setBulkAirlockPendingAction,
  });

  const { handleBulkCloudUpload } = useBulkCloudUpload({
    apiKey,
    activeType,
    allItems,
    getSelectedItems,
    setSelectedItems,
    setToast,
    t,
  });
  void handleBulkCloudUpload;

  const handleBulkExport = () => {
    if (onBulkExport) {
      onBulkExport();
    }
    phEvent('bulk_export_torrents');
  };

  const handleBulkDownload = () => {
    onBulkDownload();
    phEvent('download_items');
  };

  return (
    <ActionButtonsToolbar
      activeType={activeType}
      selectedItemCount={selectedItemCount}
      hasSelectedFiles={hasSelectedFiles}
      bulkProgress={createBulkProgress({
        isDownloading,
        isDeleting,
        isExporting,
        isArchiving,
        isForceStarting: handlers.isForceStarting,
        isBulkRetrying: handlers.isBulkRetrying,
        isStoppingSeeding,
        isUpdatingProtection,
      })}
      bulkActionVisibility={createBulkActionVisibility({
        showBulkForceStart: selection.showBulkForceStart,
        showBulkRetry: selection.showBulkRetry,
        showBulkAirlockLock: selection.showBulkAirlockLock,
        showBulkAirlockUnlock: selection.showBulkAirlockUnlock,
        showBulkProtect: selection.showBulkProtect,
        showBulkUnprotect: selection.showBulkUnprotect,
        showBulkStopSeeding: selection.showBulkStopSeeding,
        showBulkArchive: selection.showBulkArchive,
      })}
      confirmDialogs={createConfirmDialogs({
        showArchiveConfirm,
        showDeleteConfirm,
        showTagAssignment,
      })}
      bulkAirlockPendingAction={bulkAirlockPendingAction}
      deleteSelectionBlocked={selection.deleteSelectionBlocked}
      deleteParentDownloads={deleteParentDownloads}
      onDeleteParentDownloadsChange={setDeleteParentDownloads}
      onShowArchiveConfirm={setShowArchiveConfirm}
      onCloseArchiveConfirm={() => setShowArchiveConfirm(false)}
      onShowDeleteConfirm={setShowDeleteConfirm}
      onCloseDeleteConfirm={() => setShowDeleteConfirm(false)}
      onShowTagAssignment={setShowTagAssignment}
      onCloseTagAssignment={setShowTagAssignment}
      selectedArchivableTorrents={selection.selectedArchivableTorrents}
      onBulkDownload={handleBulkDownload}
      onBulkExport={handleBulkExport}
      onBulkArchive={onBulkArchive}
      onBulkDelete={onBulkDelete}
      onBulkForceStart={handlers.handleBulkForceStart}
      onBulkRetry={handlers.handleBulkRetry}
      onBulkAirlock={handlers.handleBulkAirlock}
      onBulkProtect={handlers.handleBulkProtect}
      onBulkUnprotect={handlers.handleBulkUnprotect}
      onBulkStopSeeding={handlers.handleBulkStopSeeding}
      onClearSelection={() => setSelectedItems({ items: new Set(), files: new Map() })}
      downloadPanel={{ open: isDownloadPanelOpen, setOpen: setIsDownloadPanelOpen }}
      apiKey={apiKey}
      allItems={allItems}
      getSelectedItems={getSelectedItems}
      setSelectedItems={setSelectedItems}
      itemTypeName={itemTypeName}
      itemTypePlural={itemTypePlural}
    />
  );
}
