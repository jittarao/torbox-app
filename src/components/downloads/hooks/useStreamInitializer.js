import { useState, useCallback } from 'react';
import { useStream } from '@/components/shared/hooks/useStream';

export function useStreamInitializer({ apiKey, activeType, onOpenVideoPlayer }) {
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

  const handleFileStreamInit = useCallback(
    async (itemId, file) => {
      try {
        const streamType = getStreamType();
        const streamData = await createStream(itemId, file.id, streamType);
        const data = streamData.data || streamData;
        const metadata = data.metadata || streamData.metadata || {};
        const introInformation = data.intro_information || streamData.intro_information || null;
        const fullMetadata = {
          ...metadata,
          search_metadata: data.search_metadata || streamData.search_metadata || null,
        };
        setTrackSelectionModal({
          isOpen: true,
          metadata: fullMetadata,
          introInformation,
          fileName: file.name || file.short_name || 'Video',
          itemId,
          fileId: file.id,
          file,
        });
      } catch (error) {
        console.error('Error getting stream metadata:', error);
      }
    },
    [getStreamType, createStream]
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

      setTrackSelectionModal((prev) => ({ ...prev, isOpen: false }));

      try {
        const streamMetadata = await createStream(
          itemId,
          fileId,
          streamType,
          selectedStreamData.subtitle_track_idx ?? 0,
          selectedStreamData.audio_track_idx ?? 0
        );

        const data = streamMetadata.data || streamMetadata;
        const presignedToken = data.presigned_token || streamMetadata.presigned_token;
        const userToken =
          data.user_token || data.token || streamMetadata.user_token || streamMetadata.token;

        let streamUrl = data.hls_url || streamMetadata.hls_url;

        if (!streamUrl && presignedToken && userToken) {
          const streamData = await createStream(
            itemId,
            fileId,
            streamType,
            selectedStreamData.subtitle_track_idx ?? 0,
            selectedStreamData.audio_track_idx ?? 0
          );
          streamUrl = streamData.data?.hls_url;
        }

        if (!streamUrl) {
          throw new Error('Failed to get stream URL');
        }

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
      }
    },
    [trackSelectionModal, getStreamType, createStream, onOpenVideoPlayer]
  );

  return {
    trackSelectionModal,
    closeTrackSelectionModal,
    handleFileStreamInit,
    handleTrackSelection,
  };
}
