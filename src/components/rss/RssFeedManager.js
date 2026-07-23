'use client';

import { useState, useEffect, useCallback, useEffectEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRssFeeds } from '@/components/shared/hooks/useRssFeeds';
import { ExclamationTriangle, Plus, Refresh } from '@/components/icons';
import BulkActionButton from '@/components/shared/BulkActionButton';
import { compactToolbarClass } from '@/components/shared/compactToolbar';
import Spinner from '@/components/shared/Spinner';
import RssFeedForm from './RssFeedForm';
import RssFeedList from './RssFeedList';
import { DEFAULT_RSS_FEED_FORM, rssFeedFormFromFeed } from './rssFeedFormUtils';

export default function RssFeedManager({ apiKey, setToast }) {
  const t = useTranslations('RssFeeds');
  const { feeds, loading, error, addFeed, modifyFeed, controlFeed, getFeedItems } =
    useRssFeeds(apiKey);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFeed, setEditingFeed] = useState(null);
  const [itemCounts, setItemCounts] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_RSS_FEED_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [componentError, setComponentError] = useState(null);

  const fetchItemCounts = useCallback(async () => {
    if (!feeds.length) return;

    const results = await Promise.allSettled(
      feeds.map(async (feed) => {
        const result = await getFeedItems(feed.id, 0, 250);
        return { id: feed.id, count: result.success ? result.data?.length || 0 : 0 };
      })
    );

    const counts = {};
    for (const r of results) {
      if (r.status === 'fulfilled') {
        counts[r.value.id] = r.value.count;
      } else {
        console.error('Error fetching items for feed:', r.reason);
      }
    }
    setItemCounts(counts);
  }, [feeds, getFeedItems]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchItemCounts();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (feeds.length > 0) {
      fetchItemCounts();
    }
  }, [feeds, fetchItemCounts]);

  const fetchItemCountsEvent = useEffectEvent(fetchItemCounts);

  useEffect(() => {
    const interval = setInterval(() => {
      if (feeds.length > 0) {
        fetchItemCountsEvent();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [feeds]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.name.trim() || !formData.url.trim()) {
        setToast({ message: t('validation.nameRequired'), type: 'error' });
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
        setFormData(DEFAULT_RSS_FEED_FORM);
      } else {
        setToast({ message: result.error, type: 'error' });
      }
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      setToast({ message: err.message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (feed) => {
    try {
      setEditingFeed(feed);
      setFormData(rssFeedFormFromFeed(feed));
      setShowAddForm(true);
    } catch (err) {
      console.error('Error in handleEdit:', err);
      setComponentError(err.message);
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingFeed(null);
    setFormData(DEFAULT_RSS_FEED_FORM);
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
        setToast({ message: result.error, type: 'error' });
      }
    } catch (err) {
      console.error('Error in handleControl:', err);
      setToast({ message: err.message, type: 'error' });
    }
  };

  const handleDelete = async (feedId) => {
    try {
      const result = await controlFeed(feedId, 'delete');
      if (result.success) {
        setToast({ message: t('deleteSuccess'), type: 'success' });
      } else {
        setToast({ message: result.error, type: 'error' });
      }
    } catch (err) {
      console.error('Error in handleDelete:', err);
      setToast({ message: err.message, type: 'error' });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'never' || dateString === 'Never') return t('never');
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return t('never');
      return date.toLocaleString();
    } catch {
      return t('never');
    }
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-primary-text dark:text-primary-text-dark">
          {t('title')}
        </h2>
        <div className={compactToolbarClass} role="toolbar" aria-label={t('title')}>
          <BulkActionButton
            variant="secondary"
            onClick={handleRefresh}
            loading={refreshing}
            icon={<Refresh />}
            label={refreshing ? t('refreshing') : t('refresh')}
            title={t('refresh')}
          />
          <BulkActionButton
            variant="primary"
            onClick={() => setShowAddForm(true)}
            icon={<Plus />}
            label={t('addFeed')}
            title={t('addFeed')}
          />
        </div>
      </div>

      {showAddForm ? (
        <RssFeedForm
          t={t}
          editingFeed={editingFeed}
          formData={formData}
          onFormDataChange={setFormData}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      ) : null}

      <RssFeedList
        t={t}
        feeds={feeds}
        itemCounts={itemCounts}
        formatDate={formatDate}
        onControl={handleControl}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
