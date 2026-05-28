'use client';

import { useState, useCallback } from 'react';
import { usePollingPauseStore } from '@/store/pollingPauseStore';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { entityKey } from '@/utils/downloadListMerge';
import { resolveItemAssetType } from '@/store/torboxDownloadsSelectors';

const INITIAL_VIDEO_STATE = {
  isOpen: false,
  streamUrl: null,
  fileName: null,
  subtitles: [],
  audios: [],
  metadata: {},
  itemId: null,
  fileId: null,
  streamType: 'torrent',
  introInformation: null,
  initialAudioIndex: 0,
  initialSubtitleIndex: null,
};

const INITIAL_AUDIO_STATE = {
  isOpen: false,
  url: null,
  itemId: null,
  fileId: null,
  assetType: 'torrent',
  fileName: null,
  apiKey: null,
};

export function useDownloadsPlayers({
  apiKey,
  activeType,
  requestDownloadLink,
  setToast,
}) {
  const setPauseReason = usePollingPauseStore((state) => state.setPauseReason);
  const [videoPlayerState, setVideoPlayerState] = useState(INITIAL_VIDEO_STATE);
  const [audioPlayerState, setAudioPlayerState] = useState(INITIAL_AUDIO_STATE);

  const findItemById = useCallback(
    (itemId) => {
      const entities = useTorboxDownloadsStore.getState().entities;
      const assetType = resolveItemAssetType(null, activeType);
      const key = entityKey(
        activeType === 'all' ? 'torrents' : assetType,
        itemId
      );
      if (entities[key]) return entities[key];
      if (activeType === 'all') {
        for (const type of ['torrents', 'usenet', 'webdl']) {
          const row = entities[entityKey(type, itemId)];
          if (row) return row;
        }
      }
      return undefined;
    },
    [activeType]
  );

  const handleAudioPlay = useCallback(
    async (itemId, file) => {
      const idField =
        activeType === 'usenet' ? 'usenet_id' : activeType === 'webdl' ? 'web_id' : 'torrent_id';
      const item = findItemById(itemId);
      const metadata = {
        assetType: activeType,
        item,
      };
      const result = await requestDownloadLink(
        itemId,
        { fileId: file.id, filename: file.name || file.short_name },
        idField,
        metadata
      );
      if (result.success && result.data?.url) {
        setAudioPlayerState({
          isOpen: true,
          url: result.data.url,
          itemId,
          fileId: file.id,
          assetType: activeType,
          fileName: file.name || file.short_name || 'Audio',
          apiKey,
        });
        setPauseReason('audioPlayer', true);
      } else {
        setToast({
          message: result.error || 'Could not get audio link',
          type: 'error',
        });
      }
    },
    [activeType, findItemById, requestDownloadLink, setToast, apiKey, setPauseReason]
  );

  const handleAudioRefreshUrl = useCallback(async () => {
    const { itemId, fileId, assetType: at, apiKey: key } = audioPlayerState;
    if (itemId == null || fileId == null || !key) {
      throw new Error('Cannot refresh link: missing item, file, or API key');
    }
    const idField = at === 'usenet' ? 'usenet_id' : at === 'webdl' ? 'web_id' : 'torrent_id';
    const metadata = {
      assetType: at,
      item: findItemById(itemId),
    };
    const result = await requestDownloadLink(itemId, { fileId }, idField, metadata);
    if (result.success && result.data?.url) {
      setAudioPlayerState((prev) => ({ ...prev, url: result.data.url }));
      return result.data.url;
    }
    throw new Error(result.error || 'Failed to refresh link');
  }, [audioPlayerState, findItemById, requestDownloadLink]);

  const openVideoPlayer = useCallback(
    (
      streamUrl,
      fileName,
      subtitles,
      audios,
      metadata,
      itemId,
      fileId,
      streamType,
      introInformation,
      initialAudioIndex,
      initialSubtitleIndex
    ) => {
      setVideoPlayerState({
        isOpen: true,
        streamUrl,
        fileName,
        subtitles,
        audios,
        metadata: metadata || {},
        itemId,
        fileId,
        streamType,
        introInformation: introInformation || null,
        initialAudioIndex: initialAudioIndex !== undefined ? initialAudioIndex : 0,
        initialSubtitleIndex:
          initialSubtitleIndex !== undefined ? initialSubtitleIndex : null,
      });
      setPauseReason('videoPlayer', true);
    },
    [setPauseReason]
  );

  return {
    videoPlayerState,
    setVideoPlayerState,
    audioPlayerState,
    setAudioPlayerState,
    handleAudioPlay,
    handleAudioRefreshUrl,
    openVideoPlayer,
  };
}
