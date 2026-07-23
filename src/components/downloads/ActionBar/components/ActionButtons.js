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

export default function ActionButtons({
  setSelectedItems,
  hasSelectedFiles,
  isDownloading,
  isDeleting,
  isExporting,
  onBulkDownload,
  onBulkDelete,
  onBulkArchive,
  onBulkExport,
  isArchiving = false,
  itemTypeName,
  itemTypePlural,
  isDownloadPanelOpen,
  setIsDownloadPanelOpen,
  activeType = 'torrents',
  apiKey,
  setToast,
  allItems = [],
}) {
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
      isDownloading={isDownloading}
      isDeleting={isDeleting}
      isExporting={isExporting}
      isArchiving={isArchiving}
      isForceStarting={handlers.isForceStarting}
      isBulkRetrying={handlers.isBulkRetrying}
      isStoppingSeeding={isStoppingSeeding}
      isUpdatingProtection={isUpdatingProtection}
      bulkAirlockPendingAction={bulkAirlockPendingAction}
      deleteSelectionBlocked={selection.deleteSelectionBlocked}
      deleteParentDownloads={deleteParentDownloads}
      onDeleteParentDownloadsChange={setDeleteParentDownloads}
      showBulkForceStart={selection.showBulkForceStart}
      showBulkRetry={selection.showBulkRetry}
      showBulkAirlockLock={selection.showBulkAirlockLock}
      showBulkAirlockUnlock={selection.showBulkAirlockUnlock}
      showBulkProtect={selection.showBulkProtect}
      showBulkUnprotect={selection.showBulkUnprotect}
      showBulkStopSeeding={selection.showBulkStopSeeding}
      showBulkArchive={selection.showBulkArchive}
      showArchiveConfirm={showArchiveConfirm}
      onShowArchiveConfirm={setShowArchiveConfirm}
      onCloseArchiveConfirm={() => setShowArchiveConfirm(false)}
      showDeleteConfirm={showDeleteConfirm}
      onShowDeleteConfirm={setShowDeleteConfirm}
      onCloseDeleteConfirm={() => setShowDeleteConfirm(false)}
      showTagAssignment={showTagAssignment}
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
      isDownloadPanelOpen={isDownloadPanelOpen}
      setIsDownloadPanelOpen={setIsDownloadPanelOpen}
      apiKey={apiKey}
      allItems={allItems}
      getSelectedItems={getSelectedItems}
      setSelectedItems={setSelectedItems}
      itemTypeName={itemTypeName}
      itemTypePlural={itemTypePlural}
    />
  );
}
