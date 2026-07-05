import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDownloadsActions } from '@/components/downloads/DownloadsActionsContext';
import { useStream } from '@/components/shared/hooks/useStream';
import { useFileInteractionStore } from '@/store/fileInteractionStore';
import { getIdFieldForItem, resolveItemAssetType } from '@/store/torboxDownloadsSelectors';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { entityKey } from '@/utils/downloadListMerge';
import { EXTERNAL_APP_NOT_INSTALLED, launchExternalUrl } from '@/utils/launchExternalUrl';
import { buildExternalPlayerUrl, extractHlsUrl, parseStreamMetadata } from '@/utils/streamUrl';

function findItemById(itemId, activeType) {
  const entities = useTorboxDownloadsStore.getState().entities;
  if (activeType === 'all') {
    for (const type of ['torrents', 'usenet', 'webdl']) {
      const row = entities[entityKey(type, itemId)];
      if (row) return row;
    }
    return undefined;
  }
  const assetType = resolveItemAssetType(null, activeType);
  return entities[entityKey(assetType, itemId)];
}

export function useStreamInitializer({ apiKey, activeType, onOpenVideoPlayer }) {
  const t = useTranslations('OpenIn');
  const [openInModal, setOpenInModal] = useState({
    isOpen: false,
    itemId: null,
    file: null,
    fileName: null,
    itemName: null,
  });
  const [isCreatingStream, setIsCreatingStream] = useState(false);
  const [loadingChoice, setLoadingChoice] = useState(null);
  const [openInError, setOpenInError] = useState(null);

  const [trackSelectionModal, setTrackSelectionModal] = useState({
    isOpen: false,
    metadata: null,
    introInformation: null,
    fileName: null,
    itemId: null,
    fileId: null,
    file: null,
  });

  const { createStream } = useStream(apiKey);
  const { requestDownloadLink } = useDownloadsActions();

  const getStreamType = useCallback(() => {
    switch (activeType) {
      case 'usenet':
        return 'usenet';
      case 'webdl':
        return 'webdownload';
      default:
        return 'torrent';
    }
  }, [activeType]);

  const getFileStreamKey = useCallback(
    (itemId, fileId) => `${String(itemId)}-${String(fileId)}`,
    []
  );

  const resolveStreamUrl = useCallback(
    async (itemId, fileId, streamType, subtitleIndex, audioIndex) => {
      const streamMetadata = await createStream(
        itemId,
        fileId,
        streamType,
        subtitleIndex,
        audioIndex
      );

      let streamUrl = extractHlsUrl(streamMetadata);

      if (!streamUrl) {
        const retryData = await createStream(itemId, fileId, streamType, subtitleIndex, audioIndex);
        streamUrl = extractHlsUrl(retryData);
      }

      return { streamUrl, streamMetadata };
    },
    [createStream]
  );

  const handleFileStreamInit = useCallback((itemId, file, itemName = null) => {
    setOpenInError(null);
    setOpenInModal({
      isOpen: true,
      itemId,
      file,
      fileName: file.name || file.short_name || 'Video',
      itemName,
    });
  }, []);

  const closeOpenInModal = useCallback(() => {
    if (isCreatingStream) return;
    setOpenInModal((prev) => ({ ...prev, isOpen: false }));
    setOpenInError(null);
  }, [isCreatingStream]);

  const handleOpenInChoice = useCallback(
    async (choice) => {
      const { itemId, file } = openInModal;
      if (!itemId || !file) return;

      const streamType = getStreamType();
      const fileKey = getFileStreamKey(itemId, file.id);

      setLoadingChoice(choice);
      setIsCreatingStream(true);
      setOpenInError(null);
      useFileInteractionStore.getState().setStreaming(fileKey, true);

      try {
        if (choice === 'web') {
          const streamData = await createStream(itemId, file.id, streamType);
          const { metadata: fullMetadata, introInformation } = parseStreamMetadata(streamData);

          setOpenInModal((prev) => ({ ...prev, isOpen: false }));
          setTrackSelectionModal({
            isOpen: true,
            metadata: fullMetadata,
            introInformation,
            fileName: file.name || file.short_name || 'Video',
            itemId,
            fileId: file.id,
            file,
          });
          return;
        }

        const displayName = file.name || file.short_name || 'Video';
        let streamUrl = null;

        // Infuse plays direct CDN file URLs reliably; TorBox HLS transcoder links often fail.
        if (choice === 'infuse') {
          const item = findItemById(itemId, activeType);
          const resolvedAssetType = resolveItemAssetType(item, activeType);
          const idField = getIdFieldForItem(item, activeType);
          const dlResult = await requestDownloadLink(itemId, { fileId: file.id }, idField, {
            assetType: resolvedAssetType,
            item,
          });
          if (dlResult.success && dlResult.data?.url) {
            streamUrl = dlResult.data.url;
          }
        }

        if (!streamUrl) {
          const resolved = await resolveStreamUrl(itemId, file.id, streamType, null, 0);
          streamUrl = resolved.streamUrl;
        }

        if (!streamUrl) {
          throw new Error('Failed to get stream URL');
        }

        const externalUrl = buildExternalPlayerUrl(
          choice,
          streamUrl,
          choice === 'infuse' ? { filename: displayName } : undefined
        );
        await launchExternalUrl(externalUrl);
        setOpenInModal((prev) => ({ ...prev, isOpen: false }));
      } catch (error) {
        console.error('Error preparing stream:', error);
        if (
          error?.code === EXTERNAL_APP_NOT_INSTALLED ||
          error?.message === EXTERNAL_APP_NOT_INSTALLED
        ) {
          setOpenInError(t('errors.playerNotInstalled', { player: t(`players.${choice}`) }));
        } else {
          setOpenInError(error.message || t('errors.streamFailed'));
        }
      } finally {
        setLoadingChoice(null);
        setIsCreatingStream(false);
        useFileInteractionStore.getState().setStreaming(fileKey, false);
      }
    },
    [
      openInModal,
      activeType,
      getStreamType,
      getFileStreamKey,
      createStream,
      resolveStreamUrl,
      requestDownloadLink,
      t,
    ]
  );

  const closeTrackSelectionModal = useCallback(() => {
    setTrackSelectionModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleTrackSelection = useCallback(
    async (selectedStreamData) => {
      const {
        itemId,
        fileId,
        file,
        metadata: fullMetadata,
        introInformation,
      } = trackSelectionModal;
      const streamType = getStreamType();
      const fileKey = getFileStreamKey(itemId, fileId);

      setTrackSelectionModal((prev) => ({ ...prev, isOpen: false }));
      useFileInteractionStore.getState().setStreaming(fileKey, true);

      try {
        const { streamUrl, streamMetadata } = await resolveStreamUrl(
          itemId,
          fileId,
          streamType,
          selectedStreamData.subtitle_track_idx ?? 0,
          selectedStreamData.audio_track_idx ?? 0
        );

        if (!streamUrl) {
          throw new Error('Failed to get stream URL');
        }

        const data = streamMetadata.data || streamMetadata;
        const updatedMetadata = data.metadata || streamMetadata.metadata || fullMetadata;
        const subtitles = updatedMetadata.subtitles || [];
        const audios = updatedMetadata.audios || [];

        const finalMetadata = {
          ...updatedMetadata,
          search_metadata:
            data.search_metadata ||
            streamMetadata.search_metadata ||
            fullMetadata?.search_metadata ||
            null,
        };

        if (onOpenVideoPlayer) {
          onOpenVideoPlayer(
            streamUrl,
            file.name || file.short_name || 'Video',
            subtitles,
            audios,
            finalMetadata,
            itemId,
            fileId,
            streamType,
            introInformation,
            selectedStreamData.audio_track_idx ?? 0,
            selectedStreamData.subtitle_track_idx ?? 0
          );
        }
      } catch (error) {
        console.error('Error creating stream with selected tracks:', error);
      } finally {
        useFileInteractionStore.getState().setStreaming(fileKey, false);
      }
    },
    [trackSelectionModal, getStreamType, getFileStreamKey, resolveStreamUrl, onOpenVideoPlayer]
  );

  return {
    openInModal,
    closeOpenInModal,
    handleOpenInChoice,
    isCreatingStream,
    loadingChoice,
    openInError,
    trackSelectionModal,
    closeTrackSelectionModal,
    handleFileStreamInit,
    handleTrackSelection,
  };
}
