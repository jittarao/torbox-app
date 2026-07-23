import { Download, ExclamationTriangle, ExternalLink, Rss } from '@/components/icons';
import Spinner from '@/components/shared/Spinner';
import { formatSize } from '@/components/downloads/utils/formatters';

export default function RssItemsList({
  t,
  loading,
  error,
  items,
  searchTerm,
  filterType,
  downloadingItems,
  formatDate,
  getItemType,
  onDownload,
  onOpenLink,
}) {
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner size="lg" />
        <span className="ml-2">{t('loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-500">
        <ExclamationTriangle className="size-8 mx-auto mb-2" />
        <p>{t('error')}</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        <Rss className="size-12 mx-auto mb-4 opacity-50" />
        <p>{searchTerm || filterType !== 'all' ? t('noMatchingItems') : t('noItems')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="bg-surface dark:bg-surface-dark p-4 rounded-lg border border-border dark:border-border-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-medium text-primary-text dark:text-primary-text-dark truncate">
                  {item.name || item.title}
                </h3>
                <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                  {getItemType(item.link)}
                </span>
              </div>

              <p className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 mb-2 line-clamp-2">
                {item.description || item.summary || t('noDescription')}
              </p>

              <div className="flex gap-4 text-xs text-primary-text/50 dark:text-primary-text-dark/50">
                <span>
                  {t('published')}: {formatDate(item.pubDate || item.date)}
                </span>
                {item.size && (
                  <span>
                    {t('size')}: {formatSize(item.size)}
                  </span>
                )}
                {item.category && (
                  <span>
                    {t('category')}: {item.category}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2 ml-4">
              <button
                type="button"
                onClick={() => onDownload(item)}
                disabled={downloadingItems.has(item.id)}
                className="px-3 py-1 text-xs bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {downloadingItems.has(item.id) ? (
                  <Spinner size="sm" />
                ) : (
                  <Download className="size-3" />
                )}
                {t('download')}
              </button>

              {item.link && (
                <button
                  type="button"
                  onClick={() => onOpenLink(item.link)}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  aria-label={t('openLink') || 'Open link'}
                >
                  <ExternalLink className="size-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
