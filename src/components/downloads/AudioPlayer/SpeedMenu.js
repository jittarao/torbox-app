'use client';

import { useState, useEffect } from 'react';
import { SPEED_OPTIONS } from './constants';

export default function SpeedMenu({
  playbackSpeed,
  showSpeedMenu,
  onToggle,
  onSelectSpeed,
  onClose,
}) {
  const [popoverVisible, setPopoverVisible] = useState(false);

  useEffect(() => {
    if (!showSpeedMenu) {
      setPopoverVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPopoverVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, [showSpeedMenu]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          onToggle();
          onClose?.();
        }}
        className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="18" r="3" />
          <path d="M12 15V10" />
          <path d="M22 13C22 7.47715 17.5228 3 12 3C6.47715 3 2 7.47715 2 13" />
        </svg>
        <span className="text-xs">{playbackSpeed}x</span>
      </button>
      {showSpeedMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => onToggle(false)} aria-hidden />
          <div
            className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 py-1 rounded-xl bg-[#0d1117] border border-white/10 shadow-xl z-20 min-w-[88px] origin-bottom transition-all duration-150 ${
              popoverVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSelectSpeed(s)}
                className={`block w-full text-center px-4 py-2 text-sm ${
                  s === playbackSpeed
                    ? 'text-amber-400 bg-white/5'
                    : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
