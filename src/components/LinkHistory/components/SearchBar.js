import { memo } from 'react';

const SearchBar = memo(({ search, onSearchChange, selectedCount, onBulkDelete, bulkDeleting, onRefresh }) => {
  return (
    <div className="flex gap-2 items-center">
      <input
        type="text"
        placeholder="Search link history..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="px-3 py-2 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg text-primary-text dark:text-primary-text-dark placeholder:text-primary-text/50 dark:placeholder:text-primary-text-dark/50 min-w-[200px]"
      />
      {selectedCount > 0 && (
        <button
          onClick={onBulkDelete}
          disabled={bulkDeleting}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-opacity"
        >
          {bulkDeleting ? 'Deleting...' : `Delete Selected (${selectedCount})`}
        </button>
      )}
      <button
        onClick={onRefresh}
        className="px-4 py-2 bg-accent dark:bg-accent-dark text-white rounded-lg hover:opacity-90 transition-opacity"
      >
        Refresh
      </button>
    </div>
  );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;
