import { Check, Delete, Edit, Rss } from '@/components/icons';
import ConfirmButton from '@/components/shared/ConfirmButton';

export default function RssFeedList({
  t,
  feeds,
  itemCounts,
  formatDate,
  onControl,
  onEdit,
  onDelete,
}) {
  if (feeds.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        <Rss className="size-12 mx-auto mb-4 opacity-50" />
        <p>{t('noFeeds')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feeds.map((feed) => (
        <div
          key={feed.id}
          className="bg-surface dark:bg-surface-dark p-4 rounded-lg border border-border dark:border-border-dark"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-medium text-primary-text dark:text-primary-text-dark">
                  {feed.name}
                </h3>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    feed.status === 'active'
                      ? 'bg-label-success-bg text-label-success-text dark:bg-label-success-bg-dark dark:text-label-success-text-dark'
                      : 'bg-label-default-bg text-label-default-text dark:bg-label-default-bg-dark dark:text-label-default-text-dark'
                  }`}
                >
                  {feed.status === 'active' ? t('enabled') : t('disabled')}
                </span>
              </div>
              <p className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 mb-2 break-all">
                {feed.url}
              </p>
              <div className="flex gap-4 text-xs text-primary-text/50 dark:text-primary-text-dark/50">
                <span>
                  {t('lastCheck')}: {formatDate(feed.last_check)}
                </span>
                <span>
                  {t('status')}: {feed.status === 'active' ? t('active') : t('inactive')}
                </span>
                <span>
                  {t('items')}: {itemCounts[feed.id] || 0}
                </span>
              </div>
            </div>
            <div className="flex gap-2 ml-4">
              <button
                type="button"
                onClick={() => onControl(feed.id, feed.status === 'active' ? 'pause' : 'resume')}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {feed.status === 'active' ? t('disable') : t('enable')}
              </button>
              <button
                type="button"
                onClick={() => onEdit(feed)}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-label={t('editFeed') || 'Edit feed'}
              >
                <Edit className="size-3" />
              </button>
              <ConfirmButton
                onClick={() => onDelete(feed.id)}
                confirmIcon={<Check className="size-3" />}
                defaultIcon={<Delete className="size-3" />}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title={t('confirmDelete.title')}
                message={t('confirmDelete.message')}
                confirmText={t('confirmDelete.confirm')}
                cancelText={t('confirmDelete.cancel')}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
