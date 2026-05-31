'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCustomViews } from '@/components/shared/hooks/useCustomViews';
import { useTags } from '@/components/shared/hooks/useTags';
import SidebarListItem from './SidebarListItem';
import SidebarOverflowMenu from './SidebarOverflowMenu';
import { useFiltersSidebarCounts } from './useFiltersSidebarCounts';

function SidebarSection({ title, children, emptyMessage, emptyAction, onAdd, addLabel, tall, sheet }) {
  return (
    <div className={`flex min-h-0 flex-col ${sheet ? 'min-h-0 flex-1' : ''}`}>
      <div className={`flex items-center justify-between gap-1 ${tall ? 'px-0 py-1.5' : 'p-1'}`}>
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
      <div
        className={`min-h-[60px] flex-1 overflow-y-auto overscroll-contain pb-2 ${
          tall ? 'space-y-1 px-0' : 'max-h-[200px] space-y-0.5 px-1'
        }`}
      >
        {children}
        {emptyMessage && (
          <p className="p-2 text-[11px] text-primary-text/50 dark:text-primary-text-dark/50 italic">
            {emptyMessage}
          </p>
        )}
      </div>
      {emptyAction}
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
  activeView,
  tags,
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
  onOpenTagManager,
  variant = 'inline',
  className = '',
  collapsed = false,
  onToggleCollapsed,
}) {
  const t = useTranslations('DownloadsFilters');
  const { deleteView } = useCustomViews(apiKey);
  const { deleteTag } = useTags(apiKey);
  const isFixed = variant === 'fixed';
  const isSheet = variant === 'sheet';
  const sectionTall = isFixed || isSheet;
  const [overflowMenu, setOverflowMenu] = useState(null);

  const closeOverflowMenu = () => setOverflowMenu(null);

  const openOverflowMenu = (key, anchorRef, items) => {
    setOverflowMenu((current) => (current?.key === key ? null : { key, anchorRef, items }));
  };

  const { tagCounts, viewCounts } = useFiltersSidebarCounts(activeAssetType, views);

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
    >
      {isFixed && onToggleCollapsed && (
        <FiltersSidebarHeader collapsed={false} onToggle={onToggleCollapsed} />
      )}
      <div
        className={`min-h-0 flex-1 divide-y divide-border/60 dark:divide-border-dark/60 ${
          isSheet ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        <SidebarSection
          title={t('viewsSection')}
          emptyMessage={views.length === 0 ? t('noViews') : null}
          onAdd={onNewView}
          addLabel={t('newView')}
          tall={sectionTall}
          sheet={isSheet}
        >
          {views.map((view) => {
            const menuKey = `view-${view.id}`;
            const viewIsActive = activeView?.id === view.id;
            const viewMenuItems = [
              {
                id: 'apply',
                label: viewIsActive ? t('menuClear') : t('menuApply'),
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
                isActive={viewIsActive}
                title={viewIsActive ? t('toggleFilterOff') : t('toggleFilterOn')}
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
          onAdd={onOpenTagManager}
          addLabel={t('manageTags')}
          tall={sectionTall}
          sheet={isSheet}
        >
          {tags.map((tag) => {
            const menuKey = `tag-${tag.id}`;
            const tagIsActive = activeTagSet.has(Number(tag.id)) && !activeView;
            const tagMenuItems = [
              {
                id: 'apply',
                label: tagIsActive ? t('menuClear') : t('menuApply'),
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
                isActive={tagIsActive}
                title={tagIsActive ? t('toggleFilterOff') : t('toggleFilterOn')}
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
        className={`shrink-0 space-y-1.5 border-t border-border/60 dark:border-border-dark/60 ${
          isSheet ? 'bg-transparent pt-2' : 'bg-surface/50 dark:bg-surface-dark/50'
        } ${isFixed ? 'pt-2.5' : isSheet ? '' : 'p-2'}`}
      >
        <button
          type="button"
          onClick={onNewView || onNewFilter}
          className={
            isSheet
              ? 'ui-btn-accent w-full justify-center !rounded-xl !text-xs'
              : 'w-full rounded-md border border-accent/40 px-2 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10 dark:border-accent-dark/40 dark:text-accent-dark dark:hover:bg-accent-dark/10'
          }
        >
          {t('newView')}
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
