'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCustomViews } from '@/components/shared/hooks/useCustomViews';
import { useTags } from '@/components/shared/hooks/useTags';
import SidebarListItem from './SidebarListItem';
import SidebarOverflowMenu from './SidebarOverflowMenu';
import { countDownloadsPerTag, countDownloadsPerView } from '../filters/filterHelpers';

function SidebarSection({ title, children, emptyMessage, emptyAction, onAdd, addLabel, tall }) {
  return (
    <div className="flex flex-col min-h-0">
      <div
        className={`flex items-center justify-between gap-1 ${tall ? 'px-0 py-1.5' : 'px-1 py-1'}`}
      >
        <h3 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-primary-text/50 dark:text-primary-text-dark/50">
          {title}
        </h3>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="p-1 rounded text-primary-text/50 hover:text-accent dark:text-primary-text-dark/50 dark:hover:text-accent-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors"
            aria-label={addLabel}
            title={addLabel}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>
      <div
        className={`flex-1 overflow-y-auto min-h-[60px] pb-2 ${
          tall ? 'space-y-1 px-0' : 'space-y-0.5 px-1 max-h-[200px]'
        }`}
      >
        {children}
        {emptyMessage && (
          <p className="px-2 py-2 text-[11px] text-primary-text/50 dark:text-primary-text-dark/50 italic">
            {emptyMessage}
          </p>
        )}
      </div>
      {emptyAction}
    </div>
  );
}

export default function FiltersSidebar({
  apiKey,
  views,
  activeView,
  tags,
  enrichedDownloads,
  activeAssetType = 'all',
  activeTagIds,
  onApplyView,
  onClearView,
  onApplyTag,
  onEditView,
  onRenameView,
  onRenameTag,
  onDeleteTag,
  onNewFilter,
  onNewView,
  onNewTag,
  onManageTags,
  variant = 'inline',
  className = '',
}) {
  const t = useTranslations('DownloadsFilters');
  const { deleteView } = useCustomViews(apiKey);
  const { deleteTag } = useTags(apiKey);
  const isFixed = variant === 'fixed';
  const [overflowMenu, setOverflowMenu] = useState(null);

  const closeOverflowMenu = () => setOverflowMenu(null);

  const openOverflowMenu = (key, anchorRef, items) => {
    setOverflowMenu((current) =>
      current?.key === key ? null : { key, anchorRef, items }
    );
  };

  const tagCounts = useMemo(() => countDownloadsPerTag(enrichedDownloads), [enrichedDownloads]);
  const viewCounts = useMemo(
    () => countDownloadsPerView(views, enrichedDownloads, activeAssetType),
    [views, enrichedDownloads, activeAssetType]
  );

  const activeTagSet = useMemo(
    () => new Set((activeTagIds || []).map((id) => Number(id))),
    [activeTagIds]
  );

  const handleDeleteView = async (viewId, viewName) => {
    if (!window.confirm(t('confirmDeleteView', { name: viewName }))) return;
    try {
      await deleteView(viewId);
      if (activeView?.id === viewId) onClearView();
    } catch (error) {
      alert(t('deleteViewFailed', { error: error.message }));
    }
  };

  const handleDeleteTagItem = async (tagId, tagName) => {
    if (!window.confirm(t('confirmDeleteTag', { name: tagName }))) return;
    try {
      await deleteTag(tagId);
      onDeleteTag?.(tagId);
    } catch (error) {
      alert(t('deleteTagFailed', { error: error.message }));
    }
  };

  return (
    <aside
      className={`flex flex-col overflow-hidden ${
        isFixed
          ? 'fixed inset-y-0 z-[35] w-[var(--downloads-sidebar-width,14rem)] border-r border-border/60 dark:border-border-dark/60 bg-surface/90 dark:bg-surface-dark/90 backdrop-blur-xl p-2.5'
          : 'w-[var(--downloads-sidebar-width,14rem)] shrink-0 border border-border dark:border-border-dark rounded-lg bg-surface/50 dark:bg-surface-dark/50'
      } ${className}`}
      style={isFixed ? { left: 'var(--sidebar-width, 0px)' } : undefined}
      aria-label={t('sidebarLabel')}
    >
      <div className="flex-1 overflow-y-auto divide-y divide-border/60 dark:divide-border-dark/60">
        <SidebarSection
          title={t('viewsSection')}
          emptyMessage={views.length === 0 ? t('noViews') : null}
          onAdd={onNewView}
          addLabel={t('newView')}
          tall={isFixed}
        >
          {views.map((view) => {
            const menuKey = `view-${view.id}`;
            const viewMenuItems = [
              {
                id: 'apply',
                label: t('menuApply'),
                onClick: () => onApplyView(view),
              },
              {
                id: 'edit',
                label: t('menuEdit'),
                onClick: () => onEditView(view),
              },
              {
                id: 'rename',
                label: t('menuRename'),
                onClick: () => onRenameView(view),
              },
              {
                id: 'delete',
                label: t('menuDelete'),
                destructive: true,
                onClick: () => handleDeleteView(view.id, view.name),
              },
            ];

            return (
              <SidebarListItem
                key={view.id}
                label={view.name}
                count={viewCounts[view.id]}
                isActive={activeView?.id === view.id}
                onClick={() => onApplyView(view)}
                isMenuOpen={overflowMenu?.key === menuKey}
                onMenuToggle={(open, anchorRef) => {
                  if (!open) {
                    closeOverflowMenu();
                    return;
                  }
                  openOverflowMenu(menuKey, anchorRef, viewMenuItems);
                }}
              />
            );
          })}
        </SidebarSection>

        <SidebarSection
          title={t('tagsSection')}
          emptyMessage={tags.length === 0 ? t('noTags') : null}
          onAdd={onNewTag}
          addLabel={t('newTag')}
          tall={isFixed}
        >
          {tags.map((tag) => {
            const menuKey = `tag-${tag.id}`;
            const tagMenuItems = [
              {
                id: 'apply',
                label: t('menuApply'),
                onClick: () => onApplyTag(tag.id),
              },
              {
                id: 'rename',
                label: t('menuRename'),
                onClick: () => onRenameTag(tag),
              },
              {
                id: 'delete',
                label: t('menuDelete'),
                destructive: true,
                onClick: () => handleDeleteTagItem(tag.id, tag.name),
              },
            ];

            return (
              <SidebarListItem
                key={tag.id}
                label={tag.name}
                count={tagCounts[tag.id]}
                isActive={activeTagSet.has(Number(tag.id)) && !activeView}
                onClick={() => onApplyTag(tag.id)}
                isMenuOpen={overflowMenu?.key === menuKey}
                onMenuToggle={(open, anchorRef) => {
                  if (!open) {
                    closeOverflowMenu();
                    return;
                  }
                  openOverflowMenu(menuKey, anchorRef, tagMenuItems);
                }}
              />
            );
          })}
        </SidebarSection>
      </div>

      <div
        className={`shrink-0 space-y-1.5 border-t border-border/60 dark:border-border-dark/60 bg-surface/50 dark:bg-surface-dark/50 ${
          isFixed ? 'pt-2.5' : 'p-2'
        }`}
      >
        <button
          type="button"
          onClick={onNewView || onNewFilter}
          className="w-full px-2 py-1.5 text-xs font-medium text-accent dark:text-accent-dark border border-accent/40 dark:border-accent-dark/40 rounded-md hover:bg-accent/10 dark:hover:bg-accent-dark/10 transition-colors"
        >
          {t('newView')}
        </button>
        <button
          type="button"
          onClick={onNewTag}
          className="w-full px-2 py-1.5 text-xs font-medium text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors"
        >
          {t('newTag')}
        </button>
        <button
          type="button"
          onClick={onManageTags}
          className="w-full px-2 py-1.5 text-xs text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark transition-colors"
        >
          {t('manageTags')}
        </button>
      </div>

      {overflowMenu && (
        <SidebarOverflowMenu
          isOpen
          onClose={closeOverflowMenu}
          anchorRef={overflowMenu.anchorRef}
          items={overflowMenu.items}
        />
      )}
    </aside>
  );
}

export { filtersFromView } from '../filters/filterHelpers';
