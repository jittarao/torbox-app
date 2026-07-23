'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import Dropdown from '@/components/shared/Dropdown';

export default function SearchBarAdvancedFilters({
  seasonFilter,
  setSeasonFilter,
  episodeFilter,
  setEpisodeFilter,
  yearFilter,
  setYearFilter,
  qualityFilter,
  setQualityFilter,
  sizeFilter,
  setSizeFilter,
  seedersFilter,
  setSeedersFilter,
  clearFilters,
}) {
  const t = useTranslations('SearchBar');
  const minSizeInputId = useId();
  const minSeedersInputId = useId();

  const QUALITY_OPTIONS = [
    { value: '', label: t('qualityAll') },
    { value: '2160p', label: '4K (2160p)' },
    { value: '1080p', label: 'Full HD (1080p)' },
    { value: '720p', label: 'HD (720p)' },
    { value: '480p', label: 'SD (480p)' },
    { value: 'HDRip', label: 'HDRip' },
    { value: 'BRRip', label: 'BRRip' },
    { value: 'WEBRip', label: 'WEBRip' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-border dark:border-border-dark">
      <div>
        <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
          {t('season') || 'Season'}
        </label>
        <input
          type="number"
          min="0"
          value={seasonFilter}
          onChange={(e) => setSeasonFilter(e.target.value)}
          className="w-full px-3 py-1 rounded border border-border dark:border-border-dark bg-transparent text-sm text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 focus:border-accent dark:focus:border-accent-dark transition-colors"
          placeholder={t('seasonPlaceholder') || 'S01'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
          {t('episode') || 'Episode'}
        </label>
        <input
          type="number"
          min="0"
          value={episodeFilter}
          onChange={(e) => setEpisodeFilter(e.target.value)}
          className="w-full px-3 py-1 rounded border border-border dark:border-border-dark bg-transparent text-sm text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 focus:border-accent dark:focus:border-accent-dark transition-colors"
          placeholder={t('episodePlaceholder') || 'E01'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
          {t('year') || 'Year'}
        </label>
        <input
          type="number"
          min="1900"
          max="2030"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="w-full px-3 py-1 rounded border border-border dark:border-border-dark bg-transparent text-sm text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 focus:border-accent dark:focus:border-accent-dark transition-colors"
          placeholder={t('yearPlaceholder') || '2024'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
          {t('quality') || 'Quality'}
        </label>
        <Dropdown options={QUALITY_OPTIONS} value={qualityFilter} onChange={setQualityFilter} />
      </div>

      <div>
        <label
          htmlFor={minSizeInputId}
          className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1"
        >
          {t('minSize') || 'Min Size (GB)'}
        </label>
        <input
          id={minSizeInputId}
          type="number"
          min="0"
          step="0.1"
          value={sizeFilter}
          onChange={(e) => setSizeFilter(e.target.value)}
          className="w-full px-3 py-1 rounded border border-border dark:border-border-dark bg-transparent text-sm text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 focus:border-accent dark:focus:border-accent-dark transition-colors"
          placeholder="0"
        />
      </div>

      <div>
        <label
          htmlFor={minSeedersInputId}
          className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1"
        >
          {t('minSeeders') || 'Min Seeders'}
        </label>
        <input
          id={minSeedersInputId}
          type="number"
          min="0"
          value={seedersFilter}
          onChange={(e) => setSeedersFilter(e.target.value)}
          className="w-full px-3 py-1 rounded border border-border dark:border-border-dark bg-transparent text-sm text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 focus:border-accent dark:focus:border-accent-dark transition-colors"
          placeholder="0"
        />
      </div>

      <div className="col-span-full flex justify-end">
        <button
          type="button"
          onClick={clearFilters}
          className="px-3 py-1 text-sm text-red-500 hover:text-red-600 transition-colors"
        >
          {t('clearFilters') || 'Clear Filters'}
        </button>
      </div>
    </div>
  );
}
