'use client';

import { SaveAsNewForm, SaveOptionsPanel } from './filterEditorModalComponents';

export default function FilterEditorModalFooter({
  isCreateMode,
  isEditMode,
  filtersActive,
  showSaveInput,
  apiKey,
  isSaving,
  saveViewName,
  setSaveViewName,
  saveSort,
  setSaveSort,
  saveColumns,
  setSaveColumns,
  saveSearch,
  setSaveSearch,
  trimmedSearch,
  customViewsT,
  downloadsFiltersT,
  handleCreateView,
  handleApply,
  handleClear,
  handleStartSaveAsNew,
  handleSaveAsView,
  handleCancelSaveAsNew,
  handleUpdateView,
}) {
  return (
    <div className="shrink-0 border-t border-border/50 px-4 py-3 sm:px-5 sm:py-4 dark:border-border-dark/50">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {isCreateMode && (
          <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={handleCreateView}
              disabled={isSaving || !saveViewName.trim() || !filtersActive}
              className="ui-btn-accent w-full justify-center !text-xs sm:w-auto sm:min-w-[8.5rem]"
            >
              {isSaving ? (
                <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                customViewsT('createView')
              )}
            </button>
          </div>
        )}

        {filtersActive && !isCreateMode && !isEditMode && !showSaveInput && (
          <div className="flex flex-col gap-2 sm:contents">
            <button
              type="button"
              onClick={handleApply}
              className="ui-btn-accent w-full justify-center !text-xs sm:w-auto"
            >
              {downloadsFiltersT('applyFilters')}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="ui-btn-ghost w-full justify-center !text-xs sm:w-auto"
            >
              {downloadsFiltersT('clearAll')}
            </button>
            {apiKey && (
              <button
                type="button"
                onClick={handleStartSaveAsNew}
                className="ui-btn-ghost w-full justify-center !text-xs border border-border/60 dark:border-border-dark/60 sm:w-auto"
              >
                {customViewsT('saveAsNew')}
              </button>
            )}
          </div>
        )}

        {filtersActive && !isCreateMode && !isEditMode && showSaveInput && apiKey && (
          <div className="w-full space-y-2 sm:ml-auto sm:max-w-xl">
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
            <SaveAsNewForm
              saveViewName={saveViewName}
              setSaveViewName={setSaveViewName}
              onSave={handleSaveAsView}
              onCancel={handleCancelSaveAsNew}
              isSaving={isSaving}
              customViewsT={customViewsT}
            />
          </div>
        )}

        {isEditMode && filtersActive && !showSaveInput && (
          <div className="flex flex-col gap-2 sm:contents">
            <button
              type="button"
              onClick={handleUpdateView}
              disabled={isSaving}
              className="ui-btn-accent w-full justify-center !text-xs sm:w-auto"
            >
              {isSaving ? customViewsT('updating') : customViewsT('updateView')}
            </button>
            {apiKey && (
              <button
                type="button"
                onClick={handleStartSaveAsNew}
                className="ui-btn-ghost w-full justify-center !text-xs border border-border/60 dark:border-border-dark/60 sm:w-auto"
              >
                {customViewsT('saveAsNew')}
              </button>
            )}
          </div>
        )}

        {isEditMode && filtersActive && showSaveInput && apiKey && (
          <div className="w-full space-y-2 sm:ml-auto sm:max-w-xl">
            <SaveAsNewForm
              saveViewName={saveViewName}
              setSaveViewName={setSaveViewName}
              onSave={handleSaveAsView}
              onCancel={handleCancelSaveAsNew}
              isSaving={isSaving}
              customViewsT={customViewsT}
            />
          </div>
        )}
      </div>
    </div>
  );
}
