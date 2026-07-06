'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import ModalSheet from '@/components/shared/ModalSheet';
import ModalSheetHandle from '@/components/shared/ModalSheetHandle';
import VideoInfoContent from '../VideoInfoContent';

function PlayerInfoSheet({ open, onClose, metadata, fileName, audios, subtitles }) {
  const t = useTranslations('VideoPlayer');

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      closeLabel={t('close')}
      wide
      dock
      overlayClassName="z-[60]"
      className="!z-[61] border-white/10 bg-neutral-900 text-white dark:bg-neutral-950"
      aria-label={t('videoInfo')}
    >
      <div data-player-sheet className="flex max-h-[min(90dvh,36rem)] flex-col overflow-hidden">
        <ModalSheetHandle />
        <div className="border-b border-white/10 px-4 pb-3">
          <h2 className="text-base font-semibold text-white">{t('videoInfo')}</h2>
        </div>
        <div className="ui-scrollbar flex-1 overflow-y-auto px-4 py-4 pb-[env(safe-area-inset-bottom,0px)]">
          <VideoInfoContent
            metadata={metadata}
            fileName={fileName}
            audios={audios}
            subtitles={subtitles}
          />
        </div>
      </div>
    </ModalSheet>
  );
}

export default memo(PlayerInfoSheet);
