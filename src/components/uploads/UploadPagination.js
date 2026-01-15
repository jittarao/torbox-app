export default function UploadPagination({ pagination, setPagination }) {
  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const totalPages = pagination.totalPages;
    const currentPage = pagination.page;

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page, last page, current page, and pages around current
      if (currentPage <= 3) {
        // Near the start
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  if (pagination.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} to{' '}
        {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
        uploads
      </div>
      <div className="flex gap-2 items-center">
        <button
          onClick={() =>
            setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
          }
          disabled={pagination.page === 1}
          className="px-3 py-2 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg disabled:opacity-50 hover:bg-surface dark:hover:bg-surface-dark transition-colors"
        >
          Previous
        </button>
        <div className="flex gap-1">
          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 py-2 text-primary-text/50 dark:text-primary-text-dark/50"
                >
                  ...
                </span>
              );
            }
            return (
              <button
                key={page}
                onClick={() => setPagination((prev) => ({ ...prev, page }))}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  pagination.page === page
                    ? 'bg-accent dark:bg-accent-dark text-white'
                    : 'bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark text-primary-text dark:text-primary-text-dark hover:bg-surface dark:hover:bg-surface-dark'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>
        <button
          onClick={() =>
            setPagination((prev) => ({
              ...prev,
              page: Math.min(prev.totalPages, prev.page + 1),
            }))
          }
          disabled={pagination.page === pagination.totalPages}
          className="px-3 py-2 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg disabled:opacity-50 hover:bg-surface dark:hover:bg-surface-dark transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
