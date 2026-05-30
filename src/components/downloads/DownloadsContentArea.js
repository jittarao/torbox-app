'use client';

import { useDownloadsContext } from './DownloadsContext';
import ActiveFiltersBar from './ActiveFiltersBar';
import ActionBar from './ActionBar/index';
import ItemsTable from './ItemsTable';
import CardList from './CardList';

export default function DownloadsContentArea() {
  const ctx = useDownloadsContext();

  return (
    <>
      {ctx.isBackendAvailable && (
        <ActiveFiltersBar
          appliedFilters={ctx.appliedFilters}
          activeView={ctx.activeView}
          tags={ctx.tags}
          onClear={ctx.handleClearFilters}
          onEdit={ctx.handleOpenNewFilter}
        />
      )}
      <ActionBar />

      {ctx.displayViewMode === 'table' ? <ItemsTable /> : <CardList />}
    </>
  );
}
