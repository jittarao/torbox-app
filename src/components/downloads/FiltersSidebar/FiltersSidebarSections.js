import SectionCombineToggle from './SectionCombineToggle';
import ViewSidebarSection from './ViewSidebarSection';
import TagSidebarSection from './TagSidebarSection';
import TrackerSidebarSection from './TrackerSidebarSection';
import SourceSidebarSection from './SourceSidebarSection';
import SidebarSectionSkeleton from './SidebarSectionSkeleton';
import { SidebarSection, ReorderViewsIcon } from './FiltersSidebarChrome';

export default function FiltersSidebarSections({
  t,
  sectionTall,
  sectionsExpanded,
  toggleSection,
  sectionToggleLabel,
  views,
  viewCounts,
  tags,
  tagCounts,
  trackerEntries,
  sourceEntries,
  searchQuery,
  activeViewIds,
  activeTagIds,
  activeTrackers,
  activeSources,
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
  onEditView,
  onRenameView,
  onRenameTag,
  onReorderViews,
  onOpenTagManager,
  onApplyTag,
  onApplyTagRange,
  onClearTags,
  onApplyTracker,
  onApplyTrackerRange,
  onClearTrackers,
  onApplySource,
  onApplySourceRange,
  onClearSources,
  handleDeleteView,
  handleDeleteTagItem,
  viewsLoading,
  tagsLoading,
  countsLoading,
  viewsSortMode,
  handleToggleViewsSortMode,
  handleExitViewsSortMode,
  reorderDisabledBySearch,
  sectionVisibility,
  trackerFilterLocked,
  onNewView,
}) {
  const {
    canReorderViews,
    showViewCombineToggle,
    showTagCombineToggle,
    showTrackerCombineToggle,
    showSourceCombineToggle,
    showTrackerSection,
    showSourceSection,
  } = sectionVisibility;

  return (
    <div className="ui-scrollbar min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto overscroll-contain dark:divide-border-dark/60">
      <SidebarSection
        title={t('viewsSection')}
        onAdd={onNewView}
        addLabel={t('newView')}
        headerActions={
          <>
            {showViewCombineToggle ? (
              <SectionCombineToggle
                value={viewCombineMode}
                onChange={onSetViewCombineMode}
                sectionLabel={t('viewsSection')}
              />
            ) : null}
            {canReorderViews ? (
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
            ) : null}
          </>
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
        headerActions={
          showTagCombineToggle ? (
            <SectionCombineToggle
              value={tagCombineMode}
              onChange={onSetTagCombineMode}
              disabled={trackerFilterLocked}
              sectionLabel={t('tagsSection')}
            />
          ) : null
        }
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
          headerActions={
            showTrackerCombineToggle ? (
              <SectionCombineToggle
                value={trackerCombineMode}
                onChange={onSetTrackerCombineMode}
                disabled={trackerFilterLocked}
                sectionLabel={t('trackersSection')}
              />
            ) : null
          }
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
          headerActions={
            showSourceCombineToggle ? (
              <SectionCombineToggle
                value={sourceCombineMode}
                onChange={onSetSourceCombineMode}
                disabled={trackerFilterLocked}
                sectionLabel={t('sourcesSection')}
              />
            ) : null
          }
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
  );
}
