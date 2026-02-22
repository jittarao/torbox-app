'use client';

import { useState, useCallback } from 'react';
import { formatTime } from '../utils/formatters';

export default function ProgressBar({
  seekValue,
  buffered,
  currentTime,
  chapterRemaining,
  chapters = [],
  duration = 0,
  onSeek,
  onSeekStart,
  onSeekEnd,
  onSeekEndTouch,
}) {
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPercent, setHoverPercent] = useState(null);

  const handleMouseMove = useCallback(
    (e) => {
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHoverPercent(percent * 100);
      if (duration > 0 && Number.isFinite(duration)) {
        setHoverTime(percent * duration);
      } else {
        setHoverTime(null);
      }
    },
    [duration]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverTime(null);
    setHoverPercent(null);
    onSeekEnd();
  }, [onSeekEnd]);

  const showHoverPreview = hoverTime != null && duration > 0;
  const chapterTicks =
    chapters.length > 0 && duration > 0 && Number.isFinite(duration)
      ? chapters
          .filter((ch, i) => i > 0 && Number.isFinite(ch.startSeconds) && ch.startSeconds > 0)
          .map((ch) => (ch.startSeconds / duration) * 100)
      : [];

  return (
    <div className="mb-2 relative">
      <div
        className="h-1.5 rounded-full bg-white/10 cursor-pointer relative overflow-visible"
        onClick={onSeek}
        onMouseDown={onSeekStart}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        onMouseUp={onSeekEnd}
        onTouchStart={onSeekStart}
        onTouchEnd={(e) => {
          onSeekEnd();
          onSeekEndTouch(e);
        }}
        role="slider"
        aria-valuenow={seekValue}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-white/20"
            style={{ width: `${buffered}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-amber-500"
            style={{ width: `${seekValue}%` }}
          />
        </div>
        {chapterTicks.map((pct, i) => (
          <div
            key={i}
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2 -ml-px rounded-full bg-white/25 pointer-events-none"
            style={{ left: `${pct}%` }}
            aria-hidden
          />
        ))}
      </div>
      {showHoverPreview && (
        <div
          className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-gray-800 border border-white/10 text-xs text-gray-200 whitespace-nowrap pointer-events-none z-10"
          style={{
            left: hoverPercent != null ? `${hoverPercent}%` : '50%',
            transform: 'translate(-50%, 0)',
          }}
        >
          {formatTime(hoverTime)}
        </div>
      )}
      <div className="flex justify-between text-xs text-gray-400 mt-1.5">
        <span>{formatTime(currentTime)}</span>
        <span>-{formatTime(chapterRemaining)}</span>
      </div>
    </div>
  );
}
