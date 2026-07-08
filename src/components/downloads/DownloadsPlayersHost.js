'use client';

import { useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useShallow } from 'zustand/react/shallow';
import { useDownloadsPlayerStore } from '@/store/downloadsPlayerStore';
import AudioPlayer from './AudioPlayer';

const VideoPlayerModal = dynamic(() => import('./VideoPlayerModal'), { ssr: false });
/**
 * Subscribes only to player store — keeps stream URL updates off Downloads.
 */
export default function DownloadsPlayersHost({ apiKey, activeType, requestDownloadLink }) {
  const {
    video,
    audio,
    closeVideo,
    closeAudio,
    setVideoStreamUrl,
    setActiveType,
    refreshAudioUrl,
  } = useDownloadsPlayerStore(
    useShallow((s) => ({
      video: s.video,
      audio: s.audio,
      closeVideo: s.closeVideo,
      closeAudio: s.closeAudio,
      setVideoStreamUrl: s.setVideoStreamUrl,
      setActiveType: s.setActiveType,
      refreshAudioUrl: s.refreshAudioUrl,
    }))
  );

  useEffect(() => {
    setActiveType(activeType);
  }, [activeType, setActiveType]);

  return (
    <>
      {video.isOpen && (
        <VideoPlayerModal
          isOpen={video.isOpen}
          onClose={closeVideo}
          streamUrl={video.streamUrl}
          fileName={video.fileName}
          subtitles={video.subtitles}
          audios={video.audios}
          metadata={video.metadata}
          apiKey={apiKey}
          itemId={video.itemId}
          fileId={video.fileId}
          streamType={video.streamType}
          introInformation={video.introInformation}
          initialAudioIndex={video.initialAudioIndex}
          initialSubtitleIndex={video.initialSubtitleIndex}
          onStreamUrlChange={setVideoStreamUrl}
        />
      )}
      {audio.isOpen && (
        <AudioPlayer
          key={`${audio.fileId}-${audio.itemId}`}
          audioUrl={audio.url}
          fileName={audio.fileName}
          itemId={audio.itemId}
          fileId={audio.fileId}
          assetType={audio.assetType}
          apiKey={audio.apiKey}
          onClose={closeAudio}
          onRefreshUrl={() => refreshAudioUrl(requestDownloadLink)}
        />
      )}
    </>
  );
}

/** Stable callbacks for list rows — does not subscribe to player state. */
export function useDownloadsPlayerActions(apiKey, activeType, requestDownloadLink, setToast) {
  const openVideo = useDownloadsPlayerStore((s) => s.openVideo);
  const playAudio = useDownloadsPlayerStore((s) => s.playAudio);

  useEffect(() => {
    useDownloadsPlayerStore.getState().setActiveType(activeType);
  }, [activeType]);

  const handleAudioPlay = useCallback(
    async (itemId, file) => {
      const result = await playAudio({
        itemId,
        file,
        apiKey,
        activeType,
        requestDownloadLink,
        onError: (message) => setToast({ message, type: 'error' }),
      });
      return result;
    },
    [playAudio, apiKey, activeType, requestDownloadLink, setToast]
  );

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
      openVideo({
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
        initialSubtitleIndex,
      });
    },
    [openVideo]
  );

  return { handleAudioPlay, openVideoPlayer };
}
