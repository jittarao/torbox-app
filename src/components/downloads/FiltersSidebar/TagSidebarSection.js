'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import SidebarListItem from './SidebarListItem';
import { matchesSidebarSearch } from './sidebarSearch';

export default function TagSidebarSection({
  tags = [],
  tagCounts = {},
  searchQuery = '',
  activeTagIds = [],
  onApplyTag,
  onClearTags,
  disabled = false,
  renderItemMenu,
}) {
  const t = useTranslations('DownloadsFilters');

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
        filteredTags.map((tag) => {
          const tagIsActive = activeTagSet.has(Number(tag.id));
          return (
            <SidebarListItem
              key={tag.id}
              label={tag.name}
              count={tagCounts[tag.id]}
              isActive={tagIsActive}
              disabled={disabled}
              title={tagIsActive ? t('toggleFilterOff') : t('toggleFilterOn')}
              onClick={() => !disabled && onApplyTag?.(tag.id)}
              {...(renderItemMenu ? renderItemMenu(tag, tagIsActive) : {})}
            />
          );
        })
      )}
    </div>
  );
}
