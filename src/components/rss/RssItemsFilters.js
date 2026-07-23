import { useId } from 'react';

export default function RssItemsFilters({
  t,
  feeds,
  selectedFeed,
  onFeedSelect,
  searchTerm,
  onSearchTermChange,
  filterType,
  onFilterTypeChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
}) {
  const feedSelectId = useId();
  const filterTypeId = useId();
  const sortById = useId();
  const sortOrderId = useId();

  return (
    <>
      <div className="bg-surface-alt dark:bg-surface-alt-dark p-4 rounded-lg border border-border dark:border-border-dark">
        <label
          htmlFor={feedSelectId}
          className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2"
        >
          {t('selectFeed')}
        </label>
        <select
          id={feedSelectId}
          value={selectedFeed || ''}
          onChange={(e) => onFeedSelect(e.target.value)}
          className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">{t('selectFeedPlaceholder')}</option>
          {feeds.map((feed) => (
            <option key={feed.id} value={feed.id}>
              {feed.name} ({feed.item_count || 0} items)
            </option>
          ))}
        </select>
      </div>

      {selectedFeed ? (
        <div className="bg-surface-alt dark:bg-surface-alt-dark p-4 rounded-lg border border-border dark:border-border-dark">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                {t('search')}
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label
                htmlFor={filterTypeId}
                className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2"
              >
                {t('type')}
              </label>
              <select
                id={filterTypeId}
                value={filterType}
                onChange={(e) => onFilterTypeChange(e.target.value)}
                className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="all">{t('allTypes')}</option>
                <option value="torrent">{t('torrent')}</option>
                <option value="usenet">{t('usenet')}</option>
                <option value="webdl">{t('webdl')}</option>
              </select>
            </div>
            <div>
              <label
                htmlFor={sortById}
                className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2"
              >
                {t('sortBy')}
              </label>
              <select
                id={sortById}
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value)}
                className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="date">{t('date')}</option>
                <option value="title">{t('title')}</option>
                <option value="size">{t('size')}</option>
              </select>
            </div>
            <div>
              <label
                htmlFor={sortOrderId}
                className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2"
              >
                {t('sortOrder')}
              </label>
              <select
                id={sortOrderId}
                value={sortOrder}
                onChange={(e) => onSortOrderChange(e.target.value)}
                className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="desc">{t('newestFirst')}</option>
                <option value="asc">{t('oldestFirst')}</option>
              </select>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
