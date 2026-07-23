'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLatestRef } from '@/hooks/useLatestRef';

function SeekFeedback({ side, seconds, onDone }) {
  const t = useTranslations('VideoPlayer');
  const [visible, setVisible] = useState(true);
  const onDoneRef = useLatestRef(onDone);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDoneRef.current?.();
    }, 700);
    return () => clearTimeout(timer);
  }, [side, seconds, onDoneRef]);

  if (!visible) return null;

  const isLeft = side === 'left';
  const label =
    seconds < 0 ? t('seekedBack', { seconds: Math.abs(seconds) }) : t('seekedForward', { seconds });

  return (
    <div
      className={`pointer-events-none absolute inset-y-0 z-20 flex w-2/5 items-center justify-center ${
        isLeft ? 'left-0' : 'right-0'
      }`}
      aria-live="polite"
      role="status"
    >
      <div className="flex size-20 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
        <div className="text-center text-white">
          <svg
            className={`mx-auto size-8 ${isLeft ? 'rotate-180' : ''}`}
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
          </svg>
          <span className="mt-1 block text-xs font-medium">{label}</span>
        </div>
      </div>
    </div>
  );
}

export default memo(SeekFeedback);
