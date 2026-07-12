'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from '@/components/icons';
import { useTags } from '@/components/shared/hooks/useTags';
import InlineTagMultiSelect from './InlineTagMultiSelect';
import { TAG_SEARCH_MIN_COUNT } from './constants';

const EMPTY_ARRAY = [];

/**
 * TagSelector — inline multi-select for assigning tags (no dropdown).
 * @param {Object} props
 * @param {Array} props.value - Selected tag IDs
 * @param {Function} props.onChange - (tagIds: number[]) => void
 * @param {string} props.apiKey
 * @param {string} props.className
 * @param {boolean} props.disabled
 * @param {boolean} props.allowCreate
 * @param {Array<{id: number, name: string}>|null} props.tagOptions - When set, use this list instead of all tags
 * @param {'add'|'remove'} props.variant - Visual style for selected chips
 */
export default function TagSelector({
  value = EMPTY_ARRAY,
  onChange,
  apiKey,
  className = '',
  disabled = false,
  allowCreate = false,
  tagOptions = null,
  variant = 'add',
}) {
  const t = useTranslations('DownloadsFilters');
  const { tags, loading, createTag } = useTags(apiKey);
  const [newTagName, setNewTagName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const createInputRef = useRef(null);

  const sortedTags = useMemo(
    () =>
      [...tags].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [tags]
  );

  const displayTags = useMemo(() => {
    const source = tagOptions ?? sortedTags;
    return [...source].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }, [tagOptions, sortedTags]);

  const showSearch = displayTags.length > TAG_SEARCH_MIN_COUNT;

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name || isCreating) return;

    setIsCreating(true);
    try {
      const newTag = await createTag(name);
      setNewTagName('');
      onChange([...value, newTag.id]);
      createInputRef.current?.focus();
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={className}>
      {allowCreate && !disabled && (
        <form
          className="mb-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateTag();
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Plus
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary-text/35 dark:text-primary-text-dark/35"
              aria-hidden
            />
            <input
              ref={createInputRef}
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder={t('newTagPrompt')}
              disabled={disabled || loading || isCreating}
              className="w-full rounded-xl border border-border/80 bg-surface-alt/50 py-2.5 pl-9 pr-3 text-sm
                text-primary-text placeholder:text-primary-text/40
                focus:border-accent/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/15
                disabled:opacity-60
                dark:border-border-dark/80 dark:bg-surface-alt-dark/40 dark:text-primary-text-dark
                dark:focus:border-accent-dark/50 dark:focus:bg-surface-dark dark:focus:ring-accent-dark/15"
              aria-label={t('newTag')}
            />
          </div>
          <button
            type="submit"
            disabled={!newTagName.trim() || disabled || loading || isCreating}
            className="ui-btn-accent w-full shrink-0 justify-center !px-4 sm:w-auto"
          >
            {isCreating ? (
              <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              t('newTag')
            )}
          </button>
        </form>
      )}

      <InlineTagMultiSelect
        tags={displayTags}
        value={value}
        onChange={onChange}
        disabled={disabled}
        loading={tagOptions ? false : loading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showSearch={showSearch}
        searchPlaceholder={t('tagManagerSearchPlaceholder')}
        emptyMessage={tagOptions ? t('tagAssignmentNoAssignedTags') : t('noTags')}
        noResultsMessage={t('tagManagerNoResults', { query: searchQuery.trim() })}
        variant={variant}
        aria-label={t('tagAssignmentSelectLabel')}
      />
    </div>
  );
}
