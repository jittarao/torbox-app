import { useEffect } from 'react';

export function useVideoPlayerModalEffects({
  isOpen,
  isTouchPlayer,
  initialStreamUrl,
  isManualStreamUpdateRef,
  setStreamUrl,
  hasInitializedTracksRef,
  initialAudioIndex,
  initialSubtitleIndex,
  introInformation,
  setIsLoading,
  setError,
  setIsPlaying,
  setCurrentTime,
  setDuration,
  setShowControls,
  setShowVolumeSlider,
  setShowAudioMenu,
  setShowSubtitleMenu,
  setShowPlaybackSpeedMenu,
  setShowInfo,
  setShowSettingsSheet,
  setShowInfoSheet,
  setPlaybackSpeed,
  setSelectedStreamData,
  setSelectedSubtitleIndex,
  setSelectedAudioIndex,
  volumeRef,
  audioMenuRef,
  subtitleMenuRef,
  playbackSpeedMenuRef,
  volumeSliderTimeoutRef,
}) {
  useEffect(() => {
    if (isOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !hasInitializedTracksRef.current) {
      hasInitializedTracksRef.current = true;
      setIsLoading(true);
      setError(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setShowControls(true);
      setShowVolumeSlider(false);
      setShowAudioMenu(false);
      setShowSubtitleMenu(false);
      setShowPlaybackSpeedMenu(false);
      setShowInfo(false);
      setShowSettingsSheet(false);
      setShowInfoSheet(false);
      setPlaybackSpeed(1.0);
      setSelectedStreamData({
        video_track_idx: 0,
        audio_track_idx: initialAudioIndex,
        subtitle_track_idx: initialSubtitleIndex,
        intro_info: introInformation,
      });
      setSelectedSubtitleIndex(initialSubtitleIndex);
      setSelectedAudioIndex(initialAudioIndex);
    } else if (!isOpen) {
      hasInitializedTracksRef.current = false;
    }
  }, [
    isOpen,
    introInformation,
    initialAudioIndex,
    initialSubtitleIndex,
    hasInitializedTracksRef,
    setIsLoading,
    setError,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setShowControls,
    setShowVolumeSlider,
    setShowAudioMenu,
    setShowSubtitleMenu,
    setShowPlaybackSpeedMenu,
    setShowInfo,
    setShowSettingsSheet,
    setShowInfoSheet,
    setPlaybackSpeed,
    setSelectedStreamData,
    setSelectedSubtitleIndex,
    setSelectedAudioIndex,
  ]);

  useEffect(() => {
    if (!isOpen || isTouchPlayer) return;

    const handleClickOutside = (e) => {
      if (volumeRef.current && !volumeRef.current.contains(e.target)) {
        if (volumeSliderTimeoutRef.current) clearTimeout(volumeSliderTimeoutRef.current);
        setShowVolumeSlider(false);
      }
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target)) {
        setShowAudioMenu(false);
      }
      if (subtitleMenuRef.current && !subtitleMenuRef.current.contains(e.target)) {
        setShowSubtitleMenu(false);
      }
      if (playbackSpeedMenuRef.current && !playbackSpeedMenuRef.current.contains(e.target)) {
        setShowPlaybackSpeedMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [
    isOpen,
    isTouchPlayer,
    volumeRef,
    audioMenuRef,
    subtitleMenuRef,
    playbackSpeedMenuRef,
    volumeSliderTimeoutRef,
    setShowVolumeSlider,
    setShowAudioMenu,
    setShowSubtitleMenu,
    setShowPlaybackSpeedMenu,
  ]);

  useEffect(() => {
    if (initialStreamUrl && !isManualStreamUpdateRef.current) {
      setStreamUrl(initialStreamUrl);
    }
  }, [initialStreamUrl, isManualStreamUpdateRef, setStreamUrl]);
}
