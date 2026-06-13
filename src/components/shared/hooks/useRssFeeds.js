'use client';

import { useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useRssStore } from '@/store/rssStore';

export function useRssFeeds(apiKey) {
  const {
    feeds,
    loading,
    error,
    fetchFeeds,
    addFeed: addFeedStore,
    modifyFeed: modifyFeedStore,
    controlFeed: controlFeedStore,
    getFeedItems: getFeedItemsStore,
    setApiKey,
  } = useRssStore(
    useShallow((s) => ({
      feeds: s.feeds,
      loading: s.loading,
      error: s.error,
      fetchFeeds: s.fetchFeeds,
      addFeed: s.addFeed,
      modifyFeed: s.modifyFeed,
      controlFeed: s.controlFeed,
      getFeedItems: s.getFeedItems,
      setApiKey: s.setApiKey,
    }))
  );

  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
    }
  }, [apiKey, setApiKey]);

  useEffect(() => {
    if (apiKey) {
      fetchFeeds(apiKey);
    }
  }, [apiKey, fetchFeeds]);

  const addFeed = useCallback((feedData) => addFeedStore(apiKey, feedData), [apiKey, addFeedStore]);

  const modifyFeed = useCallback(
    (feedData) => modifyFeedStore(apiKey, feedData),
    [apiKey, modifyFeedStore]
  );

  const controlFeed = useCallback(
    (feedId, operation) => controlFeedStore(apiKey, feedId, operation),
    [apiKey, controlFeedStore]
  );

  const getFeedItems = useCallback(
    (feedId, offset = 0, limit = 100) => getFeedItemsStore(apiKey, feedId, offset, limit),
    [apiKey, getFeedItemsStore]
  );

  const refetchFeeds = useCallback(() => {
    if (apiKey) {
      return fetchFeeds(apiKey);
    }
  }, [apiKey, fetchFeeds]);

  return {
    feeds,
    loading,
    error,
    fetchFeeds: refetchFeeds,
    addFeed,
    modifyFeed,
    controlFeed,
    getFeedItems,
  };
}
