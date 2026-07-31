'use client';

import { useTranslations } from 'next-intl';
import ModalSheet from '@/components/shared/ModalSheet';
import VideoInfoSheetBody from './VideoInfoSheetBody';

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

  return (
    <ModalSheet
      open={isOpen}
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
