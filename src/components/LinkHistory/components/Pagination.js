import { memo } from 'react';
import { getPageNumbers } from '../utils/formatters';

const Pagination = memo(({ pagination, onPageChange }) => {
  const pageNumbers = getPageNumbers(pagination.page, pagination.totalPages);

  const handlePrevious = () => {
    onPageChange(Math.max(1, pagination.page - 1));
  };

  const handleNext = () => {
    onPageChange(Math.min(pagination.totalPages, pagination.page + 1));
  };

  const startEntry = Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total);
  const endEntry = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        Showing {startEntry} to {endEntry} of {pagination.total} entries
      </div>
      <div className="flex gap-2 items-center">
        <button
          onClick={handlePrevious}
          disabled={pagination.page === 1}
          className="px-3 py-2 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg disabled:opacity-50 hover:bg-surface dark:hover:bg-surface-dark transition-colors"
        >
          Previous
        </button>
        <div className="flex gap-1">
          {pageNumbers.map((page, index) => {
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
                onClick={() => onPageChange(page)}
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
          onClick={handleNext}
          disabled={pagination.page === pagination.totalPages}
          className="px-3 py-2 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg disabled:opacity-50 hover:bg-surface dark:hover:bg-surface-dark transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
});

Pagination.displayName = 'Pagination';

export default Pagination;
