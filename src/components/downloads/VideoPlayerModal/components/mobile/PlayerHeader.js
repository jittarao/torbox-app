'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { X } from '@/components/icons';

function PlayerHeader({ fileName, isVisible, onClose }) {
  const t = useTranslations('VideoPlayer');

  return (
    <div
      className={`absolute inset-x-0 top-0 z-30 pointer-events-none transition-opacity duration-300 motion-reduce:transition-none ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24
          bg-gradient-to-b from-black/70 via-black/30 to-transparent"
        aria-hidden="true"
      />
      <div
        className={`relative flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2
          pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]
          ${isVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <button
          type="button"
          data-player-control
          onClick={onClose}
          className="flex size-11 shrink-0 items-center justify-center rounded-full
            bg-black/50 text-white backdrop-blur-sm
            active:bg-black/70 touch-manipulation"
          aria-label={t('close')}
        >
          <X className="size-5" />
        </button>
        {fileName ? (
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-white" title={fileName}>
            {fileName}
          </p>
        ) : (
          <span className="flex-1" />
        )}
      </div>
    </div>
  );
}

export default memo(PlayerHeader);
