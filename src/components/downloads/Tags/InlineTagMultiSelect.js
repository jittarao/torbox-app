'use client';

import { useMemo } from 'react';
import { Check, Hash, MagnifyingGlass } from '@/components/icons';

const EMPTY_ARRAY = [];

function TagChipSkeleton() {
  return (
    <div
      className="h-9 w-24 animate-pulse rounded-full border border-border/40 bg-surface-alt/60 dark:border-border-dark/40 dark:bg-surface-alt-dark/40"
      aria-hidden
    />
  );
}

/**
 * Inline multi-select for tags — toggle chips in a scrollable panel (no dropdown).
 */
export default function InlineTagMultiSelect({
  tags = EMPTY_ARRAY,
  value = EMPTY_ARRAY,
  onChange,
  disabled = false,
  loading = false,
  searchQuery = '',
  onSearchChange,
  showSearch = false,
  searchPlaceholder = 'Search tags…',
  emptyMessage = 'No tags yet.',
  noResultsMessage = 'No tags match your search.',
  isTagDisabled,
  variant = 'add',
  className = '',
  'aria-label': ariaLabel = 'Select tags',
}) {
  const selectedSet = useMemo(() => new Set(value), [value]);

  const filteredTags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((tag) => tag.name.toLowerCase().includes(q));
  }, [tags, searchQuery]);

  const toggleTag = (tagId) => {
    if (disabled || isTagDisabled?.(tags.find((t) => t.id === tagId))) return;
    if (selectedSet.has(tagId)) {
      onChange(value.filter((id) => id !== tagId));
    } else {
      onChange([...value, tagId]);
    }
  };

  const selectedChipClass =
    variant === 'remove'
      ? 'border-red-500/50 bg-red-500/15 text-red-700 ring-2 ring-red-500/25 dark:border-red-400/45 dark:bg-red-500/20 dark:text-red-300 dark:ring-red-400/20'
      : 'border-accent/50 bg-accent/15 text-accent ring-2 ring-accent/25 dark:border-accent-dark/45 dark:bg-accent-dark/15 dark:text-accent-dark dark:ring-accent-dark/20';

  return (
    <div className={className}>
      {showSearch && tags.length > 0 && (
        <div className="relative mb-3">
          <MagnifyingGlass
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary-text/35 dark:text-primary-text-dark/35"
            aria-hidden
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            disabled={disabled || loading}
            className="w-full rounded-xl border border-border/60 bg-surface py-2 pl-9 pr-3 text-sm
              text-primary-text placeholder:text-primary-text/40
              focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/10
              disabled:opacity-60
              dark:border-border-dark/60 dark:bg-surface-dark dark:text-primary-text-dark
              dark:focus:border-accent-dark/40 dark:focus:ring-accent-dark/10"
            aria-label={searchPlaceholder}
          />
        </div>
      )}

      <div
        className="max-h-[min(14rem,40vh)] overflow-y-auto overscroll-contain rounded-xl border border-border/50 bg-surface-alt/25 p-2.5 dark:border-border-dark/50 dark:bg-surface-alt-dark/20"
        role="group"
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
      >
        {loading && tags.length === 0 ? (
          <div className="flex flex-wrap gap-2" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <TagChipSkeleton key={i} />
            ))}
          </div>
        ) : tags.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-primary-text/60 dark:text-primary-text-dark/60">
            {emptyMessage}
          </p>
        ) : filteredTags.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-primary-text/60 dark:text-primary-text-dark/60">
            {noResultsMessage}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredTags.map((tag) => {
              const isSelected = selectedSet.has(tag.id);
              const tagDisabled = disabled || loading || isTagDisabled?.(tag);

              return (
                <button
                  key={tag.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  disabled={tagDisabled}
                  onClick={() => toggleTag(tag.id)}
                  className={`
                    inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium
                    transition-[color,background,box-shadow,opacity]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30
                    disabled:cursor-not-allowed disabled:opacity-45
                    ${
                      isSelected
                        ? selectedChipClass
                        : `border-border/70 bg-surface text-primary-text hover:border-accent/35 hover:bg-accent/5
                          dark:border-border-dark/70 dark:bg-surface-dark dark:text-primary-text-dark
                          dark:hover:border-accent-dark/35 dark:hover:bg-accent-dark/5`
                    }
                  `}
                  title={tag.name}
                >
                  <Hash className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  <span className="truncate">{tag.name}</span>
                  {isSelected ? (
                    <Check className="size-3.5 shrink-0 opacity-90" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
