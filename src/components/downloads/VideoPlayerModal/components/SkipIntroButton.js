'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';

function SkipIntroButton({ onSkip }) {
  const t = useTranslations('VideoPlayer');

  return (
    <div
      className="absolute z-30 right-[max(1rem,env(safe-area-inset-right))]
        bottom-[calc(var(--mobile-controls-height,6.5rem)+env(safe-area-inset-bottom,0px)+0.75rem)]"
    >
      <button
        type="button"
        data-player-control
        onClick={onSkip}
        className="flex min-h-11 items-center gap-2 rounded-lg bg-black/80 px-5 py-3
          font-medium text-white backdrop-blur-md border border-white/20
          active:scale-95 active:bg-black/90 touch-manipulation shadow-lg
          motion-reduce:active:scale-100"
      >
        <svg className="size-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M6 4l8 8-8 8V4zm10 0v16h2V4h-2z" />
        </svg>
        <span>{t('skipIntro')}</span>
      </button>
    </div>
  );
}

export default memo(SkipIntroButton);
