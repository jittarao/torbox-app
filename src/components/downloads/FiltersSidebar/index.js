'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCustomViewsStore } from '@/store/customViewsStore';
import { useTagsStore } from '@/store/tagsStore';
import FiltersSidebarSearch from './FiltersSidebarSearch';
import { useFiltersSidebarCounts } from './useFiltersSidebarCounts';
import useFiltersSidebarSectionsCollapsed from './useFiltersSidebarSectionsCollapsed';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useAppAlert } from '@/hooks/useAppAlert';
import { FiltersSidebarHeader } from './FiltersSidebarChrome';
import FiltersSidebarSections from './FiltersSidebarSections';

const EMPTY_ACTIVE_VIEW_IDS = [];
const EMPTY_ACTIVE_TRACKERS = [];
const EMPTY_ACTIVE_SOURCES = [];

export default function FiltersSidebar({
  apiKey,
  views,
  activeViewIds = EMPTY_ACTIVE_VIEW_IDS,
  tags,
  activeAssetType = 'all',
  activeTagIds,
  activeTrackers = EMPTY_ACTIVE_TRACKERS,
  activeSources = EMPTY_ACTIVE_SOURCES,
  viewCombineMode,
  tagCombineMode,
  trackerCombineMode,
  sourceCombineMode,
  onSetViewCombineMode,
  onSetTagCombineMode,
  onSetTrackerCombineMode,
  onSetSourceCombineMode,
  onApplyView,
  onApplyViewRange,
  onClearViews,
  onClearView,
  onApplyTag,
  onApplyTagRange,
  onClearTags,
  onApplyTracker,
  onApplyTrackerRange,
  onClearTrackers,
  onApplySource,
  onApplySourceRange,
  onClearSources,
  onEditView,
  onRenameView,
  onRenameTag,
  onDeleteTag,
  onNewFilter,
  onNewView,
  onOpenTagManager,
  onReorderViews,
  variant = 'inline',
  className = '',
  collapsed = false,
  onToggleCollapsed,
  viewsLoading = false,
  tagsLoading = false,
  countsLoading = false,
}) {
  const t = useTranslations('DownloadsFilters');
  const { confirm, ConfirmDialog } = useConfirmDialog({ cancelLabel: 'Cancel' });
  const { alert, AppAlert } = useAppAlert();
  const deleteViewStore = useCustomViewsStore((s) => s.deleteView);
  const deleteTagStore = useTagsStore((s) => s.deleteTag);
  const isFixed = variant === 'fixed';
  const isSheet = variant === 'sheet';
  const sectionTall = isFixed || isSheet;
  const [searchQuery, setSearchQuery] = useState('');
  const [viewsSortMode, setViewsSortMode] = useState(false);
  const { sectionsExpanded, toggleSection, expandAllSections } =
    useFiltersSidebarSectionsCollapsed();

  const { tagCounts, viewCounts, trackerEntries, sourceEntries } = useFiltersSidebarCounts(
    activeAssetType,
    views
  );

  const showTrackerSection = activeAssetType === 'all' || activeAssetType === 'torrents';
  const showSourceSection = activeAssetType === 'all' || activeAssetType === 'webdl';
  const trackerFilterLocked = activeViewIds.length > 0;
  const showViewCombineToggle = activeViewIds.length >= 2;
  const showTagCombineToggle = (activeTagIds?.length ?? 0) >= 2;
  const showTrackerCombineToggle = activeTrackers.length >= 2;
  const showSourceCombineToggle = activeSources.length >= 2;
  const hasSearchQuery = searchQuery.trim().length > 0;
  const canReorderViews = views.length >= 2 && Boolean(onReorderViews);
  const reorderDisabledBySearch = hasSearchQuery;
  const sidebarBusy = viewsLoading || tagsLoading || countsLoading;

  useEffect(() => {
    if (hasSearchQuery && viewsSortMode) {
      setViewsSortMode(false);
    }
  }, [hasSearchQuery, viewsSortMode]);

  useEffect(() => {
    if (hasSearchQuery) expandAllSections();
  }, [hasSearchQuery, expandAllSections]);

  const sectionToggleLabel = useCallback(
    (sectionTitle, expanded) =>
      expanded
        ? t('collapseSection', { section: sectionTitle })
        : t('expandSection', { section: sectionTitle }),
    [t]
  );

  const handleDeleteView = useCallback(
    async (viewId, viewName) => {
      if (
        !(await confirm(t('confirmDeleteView', { name: viewName }), {
          confirmLabel: t('menuDelete'),
        }))
      ) {
        return;
      }
      try {
        await deleteViewStore(apiKey, viewId);
        if (activeViewIds.some((id) => String(id) === String(viewId))) onClearView();
      } catch (error) {
        alert(t('deleteViewFailed', { error: error.message }));
      }
    },
    [apiKey, deleteViewStore, activeViewIds, onClearView, t, confirm, alert]
  );

  const handleToggleViewsSortMode = useCallback(() => {
    if (reorderDisabledBySearch) return;
    setViewsSortMode((current) => !current);
  }, [reorderDisabledBySearch]);

  const handleExitViewsSortMode = useCallback(() => {
    setViewsSortMode(false);
  }, []);

  const handleDeleteTagItem = useCallback(
    async (tagId, tagName) => {
      if (
        !(await confirm(t('confirmDeleteTag', { name: tagName }), {
          confirmLabel: t('menuDelete'),
        }))
      ) {
        return;
      }
      try {
        await deleteTagStore(apiKey, tagId);
        onDeleteTag?.(tagId);
      } catch (error) {
        alert(t('deleteTagFailed', { error: error.message }));
      }
    },
    [apiKey, deleteTagStore, onDeleteTag, t, confirm, alert]
  );

  if (isFixed && collapsed && onToggleCollapsed) {
    return (
      <>
        <aside
          className={`fixed inset-y-0 z-[35] flex w-[var(--downloads-sidebar-width,2.5rem)] flex-col border-r border-border/60 bg-surface/90 backdrop-blur-xl dark:border-border-dark/60 dark:bg-surface-dark/90 ${className}`}
          style={{ left: 'var(--sidebar-width, 0px)' }}
          aria-label={t('sidebarLabel')}
        >
          <FiltersSidebarHeader collapsed compact onToggle={onToggleCollapsed} />
        </aside>
        <ConfirmDialog />
        <AppAlert />
      </>
    );
  }

  return (
    <>
      <aside
        className={`flex flex-col overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isSheet
            ? 'h-full min-h-0 w-full bg-transparent'
            : isFixed
              ? 'fixed inset-y-0 z-[35] w-[var(--downloads-sidebar-width,14rem)] border-r border-border/60 dark:border-border-dark/60 bg-surface/90 dark:bg-surface-dark/90 backdrop-blur-xl p-2.5'
              : 'w-[var(--downloads-sidebar-width,14rem)] shrink-0 border border-border dark:border-border-dark rounded-lg bg-surface/50 dark:bg-surface-dark/50'
        } ${className}`}
        style={isFixed ? { left: 'var(--sidebar-width, 0px)' } : undefined}
        aria-label={isSheet ? undefined : t('sidebarLabel')}
        aria-busy={sidebarBusy || undefined}
      >
        {isFixed && onToggleCollapsed && (
          <FiltersSidebarHeader collapsed={false} onToggle={onToggleCollapsed} />
        )}
        <FiltersSidebarSearch value={searchQuery} onChange={setSearchQuery} />
        <FiltersSidebarSections
          t={t}
          sectionTall={sectionTall}
          sectionsExpanded={sectionsExpanded}
          toggleSection={toggleSection}
          sectionToggleLabel={sectionToggleLabel}
          views={views}
          viewCounts={viewCounts}
          tags={tags}
          tagCounts={tagCounts}
          trackerEntries={trackerEntries}
          sourceEntries={sourceEntries}
          searchQuery={searchQuery}
          activeViewIds={activeViewIds}
          activeTagIds={activeTagIds}
          activeTrackers={activeTrackers}
          activeSources={activeSources}
          viewCombineMode={viewCombineMode}
          tagCombineMode={tagCombineMode}
          trackerCombineMode={trackerCombineMode}
          sourceCombineMode={sourceCombineMode}
          onSetViewCombineMode={onSetViewCombineMode}
          onSetTagCombineMode={onSetTagCombineMode}
          onSetTrackerCombineMode={onSetTrackerCombineMode}
          onSetSourceCombineMode={onSetSourceCombineMode}
          onApplyView={onApplyView}
          onApplyViewRange={onApplyViewRange}
          onClearViews={onClearViews}
          onEditView={onEditView}
          onRenameView={onRenameView}
          onRenameTag={onRenameTag}
          onReorderViews={onReorderViews}
          onOpenTagManager={onOpenTagManager}
          onApplyTag={onApplyTag}
          onApplyTagRange={onApplyTagRange}
          onClearTags={onClearTags}
          onApplyTracker={onApplyTracker}
          onApplyTrackerRange={onApplyTrackerRange}
          onClearTrackers={onClearTrackers}
          onApplySource={onApplySource}
          onApplySourceRange={onApplySourceRange}
          onClearSources={onClearSources}
          handleDeleteView={handleDeleteView}
          handleDeleteTagItem={handleDeleteTagItem}
          viewsLoading={viewsLoading}
          tagsLoading={tagsLoading}
          countsLoading={countsLoading}
          viewsSortMode={viewsSortMode}
          handleToggleViewsSortMode={handleToggleViewsSortMode}
          handleExitViewsSortMode={handleExitViewsSortMode}
          reorderDisabledBySearch={reorderDisabledBySearch}
          sectionVisibility={{
            canReorderViews,
            showViewCombineToggle,
            showTagCombineToggle,
            showTrackerCombineToggle,
            showSourceCombineToggle,
            showTrackerSection,
            showSourceSection,
          }}
          trackerFilterLocked={trackerFilterLocked}
          onNewView={onNewView}
        />

        <div
          className={`shrink-0 space-y-1.5 border-t border-border/60 dark:border-border-dark/60 ${
            isSheet ? 'bg-transparent pt-2' : 'bg-surface/50 dark:bg-surface-dark/50'
          } ${isFixed ? 'pt-2.5' : isSheet ? '' : 'p-2'}`}
        >
          <button
            type="button"
            onClick={onNewView || onNewFilter}
            className={
              isSheet
                ? 'ui-btn-accent w-full justify-center !text-xs'
                : 'w-full rounded-md border border-accent/40 px-2 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10 dark:border-accent-dark/40 dark:text-accent-dark dark:hover:bg-accent-dark/10'
            }
          >
            {t('newView')}
          </button>
        </div>
      </aside>
      <ConfirmDialog />
      <AppAlert />
    </>
  );
}

export { filtersFromView } from '../filters/filterHelpers';
