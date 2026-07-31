'use client';

import { useTranslations } from 'next-intl';
import { InfoChip, InfoRow, InfoSection } from './VideoInfoParts';

export default function VideoInfoSearchMetadata({ searchMetadata }) {
  const t = useTranslations('VideoPlayer');

  if (!searchMetadata) return null;

  const hasDetailRows =
    searchMetadata.keywords?.length > 0 ||
    searchMetadata.runtime ||
    searchMetadata.mediaType ||
    searchMetadata.languages?.length > 0 ||
    searchMetadata.imdb_id;

  if (!hasDetailRows) return null;

  return (
    <InfoSection title={t('infoMediaDetails')} className="mb-5">
      {searchMetadata.keywords?.length > 0 ? (
        <div className="px-4 py-3">
          <dt className="text-xs text-white/50">{t('infoKeywords')}</dt>
          <dd className="mt-2 flex flex-wrap gap-1.5">
            {searchMetadata.keywords.slice(0, 10).map((keyword) => (
              <InfoChip key={keyword}>{keyword}</InfoChip>
            ))}
          </dd>
        </div>
      ) : null}
      <InfoRow label={t('infoRuntime')} value={searchMetadata.runtime} />
      <InfoRow
        label={t('infoType')}
        value={
          searchMetadata.mediaType
            ? searchMetadata.mediaType.charAt(0).toUpperCase() + searchMetadata.mediaType.slice(1)
            : null
        }
      />
      {searchMetadata.languages?.length > 0 ? (
        <div className="px-4 py-3">
          <dt className="text-xs text-white/50">{t('infoLanguages')}</dt>
          <dd className="mt-2 flex flex-wrap gap-1.5">
            {searchMetadata.languages.map((lang) => (
              <InfoChip key={lang}>{lang}</InfoChip>
            ))}
          </dd>
        </div>
      ) : null}
      <InfoRow label={t('infoImdbId')} value={searchMetadata.imdb_id} mono />
    </InfoSection>
  );
}
