'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import SidebarListItem from './SidebarListItem';
import { matchesSidebarSearch } from './sidebarSearch';
import { useSidebarShiftSelect } from './sidebarRangeSelect';

export default function TagSidebarSection({
  tags = [],
  tagCounts = {},
  searchQuery = '',
  activeTagIds = [],
  onApplyTag,
  onApplyTagRange,
  onClearTags,
  disabled = false,
  renderItemMenu,
}) {
  const t = useTranslations('DownloadsFilters');
  const { lastIndexRef } = useSidebarShiftSelect(searchQuery);

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

  const handleItemClick = useCallback(
    (index, tag, event) => {
      if (disabled) return;

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
    [disabled, activeTagSet, filteredTags, onApplyTag, onApplyTagRange, lastIndexRef]
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
        filteredTags.map((tag, index) => {
          const tagIsActive = activeTagSet.has(Number(tag.id));
          return (
            <SidebarListItem
              key={tag.id}
              label={tag.name}
              count={tagCounts[tag.id]}
              isActive={tagIsActive}
              disabled={disabled}
              title={tagIsActive ? t('toggleFilterOff') : t('toggleFilterOn')}
              onClick={(e) => handleItemClick(index, tag, e)}
              {...(renderItemMenu ? renderItemMenu(tag, tagIsActive) : {})}
            />
          );
        })
      )}
    </div>
  );
}
