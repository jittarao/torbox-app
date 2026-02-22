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
          className="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <path d="M8.06492 12.6258C8.31931 13.8374 9.67295 14.7077 12.3802 16.4481C15.3247 18.3411 16.797 19.2876 17.9895 18.9229C18.3934 18.7994 18.7654 18.5823 19.0777 18.2876C20 17.4178 20 15.6118 20 12C20 8.38816 20 6.58224 19.0777 5.71235C18.7654 5.41773 18.3934 5.20057 17.9895 5.07707C16.797 4.71243 15.3247 5.6589 12.3802 7.55186C9.67295 9.29233 8.31931 10.1626 8.06492 11.3742C7.97836 11.7865 7.97836 12.2135 8.06492 12.6258Z" />
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
        className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white transition-colors active:scale-95"
        aria-label="Back 15 seconds (hold for 60s)"
      >
        <svg
          className="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5L10.8961 3.45459C10.4851 2.87911 10.2795 2.59137 10.4093 2.32411C10.5391 2.05684 10.8689 2.04153 11.5286 2.01092C11.6848 2.00367 11.842 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 8.72836 3.57111 5.82368 6 3.99927" />
          <path d="M8 10.9997C8.528 10.5797 9.008 9.8871 9.308 10.0157C9.608 10.1442 9.512 10.5677 9.512 11.2277C9.512 11.8877 9.512 14.6804 9.512 16.0037" />
          <path d="M16 10H13.3595C13.1212 10 12.916 10.1682 12.8692 10.4019L12.504 12.504C13.14 12.24 13.4607 12.1429 14.1766 12.1429C15.2126 12.1429 16.104 12.78 16.002 14.1C16.02 15.66 14.76 16.02 14.1766 16C13.5931 15.98 12.66 16.2 12.5 15" />
        </svg>
      </button>
      {/* Play/pause */}
      <button
        type="button"
        onClick={onPlayPause}
        disabled={!canPlay}
        className="relative flex items-center justify-center w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-400 text-gray-900 shadow-lg transition-all disabled:opacity-50 active:scale-95"
        aria-label={isBuffering ? 'Loading' : isPlaying ? 'Pause' : 'Play'}
      >
        {isBuffering ? (
          <span
            className="w-7 h-7 border-2 border-gray-900/25 border-t-gray-900 rounded-full animate-spin"
            aria-hidden
          />
        ) : isPlaying ? (
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-7 h-7 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
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
        className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white transition-colors active:scale-95"
        aria-label="Forward 15 seconds (hold for 60s)"
      >
        <svg
          className="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5L13.1039 3.45459C13.5149 2.87911 13.7205 2.59137 13.5907 2.32411C13.4609 2.05684 13.1311 2.04153 12.4714 2.01092C12.3152 2.00367 12.158 2 12 2C6.4772 2 2 6.47715 2 12C2 17.5228 6.4772 22 12 22C17.5229 22 22 17.5228 22 12C22 8.72836 20.4289 5.82368 18 3.99927" />
          <path d="M8 10.9997C8.528 10.5797 9.008 9.8871 9.308 10.0157C9.608 10.1442 9.512 10.5677 9.512 11.2277C9.512 11.8877 9.512 14.6804 9.512 16.0037" />
          <path d="M16 10H13.3595C13.1212 10 12.916 10.1682 12.8692 10.4019L12.504 12.504C13.14 12.24 13.4607 12.1429 14.1766 12.1429C15.2126 12.1429 16.104 12.78 16.002 14.1C16.02 15.66 14.76 16.02 14.1766 16C13.5931 15.98 12.66 16.2 12.5 15" />
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
          className="w-6 h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <path d="M15.9351 12.6258C15.6807 13.8374 14.327 14.7077 11.6198 16.4481C8.67528 18.3411 7.20303 19.2876 6.01052 18.9229C5.60662 18.7994 5.23463 18.5823 4.92227 18.2876C4 17.4178 4 15.6118 4 12C4 8.38816 4 6.58224 4.92227 5.71235C5.23463 5.41773 5.60662 5.20057 6.01052 5.07707C7.20304 4.71243 8.67528 5.6589 11.6198 7.55186C14.327 9.29233 15.6807 10.1626 15.9351 11.3742C16.0216 11.7865 16.0216 12.2135 15.9351 12.6258Z" />
          <path d="M20 5V19" />
        </svg>
      </button>
    </div>
  );
}
