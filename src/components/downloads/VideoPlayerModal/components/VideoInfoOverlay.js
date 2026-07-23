'use client';

import { useEffect, useRef } from 'react';
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
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return undefined;
    }

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }

    return undefined;
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label={t('videoInfo')}
      className="m-0 box-border flex max-h-none max-w-none items-center justify-center border-0 bg-black/90 p-4 backdrop-blur-sm open:flex open:absolute open:inset-0 open:z-30"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="bg-black/90 backdrop-blur-md rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative border border-white/20 shadow-2xl">
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
    </dialog>
  );
}
