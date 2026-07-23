'use client';

import { useCallback, useEffect } from 'react';
import { useVideoPlayerKeyboard } from './useVideoPlayerKeyboard';

export function useVideoPlayerPlaybackHandlers({
  videoRef,
  isPlaying,
  isTouchPlayer,
  duration,
  playbackSpeed,
  toggleFullscreen,
  handleSeekPointerDown,
  lastClickTimeRef,
  streamUrl,
  setVolume,
  setIsMuted,
  setPlaybackSpeed,
  setShowPlaybackSpeedMenu,
  setShowInfo,
  setShowInfoSheet,
  setError,
  setIsLoading,
  setStreamUrl,
  isOpen,
  isFullscreen,
  showInfo,
  showInfoSheet,
}) {
  const handleVideoRef = useCallback(
    (videoElement) => {
      videoRef.current = videoElement;
      if (videoElement) {
        setVolume(videoElement.volume);
        setIsMuted(videoElement.muted);
        if (videoElement.playbackRate !== playbackSpeed) {
          videoElement.playbackRate = playbackSpeed;
        }
      }
    },
    [videoRef, playbackSpeed, setVolume, setIsMuted]
  );

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, videoRef]);

  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
  }, [isPlaying, videoRef]);

  const handleRewind = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 30);
    }
  }, [videoRef]);

  const handleForward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(
        videoRef.current.duration || 0,
        videoRef.current.currentTime + 30
      );
    }
  }, [videoRef]);

  const handleSeekBack10 = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    }
  }, [videoRef]);

  const handleSeekForward10 = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(
        videoRef.current.duration || 0,
        videoRef.current.currentTime + 10
      );
    }
  }, [videoRef]);

  const handleVideoClick = useCallback(
    (e) => {
      if (isTouchPlayer) return;
      if (e.target.closest('[data-seekbar]') || e.target.closest('[data-player-control]')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      const timeSinceLastClick = now - lastClickTimeRef.current;

      if (timeSinceLastClick < 300) {
        toggleFullscreen();
        lastClickTimeRef.current = 0;
      } else {
        lastClickTimeRef.current = now;
        handlePlayPause();
      }
    },
    [isTouchPlayer, toggleFullscreen, handlePlayPause, lastClickTimeRef]
  );

  const handleSeek = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (videoRef.current && duration) {
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        videoRef.current.currentTime = pos * duration;
      }
    },
    [duration, videoRef]
  );

  const handleSeekbarMouseDown = useCallback(
    (e) => {
      if (isTouchPlayer) return;
      e.preventDefault();
      e.stopPropagation();
      handleSeekPointerDown(e);
    },
    [isTouchPlayer, handleSeekPointerDown]
  );

  const handleVolumeChange = useCallback(
    (newVolume) => {
      if (videoRef.current) {
        videoRef.current.volume = newVolume;
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
      }
    },
    [videoRef, setVolume, setIsMuted]
  );

  const handleMuteToggle = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }, [videoRef, setIsMuted]);

  const handlePlaybackSpeedChange = useCallback(
    (speed) => {
      if (videoRef.current) {
        videoRef.current.playbackRate = speed;
        setPlaybackSpeed(speed);
        setShowPlaybackSpeedMenu(false);
      }
    },
    [videoRef, setPlaybackSpeed, setShowPlaybackSpeedMenu]
  );

  const handleInfoClose = useCallback(() => {
    setShowInfo(false);
    setShowInfoSheet(false);
  }, [setShowInfo, setShowInfoSheet]);

  useVideoPlayerKeyboard({
    isOpen,
    isPlaying,
    isFullscreen,
    showInfo: showInfo || showInfoSheet,
    videoRef,
    onPlayPause: handlePlayPause,
    onFullscreen: toggleFullscreen,
    onMuteToggle: handleMuteToggle,
    onInfoClose: handleInfoClose,
    onVolumeChange: handleVolumeChange,
  });

  const handleErrorRetry = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      if (streamUrl) {
        setStreamUrl(streamUrl);
        setIsLoading(false);
      } else {
        throw new Error('No stream URL available to retry');
      }
    } catch (retryError) {
      console.error('Error retrying stream:', retryError);
      setIsLoading(false);
      setError(retryError.message || 'Failed to retry stream. Please close and reopen the player.');
    }
  }, [streamUrl, setError, setIsLoading, setStreamUrl]);

  return {
    handleVideoRef,
    handlePlayPause,
    handleRewind,
    handleForward,
    handleSeekBack10,
    handleSeekForward10,
    handleVideoClick,
    handleSeek,
    handleSeekbarMouseDown,
    handleVolumeChange,
    handleMuteToggle,
    handlePlaybackSpeedChange,
    handleInfoClose,
    handleErrorRetry,
  };
}
