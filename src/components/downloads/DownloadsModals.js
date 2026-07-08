'use client';

import dynamic from 'next/dynamic';
import MobileFiltersDrawer from './FiltersSidebar/MobileFiltersDrawer';

const FilterEditorModal = dynamic(() => import('./FilterEditorModal'), { ssr: false });
const TagManager = dynamic(() => import('./Tags/TagManager'), { ssr: false });

export default function DownloadsModals({
  isBackendAvailable,
  mobileFiltersOpen,
  setMobileFiltersOpen,
  sidebarProps,
  filterModalOpen,
  handleCloseFilterModal,
  filterModalMode,
  editingView,
  apiKey,
  activeType,
  columnFilters,
  setColumnFilters,
  handleApplyFiltersFromModal,
  handlePreviewFiltersFromModal,
  viewItems,
  handleViewCreated,
  handleViewUpdated,
  sortField,
  sortDirection,
  activeColumns,
  search,
  tagManagerOpen,
  setTagManagerOpen,
}) {
  if (!isBackendAvailable) return null;

  return (
    <>
      <MobileFiltersDrawer
        isOpen={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        sidebarProps={sidebarProps}
      />
      {filterModalOpen && (
        <FilterEditorModal
          isOpen={filterModalOpen}
          onClose={handleCloseFilterModal}
          mode={filterModalMode || 'filter'}
          editingView={editingView}
          apiKey={apiKey}
          activeType={activeType}
          columnFilters={columnFilters}
          setColumnFilters={setColumnFilters}
          onApply={handleApplyFiltersFromModal}
          onPreview={handlePreviewFiltersFromModal}
          previewItems={viewItems}
          onViewCreated={handleViewCreated}
          onViewUpdated={handleViewUpdated}
          sortField={sortField}
          sortDirection={sortDirection}
          activeColumns={activeColumns}
          search={search}
        />
      )}
      {tagManagerOpen && (
        <TagManager
          isOpen={tagManagerOpen}
          onClose={() => setTagManagerOpen(false)}
          apiKey={apiKey}
        />
      )}
    </>
  );
}
