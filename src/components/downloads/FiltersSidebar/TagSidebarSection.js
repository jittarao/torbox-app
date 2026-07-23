'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import SidebarListItem from './SidebarListItem';
import SidebarOverflowMenu from './SidebarOverflowMenu';
import { matchesSidebarSearch } from './sidebarSearch';
import { useSidebarShiftSelect } from './sidebarRangeSelect';

const EMPTY_TAGS = [];
const EMPTY_TAG_COUNTS = {};
const EMPTY_ACTIVE_TAG_IDS = [];

export default function TagSidebarSection({
  tags = EMPTY_TAGS,
  tagCounts = EMPTY_TAG_COUNTS,
  searchQuery = '',
  activeTagIds = EMPTY_ACTIVE_TAG_IDS,
  onApplyTag,
  onApplyTagRange,
  onClearTags,
  onRenameTag,
  onDeleteTag,
  disabled = false,
}) {
  const t = useTranslations('DownloadsFilters');
  const { lastIndexRef } = useSidebarShiftSelect(searchQuery);
  const [overflowMenu, setOverflowMenu] = useState(null);

  const activeTagSet = useMemo(
    () => new Set((activeTagIds || []).map((id) => Number(id))),
    [activeTagIds]
  );

  const filteredTags = useMemo(
    () => tags.filter((tag) => matchesSidebarSearch(searchQuery, tag.name)),
    [tags, searchQuery]
  );

  const selectedCount = activeTagSet.size;
  const hasSearchQuery = searchQuery.trim().length > 0;

  const closeOverflowMenu = useCallback(() => setOverflowMenu(null), []);

  const handleItemActivate = useCallback(
    (index) => (event) => {
      const tag = filteredTags[index];
      if (!tag || disabled) return;

      const tagIsActive = activeTagSet.has(Number(tag.id));

      if (event.shiftKey && lastIndexRef.current !== null && onApplyTagRange) {
        const start = Math.min(lastIndexRef.current, index);
        const end = Math.max(lastIndexRef.current, index);
        const rangeIds = filteredTags.slice(start, end + 1).map((item) => item.id);
        onApplyTagRange(rangeIds, !tagIsActive);
      } else {
        onApplyTag?.(tag.id);
      }

      lastIndexRef.current = index;
    },
    [disabled, filteredTags, activeTagSet, onApplyTag, onApplyTagRange, lastIndexRef]
  );

  const handleMenuToggle = useCallback(
    (tag) => (_isOpen, menuButtonRef) => {
      const tagId = String(tag.id);
      if (overflowMenu?.tagId === tagId) {
        closeOverflowMenu();
        return;
      }
      const tagIsActive = activeTagSet.has(Number(tag.id));
      setOverflowMenu({
        tagId,
        anchorRef: menuButtonRef,
        items: [
          {
            id: 'apply',
            label: tagIsActive ? t('menuClear') : t('menuApply'),
            onClick: () => onApplyTag?.(tag.id),
          },
          {
            id: 'rename',
            label: t('menuRename'),
            onClick: () => onRenameTag?.(tag),
          },
          {
            id: 'delete',
            label: t('menuDelete'),
            destructive: true,
            onClick: () => onDeleteTag?.(tag.id, tag.name),
          },
        ],
      });
    },
    [activeTagSet, closeOverflowMenu, onApplyTag, onDeleteTag, onRenameTag, overflowMenu?.tagId, t]
  );

  if (tags.length === 0) {
    return (
      <p className="p-2 text-[11px] text-primary-text/50 dark:text-primary-text-dark/50 italic">
        {t('noTags')}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {selectedCount > 0 && (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[10px] font-medium text-accent dark:text-accent-dark">
            {t('tagsSelected', { count: selectedCount })}
          </span>
          <button
            type="button"
            onClick={onClearTags}
            className="text-[10px] font-medium text-primary-text/55 hover:text-accent dark:text-primary-text-dark/55 dark:hover:text-accent-dark transition-colors"
          >
            {t('clearTags')}
          </button>
        </div>
      )}

      {filteredTags.length === 0 ? (
        <p className="p-2 text-[11px] text-primary-text/50 dark:text-primary-text-dark/50 italic">
          {hasSearchQuery ? t('noTagMatches', { query: searchQuery.trim() }) : t('noTags')}
        </p>
      ) : (
        <div>
          {filteredTags.map((tag, index) => {
            const tagId = String(tag.id);
            const tagIsActive = activeTagSet.has(Number(tag.id));
            return (
              <SidebarListItem
                key={tag.id}
                itemId={tagId}
                itemIndex={index}
                label={tag.name}
                count={tagCounts[tag.id]}
                isActive={tagIsActive}
                disabled={disabled}
                title={tagIsActive ? t('toggleFilterOff') : t('toggleFilterOn')}
                onClick={handleItemActivate(index)}
                menu={{ open: overflowMenu?.tagId === tagId, visible: true }}
                onMenuToggle={handleMenuToggle(tag)}
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
