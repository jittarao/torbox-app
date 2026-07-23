'use client';

import { forwardRef } from 'react';

/**
 * ProgressBar - Video progress bar with seeking capability
 */
const ProgressBar = forwardRef(function ProgressBar(
  { progress, isSeeking, onSeek, onSeekStart },
  ref
) {
  return (
    <button
      type="button"
      ref={ref}
      data-seekbar
      className="w-full h-1.5 bg-white/20 cursor-pointer group pointer-events-auto touch-manipulation"
      onClick={(e) => {
        e.stopPropagation();
        onSeek(e);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSeekStart(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onSeek(e);
        }
      }}
    >
      <div
        className="h-full bg-accent dark:bg-accent-dark transition-[width] duration-150 transition-colors
          group-hover:bg-accent/90 dark:group-hover:bg-accent-dark/90
          relative pointer-events-none"
        style={{ width: `${progress}%` }}
      >
        <div
          className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2
          w-3 h-3 rounded-full bg-accent dark:bg-accent-dark
          transition-opacity pointer-events-none ${isSeeking ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        />
      </div>
    </button>
  );
});

export default ProgressBar;
