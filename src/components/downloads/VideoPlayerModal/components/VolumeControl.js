'use client';

import { useRef, useEffect } from 'react';

/**
 * VolumeControl - Volume button and vertical slider
 * @param {Object} props
 * @param {number} props.volume - Current volume (0-1)
 * @param {boolean} props.isMuted - Whether volume is muted
 * @param {boolean} props.showSlider - Whether to show the volume slider
 * @param {Function} props.onVolumeChange - Callback when volume changes
 * @param {Function} props.onMuteToggle - Callback when mute button is clicked
 * @param {Function} props.onSliderShow - Callback to show slider
 * @param {Function} props.onSliderHide - Callback to hide slider
 */
export default function VolumeControl({
  volume,
  isMuted,
  showSlider,
  onVolumeChange,
  onMuteToggle,
  onSliderShow,
  onSliderHide,
}) {
  const volumeRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onSliderShow();
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      onSliderHide();
    }, 300);
  };

  const handleVolumeChange = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = 1 - (e.clientY - rect.top) / rect.height;
    const newVolume = Math.max(0, Math.min(1, pos));
    onVolumeChange(newVolume);
  };

  const handleSliderDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const handleMouseMove = (moveEvent) => {
      const rect = e.currentTarget.parentElement.parentElement.getBoundingClientRect();
      const pos = 1 - (moveEvent.clientY - rect.top) / rect.height;
      const newVolume = Math.max(0, Math.min(1, pos));
      onVolumeChange(newVolume);
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div 
      className="relative" 
      ref={volumeRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMuteToggle();
          if (!showSlider) {
            onSliderShow();
          } else {
            onSliderHide();
          }
        }}
        className="p-2 rounded-full bg-white/10 hover:bg-white/20 
          backdrop-blur-sm text-white transition-all duration-200
          hover:scale-110 active:scale-95"
        aria-label="Volume"
      >
        {isMuted || volume === 0 ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
          </svg>
        ) : volume < 0.5 ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.83 7l-1.45 1.45c.9 1.18 1.45 2.67 1.45 4.3v4.5l-2-.2v-3.3c0-1.32-.84-2.51-2.1-2.96L13 9.5V7.5c0-.28.22-.5.5-.5s.5.22.5.5v.7l2.83 2.83L18.83 7zM4 9v6h4l5 5V4L8 9H4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        )}
      </button>
      {showSlider && (
        <div 
          className="absolute bottom-full right-0 mb-2 w-12 h-32 bg-black/90 backdrop-blur-md rounded-lg border border-white/20 p-2 cursor-pointer pointer-events-auto"
          onClick={handleVolumeChange}
          onMouseMove={(e) => {
            if (e.buttons === 1) {
              handleVolumeChange(e);
            }
          }}
          onMouseEnter={handleMouseEnter}
        >
          <div className="relative h-full w-2 bg-white/20 rounded-full mx-auto">
            <div 
              className="absolute bottom-0 w-full bg-accent dark:bg-accent-dark rounded-full transition-all"
              style={{ height: `${(isMuted ? 0 : volume) * 100}%` }}
            />
            <div 
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2
                w-4 h-4 rounded-full bg-accent dark:bg-accent-dark cursor-grab active:cursor-grabbing pointer-events-auto"
              style={{ bottom: `${(isMuted ? 0 : volume) * 100}%` }}
              onMouseDown={handleSliderDrag}
            />
          </div>
        </div>
      )}
    </div>
  );
}
