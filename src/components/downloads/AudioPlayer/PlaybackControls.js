'use client';

import { useRef, useCallback, useEffect } from 'react';
import { SKIP_SECONDS, SKIP_SECONDS_LONG, SKIP_LONG_PRESS_MS } from './constants';

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(10);
  }
}

export default function PlaybackControls({
  isPlaying,
  duration,
  isBuffering = false,
  onPlayPause,
  onPrevChapter,
  onNextChapter,
  onSkip,
}) {
  const canPlay =
    (duration != null && (Number.isFinite(duration) || duration === Infinity)) || isPlaying;
  const longPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressFiredRef.current = false;
  }, []);

  useEffect(() => {
    return () => clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleSkipBackPointerDown = useCallback(() => {
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressFiredRef.current = true;
      triggerHaptic();
      onSkip?.(-SKIP_SECONDS_LONG);
    }, SKIP_LONG_PRESS_MS);
  }, [onSkip]);

  const handleSkipBackPointerUp = useCallback(() => {
    if (!longPressFiredRef.current) {
      triggerHaptic();
      onSkip?.(-SKIP_SECONDS);
    }
    clearLongPressTimer();
  }, [onSkip, clearLongPressTimer]);

  const handleSkipForwardPointerDown = useCallback(() => {
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressFiredRef.current = true;
      triggerHaptic();
      onSkip?.(SKIP_SECONDS_LONG);
    }, SKIP_LONG_PRESS_MS);
  }, [onSkip]);

  const handleSkipForwardPointerUp = useCallback(() => {
    if (!longPressFiredRef.current) {
      triggerHaptic();
      onSkip?.(SKIP_SECONDS);
    }
    clearLongPressTimer();
  }, [onSkip, clearLongPressTimer]);

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 py-4">
      {/* Previous chapter */}
      <button
        type="button"
        onClick={onPrevChapter}
        className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        aria-label="Previous chapter"
      >
        <svg
          className="size-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <path d="M8.06 12.63C8.32 13.84 9.67 14.71 12.38 16.45C15.32 18.34 16.80 19.29 17.99 18.92C18.39 18.80 18.77 18.58 19.08 18.29C20 17.42 20 15.61 20 12C20 8.39 20 6.58 19.08 5.71C18.77 5.42 18.39 5.20 17.99 5.08C16.80 4.71 15.32 5.66 12.38 7.55C9.67 9.29 8.32 10.16 8.06 11.37C7.98 11.79 7.98 12.21 8.06 12.63Z" />
          <path d="M4 4L4 20" />
        </svg>
      </button>
      {/* Skip back */}
      <button
        type="button"
        onPointerDown={handleSkipBackPointerDown}
        onPointerUp={handleSkipBackPointerUp}
        onPointerCancel={handleSkipBackPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        className="flex flex-col items-center justify-center size-12 rounded-full bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white transition-colors active:scale-95"
        aria-label="Back 15 seconds (hold for 60s)"
      >
        <svg
          className="size-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5L10.90 3.45C10.49 2.88 10.28 2.59 10.41 2.32C10.54 2.06 10.87 2.04 11.53 2.01C11.68 2.00 11.84 2 12 2C17.52 2 22 6.48 22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 8.73 3.57 5.82 6 4.00" />
          <path d="M8 11.00C8.53 10.58 9.01 9.89 9.31 10.02C9.61 10.14 9.51 10.57 9.51 11.23C9.51 11.89 9.51 14.68 9.51 16.00" />
          <path d="M16 10H13.36C13.12 10 12.92 10.17 12.87 10.40L12.50 12.50C13.14 12.24 13.46 12.14 14.18 12.14C15.21 12.14 16.10 12.78 16.00 14.1C16.02 15.66 14.76 16.02 14.18 16C13.59 15.98 12.66 16.2 12.5 15" />
        </svg>
      </button>
      {/* Play/pause */}
      <button
        type="button"
        onClick={onPlayPause}
        disabled={!canPlay}
        className="relative flex items-center justify-center size-14 rounded-full bg-amber-500 hover:bg-amber-400 text-white shadow-lg transition-all disabled:opacity-50 active:scale-95"
        aria-label={isBuffering ? 'Loading' : isPlaying ? 'Pause' : 'Play'}
      >
        {isBuffering ? (
          <span
            className="size-7 border-2 border-gray-900/25 border-t-gray-900 rounded-full animate-spin"
            aria-hidden
          />
        ) : isPlaying ? (
          <svg className="size-7" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="size-7 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      {/* Skip forward */}
      <button
        type="button"
        onPointerDown={handleSkipForwardPointerDown}
        onPointerUp={handleSkipForwardPointerUp}
        onPointerCancel={handleSkipForwardPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        className="flex flex-col items-center justify-center size-12 rounded-full bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white transition-colors active:scale-95"
        aria-label="Forward 15 seconds (hold for 60s)"
      >
        <svg
          className="size-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5L13.10 3.45C13.51 2.88 13.72 2.59 13.59 2.32C13.46 2.06 13.13 2.04 12.47 2.01C12.32 2.00 12.16 2 12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 8.73 20.43 5.82 18 4.00" />
          <path d="M8 11.00C8.53 10.58 9.01 9.89 9.31 10.02C9.61 10.14 9.51 10.57 9.51 11.23C9.51 11.89 9.51 14.68 9.51 16.00" />
          <path d="M16 10H13.36C13.12 10 12.92 10.17 12.87 10.40L12.50 12.50C13.14 12.24 13.46 12.14 14.18 12.14C15.21 12.14 16.10 12.78 16.00 14.1C16.02 15.66 14.76 16.02 14.18 16C13.59 15.98 12.66 16.2 12.5 15" />
        </svg>
      </button>
      {/* Next chapter */}
      <button
        type="button"
        onClick={onNextChapter}
        className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        aria-label="Next chapter"
      >
        <svg
          className="size-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <path d="M15.94 12.63C15.68 13.84 14.33 14.71 11.62 16.45C8.68 18.34 7.20 19.29 6.01 18.92C5.61 18.80 5.23 18.58 4.92 18.29C4 17.42 4 15.61 4 12C4 8.39 4 6.58 4.92 5.71C5.23 5.42 5.61 5.20 6.01 5.08C7.20 4.71 8.68 5.66 11.62 7.55C14.33 9.29 15.68 10.16 15.94 11.37C16.02 11.79 16.02 12.21 15.94 12.63Z" />
          <path d="M20 5V19" />
        </svg>
      </button>
    </div>
  );
}
