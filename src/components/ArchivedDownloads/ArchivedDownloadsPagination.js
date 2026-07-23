export default function ArchivedDownloadsPagination({ t, resolvedPagination, fetchPage }) {
  if (resolvedPagination.totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        {t('showing') || 'Showing'} {(resolvedPagination.page - 1) * resolvedPagination.limit + 1} -{' '}
        {Math.min(resolvedPagination.page * resolvedPagination.limit, resolvedPagination.total)}{' '}
        {t('of') || 'of'} {resolvedPagination.total}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fetchPage(resolvedPagination.page - 1)}
          disabled={resolvedPagination.page === 1}
          className="rounded-md border border-border bg-surface px-4 py-2 text-primary-text hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark dark:text-primary-text-dark dark:hover:bg-surface-alt-dark"
        >
          {t('previous') || 'Previous'}
        </button>
        <button
          type="button"
          onClick={() => fetchPage(resolvedPagination.page + 1)}
          disabled={resolvedPagination.page >= resolvedPagination.totalPages}
          className="rounded-md border border-border bg-surface px-4 py-2 text-primary-text hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark dark:text-primary-text-dark dark:hover:bg-surface-alt-dark"
        >
          {t('next') || 'Next'}
        </button>
      </div>
    </div>
  );
}
