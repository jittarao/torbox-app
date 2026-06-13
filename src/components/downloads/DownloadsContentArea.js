'use client';

import { useDownloadsFilterContext } from './DownloadsFilterContext';
import { useDownloadsUIContext } from './DownloadsUIContext';
import ActiveFiltersBar from './ActiveFiltersBar';
import ActionBar from './ActionBar/index';
import ItemsTable from './ItemsTable';
import CardList from './CardList';

export default function DownloadsContentArea() {
  const { appliedFilters, activeView, tags, handleClearFilters, handleEditActiveFilters } =
    useDownloadsFilterContext();
  const { isBackendAvailable, displayViewMode } = useDownloadsUIContext();

  return (
    <>
      {isBackendAvailable && (
        <ActiveFiltersBar
          appliedFilters={appliedFilters}
          activeView={activeView}
          tags={tags}
          onClear={handleClearFilters}
          onEdit={handleEditActiveFilters}
        />
      )}
      <ActionBar />

      {displayViewMode === 'table' ? <ItemsTable /> : <CardList />}
    </>
  );
}
