'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCustomViewsStore } from '@/store/customViewsStore';
import { useTagsStore } from '@/store/tagsStore';
import TrackerSidebarSection from './TrackerSidebarSection';
import SourceSidebarSection from './SourceSidebarSection';
import TagSidebarSection from './TagSidebarSection';
import ViewSidebarSection from './ViewSidebarSection';
import FiltersSidebarSearch from './FiltersSidebarSearch';
import SidebarSectionSkeleton from './SidebarSectionSkeleton';
import { useFiltersSidebarCounts } from './useFiltersSidebarCounts';
import useFiltersSidebarSectionsCollapsed from './useFiltersSidebarSectionsCollapsed';

function SectionChevron({ expanded, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.25}
      stroke="currentColor"
      className={`size-3 shrink-0 transition-transform duration-200 ease-out ${
        expanded ? '' : '-rotate-90'
      } ${className}`}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SidebarSection({
  title,
  children,
  onAdd,
  addLabel,
  headerActions = null,
  tall,
  expanded,
  onToggle,
  toggleLabel,
  activeCount = 0,
}) {
  return (
    <div className="flex flex-col">
      <div className={`flex items-center gap-0.5 ${tall ? 'px-0 py-1.5' : 'p-1'}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={toggleLabel}
          className="group flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-surface-alt/70 dark:hover:bg-surface-alt-dark/50"
        >
          <SectionChevron
            expanded={expanded}
            className="text-primary-text/35 group-hover:text-primary-text/55 dark:text-primary-text-dark/35 dark:group-hover:text-primary-text-dark/55"
          />
          <h3 className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wider text-primary-text/50 group-hover:text-primary-text/70 dark:text-primary-text-dark/50 dark:group-hover:text-primary-text-dark/70">
            {title}
          </h3>
          {!expanded && activeCount > 0 && (
            <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-px text-[10px] font-semibold tabular-nums text-accent dark:bg-accent-dark/20 dark:text-accent-dark">
              {activeCount}
            </span>
          )}
        </button>
        {headerActions}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="p-1 rounded text-primary-text/50 hover:text-accent dark:text-primary-text-dark/50 dark:hover:text-accent-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors"
            aria-label={addLabel}
            title={addLabel}
          >
            <svg
              className="size-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        )}
      </div>
      {expanded && (
        <div className={`pb-2 ${tall ? 'space-y-1 px-0' : 'space-y-0.5 px-1'}`}>{children}</div>
      )}
    </div>
  );
}

function FilterIcon({ className = 'size-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
      />
    </svg>
  );
}

function ReorderViewsIcon({ className = 'size-3.5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"
      />
    </svg>
  );
}

function CollapseChevron({ collapsed, className = 'size-3.5' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.25}
      stroke="currentColor"
      className={`${className} transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        collapsed ? 'rotate-180' : ''
      }`}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function CollapseToggleControl({ collapsed }) {
  return (
    <span
      className="flex size-7 items-center justify-center rounded-lg border border-border/50 bg-white/60 text-primary-text/50 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm transition-all duration-200 group-hover:border-accent/35 group-hover:bg-accent/[0.07] group-hover:text-accent group-hover:shadow-[0_1px_3px_rgba(217,119,6,0.12)] group-active:scale-95 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-primary-text-dark/55 dark:group-hover:border-accent-dark/40 dark:group-hover:bg-accent-dark/10 dark:group-hover:text-accent-dark"
      aria-hidden
    >
      <CollapseChevron collapsed={collapsed} />
    </span>
  );
}

function FiltersSidebarHeader({ collapsed, onToggle, compact = false }) {
  const t = useTranslations('DownloadsFilters');
  const label = t('sidebarLabel');
  const toggleLabel = collapsed ? t('expandSidebar') : t('collapseSidebar');

  if (compact) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={toggleLabel}
        title={toggleLabel}
        className="group flex w-full flex-col items-center gap-2 border-b border-border/50 px-1 py-3 transition-colors hover:bg-surface-alt/40 dark:border-border-dark/50 dark:hover:bg-surface-alt-dark/30"
      >
        <span
          className="flex size-7 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/15 dark:bg-accent-dark/15 dark:text-accent-dark dark:group-hover:bg-accent-dark/20"
          aria-hidden
        >
          <FilterIcon className="size-3.5" />
        </span>
        <span
          className="max-h-[4.5rem] truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-text/50 dark:text-primary-text-dark/50"
          style={{ writingMode: 'vertical-rl' }}
          aria-hidden
        >
          {label}
        </span>
        <CollapseToggleControl collapsed={collapsed} />
      </button>
    );
  }

  return (
    <div className="mb-2.5 flex shrink-0 items-center gap-2 border-b border-border/50 pb-2.5 dark:border-border-dark/50">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent dark:bg-accent-dark/15 dark:text-accent-dark"
          aria-hidden
        >
          <FilterIcon className="size-3.5" />
        </span>
        <h2 className="truncate text-sm font-semibold tracking-tight text-primary-text dark:text-primary-text-dark">
          {label}
        </h2>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-label={toggleLabel}
        title={toggleLabel}
        className="group shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:focus-visible:ring-accent-dark/40"
      >
        <CollapseToggleControl collapsed={collapsed} />
      </button>
    </div>
  );
}

export default function FiltersSidebar({
  apiKey,
  views,
  activeViewIds = [],
  tags,
  activeAssetType = 'all',
  activeTagIds,
  activeTrackers = [],
  activeSources = [],
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
      if (!window.confirm(t('confirmDeleteView', { name: viewName }))) return;
      try {
        await deleteViewStore(apiKey, viewId);
        if (activeViewIds.some((id) => String(id) === String(viewId))) onClearView();
      } catch (error) {
        alert(t('deleteViewFailed', { error: error.message }));
      }
    },
    [apiKey, deleteViewStore, activeViewIds, onClearView, t]
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
      if (!window.confirm(t('confirmDeleteTag', { name: tagName }))) return;
      try {
        await deleteTagStore(apiKey, tagId);
        onDeleteTag?.(tagId);
      } catch (error) {
        alert(t('deleteTagFailed', { error: error.message }));
      }
    },
    [apiKey, deleteTagStore, onDeleteTag, t]
  );

  if (isFixed && collapsed && onToggleCollapsed) {
    return (
      <aside
        className={`fixed inset-y-0 z-[35] flex w-[var(--downloads-sidebar-width,2.5rem)] flex-col border-r border-border/60 bg-surface/90 backdrop-blur-xl dark:border-border-dark/60 dark:bg-surface-dark/90 ${className}`}
        style={{ left: 'var(--sidebar-width, 0px)' }}
        aria-label={t('sidebarLabel')}
      >
        <FiltersSidebarHeader collapsed compact onToggle={onToggleCollapsed} />
      </aside>
    );
  }

  return (
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
      <div className="ui-scrollbar min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto overscroll-contain dark:divide-border-dark/60">
        <SidebarSection
          title={t('viewsSection')}
          onAdd={onNewView}
          addLabel={t('newView')}
          headerActions={
            canReorderViews ? (
              <button
                type="button"
                onClick={handleToggleViewsSortMode}
                disabled={reorderDisabledBySearch}
                className={`p-1 rounded transition-colors ${
                  viewsSortMode
                    ? 'bg-accent/15 text-accent dark:bg-accent-dark/20 dark:text-accent-dark'
                    : 'text-primary-text/50 hover:text-accent dark:text-primary-text-dark/50 dark:hover:text-accent-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark'
                } disabled:cursor-not-allowed disabled:opacity-40`}
                aria-label={viewsSortMode ? t('reorderViewsActive') : t('reorderViews')}
                aria-pressed={viewsSortMode}
                title={
                  reorderDisabledBySearch
                    ? t('reorderViewsDisabledSearch')
                    : viewsSortMode
                      ? t('reorderViewsActive')
                      : t('reorderViews')
                }
              >
                <ReorderViewsIcon />
              </button>
            ) : null
          }
          tall={sectionTall}
          expanded={sectionsExpanded.views}
          onToggle={() => toggleSection('views')}
          toggleLabel={sectionToggleLabel(t('viewsSection'), sectionsExpanded.views)}
          activeCount={activeViewIds.length}
        >
          {viewsLoading ? (
            <SidebarSectionSkeleton rows={3} />
          ) : (
            <ViewSidebarSection
              views={views}
              viewCounts={viewCounts}
              searchQuery={searchQuery}
              activeViewIds={activeViewIds}
              onApplyView={onApplyView}
              onApplyViewRange={onApplyViewRange}
              onClearViews={onClearViews}
              onEditView={onEditView}
              onRenameView={onRenameView}
              onDeleteView={handleDeleteView}
              sortMode={viewsSortMode}
              onExitSortMode={handleExitViewsSortMode}
              onReorderViews={onReorderViews}
            />
          )}
        </SidebarSection>

        <SidebarSection
          title={t('tagsSection')}
          onAdd={onOpenTagManager}
          addLabel={t('manageTags')}
          tall={sectionTall}
          expanded={sectionsExpanded.tags}
          onToggle={() => toggleSection('tags')}
          toggleLabel={sectionToggleLabel(t('tagsSection'), sectionsExpanded.tags)}
          activeCount={activeTagIds?.length ?? 0}
        >
          {tagsLoading ? (
            <SidebarSectionSkeleton rows={4} />
          ) : (
            <TagSidebarSection
              tags={tags}
              tagCounts={tagCounts}
              searchQuery={searchQuery}
              activeTagIds={activeTagIds}
              onApplyTag={onApplyTag}
              onApplyTagRange={onApplyTagRange}
              onClearTags={onClearTags}
              onRenameTag={onRenameTag}
              onDeleteTag={handleDeleteTagItem}
              disabled={trackerFilterLocked}
            />
          )}
        </SidebarSection>

        {showTrackerSection && (
          <SidebarSection
            title={t('trackersSection')}
            tall={sectionTall}
            expanded={sectionsExpanded.trackers}
            onToggle={() => toggleSection('trackers')}
            toggleLabel={sectionToggleLabel(t('trackersSection'), sectionsExpanded.trackers)}
            activeCount={activeTrackers.length}
          >
            {countsLoading ? (
              <SidebarSectionSkeleton rows={3} />
            ) : (
              <TrackerSidebarSection
                entries={trackerEntries}
                searchQuery={searchQuery}
                activeTrackers={activeTrackers}
                onApplyTracker={onApplyTracker}
                onApplyTrackerRange={onApplyTrackerRange}
                onClearTrackers={onClearTrackers}
                disabled={trackerFilterLocked}
              />
            )}
          </SidebarSection>
        )}

        {showSourceSection && (
          <SidebarSection
            title={t('sourcesSection')}
            tall={sectionTall}
            expanded={sectionsExpanded.sources}
            onToggle={() => toggleSection('sources')}
            toggleLabel={sectionToggleLabel(t('sourcesSection'), sectionsExpanded.sources)}
            activeCount={activeSources.length}
          >
            {countsLoading ? (
              <SidebarSectionSkeleton rows={3} />
            ) : (
              <SourceSidebarSection
                entries={sourceEntries}
                searchQuery={searchQuery}
                activeSources={activeSources}
                onApplySource={onApplySource}
                onApplySourceRange={onApplySourceRange}
                onClearSources={onClearSources}
                disabled={trackerFilterLocked}
              />
            )}
          </SidebarSection>
        )}
      </div>

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
  );
}

export { filtersFromView } from '../filters/filterHelpers';
