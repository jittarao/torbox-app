import { useEffect } from 'react';

/**
 * useAudioKeyboard - Handles keyboard shortcuts for audio player
 * Space = play/pause, ArrowLeft/Right = seek, ArrowUp/Down = volume, C = chapters
 */
export function useAudioKeyboard({ onPlayPause, onSeek, onVolumeChange, onToggleChapters }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) {
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        onPlayPause?.();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSeek?.(-15);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSeek?.(15);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onVolumeChange?.(0.1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onVolumeChange?.(-0.1);
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        onToggleChapters?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPlayPause, onSeek, onVolumeChange, onToggleChapters]);
}
