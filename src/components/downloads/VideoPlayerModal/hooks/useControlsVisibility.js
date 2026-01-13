import { useEffect, useRef } from 'react';

/**
 * useControlsVisibility - Manages auto-hide behavior for video controls
 * @param {Object} options
 * @param {boolean} options.isOpen - Whether modal is open
 * @param {boolean} options.isPlaying - Whether video is playing
 * @param {boolean} options.showControls - Whether controls should be visible
 * @param {Function} options.setShowControls - Function to set controls visibility
 * @param {Object} options.controlsBarRef - Ref to the controls bar element (bottom section with buttons)
 * @param {boolean} options.showVolumeSlider - Whether volume slider is visible
 * @param {boolean} options.showAudioMenu - Whether audio menu is open
 * @param {boolean} options.showSubtitleMenu - Whether subtitle menu is open
 * @param {boolean} options.showPlaybackSpeedMenu - Whether playback speed menu is open
 * @param {Object} options.volumeRef - Ref to the volume control element
 * @param {Object} options.audioMenuRef - Ref to the audio menu element
 * @param {Object} options.subtitleMenuRef - Ref to the subtitle menu element
 * @param {Object} options.playbackSpeedMenuRef - Ref to the playback speed menu element
 */
export function useControlsVisibility({
  isOpen,
  isPlaying,
  showControls,
  setShowControls,
  controlsBarRef,
  showVolumeSlider = false,
  showAudioMenu = false,
  showSubtitleMenu = false,
  showPlaybackSpeedMenu = false,
  volumeRef = null,
  audioMenuRef = null,
  subtitleMenuRef = null,
  playbackSpeedMenuRef = null,
}) {
  const controlsTimeoutRef = useRef(null);
  const isHoveringControlsRef = useRef(false);

  // Helper function to check if point is within an element's bounds
  const isPointInElement = (element, x, y) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  useEffect(() => {
    if (!isOpen) return;

    // Check if any menu is open
    const hasOpenMenu = showVolumeSlider || showAudioMenu || showSubtitleMenu || showPlaybackSpeedMenu;

    const resetControlsTimeout = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      setShowControls(true);
      // Only auto-hide if playing AND not hovering over controls bar AND no menus are open
      if (isPlaying && !isHoveringControlsRef.current && !hasOpenMenu) {
        controlsTimeoutRef.current = setTimeout(() => {
          if (!isHoveringControlsRef.current && !hasOpenMenu) {
            setShowControls(false);
          }
        }, 3000);
      }
    };

    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      
      // Check if mouse is over the controls bar (bottom section with buttons) or any open menu
      let isOverControls = false;
      
      // First check if mouse is over the controls bar itself
      if (controlsBarRef?.current) {
        isOverControls = isPointInElement(controlsBarRef.current, clientX, clientY);
      }
      
      // Also check if mouse is over any open menu (menus may extend outside controls bar)
      if (!isOverControls) {
        if (showVolumeSlider && volumeRef?.current) {
          isOverControls = isPointInElement(volumeRef.current, clientX, clientY);
        }
        if (!isOverControls && showAudioMenu && audioMenuRef?.current) {
          isOverControls = isPointInElement(audioMenuRef.current, clientX, clientY);
        }
        if (!isOverControls && showSubtitleMenu && subtitleMenuRef?.current) {
          isOverControls = isPointInElement(subtitleMenuRef.current, clientX, clientY);
        }
        if (!isOverControls && showPlaybackSpeedMenu && playbackSpeedMenuRef?.current) {
          isOverControls = isPointInElement(playbackSpeedMenuRef.current, clientX, clientY);
        }
      }
      
      isHoveringControlsRef.current = isOverControls;
      
      // If hovering over controls bar or menus, don't auto-hide
      if (isOverControls) {
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
        setShowControls(true);
        return;
      }
      
      // Only reset timeout if not hovering over controls bar
      if (!isHoveringControlsRef.current) {
        resetControlsTimeout();
      }
    };

    const handleMouseLeave = () => {
      isHoveringControlsRef.current = false;
      // Only hide if playing and no menus are open
      if (isPlaying && !hasOpenMenu) {
        controlsTimeoutRef.current = setTimeout(() => {
          if (!hasOpenMenu) {
            setShowControls(false);
          }
        }, 2000);
      }
    };

    if (showControls) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isOpen, isPlaying, showControls, setShowControls, controlsBarRef, showVolumeSlider, showAudioMenu, showSubtitleMenu, showPlaybackSpeedMenu, volumeRef, audioMenuRef, subtitleMenuRef, playbackSpeedMenuRef]);
}
