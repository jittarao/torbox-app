'use client';

import { useState, useEffect } from 'react';
import { SLEEP_TIMER_OPTIONS } from './constants';

export default function TimerMenu({
  sleepTimer,
  showTimerMenu,
  hasChapters = true,
  onToggle,
  onSetTimer,
  onCancelTimer,
  onClose,
}) {
  const [popoverVisible, setPopoverVisible] = useState(false);
  const timerOptions = hasChapters
    ? SLEEP_TIMER_OPTIONS
    : SLEEP_TIMER_OPTIONS.filter((opt) => opt.value !== 'end');

  useEffect(() => {
    if (!showTimerMenu) {
      setPopoverVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPopoverVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, [showTimerMenu]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          onToggle();
          onClose?.();
        }}
        className={`flex flex-col items-center gap-1 transition-colors ${sleepTimer ? 'text-amber-400' : 'text-gray-400 hover:text-white'}`}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8V12L14 14" />
        </svg>
        <span className="text-xs">Timer</span>
      </button>
      {showTimerMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => onToggle(false)} aria-hidden />
          <div
            className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 py-1 rounded-xl bg-[#0d1117] border border-white/10 shadow-xl z-20 min-w-[140px] origin-bottom transition-all duration-150 ${
              popoverVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            {timerOptions.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => onSetTimer(opt.value)}
                className="block w-full text-center px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
              >
                {opt.label}
              </button>
            ))}
            {sleepTimer && (
              <button
                type="button"
                onClick={() => {
                  onCancelTimer();
                  onToggle(false);
                }}
                className="block w-full text-center px-4 py-2 text-sm text-amber-400 hover:bg-white/5 border-t border-white/10 mt-1 pt-2"
              >
                Cancel timer
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
