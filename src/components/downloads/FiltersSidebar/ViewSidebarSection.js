'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import SidebarListItem from './SidebarListItem';
import SidebarOverflowMenu from './SidebarOverflowMenu';
import { matchesSidebarSearch } from './sidebarSearch';
import { useSidebarShiftSelect } from './sidebarRangeSelect';

export default function ViewSidebarSection({
  views = [],
  viewCounts = {},
  searchQuery = '',
  activeViewIds = [],
  onApplyView,
  onApplyViewRange,
  onClearViews,
  onEditView,
  onRenameView,
  onDeleteView,
  disabled = false,
}) {
  const t = useTranslations('DownloadsFilters');
  const { lastIndexRef } = useSidebarShiftSelect(searchQuery);
  const [overflowMenu, setOverflowMenu] = useState(null);

  const activeViewIdSet = useMemo(
    () => new Set((activeViewIds || []).map((id) => String(id))),
    [activeViewIds]
  );

  const filteredViews = useMemo(
    () => views.filter((view) => matchesSidebarSearch(searchQuery, view.name)),
    [views, searchQuery]
  );

  const selectedCount = activeViewIds.length;
  const hasSearchQuery = searchQuery.trim().length > 0;

  const closeOverflowMenu = useCallback(() => setOverflowMenu(null), []);

  const handleListMouseDown = useCallback((event) => {
    if (event.shiftKey && event.target.closest('[data-sidebar-item]')) {
      event.preventDefault();
    }
  }, []);

  const handleListClick = useCallback(
    (event) => {
      const menuButton = event.target.closest('[data-sidebar-menu]');
      if (menuButton) {
        event.stopPropagation();
        const row = menuButton.closest('[data-sidebar-item]');
        if (!row) return;
        const index = Number(row.dataset.index);
        const view = filteredViews[index];
        if (!view || String(view.id) !== row.dataset.id) return;
        const viewId = String(view.id);
        if (overflowMenu?.viewId === viewId) {
          closeOverflowMenu();
          return;
        }
        const viewIsActive = activeViewIdSet.has(viewId);
        setOverflowMenu({
          viewId,
          anchorRef: { current: menuButton },
          items: [
            {
              id: 'apply',
              label: viewIsActive ? t('menuClear') : t('menuApply'),
              onClick: () => onApplyView?.(view),
            },
            {
              id: 'edit',
              label: t('menuEdit'),
              onClick: () => onEditView?.(view),
            },
            {
              id: 'rename',
              label: t('menuRename'),
              onClick: () => onRenameView?.(view),
            },
            {
              id: 'delete',
              label: t('menuDelete'),
              destructive: true,
              onClick: () => onDeleteView?.(view.id, view.name),
            },
          ],
        });
        return;
      }

      const activateButton = event.target.closest('[data-sidebar-activate]');
      if (!activateButton || disabled) return;

      const row = activateButton.closest('[data-sidebar-item]');
      if (!row) return;

      const index = Number(row.dataset.index);
      const view = filteredViews[index];
      if (!view || String(view.id) !== row.dataset.id) return;

      const viewIsActive = activeViewIdSet.has(String(view.id));

      if (event.shiftKey && lastIndexRef.current !== null && onApplyViewRange) {
        const start = Math.min(lastIndexRef.current, index);
        const end = Math.max(lastIndexRef.current, index);
        const rangeIds = filteredViews.slice(start, end + 1).map((v) => v.id);
        onApplyViewRange(rangeIds, !viewIsActive);
      } else {
        onApplyView?.(view);
      }

      lastIndexRef.current = index;
    },
    [
      disabled,
      filteredViews,
      activeViewIdSet,
      onApplyView,
      onApplyViewRange,
      onEditView,
      onRenameView,
      onDeleteView,
      lastIndexRef,
      overflowMenu,
      closeOverflowMenu,
      t,
    ]
  );

  if (views.length === 0) {
    return (
      <p className="p-2 text-[11px] text-primary-text/50 dark:text-primary-text-dark/50 italic">
        {t('noViews')}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {selectedCount > 0 && (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[10px] font-medium text-accent dark:text-accent-dark">
            {t('viewsSelected', { count: selectedCount })}
          </span>
          <button
            type="button"
            onClick={onClearViews}
            className="text-[10px] font-medium text-primary-text/55 hover:text-accent dark:text-primary-text-dark/55 dark:hover:text-accent-dark transition-colors"
          >
            {t('clearViews')}
          </button>
        </div>
      )}

      {filteredViews.length === 0 ? (
        <p className="p-2 text-[11px] text-primary-text/50 dark:text-primary-text-dark/50 italic">
          {hasSearchQuery ? t('noViewMatches', { query: searchQuery.trim() }) : t('noViews')}
        </p>
      ) : (
        <div onMouseDown={handleListMouseDown} onClick={handleListClick}>
          {filteredViews.map((view, index) => {
            const viewId = String(view.id);
            const viewIsActive = activeViewIdSet.has(viewId);
            return (
              <SidebarListItem
                key={view.id}
                itemId={viewId}
                itemIndex={index}
                label={view.name}
                count={viewCounts[view.id]}
                isActive={viewIsActive}
                disabled={disabled}
                title={viewIsActive ? t('toggleFilterOff') : t('toggleFilterOn')}
                showMenu
                isMenuOpen={overflowMenu?.viewId === viewId}
              />
            );
          })}
        </div>
      )}

      {overflowMenu && (
        <SidebarOverflowMenu
          isOpen
          onClose={closeOverflowMenu}
          anchorRef={overflowMenu.anchorRef}
          items={overflowMenu.items}
        />
      )}
    </div>
  );
}
