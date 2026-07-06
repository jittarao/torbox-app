'use client';

import { memo } from 'react';
import { formatTime } from '../../../utils/formatters';

function MobileSeekBar({
  seekBarRef,
  progress,
  isSeeking,
  previewTime,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClick,
}) {
  return (
    <div className="relative px-3 pt-2 pb-1">
      <button
        type="button"
        ref={seekBarRef}
        data-seekbar
        data-player-control
        className="relative flex h-11 w-full touch-manipulation items-center"
        style={{ touchAction: isSeeking ? 'none' : 'manipulation' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25" />
        <span
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent dark:bg-accent-dark transition-[width] duration-75 motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
        <span
          className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-md dark:bg-accent-dark ${
            isSeeking ? 'scale-125 opacity-100' : 'opacity-0'
          } transition-transform motion-reduce:transition-none`}
          style={{ left: `${progress}%` }}
        />
        {isSeeking && previewTime !== null && (
          <span
            className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-xs font-mono text-white"
            style={{ left: `${progress}%` }}
          >
            {formatTime(previewTime)}
          </span>
        )}
      </button>
    </div>
  );
}

export default memo(MobileSeekBar);
