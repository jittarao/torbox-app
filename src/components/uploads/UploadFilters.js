export default function UploadFilters({
  filters,
  setFilters,
  setPagination,
  compact = false,
  searchInput,
  onSearchChange,
}) {
  // Use searchInput if provided (for debouncing), otherwise fall back to filters.search
  const searchValue = searchInput !== undefined ? searchInput : filters.search || '';
  const handleSearchChange =
    onSearchChange ||
    ((e) => {
      setFilters((prev) => ({ ...prev, search: e.target.value }));
      setPagination((prev) => ({ ...prev, page: 1 }));
    });

  if (compact) {
    // Compact version for header toolbar
    return (
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Search uploads..."
          value={searchValue}
          onChange={(e) => {
            if (onSearchChange) {
              onSearchChange(e.target.value);
            } else {
              handleSearchChange(e);
            }
          }}
          className="px-3 py-2 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg text-primary-text dark:text-primary-text-dark placeholder:text-primary-text/50 dark:placeholder:text-primary-text-dark/50 min-w-[200px]"
        />
        <select
          value={filters.type}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, type: e.target.value }));
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
          className="px-3 py-2 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg text-primary-text dark:text-primary-text-dark"
        >
          <option value="">All Types</option>
          <option value="torrent">Torrent</option>
          <option value="usenet">Usenet</option>
          <option value="webdl">WebDL</option>
        </select>
      </div>
    );
  }

  // Full-width version (legacy, if needed)
  return (
    <div className="flex gap-4 items-center">
      <input
        type="text"
        placeholder="Search uploads..."
        value={searchValue}
        onChange={(e) => {
          if (onSearchChange) {
            onSearchChange(e.target.value);
          } else {
            handleSearchChange(e);
          }
        }}
        className="px-3 py-2 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg text-primary-text dark:text-primary-text-dark placeholder:text-primary-text/50 dark:placeholder:text-primary-text-dark/50 flex-1 max-w-md"
      />
      <select
        value={filters.type}
        onChange={(e) => {
          setFilters((prev) => ({ ...prev, type: e.target.value }));
          setPagination((prev) => ({ ...prev, page: 1 }));
        }}
        className="px-3 py-2 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg text-primary-text dark:text-primary-text-dark"
      >
        <option value="">All Types</option>
        <option value="torrent">Torrent</option>
        <option value="usenet">Usenet</option>
        <option value="webdl">WebDL</option>
      </select>
    </div>
  );
}
