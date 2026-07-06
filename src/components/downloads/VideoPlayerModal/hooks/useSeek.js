import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Unified pointer/touch seek handling.
 */
export function useSeek({ duration, videoRef, seekBarRef, onTimeCommit }) {
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(null);
  const seekTimeRef = useRef(null);
  const isSeekingRef = useRef(false);

  const getTimeFromClientX = useCallback(
    (clientX) => {
      const bar = seekBarRef.current;
      if (!bar || !duration) return 0;
      const rect = bar.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return pos * duration;
    },
    [duration, seekBarRef]
  );

  const updateSeekPreview = useCallback(
    (clientX) => {
      const time = getTimeFromClientX(clientX);
      seekTimeRef.current = time;
      setSeekTime(time);
    },
    [getTimeFromClientX]
  );

  const commitSeek = useCallback(() => {
    const time = seekTimeRef.current;
    if (videoRef.current && time !== null && Number.isFinite(time)) {
      videoRef.current.currentTime = time;
      onTimeCommit?.(time);
    }
    isSeekingRef.current = false;
    setIsSeeking(false);
    setSeekTime(null);
    seekTimeRef.current = null;
  }, [videoRef, onTimeCommit]);

  const handleSeekPointerDown = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!duration) return;

      isSeekingRef.current = true;
      setIsSeeking(true);
      updateSeekPreview(e.clientX);

      const target = /** @type {HTMLElement} */ (e.currentTarget);
      if (target.setPointerCapture) {
        try {
          target.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
    },
    [duration, updateSeekPreview]
  );

  const handleSeekPointerMove = useCallback(
    (e) => {
      if (!isSeekingRef.current) return;
      e.preventDefault();
      updateSeekPreview(e.clientX);
    },
    [updateSeekPreview]
  );

  const handleSeekPointerUp = useCallback(
    (e) => {
      if (!isSeekingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      commitSeek();
    },
    [commitSeek]
  );

  const handleSeekClick = useCallback(
    (e) => {
      if (isSeekingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      if (!videoRef.current || !duration) return;
      const time = getTimeFromClientX(e.clientX);
      videoRef.current.currentTime = time;
      onTimeCommit?.(time);
    },
    [duration, videoRef, getTimeFromClientX, onTimeCommit]
  );

  useEffect(() => {
    if (!isSeeking) return undefined;

    const handleMove = (e) => {
      if (!isSeekingRef.current) return;
      updateSeekPreview(e.clientX);
    };

    const handleUp = () => {
      if (!isSeekingRef.current) return;
      commitSeek();
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    document.addEventListener('pointercancel', handleUp);

    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      document.removeEventListener('pointercancel', handleUp);
    };
  }, [isSeeking, updateSeekPreview, commitSeek]);

  return {
    isSeeking,
    seekTime,
    handleSeekPointerDown,
    handleSeekPointerMove,
    handleSeekPointerUp,
    handleSeekClick,
  };
}
