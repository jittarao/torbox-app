'use client';

import { useTranslations } from 'next-intl';
import { QuestionMarkCircle } from '@/components/icons';
import ModalSheetHandle from '@/components/shared/ModalSheetHandle';
import VideoInfoContent from './VideoInfoContent';

const EMPTY_ARRAY = [];

export default function VideoInfoSheetBody({
  metadata,
  fileName,
  audios = EMPTY_ARRAY,
  subtitles = EMPTY_ARRAY,
}) {
  const t = useTranslations('VideoPlayer');

  return (
    <div data-player-sheet className="flex max-h-[min(90dvh,36rem)] flex-col overflow-hidden">
      <ModalSheetHandle />
      <div className="border-b border-white/10 px-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5"
            aria-hidden
          >
            <QuestionMarkCircle className="size-4 text-white/70" />
          </span>
          <h2 className="text-base font-semibold text-white">{t('videoInfo')}</h2>
        </div>
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
  );
}
