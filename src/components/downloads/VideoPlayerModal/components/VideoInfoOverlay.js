'use client';

import { useTranslations } from 'next-intl';
import { Question, X } from '@/components/icons';
import VideoInfoContent from './VideoInfoContent';

const EMPTY_ARRAY = [];

export default function VideoInfoOverlay({
  isOpen,
  onClose,
  metadata,
  fileName,
  audios = EMPTY_ARRAY,
  subtitles = EMPTY_ARRAY,
}) {
  const t = useTranslations('VideoPlayer');

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('videoInfo')}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className="bg-black/90 backdrop-blur-md rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative border border-white/20 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            <Question className="size-6 text-accent dark:text-accent-dark" />
            {t('videoInfo')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors min-h-11 min-w-11"
            aria-label={t('close')}
          >
            <X className="size-5" />
          </button>
        </div>

        <VideoInfoContent
          metadata={metadata}
          fileName={fileName}
          audios={audios}
          subtitles={subtitles}
        />
      </div>
    </div>
  );
}
