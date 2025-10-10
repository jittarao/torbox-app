'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRssFeeds } from '@/components/shared/hooks/useRssFeeds';
import Icons from '@/components/icons';
import Spinner from '@/components/shared/Spinner';
import ConfirmButton from '@/components/shared/ConfirmButton';
import Toast from '@/components/shared/Toast';

export default function RssFeedManager({ apiKey, setToast }) {
  const t = useTranslations('RssFeeds');
  const { feeds, loading, error, addFeed, modifyFeed, controlFeed, getFeedItems } = useRssFeeds(apiKey);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFeed, setEditingFeed] = useState(null);
  const [itemCounts, setItemCounts] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  // Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchItemCounts();
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch item counts for all feeds
  const fetchItemCounts = async () => {
    if (!feeds.length) return;
    
    const counts = {};
    for (const feed of feeds) {
      try {
        // Fetch a reasonable number to get the count
        const result = await getFeedItems(feed.id, 0, 250);
        counts[feed.id] = result.success ? (result.data?.length || 0) : 0;
      } catch (error) {
        console.error(`Error fetching items for feed ${feed.id}:`, error);
        counts[feed.id] = 0;
      }
    }
    setItemCounts(counts);
  };

  // Fetch item counts when feeds change
  useEffect(() => {
    if (feeds.length > 0) {
      fetchItemCounts();
    }
  }, [feeds]);

  // Auto-refresh feeds every 30 seconds to get items quickly
  useEffect(() => {
    const interval = setInterval(() => {
      if (feeds.length > 0) {
        fetchItemCounts();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [feeds]);

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    rss_type: 'torrent',
    torrent_seeding: 1,
    do_regex: '',
    dont_regex: '',
    scan_interval: 60,
    dont_older_than: 0,
    pass_check: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [componentError, setComponentError] = useState(null);

  // Reset component error when apiKey changes
  useEffect(() => {
    setComponentError(null);
  }, [apiKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.name.trim() || !formData.url.trim()) {
        setToast({
          message: t('validation.nameRequired'),
          type: 'error',
        });
        return;
      }

      setIsSubmitting(true);
      const result = editingFeed 
        ? await modifyFeed({ rss_feed_id: editingFeed.id, ...formData })
        : await addFeed(formData);

      if (result.success) {
        setToast({
          message: editingFeed ? t('editSuccess') : t('addSuccess'),
          type: 'success',
        });
        setShowAddForm(false);
        setEditingFeed(null);
        setFormData({ 
          name: '', 
          url: '', 
          rss_type: 'torrent',
          torrent_seeding: 1,
          do_regex: '',
          dont_regex: '',
          scan_interval: 60,
          dont_older_than: 0,
          pass_check: false
        });
      } else {
        setToast({
          message: result.error,
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setToast({
        message: error.message,
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (feed) => {
    try {
      setEditingFeed(feed);
      setFormData({
        name: feed.name || '',
        url: feed.url || '',
        rss_type: feed.rss_type || 'torrent',
        torrent_seeding: feed.torrent_seeding || 1,
        do_regex: feed.do_regex || '',
        dont_regex: feed.dont_regex || '',
        scan_interval: feed.scan_interval || 60,
        dont_older_than: feed.dont_older_than || 0,
        pass_check: feed.pass_check || false
      });
      setShowAddForm(true);
    } catch (error) {
      console.error('Error in handleEdit:', error);
      setComponentError(error.message);
    }
  };

  const handleCancel = () => {
    try {
      setShowAddForm(false);
      setEditingFeed(null);
      setFormData({
        name: '',
        url: '',
        rss_type: 'torrent',
        torrent_seeding: 1,
        do_regex: '',
        dont_regex: '',
        scan_interval: 60,
        dont_older_than: 0,
        pass_check: false
      });
    } catch (error) {
      console.error('Error in handleCancel:', error);
      setComponentError(error.message);
    }
  };

  const handleControl = async (feedId, operation) => {
    try {
      const result = await controlFeed(feedId, operation);
      if (result.success) {
        setToast({
          message: operation === 'resume' ? t('enableSuccess') : t('disableSuccess'),
          type: 'success',
        });
      } else {
        setToast({
          message: result.error,
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error in handleControl:', error);
      setToast({
        message: error.message,
        type: 'error',
      });
    }
  };

  const handleDelete = async (feedId) => {
    try {
      const result = await controlFeed(feedId, 'delete');
      if (result.success) {
        setToast({
          message: t('deleteSuccess'),
          type: 'success',
        });
      } else {
        setToast({
          message: result.error,
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error in handleDelete:', error);
      setToast({
        message: error.message,
        type: 'error',
      });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'never' || dateString === 'Never') return t('never');
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return t('never');
      return date.toLocaleString();
    } catch (error) {
      return t('never');
    }
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
        <Icons.ExclamationTriangle className="w-8 h-8 mx-auto mb-2" />
        <p>{t('error')}</p>
        <p className="text-sm text-gray-500">{error}</p>
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
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {refreshing ? <Icons.Loading className="w-4 h-4 animate-spin" /> : <Icons.Refresh className="w-4 h-4" />}
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-2"
          >
            <Icons.Plus className="w-4 h-4" />
            {t('addFeed')}
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-surface-alt dark:bg-surface-alt-dark p-6 rounded-lg border border-border dark:border-border-dark">
          <h3 className="text-lg font-medium mb-4 text-primary-text dark:text-primary-text-dark">
            {editingFeed ? t('editFeed') : t('addFeed')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('feedName')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('feedNamePlaceholder')}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('feedUrl')}
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder={t('feedUrlPlaceholder')}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>
            </div>

            {/* Download Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('downloadType')}
                </label>
                <select
                  value={formData.rss_type}
                  onChange={(e) => setFormData({ ...formData, rss_type: e.target.value })}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="torrent">{t('options.torrent')}</option>
                  <option value="usenet">{t('options.usenet')}</option>
                  <option value="webdl">{t('options.webdl')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('torrentSeeding')}
                </label>
                <select
                  value={formData.torrent_seeding}
                  onChange={(e) => setFormData({ ...formData, torrent_seeding: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value={1}>{t('options.auto')}</option>
                  <option value={2}>{t('options.seed')}</option>
                  <option value={3}>{t('options.dontSeed')}</option>
                </select>
              </div>
            </div>

            {/* Regex Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('doRegex')}
                </label>
                <input
                  type="text"
                  value={formData.do_regex}
                  onChange={(e) => setFormData({ ...formData, do_regex: e.target.value })}
                  placeholder={t('doRegexPlaceholder')}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('dontRegex')}
                </label>
                <input
                  type="text"
                  value={formData.dont_regex}
                  onChange={(e) => setFormData({ ...formData, dont_regex: e.target.value })}
                  placeholder={t('dontRegexPlaceholder')}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* Timing Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('scanInterval')}
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.scan_interval}
                  onChange={(e) => setFormData({ ...formData, scan_interval: parseInt(e.target.value) || 60 })}
                  placeholder={t('scanIntervalPlaceholder')}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                  {t('dontOlderThan')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.dont_older_than}
                  onChange={(e) => setFormData({ ...formData, dont_older_than: parseInt(e.target.value) || 0 })}
                  placeholder={t('dontOlderThanPlaceholder')}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* Advanced Settings */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                <input
                  type="checkbox"
                  checked={formData.pass_check}
                  onChange={(e) => setFormData({ ...formData, pass_check: e.target.checked })}
                  className="rounded border-border dark:border-border-dark text-accent focus:ring-accent"
                />
                {t('passCheck')}
              </label>
              <p className="text-xs text-primary-text/70 dark:text-primary-text-dark/70">
                {t('passCheckDescription')}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? <Spinner size="sm" /> : <Icons.Check className="w-4 h-4" />}
                {t('save')}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-border dark:border-border-dark rounded-lg text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Feeds List */}
      <div className="space-y-4">
        {feeds.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <Icons.Rss className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t('noFeeds')}</p>
          </div>
        ) : (
          feeds.map((feed) => (
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
                    <span>{t('lastCheck')}: {formatDate(feed.last_check)}</span>
                    <span>{t('status')}: {feed.status === 'active' ? t('active') : t('inactive')}</span>
                    <span>{t('items')}: {itemCounts[feed.id] || 0}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleControl(feed.id, feed.status === 'active' ? 'pause' : 'resume')}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {feed.status === 'active' ? t('disable') : t('enable')}
                  </button>
                  <button
                    onClick={() => handleEdit(feed)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Icons.Edit className="w-3 h-3" />
                  </button>
                  <ConfirmButton
                    onClick={() => handleDelete(feed.id)}
                    confirmIcon={<Icons.Check className="w-3 h-3" />}
                    defaultIcon={<Icons.Delete className="w-3 h-3" />}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title={t('confirmDelete.title')}
                    message={t('confirmDelete.message')}
                    confirmText={t('confirmDelete.confirm')}
                    cancelText={t('confirmDelete.cancel')}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
