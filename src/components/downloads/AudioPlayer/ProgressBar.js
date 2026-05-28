'use client';

import { useState, useCallback } from 'react';
import { formatTime } from '../utils/formatters';

const EMPTY_ARRAY = [];

export default function ProgressBar({
  seekValue,
  buffered,
  currentTime,
  chapterRemaining,
  chapters = EMPTY_ARRAY,
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
      ? chapters.reduce((acc, ch, i) => {
          if (i > 0 && Number.isFinite(ch.startSeconds) && ch.startSeconds > 0) {
            acc.push((ch.startSeconds / duration) * 100);
          }
          return acc;
        }, [])
      : [];

  return (
    <div className="mb-2 relative">
      <div className="relative h-1.5">
        <input
          type="range"
          min={0}
          max={100}
          value={seekValue}
          onChange={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (rect.width > 0) {
              const pct = parseFloat(e.target.value) / 100;
              onSeek({
                ...e,
                clientX: rect.left + pct * rect.width,
                currentTarget: e.currentTarget,
              });
            }
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0 p-0"
          onMouseDown={onSeekStart}
          onMouseUp={onSeekEnd}
          onTouchStart={onSeekStart}
          onTouchEnd={(e) => {
            onSeekEnd();
            onSeekEndTouch(e);
            e.preventDefault();
          }}
          aria-label="Audio progress"
        />
        <div
          className="h-1.5 rounded-full bg-white/10 cursor-pointer relative overflow-visible pointer-events-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
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
          {chapterTicks.map((pct) => (
            <div
              key={pct}
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2 -ml-px rounded-full bg-white/25 pointer-events-none"
              style={{ left: `${pct}%` }}
              aria-hidden
            />
          ))}
        </div>
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
