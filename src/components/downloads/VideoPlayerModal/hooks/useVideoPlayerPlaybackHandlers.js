'use client';

import { useCallback, useEffect, useRef } from 'react';
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
  error,
  onClose,
}) {
  const volumeBeforeMuteRef = useRef(1);

  const handleVideoRef = useCallback(
    (videoElement) => {
      videoRef.current = videoElement;
      if (videoElement) {
        setVolume(videoElement.volume);
        setIsMuted(videoElement.muted);
        if (videoElement.volume > 0) {
          volumeBeforeMuteRef.current = videoElement.volume;
        }
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
    if (isPlaying) {
      videoRef.current.pause();
      return;
    }
    // User gesture: always unmute so Search autoplay-muted streams regain audio.
    const tracks = videoRef.current.audioTracks;
    if (tracks && tracks.length > 0) {
      let anyEnabled = false;
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].enabled) {
          anyEnabled = true;
          break;
        }
      }
      if (!anyEnabled) tracks[0].enabled = true;
    }
    videoRef.current.muted = false;
    if (videoRef.current.volume === 0) {
      videoRef.current.volume = 1;
      setVolume(1);
    }
    setIsMuted(false);
    videoRef.current.play().catch(() => {});
  }, [isPlaying, videoRef, setVolume, setIsMuted]);

  const handleVolumeStateChange = useCallback(
    ({ volume: nextVolume, muted }) => {
      if (typeof nextVolume === 'number' && Number.isFinite(nextVolume)) {
        setVolume(nextVolume);
        if (nextVolume > 0) {
          volumeBeforeMuteRef.current = nextVolume;
        }
      }
      if (typeof muted === 'boolean') {
        setIsMuted(muted);
      }
    },
    [setVolume, setIsMuted]
  );

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
      if (!videoRef.current) return;
      const clamped = Math.max(0, Math.min(1, newVolume));
      videoRef.current.volume = clamped;
      setVolume(clamped);
      if (clamped > 0) {
        volumeBeforeMuteRef.current = clamped;
        if (videoRef.current.muted) {
          videoRef.current.muted = false;
        }
        setIsMuted(false);
      } else {
        setIsMuted(true);
      }
    },
    [videoRef, setVolume, setIsMuted]
  );

  const handleMuteToggle = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.muted || videoRef.current.volume === 0) {
      const restore = volumeBeforeMuteRef.current || 1;
      videoRef.current.volume = restore;
      videoRef.current.muted = false;
      setVolume(restore);
      setIsMuted(false);
      return;
    }
    volumeBeforeMuteRef.current = videoRef.current.volume || 1;
    videoRef.current.muted = true;
    setIsMuted(true);
  }, [videoRef, setVolume, setIsMuted]);

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
    error,
    videoRef,
    onPlayPause: handlePlayPause,
    onFullscreen: toggleFullscreen,
    onMuteToggle: handleMuteToggle,
    onInfoClose: handleInfoClose,
    onClose,
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
    handleVolumeStateChange,
    handleMuteToggle,
    handlePlaybackSpeedChange,
    handleInfoClose,
    handleErrorRetry,
  };
}
