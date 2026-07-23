export default function ItemUploaderCompletionBar({ items, t, onDismiss }) {
  const hasNoActiveItems =
    items.length > 0 &&
    !items.some((item) => item.status === 'queued' || item.status === 'processing');

  if (!hasNoActiveItems) return null;

  const successCount = items.filter((item) => item.status === 'success').length;
  const totalCount = items.length;
  const allCompleted = successCount === totalCount;

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-center justify-end mt-4">
      <h3 className="text-xs lg:text-sm text-primary-text dark:text-primary-text-dark/70">
        {allCompleted
          ? t('status.allCompleted', { count: successCount })
          : t('status.completed', {
              count: successCount,
              total: totalCount,
            })}
      </h3>

      <button
        type="button"
        onClick={onDismiss}
        className="text-sm text-primary-text/70 hover:text-primary-text dark:text-primary-text-dark dark:hover:text-primary-text-dark/70"
        aria-label={t('status.clearItems')}
      >
        {t('status.clearItems')}
      </button>
    </div>
  );
}
