import { useEffect } from 'react';

export function useVideoPlayerModalEffects({
  isOpen,
  isTouchPlayer,
  setShowVolumeSlider,
  setShowAudioMenu,
  setShowSubtitleMenu,
  setShowPlaybackSpeedMenu,
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
}
