'use client';

import PresetViewsSection from './CustomViews/components/PresetViewsSection';
import ViewFilterPreview from './CustomViews/components/ViewFilterPreview';
import ModalSheet from '@/components/shared/ModalSheet';
import ModalSheetHandle from '@/components/shared/ModalSheetHandle';
import { Filter, X } from '@/components/icons';
import { SaveOptionsPanel } from './filterEditorModalComponents';
import FilterEditorGroupsSection from './FilterEditorGroupsSection';
import FilterEditorModalFooter from './FilterEditorModalFooter';

export default function FilterEditorModalBody(props) {
  const {
    isOpen,
    onClose,
    apiKey,
    activeType,
    columnFilters,
    previewItems,
    onPreview,
    customViewsT,
    automationRulesT,
    downloadsFiltersT,
    AppAlert,
    isCreateMode,
    isEditMode,
    isSaving,
    saveViewName,
    setSaveViewName,
    showSaveInput,
    saveSort,
    setSaveSort,
    saveColumns,
    setSaveColumns,
    saveSearch,
    setSaveSearch,
    availableColumns,
    isViewMode,
    trimmedSearch,
    previewAssetType,
    previewSearchQuery,
    modalTitle,
    modalDescription,
    dialogRef,
    viewNameInputRef,
    filterGroups,
    groupLogicOperator,
    filtersActive,
    handleAddGroup,
    handleUpdateGroup,
    handleRemoveGroup,
    handleAddFilter,
    handleUpdateFilter,
    handleRemoveFilter,
    handleGroupLogicChange,
    handleApplyPreset,
    handleSavePreset,
    handleSaveAsView,
    handleCreateView,
    handleUpdateView,
    handleCancelSaveAsNew,
    handleStartSaveAsNew,
    handleApply,
    handlePreview,
    handleClear,
  } = props;

  const filterGroupsSection = (
    <FilterEditorGroupsSection
      filterGroups={filterGroups}
      groupLogicOperator={groupLogicOperator}
      customViewsT={customViewsT}
      automationRulesT={automationRulesT}
      handleGroupLogicChange={handleGroupLogicChange}
      handleAddGroup={handleAddGroup}
      handleUpdateGroup={handleUpdateGroup}
      handleRemoveGroup={handleRemoveGroup}
      handleAddFilter={handleAddFilter}
      handleUpdateFilter={handleUpdateFilter}
      handleRemoveFilter={handleRemoveFilter}
      availableColumns={availableColumns}
      apiKey={apiKey}
      activeType={activeType}
    />
  );

  return (
    <>
      <ModalSheet
        ref={dialogRef}
        open={isOpen}
        onClose={onClose}
        closeLabel={downloadsFiltersT('close')}
        wide
        aria-labelledby="filter-editor-title"
        aria-describedby="filter-editor-description"
      >
        <div onClick={(e) => e.stopPropagation()} className="flex min-h-0 flex-1 flex-col">
          <ModalSheetHandle />
          <div className="relative shrink-0 border-b border-border/50 px-4 pb-2.5 sm:overflow-hidden sm:px-5 sm:pb-4 sm:pt-5 dark:border-border-dark/50">
            <div
              className="pointer-events-none absolute inset-0 hidden bg-gradient-to-br from-accent/8 via-transparent to-transparent dark:from-accent-dark/10 sm:block"
              aria-hidden
            />
            <div className="relative flex items-center gap-2 sm:items-start sm:gap-3">
              <div
                className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent ring-1 ring-accent/20 dark:bg-accent-dark/15 dark:text-accent-dark dark:ring-accent-dark/25 sm:flex"
                aria-hidden
              >
                <Filter className="size-5" />
              </div>
              <div className="min-w-0 flex-1 sm:pt-0.5">
                <h2
                  id="filter-editor-title"
                  className="truncate text-base font-semibold tracking-tight text-primary-text dark:text-primary-text-dark sm:text-lg"
                >
                  {modalTitle}
                </h2>
                <p
                  id="filter-editor-description"
                  className="mt-1 hidden text-sm leading-relaxed text-primary-text/60 dark:text-primary-text-dark/60 sm:block"
                >
                  {modalDescription}
                </p>
                <p className="sr-only sm:hidden">{modalDescription}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-primary-text/60 transition-colors hover:bg-surface-alt hover:text-primary-text dark:text-primary-text-dark/60 dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark sm:-mt-1 sm:size-9 sm:rounded-xl"
                aria-label={downloadsFiltersT('close')}
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
          </div>

          {isCreateMode && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-4 sm:px-5 sm:py-4">
              <div>
                <label
                  htmlFor="view-name-input"
                  className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-primary-text/45 dark:text-primary-text-dark/45"
                >
                  {customViewsT('viewEditorNameLabel')}
                </label>
                <input
                  id="view-name-input"
                  ref={viewNameInputRef}
                  type="text"
                  value={saveViewName}
                  onChange={(e) => setSaveViewName(e.target.value)}
                  placeholder={customViewsT('viewNamePlaceholder')}
                  className="w-full rounded-xl border border-border/80 bg-surface-alt/50 px-3 py-2.5 text-sm text-primary-text placeholder:text-primary-text/40 focus:border-accent/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/15 dark:border-border-dark/80 dark:bg-surface-alt-dark/40 dark:text-primary-text-dark dark:focus:border-accent-dark/50 dark:focus:bg-surface-dark dark:focus:ring-accent-dark/15"
                />
              </div>

              {filterGroupsSection}

              <SaveOptionsPanel
                saveSort={saveSort}
                setSaveSort={setSaveSort}
                saveColumns={saveColumns}
                setSaveColumns={setSaveColumns}
                saveSearch={saveSearch}
                setSaveSearch={setSaveSearch}
                trimmedSearch={trimmedSearch}
                t={customViewsT}
              />

              {previewItems && (filtersActive || previewSearchQuery) && (
                <ViewFilterPreview
                  filters={columnFilters}
                  previewItems={previewItems}
                  assetType={previewAssetType}
                  searchQuery={previewSearchQuery}
                  onPreview={onPreview ? handlePreview : undefined}
                  showPreviewButton={!!onPreview}
                />
              )}

              <PresetViewsSection
                onApplyPreset={handleApplyPreset}
                onSavePreset={handleSavePreset}
                isSaving={isSaving}
                t={customViewsT}
              />
            </div>
          )}

          {!isCreateMode && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-4 sm:px-5 sm:py-4">
              {isViewMode && (
                <SaveOptionsPanel
                  saveSort={saveSort}
                  setSaveSort={setSaveSort}
                  saveColumns={saveColumns}
                  setSaveColumns={setSaveColumns}
                  saveSearch={saveSearch}
                  setSaveSearch={setSaveSearch}
                  trimmedSearch={trimmedSearch}
                  t={customViewsT}
                />
              )}

              {isViewMode && previewItems && (filtersActive || previewSearchQuery) && (
                <ViewFilterPreview
                  filters={columnFilters}
                  previewItems={previewItems}
                  assetType={previewAssetType}
                  searchQuery={previewSearchQuery}
                  onPreview={onPreview ? handlePreview : undefined}
                  showPreviewButton={!!onPreview}
                />
              )}

              {filterGroupsSection}
            </div>
          )}

          <FilterEditorModalFooter
            editorMode={isCreateMode ? 'create' : isEditMode ? 'edit' : 'filter'}
            filtersActive={filtersActive}
            showSaveInput={showSaveInput}
            apiKey={apiKey}
            isSaving={isSaving}
            saveViewName={saveViewName}
            setSaveViewName={setSaveViewName}
            saveSort={saveSort}
            setSaveSort={setSaveSort}
            saveColumns={saveColumns}
            setSaveColumns={setSaveColumns}
            saveSearch={saveSearch}
            setSaveSearch={setSaveSearch}
            trimmedSearch={trimmedSearch}
            customViewsT={customViewsT}
            downloadsFiltersT={downloadsFiltersT}
            handleCreateView={handleCreateView}
            handleApply={handleApply}
            handleClear={handleClear}
            handleStartSaveAsNew={handleStartSaveAsNew}
            handleSaveAsView={handleSaveAsView}
            handleCancelSaveAsNew={handleCancelSaveAsNew}
            handleUpdateView={handleUpdateView}
          />
        </div>
      </ModalSheet>
      <AppAlert />
    </>
  );
}
