import { useCallback, useEffect, useRef, useState } from 'react';
import {
  exitFullscreen,
  exitVideoFullscreen,
  getFullscreenElement,
  isFullscreenActive,
  isIOS,
  requestFullscreen,
  requestVideoFullscreen,
} from '../utils/fullscreen';

/**
 * Cross-browser fullscreen with iOS video fallback.
 * @param {Object} options
 * @param {boolean} options.enabled
 * @param {React.RefObject<HTMLElement | null>} options.containerRef
 * @param {React.RefObject<HTMLVideoElement | null>} options.videoRef
 */
export function useFullscreen({ enabled, containerRef, videoRef }) {
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const pseudoTimeoutRef = useRef(null);

  const syncFullscreenState = useCallback(() => {
    setIsNativeFullscreen(isFullscreenActive());
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const handleChange = () => {
      syncFullscreenState();
      if (!isFullscreenActive()) {
        setIsPseudoFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    document.addEventListener('mozfullscreenchange', handleChange);
    window.addEventListener('orientationchange', handleChange);
    window.addEventListener('resize', handleChange);

    syncFullscreenState();

    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
      document.removeEventListener('mozfullscreenchange', handleChange);
      window.removeEventListener('orientationchange', handleChange);
      window.removeEventListener('resize', handleChange);
      if (pseudoTimeoutRef.current) {
        clearTimeout(pseudoTimeoutRef.current);
      }
    };
  }, [enabled, syncFullscreenState]);

  const exitAllFullscreen = useCallback(async () => {
    setIsPseudoFullscreen(false);
    if (pseudoTimeoutRef.current) {
      clearTimeout(pseudoTimeoutRef.current);
      pseudoTimeoutRef.current = null;
    }
    await exitVideoFullscreen(videoRef.current);
    if (getFullscreenElement()) {
      await exitFullscreen();
    }
    syncFullscreenState();
  }, [videoRef, syncFullscreenState]);

  const enterFullscreen = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current;

    try {
      if (isIOS() && video) {
        await requestVideoFullscreen(video);
        syncFullscreenState();
        return;
      }

      if (container) {
        await requestFullscreen(container);
        syncFullscreenState();
        return;
      }

      setIsPseudoFullscreen(true);
      if (pseudoTimeoutRef.current) clearTimeout(pseudoTimeoutRef.current);
      pseudoTimeoutRef.current = setTimeout(() => {
        if (!isFullscreenActive()) {
          setIsPseudoFullscreen(false);
        }
      }, 500);
    } catch {
      setIsPseudoFullscreen(true);
    }
  }, [containerRef, videoRef, syncFullscreenState]);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreenActive() || isPseudoFullscreen) {
      await exitAllFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [isPseudoFullscreen, exitAllFullscreen, enterFullscreen]);

  useEffect(() => {
    if (!enabled) {
      exitAllFullscreen();
    }
    return () => {
      if (enabled) {
        exitAllFullscreen();
      }
    };
  }, [enabled, exitAllFullscreen]);

  const isFullscreen = isNativeFullscreen || isPseudoFullscreen;

  return {
    isFullscreen,
    isNativeFullscreen,
    isPseudoFullscreen,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen: exitAllFullscreen,
  };
}
