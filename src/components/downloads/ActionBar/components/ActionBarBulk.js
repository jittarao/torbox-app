'use client';

import { useDownloadsDataContext } from '@/components/downloads/DownloadsDataContext';
import { useDownloadsContext } from '@/components/downloads/DownloadsContext';
import { useDownloadsUIContext } from '@/components/downloads/DownloadsUIContext';
import {
  useDownloadsSelectionStore,
  selectHasSelectedFiles,
  selectSelectedItemCount,
} from '@/store/downloadsSelectionStore';
import ActionButtons from './ActionButtons';

export default function ActionBarBulk({ itemTypeName, itemTypePlural }) {
  const { viewItems: unfilteredItems } = useDownloadsDataContext();
  const {
    isDownloading,
    isDeleting,
    isExporting,
    handleBulkDownload: onBulkDownload,
    deleteItems: onBulkDelete,
    archiveItems: onBulkArchive,
    isArchiving,
    handleBulkExport: onBulkExport,
    apiKey,
    setToast,
  } = useDownloadsContext();
  const {
    activeType = 'torrents',
    isDownloadPanelOpen,
    setIsDownloadPanelOpen,
  } = useDownloadsUIContext();

  const selectedItemCount = useDownloadsSelectionStore(selectSelectedItemCount);
  const hasSelectedFiles = useDownloadsSelectionStore(selectHasSelectedFiles);
  const setSelectedItems = useDownloadsSelectionStore((state) => state.setSelectedItems);
  const hasSelection = selectedItemCount > 0 || hasSelectedFiles;

  if (!hasSelection) return null;

  const onBulkDownloadWrapper = () =>
    onBulkDownload(useDownloadsSelectionStore.getState().selectedItems, unfilteredItems);
  const onBulkDeleteWrapper = (includeParentDownloads) =>
    onBulkDelete(
      useDownloadsSelectionStore.getState().selectedItems,
      includeParentDownloads,
      unfilteredItems
    );
  const onBulkArchiveWrapper = () =>
    onBulkArchive(useDownloadsSelectionStore.getState().selectedItems, unfilteredItems);

  return (
    <ActionButtons
      setSelectedItems={setSelectedItems}
      hasSelectedFiles={hasSelectedFiles}
      bulkProgress={{
        downloading: isDownloading,
        deleting: isDeleting,
        archiving: isArchiving,
        exporting: isExporting,
      }}
      onBulkDownload={onBulkDownloadWrapper}
      onBulkDelete={onBulkDeleteWrapper}
      onBulkArchive={onBulkArchiveWrapper}
      onBulkExport={onBulkExport}
      itemTypeName={itemTypeName}
      itemTypePlural={itemTypePlural}
      downloadPanel={{ open: isDownloadPanelOpen, setOpen: setIsDownloadPanelOpen }}
      activeType={activeType}
      apiKey={apiKey}
      setToast={setToast}
      allItems={unfilteredItems}
    />
  );
}
