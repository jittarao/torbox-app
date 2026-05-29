'use client';

import MobileFiltersDrawer from './FiltersSidebar/MobileFiltersDrawer';
import FilterEditorModal from './FilterEditorModal';
import TagManager from './Tags/TagManager';

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
      <TagManager
        isOpen={tagManagerOpen}
        onClose={() => setTagManagerOpen(false)}
        apiKey={apiKey}
      />
    </>
  );
}
