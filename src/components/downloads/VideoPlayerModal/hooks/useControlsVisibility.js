import { useEffect, useRef, useCallback, useState } from 'react';

const IDLE_HIDE_MS = 2500;
const POINTER_MOVE_THROTTLE_MS = 100;

/**
 * Auto-hide video controls. Touch-aware on mobile; pointer-hover on desktop.
 */
export function useControlsVisibility({
  isOpen,
  isPlaying,
  isSeeking = false,
  playerRef,
  controlsBarRef,
  showVolumeSlider = false,
  showAudioMenu = false,
  showSubtitleMenu = false,
  showPlaybackSpeedMenu = false,
  showSettingsSheet = false,
  showInfoSheet = false,
  volumeRef = null,
  audioMenuRef = null,
  subtitleMenuRef = null,
  playbackSpeedMenuRef = null,
  isTouchPlayer = false,
}) {
  const [showControls, setShowControls] = useState(true);
  const [wasOpen, setWasOpen] = useState(false);
  const hideTimeoutRef = useRef(null);
  const isHoveringControlsRef = useRef(false);
  const lastPointerMoveRef = useRef(0);
  const stateRef = useRef({ isPlaying, hasOpenMenu: false, isSeeking: false });

  const hasOpenMenu =
    showVolumeSlider ||
    showAudioMenu ||
    showSubtitleMenu ||
    showPlaybackSpeedMenu ||
    showSettingsSheet ||
    showInfoSheet;

  if (isOpen && !wasOpen) {
    setWasOpen(true);
    setShowControls(true);
  } else if (!isOpen && wasOpen) {
    setWasOpen(false);
  }

  const controlsVisible = showControls || hasOpenMenu || !isPlaying || isSeeking;

  useEffect(() => {
    stateRef.current = { isPlaying, hasOpenMenu, isSeeking };
  }, [isPlaying, hasOpenMenu, isSeeking]);

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

  const toggleControls = useCallback(() => {
    setShowControls((prev) => !prev);
  }, [setShowControls]);

  useEffect(() => {
    if (!isOpen) return;

    if (hasOpenMenu) {
      clearHideTimeout();
      // Persist visibility so closing a menu still has a true base state for scheduleHide().
      setShowControls(true);
      return;
    }

    if (!showControls) {
      clearHideTimeout();
      return;
    }

    if (isPlaying) {
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

  useEffect(() => {
    if (!isOpen) return;

    if (!isPlaying || isSeeking) {
      clearHideTimeout();
      // Persist visibility so resume/play still fades out from a true base state.
      setShowControls(true);
      return;
    }

    if (!hasOpenMenu && showControls) {
      scheduleHide();
    }

    return clearHideTimeout;
  }, [
    isOpen,
    isPlaying,
    isSeeking,
    hasOpenMenu,
    showControls,
    clearHideTimeout,
    scheduleHide,
    setShowControls,
  ]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const player = playerRef?.current;
    if (!player) return undefined;

    const handlePointerMove = (e) => {
      if (isTouchPlayer) {
        const now = Date.now();
        if (now - lastPointerMoveRef.current < POINTER_MOVE_THROTTLE_MS) return;
        lastPointerMoveRef.current = now;
      }

      const overControls = isPointerOverInteractiveControls(e.clientX, e.clientY);
      isHoveringControlsRef.current = overControls;

      if (overControls) {
        clearHideTimeout();
        setShowControls(true);
        return;
      }

      if (!isTouchPlayer) {
        revealControls();
      }
    };

    const handlePointerLeave = () => {
      isHoveringControlsRef.current = false;
      if (!isTouchPlayer) {
        hideControlsNow();
      }
    };

    const handleDocumentMouseOut = (e) => {
      if (e.relatedTarget === null) {
        isHoveringControlsRef.current = false;
        if (!isTouchPlayer) hideControlsNow();
      }
    };

    const handleWindowBlur = () => {
      isHoveringControlsRef.current = false;
      if (!isTouchPlayer) hideControlsNow();
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
    isTouchPlayer,
  ]);

  return {
    showControls: controlsVisible,
    setShowControls,
    revealControls,
    hideControlsNow,
    toggleControls,
  };
}
