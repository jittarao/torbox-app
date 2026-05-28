import { create } from 'zustand';
import { usePollingPauseStore } from '@/store/pollingPauseStore';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { entityKey } from '@/utils/downloadListMerge';
import { resolveItemAssetType } from '@/store/torboxDownloadsSelectors';

const INITIAL_VIDEO = {
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

const INITIAL_AUDIO = {
  isOpen: false,
  url: null,
  itemId: null,
  fileId: null,
  assetType: 'torrent',
  fileName: null,
  apiKey: null,
};

function findItemById(itemId, activeType) {
  const entities = useTorboxDownloadsStore.getState().entities;
  const assetType = resolveItemAssetType(null, activeType);
  const key = entityKey(activeType === 'all' ? 'torrents' : assetType, itemId);
  if (entities[key]) return entities[key];
  if (activeType === 'all') {
    for (const type of ['torrents', 'usenet', 'webdl']) {
      const row = entities[entityKey(type, itemId)];
      if (row) return row;
    }
  }
  return undefined;
}

/**
 * Video/audio player UI state — isolated so DownloadsPage does not re-render on stream URL ticks.
 */
export const useDownloadsPlayerStore = create((set, get) => ({
  video: INITIAL_VIDEO,
  audio: INITIAL_AUDIO,
  activeType: 'torrents',

  setActiveType: (activeType) => set({ activeType }),

  openVideo: (payload) => {
    usePollingPauseStore.getState().setPauseReason('videoPlayer', true);
    set({
      video: {
        isOpen: true,
        streamUrl: payload.streamUrl,
        fileName: payload.fileName,
        subtitles: payload.subtitles || [],
        audios: payload.audios || [],
        metadata: payload.metadata || {},
        itemId: payload.itemId,
        fileId: payload.fileId,
        streamType: payload.streamType || 'torrent',
        introInformation: payload.introInformation || null,
        initialAudioIndex: payload.initialAudioIndex ?? 0,
        initialSubtitleIndex: payload.initialSubtitleIndex ?? null,
      },
    });
  },

  closeVideo: () => {
    usePollingPauseStore.getState().setPauseReason('videoPlayer', false);
    set({ video: INITIAL_VIDEO });
  },

  setVideoStreamUrl: (streamUrl) =>
    set((state) => ({ video: { ...state.video, streamUrl } })),

  openAudio: (payload) => {
    usePollingPauseStore.getState().setPauseReason('audioPlayer', true);
    set({
      audio: {
        isOpen: true,
        url: payload.url,
        itemId: payload.itemId,
        fileId: payload.fileId,
        assetType: payload.assetType || 'torrent',
        fileName: payload.fileName,
        apiKey: payload.apiKey,
      },
    });
  },

  closeAudio: () => {
    usePollingPauseStore.getState().setPauseReason('audioPlayer', false);
    set({ audio: INITIAL_AUDIO });
  },

  setAudioUrl: (url) => set((state) => ({ audio: { ...state.audio, url } })),

  playAudio: async ({ itemId, file, apiKey, activeType, requestDownloadLink, onError }) => {
    const idField =
      activeType === 'usenet' ? 'usenet_id' : activeType === 'webdl' ? 'web_id' : 'torrent_id';
    const item = findItemById(itemId, activeType);
    const result = await requestDownloadLink(
      itemId,
      { fileId: file.id, filename: file.name || file.short_name },
      idField,
      { assetType: activeType, item }
    );
    if (result.success && result.data?.url) {
      get().openAudio({
        url: result.data.url,
        itemId,
        fileId: file.id,
        assetType: activeType,
        fileName: file.name || file.short_name || 'Audio',
        apiKey,
      });
      return { success: true };
    }
    onError?.(result.error || 'Could not get audio link');
    return { success: false, error: result.error };
  },

  refreshAudioUrl: async (requestDownloadLink) => {
    const { audio, activeType } = get();
    const { itemId, fileId, assetType: at, apiKey: key } = audio;
    if (itemId == null || fileId == null || !key) {
      throw new Error('Cannot refresh link: missing item, file, or API key');
    }
    const idField = at === 'usenet' ? 'usenet_id' : at === 'webdl' ? 'web_id' : 'torrent_id';
    const result = await requestDownloadLink(
      itemId,
      { fileId },
      idField,
      { assetType: at, item: findItemById(itemId, activeType) }
    );
    if (result.success && result.data?.url) {
      get().setAudioUrl(result.data.url);
      return result.data.url;
    }
    throw new Error(result.error || 'Failed to refresh link');
  },
}));
