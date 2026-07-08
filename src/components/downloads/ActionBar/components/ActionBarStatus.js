'use client';

import { useDownloadsDataContext } from '@/components/downloads/DownloadsDataContext';
import { useDownloadsFilterContext } from '@/components/downloads/DownloadsFilterContext';
import { useDownloadsContext } from '@/components/downloads/DownloadsContext';
import { useDownloadsUIContext } from '@/components/downloads/DownloadsUIContext';
import {
  useDownloadsSelectionStore,
  selectHasSelectedFiles,
  selectSelectedItemCount,
  selectTotalSelectedFileCount,
} from '@/store/downloadsSelectionStore';
import { useDownloadsStatusCounts } from '../hooks/useDownloadsStatusCounts';
import StatusSection from './StatusSection';

export default function ActionBarStatus({ itemTypeName, itemTypePlural }) {
  const { viewItems: unfilteredItems, sortedItems: filteredItems } = useDownloadsDataContext();
  const { statusFilter, setStatusFilter: onStatusChange } = useDownloadsFilterContext();
  const { getTotalDownloadSize } = useDownloadsContext();
  const { activeType = 'torrents' } = useDownloadsUIContext();

  const selectedItemCount = useDownloadsSelectionStore(selectSelectedItemCount);
  const selectedFileCount = useDownloadsSelectionStore(selectTotalSelectedFileCount);
  const hasSelectedFiles = useDownloadsSelectionStore(selectHasSelectedFiles);

  const { statusCounts, statusOptions, isStatusSelected } = useDownloadsStatusCounts(activeType);

  return (
    <StatusSection
      statusCounts={statusCounts}
      statusOptions={statusOptions}
      isStatusSelected={isStatusSelected}
      unfilteredItems={unfilteredItems}
      filteredItems={filteredItems}
      selectedItemCount={selectedItemCount}
      selectedFileCount={selectedFileCount}
      hasSelectedFiles={hasSelectedFiles}
      statusFilter={statusFilter}
      onStatusChange={onStatusChange}
      itemTypeName={itemTypeName}
      itemTypePlural={itemTypePlural}
      getTotalDownloadSize={getTotalDownloadSize}
    />
  );
}
