'use client';

import { useMemo } from 'react';
import { COLUMNS } from '@/components/constants';
import { useDownloadsDataContext } from '@/components/downloads/DownloadsDataContext';
import { useDownloadsFilterContext } from '@/components/downloads/DownloadsFilterContext';
import { useDownloadsUIContext } from '@/components/downloads/DownloadsUIContext';
import Dropdown from '@/components/shared/Dropdown';
import { useTranslations } from 'next-intl';
import SearchBar from './SearchBar';

export default function ActionBarSearch({ itemTypePlural }) {
  const { activeColumns } = useDownloadsDataContext();
  const { search, setSearch, sortField, sortDirection, handleSort } = useDownloadsFilterContext();
  const { displayViewMode: viewMode } = useDownloadsUIContext();
  const t = useTranslations('Columns');

  const sortOptions = useMemo(
    () =>
      activeColumns.map((column) => ({
        label: COLUMNS[column].displayName
          ? COLUMNS[column].displayName
          : t(`${COLUMNS[column].key}`),
        value: column,
      })),
    [activeColumns, t]
  );

  return (
    <>
      <SearchBar
        search={search}
        onSearchChange={setSearch}
        itemTypePlural={itemTypePlural}
        className="min-w-0 w-full basis-full sm:basis-auto sm:w-44 sm:flex-none md:w-52 lg:w-60"
      />

      {viewMode === 'card' && (
        <div className="flex shrink-0 items-center gap-1">
          <Dropdown
            options={sortOptions}
            value={sortField}
            onChange={(value) => handleSort(value)}
            className="min-w-[8.5rem] max-w-[11rem] sm:min-w-[150px]"
            sortDir={sortDirection}
          />
          <button
            type="button"
            onClick={() => handleSort(sortField)}
            className="shrink-0 rounded-md border border-border px-2 py-1.5 text-sm text-primary-text/70 transition-colors hover:bg-surface-alt-hover hover:text-accent dark:border-border-dark dark:text-primary-text-dark/70 dark:hover:bg-surface-alt-hover-dark dark:hover:text-accent-dark"
            aria-label={sortDirection === 'desc' ? 'Sort descending' : 'Sort ascending'}
          >
            {sortDirection === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      )}
    </>
  );
}
