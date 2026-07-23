import { useCallback } from 'react';

export function useVideoPlayerTrackSwitch({
  audios,
  apiKey,
  itemId,
  fileId,
  streamType,
  isPlaying,
  selectedSubtitleIndex,
  selectedAudioIndex,
  selectedStreamData,
  createStream,
  onStreamUrlChange,
  videoRef,
  setIsLoading,
  setError,
  setCapturedSeekTime,
  setWasPlayingBeforeTrackChange,
  setSelectedStreamData,
  setSelectedAudioIndex,
  setSelectedSubtitleIndex,
  setShowAudioMenu,
  setShowSubtitleMenu,
  setShowSettingsSheet,
  isManualStreamUpdateRef,
  setStreamUrl,
}) {
  const handleAudioTrackSelect = useCallback(
    async (index) => {
      if (!audios || audios.length <= index || !apiKey || !itemId || fileId === undefined) {
        console.error('Missing required data for audio track selection');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const capturedTime = videoRef.current?.currentTime || 0;
        const wasPlaying = isPlaying;
        setCapturedSeekTime(capturedTime);
        setWasPlayingBeforeTrackChange(wasPlaying);

        if (videoRef.current && wasPlaying) videoRef.current.pause();

        const streamMetadata = await createStream(
          itemId,
          fileId,
          streamType,
          selectedSubtitleIndex !== null && selectedSubtitleIndex !== undefined
            ? selectedSubtitleIndex
            : selectedStreamData.subtitle_track_idx,
          index
        );

        const data = streamMetadata.data || streamMetadata;
        const newStreamUrl = data.hls_url || streamMetadata.hls_url;
        if (!newStreamUrl) throw new Error('No stream URL in response');

        setSelectedStreamData((prev) => ({ ...prev, audio_track_idx: index }));
        isManualStreamUpdateRef.current = true;
        setStreamUrl(newStreamUrl);
        onStreamUrlChange?.(newStreamUrl);
        setTimeout(() => {
          isManualStreamUpdateRef.current = false;
        }, 500);

        setSelectedAudioIndex(index);
        setShowAudioMenu(false);
        setShowSettingsSheet(false);
        setIsLoading(false);
      } catch (err) {
        console.error('Error selecting audio track:', err);
        setIsLoading(false);
        setError(err?.message || err?.toString() || 'Failed to change audio track');
      }
    },
    [
      audios,
      apiKey,
      itemId,
      fileId,
      streamType,
      isPlaying,
      selectedSubtitleIndex,
      selectedStreamData.subtitle_track_idx,
      createStream,
      onStreamUrlChange,
      videoRef,
      setIsLoading,
      setError,
      setCapturedSeekTime,
      setWasPlayingBeforeTrackChange,
      setSelectedStreamData,
      setSelectedAudioIndex,
      setShowAudioMenu,
      setShowSettingsSheet,
      isManualStreamUpdateRef,
      setStreamUrl,
    ]
  );

  const handleSubtitleTrackSelect = useCallback(
    async (index) => {
      if (!apiKey || !itemId || fileId === undefined) {
        console.error('Missing required data for subtitle track selection');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const capturedTime = videoRef.current?.currentTime || 0;
        const wasPlaying = isPlaying;
        setCapturedSeekTime(capturedTime);
        setWasPlayingBeforeTrackChange(wasPlaying);

        if (videoRef.current && wasPlaying) videoRef.current.pause();

        const streamMetadata = await createStream(
          itemId,
          fileId,
          streamType,
          index,
          selectedAudioIndex
        );

        const data = streamMetadata.data || streamMetadata;
        const newStreamUrl = data.hls_url || streamMetadata.hls_url;
        if (!newStreamUrl) throw new Error('No stream URL in response');

        setSelectedStreamData((prev) => ({ ...prev, subtitle_track_idx: index }));
        setSelectedSubtitleIndex(index);
        isManualStreamUpdateRef.current = true;
        setStreamUrl(newStreamUrl);
        onStreamUrlChange?.(newStreamUrl);
        setTimeout(() => {
          isManualStreamUpdateRef.current = false;
        }, 500);

        setShowSubtitleMenu(false);
        setShowSettingsSheet(false);
        setIsLoading(false);
      } catch (err) {
        console.error('Error selecting subtitle track:', err);
        setIsLoading(false);
        setError(err?.message || err?.toString() || 'Failed to change subtitle track');
      }
    },
    [
      apiKey,
      itemId,
      fileId,
      streamType,
      isPlaying,
      selectedAudioIndex,
      createStream,
      onStreamUrlChange,
      videoRef,
      setIsLoading,
      setError,
      setCapturedSeekTime,
      setWasPlayingBeforeTrackChange,
      setSelectedStreamData,
      setSelectedSubtitleIndex,
      setShowSubtitleMenu,
      setShowSettingsSheet,
      isManualStreamUpdateRef,
      setStreamUrl,
    ]
  );

  return { handleAudioTrackSelect, handleSubtitleTrackSelect };
}
