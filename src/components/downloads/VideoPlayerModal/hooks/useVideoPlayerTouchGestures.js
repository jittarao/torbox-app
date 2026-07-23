import { useCallback } from 'react';
import { usePlayerGestures } from './usePlayerGestures';

export function useVideoPlayerTouchGestures({
  isOpen,
  isTouchPlayer,
  isLoading,
  error,
  isFullscreen,
  exitFullscreen,
  onClose,
  videoRef,
  playerAreaRef,
  toggleControls,
  revealControls,
  setCurrentTime,
  setSeekFeedback,
  isSeeking,
  showSettingsSheet,
  showInfoSheet,
  showInfo,
}) {
  const handleDoubleTapSeek = useCallback(
    (deltaSeconds, side) => {
      if (videoRef.current) {
        const next = Math.max(
          0,
          Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + deltaSeconds)
        );
        videoRef.current.currentTime = next;
        setCurrentTime(next);
      }
      setSeekFeedback({ side, seconds: deltaSeconds });
      revealControls();
    },
    [videoRef, setCurrentTime, setSeekFeedback, revealControls]
  );

  const handleSeekFeedbackDone = useCallback(() => {
    setSeekFeedback(null);
  }, [setSeekFeedback]);

  const handleSwipeDown = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
      return;
    }
    onClose();
  }, [isFullscreen, exitFullscreen, onClose]);

  usePlayerGestures({
    enabled: isOpen && isTouchPlayer && !isLoading && !error,
    targetRef: playerAreaRef,
    onToggleControls: toggleControls,
    onDoubleTapSeek: handleDoubleTapSeek,
    onSwipeDown: handleSwipeDown,
    isBlocked: () => isSeeking || showSettingsSheet || showInfoSheet || showInfo,
  });

  return { handleSeekFeedbackDone };
}
