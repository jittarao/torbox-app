'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Play } from '@/components/icons';
import { InfoChip } from './VideoInfoParts';

function buildHeroChips(videoInfo, searchMetadata, t) {
  const chips = [];

  if (videoInfo.width && videoInfo.height) {
    const resolutionLabel = videoInfo.title_data?.resolution
      ? `${videoInfo.width}×${videoInfo.height} (${videoInfo.title_data.resolution})`
      : `${videoInfo.width}×${videoInfo.height}`;
    chips.push({ key: 'resolution', label: resolutionLabel });
  }

  if (videoInfo.duration) {
    chips.push({ key: 'duration', label: videoInfo.duration });
  }

  if (videoInfo.codec) {
    chips.push({ key: 'codec', label: videoInfo.codec.toUpperCase() });
  }

  if (videoInfo.bitrate) {
    const kbps = Math.round(parseInt(videoInfo.bitrate, 10) / 1000);
    chips.push({ key: 'bitrate', label: t('infoBitrateValue', { kbps }) });
  }

  if (searchMetadata?.rating) {
    chips.push({ key: 'rating', label: `★ ${searchMetadata.rating}/10`, accent: true });
  }

  if (searchMetadata?.releaseYears) {
    chips.push({ key: 'year', label: searchMetadata.releaseYears });
  }

  if (searchMetadata?.contentRating) {
    chips.push({ key: 'contentRating', label: searchMetadata.contentRating });
  }

  return chips;
}

export default function VideoInfoHero({ searchMetadata, fileName, videoInfo }) {
  const t = useTranslations('VideoPlayer');

  const title = searchMetadata?.title || fileName;
  const chips = useMemo(
    () => buildHeroChips(videoInfo, searchMetadata, t),
    [videoInfo, searchMetadata, t]
  );

  if (!title && chips.length === 0) return null;

  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02]">
      <div className="p-4">
        {title ? (
          <div className="flex items-start gap-3">
            {searchMetadata?.title ? (
              <span
                className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 dark:border-accent-dark/25 dark:bg-accent-dark/10"
                aria-hidden
              >
                <Play className="size-4 text-accent dark:text-accent-dark" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold leading-snug text-white">{title}</p>
              {searchMetadata?.description ? (
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/65">
                  {searchMetadata.description}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {chips.length > 0 ? (
          <div className={`flex flex-wrap gap-2 ${title ? 'mt-4' : ''}`}>
            {chips.map((chip) => (
              <InfoChip key={chip.key} accent={chip.accent}>
                {chip.label}
              </InfoChip>
            ))}
          </div>
        ) : null}

        {searchMetadata?.genres?.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {searchMetadata.genres.map((genre) => (
              <InfoChip key={genre} accent>
                {genre}
              </InfoChip>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
