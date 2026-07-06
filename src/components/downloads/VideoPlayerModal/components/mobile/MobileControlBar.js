'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { formatTime } from '../../../utils/formatters';

function ControlButton({ label, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      data-player-control
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full
        bg-white/10 text-white backdrop-blur-sm
        active:bg-white/25 touch-manipulation motion-reduce:active:scale-100
        active:scale-95 transition-transform ${className}`}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function MobileControlBar({
  currentTime,
  duration,
  isPlaying,
  onPlayPause,
  onSeekBack,
  onSeekForward,
  onOpenSettings,
}) {
  const t = useTranslations('VideoPlayer');

  return (
    <div
      className="flex items-center gap-1 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]
        pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]"
      data-player-control
    >
      <div className="min-w-0 flex-1 truncate font-mono text-xs text-white tabular-nums">
        <span>{formatTime(currentTime)}</span>
        <span className="text-white/50"> / </span>
        <span className="text-white/70">{formatTime(duration)}</span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <ControlButton label={t('seekBack10')} onClick={onSeekBack}>
          <span className="relative flex items-center justify-center">
            <svg className="size-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
            </svg>
            <span className="absolute text-[9px] font-bold">10</span>
          </span>
        </ControlButton>

        <ControlButton
          label={isPlaying ? t('pause') : t('play')}
          onClick={onPlayPause}
          className="size-12 bg-white/15"
        >
          {isPlaying ? (
            <svg className="size-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="size-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </ControlButton>

        <ControlButton label={t('seekForward10')} onClick={onSeekForward}>
          <span className="relative flex items-center justify-center">
            <svg className="size-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 4V1l4 4-4 4V6c-3.31 0-6 2.69-6 6 0 1.01.25 1.97.7 2.8L5.24 16.26C4.46 15.03 4 13.57 4 12c0-4.42 3.58-8 8-8zm0 14c3.31 0 6-2.69 6-6 0-1.01-.25-1.97-.7-2.8l-1.46-1.46C19.54 8.97 20 10.43 20 12c0 4.42-3.58 8-8 8v3l-4-4 4-4v3z" />
            </svg>
            <span className="absolute text-[9px] font-bold">10</span>
          </span>
        </ControlButton>

        <ControlButton label={t('moreOptions')} onClick={onOpenSettings}>
          <svg className="size-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </ControlButton>
      </div>
    </div>
  );
}

export default memo(MobileControlBar);
