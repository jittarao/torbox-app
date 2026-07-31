'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import ModalSheet from '@/components/shared/ModalSheet';
import VideoInfoSheetBody from '../VideoInfoSheetBody';

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
      <VideoInfoSheetBody
        metadata={metadata}
        fileName={fileName}
        audios={audios}
        subtitles={subtitles}
      />
    </ModalSheet>
  );
}

export default memo(PlayerInfoSheet);
