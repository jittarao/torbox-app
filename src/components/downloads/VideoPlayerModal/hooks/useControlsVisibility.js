import { useEffect, useRef, useCallback } from 'react';

const IDLE_HIDE_MS = 2500;

/**
 * useControlsVisibility - Auto-hide video controls like mainstream players.
 * Shows on pointer activity inside the player, hides after idle while playing,
 * and hides immediately when the pointer leaves the player or browser window.
 */
export function useControlsVisibility({
  isOpen,
  isPlaying,
  isSeeking = false,
  showControls,
  setShowControls,
  playerRef,
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
  const hideTimeoutRef = useRef(null);
  const isHoveringControlsRef = useRef(false);
  const stateRef = useRef({ isPlaying, hasOpenMenu: false, isSeeking: false });

  const hasOpenMenu =
    showVolumeSlider || showAudioMenu || showSubtitleMenu || showPlaybackSpeedMenu;

  stateRef.current = { isPlaying, hasOpenMenu, isSeeking };

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const isPointInElement = useCallback((element, x, y) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }, []);

  const isPointerOverInteractiveControls = useCallback(
    (clientX, clientY) => {
      if (controlsBarRef?.current && isPointInElement(controlsBarRef.current, clientX, clientY)) {
        return true;
      }
      if (showVolumeSlider && volumeRef?.current) {
        if (isPointInElement(volumeRef.current, clientX, clientY)) return true;
      }
      if (showAudioMenu && audioMenuRef?.current) {
        if (isPointInElement(audioMenuRef.current, clientX, clientY)) return true;
      }
      if (showSubtitleMenu && subtitleMenuRef?.current) {
        if (isPointInElement(subtitleMenuRef.current, clientX, clientY)) return true;
      }
      if (showPlaybackSpeedMenu && playbackSpeedMenuRef?.current) {
        if (isPointInElement(playbackSpeedMenuRef.current, clientX, clientY)) return true;
      }
      return false;
    },
    [
      controlsBarRef,
      volumeRef,
      audioMenuRef,
      subtitleMenuRef,
      playbackSpeedMenuRef,
      showVolumeSlider,
      showAudioMenu,
      showSubtitleMenu,
      showPlaybackSpeedMenu,
      isPointInElement,
    ]
  );

  const scheduleHide = useCallback(
    (delay = IDLE_HIDE_MS) => {
      const { isPlaying: playing, hasOpenMenu: menuOpen, isSeeking: seeking } = stateRef.current;
      if (!playing || menuOpen || seeking || isHoveringControlsRef.current) return;

      clearHideTimeout();
      hideTimeoutRef.current = setTimeout(() => {
        const latest = stateRef.current;
        if (
          !latest.isPlaying ||
          latest.hasOpenMenu ||
          latest.isSeeking ||
          isHoveringControlsRef.current
        ) {
          return;
        }
        setShowControls(false);
      }, delay);
    },
    [clearHideTimeout, setShowControls]
  );

  const revealControls = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [setShowControls, scheduleHide]);

  const hideControlsNow = useCallback(() => {
    const { isPlaying: playing, hasOpenMenu: menuOpen, isSeeking: seeking } = stateRef.current;
    if (!playing || menuOpen || seeking || isHoveringControlsRef.current) return;
    clearHideTimeout();
    setShowControls(false);
  }, [clearHideTimeout, setShowControls]);

  // Keep controls visible while paused or seeking.
  useEffect(() => {
    if (!isOpen) return;

    if (!isPlaying || isSeeking) {
      clearHideTimeout();
      setShowControls(true);
      return;
    }

    if (!hasOpenMenu) {
      scheduleHide();
    }

    return clearHideTimeout;
  }, [isOpen, isPlaying, isSeeking, hasOpenMenu, clearHideTimeout, scheduleHide, setShowControls]);

  // Keep controls visible while a menu is open; resume idle hide when menus close.
  useEffect(() => {
    if (!isOpen) return;

    if (hasOpenMenu) {
      clearHideTimeout();
      setShowControls(true);
      return;
    }

    if (isPlaying && showControls) {
      scheduleHide();
    }
  }, [
    isOpen,
    hasOpenMenu,
    isPlaying,
    showControls,
    clearHideTimeout,
    scheduleHide,
    setShowControls,
  ]);

  // Pointer + window leave listeners on the player surface.
  useEffect(() => {
    if (!isOpen) return undefined;

    const player = playerRef?.current;
    if (!player) return undefined;

    const handlePointerMove = (e) => {
      const overControls = isPointerOverInteractiveControls(e.clientX, e.clientY);
      isHoveringControlsRef.current = overControls;

      if (overControls) {
        clearHideTimeout();
        setShowControls(true);
        return;
      }

      revealControls();
    };

    const handlePointerLeave = () => {
      isHoveringControlsRef.current = false;
      hideControlsNow();
    };

    const handleDocumentMouseOut = (e) => {
      // Fires when the pointer leaves the browser window (relatedTarget is null).
      if (e.relatedTarget === null) {
        isHoveringControlsRef.current = false;
        hideControlsNow();
      }
    };

    const handleWindowBlur = () => {
      isHoveringControlsRef.current = false;
      hideControlsNow();
    };

    player.addEventListener('pointermove', handlePointerMove);
    player.addEventListener('pointerleave', handlePointerLeave);
    document.documentElement.addEventListener('mouseleave', hideControlsNow);
    document.addEventListener('mouseout', handleDocumentMouseOut);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      player.removeEventListener('pointermove', handlePointerMove);
      player.removeEventListener('pointerleave', handlePointerLeave);
      document.documentElement.removeEventListener('mouseleave', hideControlsNow);
      document.removeEventListener('mouseout', handleDocumentMouseOut);
      window.removeEventListener('blur', handleWindowBlur);
      clearHideTimeout();
    };
  }, [
    isOpen,
    playerRef,
    isPointerOverInteractiveControls,
    revealControls,
    hideControlsNow,
    clearHideTimeout,
    setShowControls,
  ]);

  return { revealControls, hideControlsNow };
}
