'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRssFeeds } from '@/components/shared/hooks/useRssFeeds';
import { useUpload } from '@/components/shared/hooks/useUpload';
import Icons from '@/components/icons';
import Spinner from '@/components/shared/Spinner';
import Toast from '@/components/shared/Toast';
import { formatSize } from '@/components/downloads/utils/formatters';

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

  // Reset component error when apiKey changes
  useEffect(() => {
    setComponentError(null);
  }, [apiKey]);

  // Fetch items for selected feed
  const fetchItems = useCallback(async (feedId) => {
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
  }, [getFeedItems]);

  // Handle feed selection
  const handleFeedSelect = (feedId) => {
    try {
      setSelectedFeed(feedId);
      fetchItems(feedId);
    } catch (error) {
      console.error('Error in handleFeedSelect:', error);
      setComponentError(error.message);
    }
  };

  // Download an RSS item
  const handleDownload = async (item) => {
    if (!item.link) {
      setToast({
        message: t('toast.noLink'),
        type: 'error',
      });
      return;
    }

    setDownloadingItems(prev => new Set([...prev, item.id]));

    try {
      const feed = feeds.find(f => f.id === selectedFeed);
      const downloadType = feed?.type || 'torrent';
      
      let uploadData = {
        type: downloadType,
        data: item.link,
        seed: feed?.torrent_seeding || 1,
        allowZip: true,
        asQueued: false,
      };

      // Add name for non-NZB downloads or NZB downloads that aren't API links
      if (downloadType !== 'usenet' || !item.link.includes('api')) {
        uploadData.name = item.title;
      }

      // Add password for webdl if available
      if (downloadType === 'webdl' && item.password) {
        uploadData.password = item.password;
      }

      const result = await uploadItem(uploadData);

      if (result.success) {
        setToast({
          message: t('toast.downloadStarted'),
          type: 'success',
        });
      } else {
        setToast({
          message: result.error || t('toast.downloadFailed'),
          type: 'error',
        });
      }
    } catch (err) {
      console.error('Error in handleDownload:', err);
      setToast({
        message: err.message || t('toast.downloadFailed'),
        type: 'error',
      });
    } finally {
      setDownloadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };

  // Filter and sort items
  const filteredAndSortedItems = (items || [])
    .filter(item => {
      if (!item || typeof item !== 'object') return false;
      
      // Search filter
      if (searchTerm && !item.title?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Type filter
      if (filterType !== 'all') {
        const itemType = item.link?.includes('magnet:') ? 'torrent' : 
                        item.link?.includes('.nzb') ? 'usenet' : 'webdl';
        if (itemType !== filterType) {
          return false;
        }
      }
      
      return true;
    })
    .sort((a, b) => {
      if (!a || !b) return 0;
      
      let aValue, bValue;
      
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
      } else {
        return aValue < bValue ? -1 : 1;
      }
    });

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return t('unknown');
    try {
      return new Date(dateString).toLocaleString();
    } catch (error) {
      return t('unknown');
    }
  };

  // Get item type
  const getItemType = (link) => {
    if (link?.includes('magnet:')) return 'torrent';
    if (link?.includes('.nzb')) return 'usenet';
    return 'webdl';
  };

  // Handle component errors
  if (componentError) {
    return (
      <div className="text-center p-8 text-red-500">
        <Icons.ExclamationTriangle className="w-8 h-8 mx-auto mb-2" />
        <p>{t('error')}</p>
        <p className="text-sm text-gray-500">{componentError}</p>
        <button
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-primary-text dark:text-primary-text-dark">
          {t('title')}
        </h2>
        <button
          onClick={() => fetchItems(selectedFeed)}
          disabled={!selectedFeed || loading}
          className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Icons.Refresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {/* Feed Selection */}
      <div className="bg-surface-alt dark:bg-surface-alt-dark p-4 rounded-lg border border-border dark:border-border-dark">
        <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
          {t('selectFeed')}
        </label>
        <select
          value={selectedFeed || ''}
          onChange={(e) => handleFeedSelect(e.target.value)}
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

      {/* Filters and Search */}
      {selectedFeed && (
        <div className="bg-surface-alt dark:bg-surface-alt-dark p-4 rounded-lg border border-border dark:border-border-dark">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                {t('search')}
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                {t('type')}
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="all">{t('allTypes')}</option>
                <option value="torrent">{t('torrent')}</option>
                <option value="usenet">{t('usenet')}</option>
                <option value="webdl">{t('webdl')}</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                {t('sortBy')}
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="date">{t('date')}</option>
                <option value="title">{t('title')}</option>
                <option value="size">{t('size')}</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                {t('sortOrder')}
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="desc">{t('newestFirst')}</option>
                <option value="asc">{t('oldestFirst')}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Items List */}
      {selectedFeed && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <Spinner size="lg" />
              <span className="ml-2">{t('loading')}</span>
            </div>
          ) : error ? (
            <div className="text-center p-8 text-red-500">
              <Icons.ExclamationTriangle className="w-8 h-8 mx-auto mb-2" />
              <p>{t('error')}</p>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          ) : filteredAndSortedItems.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <Icons.Rss className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{searchTerm || filterType !== 'all' ? t('noMatchingItems') : t('noItems')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAndSortedItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-surface dark:bg-surface-dark p-4 rounded-lg border border-border dark:border-border-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-primary-text dark:text-primary-text-dark truncate">
                          {item.title}
                        </h3>
                        <span
                          className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                        >
                          {getItemType(item.link)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 mb-2 line-clamp-2">
                        {item.description || item.summary || t('noDescription')}
                      </p>
                      
                      <div className="flex gap-4 text-xs text-primary-text/50 dark:text-primary-text-dark/50">
                        <span>{t('published')}: {formatDate(item.pubDate || item.date)}</span>
                        {item.size && (
                          <span>{t('size')}: {formatSize(item.size)}</span>
                        )}
                        {item.category && (
                          <span>{t('category')}: {item.category}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleDownload(item)}
                        disabled={downloadingItems.has(item.id)}
                        className="px-3 py-1 text-xs bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {downloadingItems.has(item.id) ? (
                          <Spinner size="sm" />
                        ) : (
                          <Icons.Download className="w-3 h-3" />
                        )}
                        {t('download')}
                      </button>
                      
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          <Icons.ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
