'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRssFeeds } from '@/components/shared/hooks/useRssFeeds';
import { useUpload } from '@/components/shared/hooks/useUpload';
import { ExclamationTriangle, Refresh } from '@/components/icons';
import BulkActionButton from '@/components/shared/BulkActionButton';
import { compactToolbarClass } from '@/components/shared/compactToolbar';
import RssItemsFilters from './RssItemsFilters';
import RssItemsList from './RssItemsList';

export default function RssItemsManager({ apiKey, setToast }) {
  const t = useTranslations('RssItems');
  const { feeds, getFeedItems } = useRssFeeds(apiKey);
  const { uploadItem } = useUpload(apiKey);

  const [selectedFeed, setSelectedFeed] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [downloadingItems, setDownloadingItems] = useState(new Set());
  const [componentError, setComponentError] = useState(null);

  const fetchItems = useCallback(
    async (feedId) => {
      if (!feedId) return;

      setLoading(true);
      setError(null);

      try {
        const result = await getFeedItems(feedId, 0, 1000);
        if (result.success) {
          setItems(result.data || []);
        } else {
          setError(result.error);
        }
      } catch (err) {
        console.error('Error fetching RSS items:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [getFeedItems]
  );

  const handleFeedSelect = (feedId) => {
    try {
      setSelectedFeed(feedId);
      fetchItems(feedId);
    } catch (err) {
      console.error('Error in handleFeedSelect:', err);
      setComponentError(err.message);
    }
  };

  const handleDownload = async (item) => {
    if (!item.link) {
      setToast({ message: t('toast.noLink'), type: 'error' });
      return;
    }

    setDownloadingItems((prev) => new Set([...prev, item.id]));

    try {
      const feed = feeds.find((f) => f.id === selectedFeed);
      const downloadType = feed?.type || 'torrent';

      const uploadData = {
        type: downloadType,
        data: item.link,
        seed: feed?.torrent_seeding || 1,
        allowZip: true,
        asQueued: false,
      };

      if (downloadType !== 'usenet' || !item.link.includes('api')) {
        uploadData.name = item.name || item.title;
      }

      if (downloadType === 'webdl' && item.password) {
        uploadData.password = item.password;
      }

      const result = await uploadItem(uploadData);

      if (result.success) {
        setToast({ message: t('toast.downloadStarted'), type: 'success' });
      } else {
        setToast({ message: result.error || t('toast.downloadFailed'), type: 'error' });
      }
    } catch (err) {
      console.error('Error in handleDownload:', err);
      setToast({ message: err.message || t('toast.downloadFailed'), type: 'error' });
    } finally {
      setDownloadingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };

  const filteredAndSortedItems = (items || [])
    .filter((item) => {
      if (!item || typeof item !== 'object') return false;

      if (
        searchTerm &&
        !(item.name || item.title)?.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      if (filterType !== 'all') {
        const itemType = item.link?.includes('magnet:')
          ? 'torrent'
          : item.link?.includes('.nzb')
            ? 'usenet'
            : 'webdl';
        if (itemType !== filterType) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      if (!a || !b) return 0;

      let aValue;
      let bValue;

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.pubDate || a.date || 0);
          bValue = new Date(b.pubDate || b.date || 0);
          break;
        case 'title':
          aValue = a.title || '';
          bValue = b.title || '';
          break;
        case 'size':
          aValue = a.size || 0;
          bValue = b.size || 0;
          break;
        default:
          aValue = a.title || '';
          bValue = b.title || '';
      }

      if (sortOrder === 'desc') {
        return aValue > bValue ? -1 : 1;
      }
      return aValue < bValue ? -1 : 1;
    });

  const formatDate = (dateString) => {
    if (!dateString) return t('unknown');
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return t('unknown');
    }
  };

  const getItemType = (link) => {
    if (link?.includes('magnet:')) return 'torrent';
    if (link?.includes('.nzb')) return 'usenet';
    return 'webdl';
  };

  if (componentError) {
    return (
      <div className="text-center p-8 text-red-500">
        <ExclamationTriangle className="size-8 mx-auto mb-2" />
        <p>{t('error')}</p>
        <p className="text-sm text-gray-500">{componentError}</p>
        <button
          type="button"
          onClick={() => setComponentError(null)}
          className="mt-4 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-primary-text dark:text-primary-text-dark">
          {t('title')}
        </h2>
        <div className={compactToolbarClass} role="toolbar" aria-label={t('title')}>
          <BulkActionButton
            variant="primary"
            onClick={() => fetchItems(selectedFeed)}
            disabled={!selectedFeed}
            loading={loading}
            icon={<Refresh />}
            label={t('refresh')}
            title={t('refresh')}
          />
        </div>
      </div>

      <RssItemsFilters
        t={t}
        feeds={feeds}
        selectedFeed={selectedFeed}
        onFeedSelect={handleFeedSelect}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
      />

      {selectedFeed ? (
        <RssItemsList
          t={t}
          loading={loading}
          error={error}
          items={filteredAndSortedItems}
          searchTerm={searchTerm}
          filterType={filterType}
          downloadingItems={downloadingItems}
          formatDate={formatDate}
          getItemType={getItemType}
          onDownload={handleDownload}
          onOpenLink={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
        />
      ) : null}
    </div>
  );
}
