'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useTranslations } from 'next-intl';
import SidebarListItem from './SidebarListItem';
import SidebarOverflowMenu from './SidebarOverflowMenu';
import { matchesSidebarSearch } from './sidebarSearch';
import { useSidebarShiftSelect } from './sidebarRangeSelect';

function DragHandle({ listeners, attributes, label }) {
  return (
    <button
      type="button"
      className="flex size-4 shrink-0 cursor-grab items-center justify-center rounded text-primary-text/60 hover:text-primary-text active:cursor-grabbing dark:text-primary-text-dark/60 dark:hover:text-primary-text-dark"
      aria-label={label}
      title={label}
      {...listeners}
      {...attributes}
    >
      <svg
        className="size-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <circle cx="9" cy="5" r="1" />
        <circle cx="9" cy="12" r="1" />
        <circle cx="9" cy="19" r="1" />
        <circle cx="15" cy="5" r="1" />
        <circle cx="15" cy="12" r="1" />
        <circle cx="15" cy="19" r="1" />
      </svg>
    </button>
  );
}

const SortableViewRow = memo(function SortableViewRow({ view, itemIndex, viewCounts, dragLabel }) {
  const viewId = String(view.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: viewId,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SidebarListItem
        itemId={viewId}
        itemIndex={itemIndex}
        label={view.name}
        count={viewCounts[view.id]}
        isActive={false}
        disabled
        hideCheckbox
        menu={{ open: false, visible: false }}
        leading={<DragHandle listeners={listeners} attributes={attributes} label={dragLabel} />}
      />
    </div>
  );
});

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
  sortMode = false,
  onExitSortMode,
  onReorderViews,
  disabled = false,
}) {
  const t = useTranslations('DownloadsFilters');
  const { lastIndexRef } = useSidebarShiftSelect(searchQuery);
  const [overflowMenu, setOverflowMenu] = useState(null);

  const activeViewIdSet = useMemo(
    () => new Set((activeViewIds || []).map((id) => String(id))),
    [activeViewIds]
  );

  const filteredViews = useMemo(() => {
    if (sortMode) return views;
    return views.filter((view) => matchesSidebarSearch(searchQuery, view.name));
  }, [views, searchQuery, sortMode]);

  const sortableIds = useMemo(() => filteredViews.map((view) => String(view.id)), [filteredViews]);

  const selectedCount = activeViewIds.length;
  const hasSearchQuery = searchQuery.trim().length > 0;
  const effectiveOverflowMenu = sortMode ? null : overflowMenu;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!sortMode) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onExitSortMode?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortMode, onExitSortMode]);

  const closeOverflowMenu = useCallback(() => setOverflowMenu(null), []);

  const handleListMouseDown = useCallback((event) => {
    if (event.shiftKey && event.target.closest('[data-sidebar-item]')) {
      event.preventDefault();
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortableIds.indexOf(String(active.id));
      const newIndex = sortableIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      const nextIds = arrayMove(sortableIds, oldIndex, newIndex).map((id) => Number(id));
      try {
        await onReorderViews?.(nextIds);
      } catch {
        // Parent shows toast; keep sort mode open for retry.
      }
    },
    [sortableIds, onReorderViews]
  );

  const handleListClick = useCallback(
    (event) => {
      if (sortMode) return;

      const menuButton = event.target.closest('[data-sidebar-menu]');
      if (menuButton) {
        event.stopPropagation();
        const row = menuButton.closest('[data-sidebar-item]');
        if (!row) return;
        const index = Number(row.dataset.index);
        const view = filteredViews[index];
        if (!view || String(view.id) !== row.dataset.id) return;
        const viewId = String(view.id);
        if (effectiveOverflowMenu?.viewId === viewId) {
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
      sortMode,
      disabled,
      filteredViews,
      activeViewIdSet,
      onApplyView,
      onApplyViewRange,
      onEditView,
      onRenameView,
      onDeleteView,
      lastIndexRef,
      effectiveOverflowMenu,
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

  const renderNormalList = () => (
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
            menu={{ open: effectiveOverflowMenu?.viewId === viewId, visible: true }}
          />
        );
      })}
    </div>
  );

  const renderSortableList = () => (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis]}
    >
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div>
          {filteredViews.map((view, index) => (
            <SortableViewRow
              key={view.id}
              view={view}
              itemIndex={index}
              viewCounts={viewCounts}
              dragLabel={t('dragToReorderView')}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );

  return (
    <div className="space-y-1.5">
      {sortMode && (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[10px] font-medium text-primary-text/55 dark:text-primary-text-dark/55">
            {t('reorderViewsHint')}
          </span>
          <button
            type="button"
            onClick={onExitSortMode}
            className="text-[10px] font-medium text-accent hover:text-accent/80 dark:text-accent-dark dark:hover:text-accent-dark/80 transition-colors"
          >
            {t('reorderViewsDone')}
          </button>
        </div>
      )}

      {!sortMode && selectedCount > 0 && (
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
      ) : sortMode ? (
        renderSortableList()
      ) : (
        renderNormalList()
      )}

      {!sortMode && effectiveOverflowMenu && (
        <SidebarOverflowMenu
          isOpen
          onClose={closeOverflowMenu}
          anchorRef={effectiveOverflowMenu.anchorRef}
          items={effectiveOverflowMenu.items}
        />
      )}
    </div>
  );
}
