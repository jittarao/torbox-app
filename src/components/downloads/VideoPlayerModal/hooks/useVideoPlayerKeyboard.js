import { useEffect } from 'react';

/**
 * useVideoPlayerKeyboard - Handles keyboard shortcuts for video player
 * @param {Object} options
 * @param {boolean} options.isOpen - Whether modal is open
 * @param {boolean} options.isPlaying - Whether video is playing
 * @param {boolean} options.isFullscreen - Whether in fullscreen
 * @param {boolean} options.showInfo - Whether info overlay is open
 * @param {Object} options.videoRef - Ref to video element
 * @param {Function} options.onPlayPause - Callback for play/pause
 * @param {Function} options.onFullscreen - Callback for fullscreen
 * @param {Function} options.onMuteToggle - Callback for mute toggle
 * @param {Function} options.onInfoClose - Callback to close info overlay
 * @param {Function} options.onVolumeChange - Callback when volume changes (for arrow keys)
 */
export function useVideoPlayerKeyboard({
  isOpen,
  isPlaying,
  isFullscreen,
  showInfo,
  videoRef,
  onPlayPause,
  onFullscreen,
  onMuteToggle,
  onInfoClose,
  onVolumeChange,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Don't handle keyboard shortcuts if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        // Only exit fullscreen if in fullscreen, don't close the player
        if (isFullscreen) {
          e.preventDefault();
          document.exitFullscreen();
        }
        // If info modal is open, close it
        if (showInfo) {
          e.preventDefault();
          onInfoClose();
        }
      } else if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        onPlayPause();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        onFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        onMuteToggle();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (videoRef.current && onVolumeChange) {
          const newVolume = Math.min(1, videoRef.current.volume + 0.1);
          videoRef.current.volume = newVolume;
          onVolumeChange(newVolume);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (videoRef.current && onVolumeChange) {
          const newVolume = Math.max(0, videoRef.current.volume - 0.1);
          videoRef.current.volume = newVolume;
          onVolumeChange(newVolume);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 10);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying, isFullscreen, showInfo, videoRef, onPlayPause, onFullscreen, onMuteToggle, onInfoClose, onVolumeChange]);
}
