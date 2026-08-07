'use client';

import { useRef, useCallback, useState, useEffect } from 'react';

const SLIDER_HIDE_DELAY_MS = 200;

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function VolumeIcon({ level, className = 'size-5' }) {
  if (level === 0) {
    return (
      <svg className={className} {...iconProps} aria-hidden>
        <path d="M14 14.81V9.19C14 6.04 14 4.47 13.07 4.08C12.15 3.69 11.06 4.80 8.88 7.02C7.75 8.17 7.11 8.43 5.51 8.43C4.10 8.43 3.40 8.43 2.90 8.77C1.85 9.49 2.01 10.88 2.01 12C2.01 13.12 1.85 14.51 2.90 15.23C3.40 15.57 4.10 15.57 5.51 15.57C7.11 15.57 7.75 15.83 8.88 16.98C11.06 19.20 12.15 20.31 13.07 19.92C14 19.53 14 17.96 14 14.81Z" />
        <path d="M18 10L22 14M18 14L22 10" />
      </svg>
    );
  }
  if (level < 0.5) {
    return (
      <svg className={className} {...iconProps} aria-hidden>
        <path d="M19 9C19.63 9.82 20 10.86 20 12C20 13.14 19.63 14.18 19 15" />
        <path d="M16 14.81V9.19C16 6.04 16 4.47 15.07 4.08C14.15 3.69 13.06 4.80 10.88 7.02C9.75 8.17 9.11 8.43 7.51 8.43C6.10 8.43 5.40 8.43 4.90 8.77C3.85 9.49 4.01 10.88 4.01 12C4.01 13.12 3.85 14.51 4.90 15.23C5.40 15.57 6.10 15.57 7.51 15.57C9.11 15.57 9.75 15.83 10.88 16.98C13.06 19.20 14.15 20.31 15.07 19.92C16 19.53 16 17.96 16 14.81Z" />
      </svg>
    );
  }
  return (
    <svg className={className} {...iconProps} aria-hidden>
      <path d="M14 14.81V9.19C14 6.04 14 4.47 13.07 4.08C12.15 3.69 11.06 4.80 8.88 7.02C7.75 8.17 7.11 8.43 5.51 8.43C4.10 8.43 3.40 8.43 2.90 8.77C1.85 9.49 2.01 10.88 2.01 12C2.01 13.12 1.85 14.51 2.90 15.23C3.40 15.57 4.10 15.57 5.51 15.57C7.11 15.57 7.75 15.83 8.88 16.98C11.06 19.20 12.15 20.31 13.07 19.92C14 19.53 14 17.96 14 14.81Z" />
      <path d="M17 9C17.63 9.82 18 10.86 18 12C18 13.14 17.63 14.18 17 15" />
      <path d="M20 7C21.25 8.37 22 10.11 22 12C22 13.89 21.25 15.63 20 17" />
    </svg>
  );
}

function volumeFromClientY(rail, clientY) {
  const rect = rail.getBoundingClientRect();
  if (rect.height <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
}

/**
 * VolumeControl — vertical popup slider (no inline layout shift)
 */
export default function VolumeControl({
  volume,
  isMuted,
  showSlider,
  onVolumeChange,
  onMuteToggle,
  onSliderShow,
  onSliderHide,
  containerRef,
}) {
  const internalRef = useRef(null);
  const volumeRef = containerRef || internalRef;
  const hideTimeoutRef = useRef(null);
  const railRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragCleanupRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showLevelHint, setShowLevelHint] = useState(false);

  const displayVolume = isMuted ? 0 : volume;
  const percent = Math.round(displayVolume * 100);
  const sliderVisible = showSlider || isDragging;

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      dragCleanupRef.current?.();
    };
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    if (isDraggingRef.current) return;
    clearHideTimer();
    hideTimeoutRef.current = setTimeout(() => {
      onSliderHide();
      setShowLevelHint(false);
    }, SLIDER_HIDE_DELAY_MS);
  }, [clearHideTimer, onSliderHide]);

  const handlePointerEnter = useCallback(() => {
    clearHideTimer();
    onSliderShow();
  }, [clearHideTimer, onSliderShow]);

  const handlePointerLeave = useCallback(
    (e) => {
      if (isDraggingRef.current) return;
      const related = e.relatedTarget;
      if (related instanceof Node && volumeRef.current?.contains(related)) return;
      scheduleHide();
    },
    [scheduleHide, volumeRef]
  );

  const applyVolume = useCallback(
    (next) => {
      onVolumeChange(next);
      setShowLevelHint(true);
    },
    [onVolumeChange]
  );

  const endDrag = useCallback(() => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  const handleTrackPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const rail = railRef.current;
      if (!rail) return;

      endDrag();
      isDraggingRef.current = true;
      setIsDragging(true);
      setShowLevelHint(true);
      clearHideTimer();
      onSliderShow();

      const updateFromEvent = (ev) => {
        applyVolume(volumeFromClientY(rail, ev.clientY));
      };

      updateFromEvent(e);

      const handlePointerMove = (moveEvent) => {
        moveEvent.preventDefault();
        updateFromEvent(moveEvent);
      };

      const handlePointerUp = (upEvent) => {
        endDrag();
        const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        if (!target || !volumeRef.current?.contains(target)) {
          scheduleHide();
        }
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);

      dragCleanupRef.current = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };
    },
    [applyVolume, clearHideTimer, endDrag, onSliderShow, scheduleHide, volumeRef]
  );

  const handleTrackKeyDown = useCallback(
    (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        applyVolume(Math.min(1, displayVolume + 0.05));
        onSliderShow();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        applyVolume(Math.max(0, displayVolume - 0.05));
        onSliderShow();
      } else if (e.key === 'Home') {
        e.preventDefault();
        applyVolume(1);
        onSliderShow();
      } else if (e.key === 'End') {
        e.preventDefault();
        applyVolume(0);
        onSliderShow();
      }
    },
    [applyVolume, displayVolume, onSliderShow]
  );

  const handleWheel = useCallback(
    (e) => {
      if (!showSlider && !isDragging) return;
      e.preventDefault();
      e.stopPropagation();
      clearHideTimer();
      onSliderShow();
      setShowLevelHint(true);
      const step = e.deltaY < 0 ? 0.05 : -0.05;
      applyVolume(Math.max(0, Math.min(1, displayVolume + step)));
    },
    [applyVolume, clearHideTimer, displayVolume, isDragging, onSliderShow, showSlider]
  );

  const popover = sliderVisible ? (
    <>
      {/* Bridge the mb-2 gap so pointer transitions don't close the popover */}
      <div
        className="absolute bottom-full left-1/2 z-30 h-2 w-12 -translate-x-1/2"
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
        aria-hidden
      />
      <div
        className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2"
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
      >
        <div
          className="flex flex-col items-center gap-2 rounded-xl border border-white/15
            bg-black/85 px-3 py-3 shadow-lg backdrop-blur-md"
        >
          <span
            className={`text-[11px] font-medium tabular-nums text-white/90 transition-opacity duration-100 ${
              showLevelHint || isDragging ? 'opacity-100' : 'opacity-60'
            }`}
          >
            {percent}%
          </span>

          <div
            role="slider"
            tabIndex={0}
            aria-label="Volume"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${percent}%`}
            className={`group/track relative flex h-28 w-8 items-center justify-center touch-manipulation
              outline-hidden focus-visible:ring-2 focus-visible:ring-accent/60
              focus-visible:ring-offset-1 focus-visible:ring-offset-black/80
              ${isDragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
            onPointerDown={handleTrackPointerDown}
            onKeyDown={handleTrackKeyDown}
          >
            <div ref={railRef} className="relative h-full w-1.5 rounded-full bg-white/20">
              <div
                className={`absolute bottom-0 w-full rounded-full bg-accent dark:bg-accent-dark
                  ${isDragging ? '' : 'transition-[height] duration-75'}`}
                style={{ height: `${displayVolume * 100}%` }}
              />
              <div
                className={`pointer-events-none absolute left-1/2 size-3 rounded-full bg-white
                  shadow-[0_0_0_1px_rgba(0,0,0,0.25)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.15)]
                  ${isDragging ? 'opacity-100' : 'opacity-0 group-hover/track:opacity-100 group-focus-visible/track:opacity-100'}
                  ${isDragging ? '' : 'transition-[opacity,bottom] duration-75'}`}
                style={{
                  bottom: `${displayVolume * 100}%`,
                  transform: 'translate(-50%, 50%)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  ) : null;

  return (
    <div
      className="relative shrink-0"
      ref={volumeRef}
      data-player-control
      onPointerLeave={handlePointerLeave}
      onWheel={handleWheel}
    >
      {popover}

      <button
        type="button"
        data-player-control
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={(e) => {
          e.stopPropagation();
          onMuteToggle();
        }}
        className="rounded-full bg-white/10 p-2 text-white backdrop-blur-xs
          transition-[colors,transform] duration-150
          hover:scale-110 hover:bg-white/20 active:scale-95"
        aria-label={isMuted ? 'Unmute' : `Volume ${percent}%`}
        title={isMuted ? 'Unmute (M)' : `Volume ${percent}%`}
      >
        <VolumeIcon level={displayVolume} />
      </button>
    </div>
  );
}
