'use client';

import { useTranslations } from 'next-intl';
import { Cog, Eye } from '@/components/icons';
import { formatSize } from '../../utils/formatters';
import { InfoRow, InfoSection, TrackRow } from './VideoInfoParts';

function AudioIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path d="M2 10v3" />
      <path d="M6 6v11" />
      <path d="M10 3v18" />
      <path d="M14 8v7" />
      <path d="M18 5v13" />
      <path d="M22 10v3" />
    </svg>
  );
}

export function VideoInfoTechnicalDetails({ fileName, videoInfo }) {
  const t = useTranslations('VideoPlayer');

  const hasRows =
    fileName ||
    videoInfo.duration ||
    (videoInfo.width && videoInfo.height) ||
    videoInfo.codec ||
    videoInfo.frame_rate ||
    videoInfo.bitrate ||
    videoInfo.size ||
    videoInfo.pixel_format ||
    videoInfo.total_chunks;

  if (!hasRows) return null;

  const resolution =
    videoInfo.width && videoInfo.height
      ? videoInfo.title_data?.resolution
        ? `${videoInfo.width}×${videoInfo.height} (${videoInfo.title_data.resolution})`
        : `${videoInfo.width}×${videoInfo.height}`
      : null;

  const bitrate = videoInfo.bitrate
    ? t('infoBitrateValue', { kbps: Math.round(parseInt(videoInfo.bitrate, 10) / 1000) })
    : null;

  const frameRate = videoInfo.frame_rate
    ? t('infoFrameRateValue', { rate: videoInfo.frame_rate })
    : null;

  return (
    <InfoSection title={t('infoTechnicalDetails')} icon={Cog} className="mb-5">
      <InfoRow label={t('infoFileName')} value={fileName} />
      <InfoRow label={t('infoDuration')} value={videoInfo.duration} />
      <InfoRow label={t('infoResolution')} value={resolution} />
      <InfoRow
        label={t('infoVideoCodec')}
        value={videoInfo.codec ? videoInfo.codec.toUpperCase() : null}
        mono
      />
      <InfoRow label={t('infoFrameRate')} value={frameRate} />
      <InfoRow label={t('infoBitrate')} value={bitrate} />
      <InfoRow
        label={t('infoFileSize')}
        value={videoInfo.size ? formatSize(videoInfo.size) : null}
      />
      <InfoRow label={t('infoPixelFormat')} value={videoInfo.pixel_format} mono />
      <InfoRow label={t('infoTotalChunks')} value={videoInfo.total_chunks} />
    </InfoSection>
  );
}

export function VideoInfoAudioTracks({ audios }) {
  const t = useTranslations('VideoPlayer');

  if (audios.length === 0) return null;

  return (
    <InfoSection
      title={t('infoSectionAudio', { count: audios.length })}
      icon={AudioIcon}
      className="mb-5"
    >
      {audios.map((audio, idx) => {
        const language = audio.language_full || audio.language || t('infoUnknown');
        const details = [
          audio.codec ? t('infoCodecValue', { codec: audio.codec.toUpperCase() }) : null,
          audio.channels
            ? t('infoChannelsValue', {
                channels: audio.channels,
                layout: audio.channel_layout || t('infoNotAvailable'),
              })
            : null,
          audio.sample_rate ? t('infoSampleRateValue', { rate: audio.sample_rate }) : null,
        ]
          .filter(Boolean)
          .join(' · ');

        return (
          <TrackRow
            key={`${audio.language || ''}-${audio.language_full || ''}-${audio.codec || ''}-${audio.channels || ''}-${idx}`}
            title={t('infoTrack', { number: idx + 1 })}
            meta={`${language}${details ? ` — ${details}` : ''}`}
            badge={audio.default ? t('defaultTrack') : undefined}
          />
        );
      })}
    </InfoSection>
  );
}

export function VideoInfoSubtitleTracks({ subtitles }) {
  const t = useTranslations('VideoPlayer');

  if (subtitles.length === 0) return null;

  return (
    <InfoSection
      title={t('infoSectionSubtitles', { count: subtitles.length })}
      icon={Eye}
      className="mb-5"
    >
      {subtitles.map((subtitle, idx) => (
        <TrackRow
          key={`${subtitle.language || ''}-${subtitle.language_full || ''}-${subtitle.codec || ''}-${idx}`}
          title={t('infoTrack', { number: idx + 1 })}
          meta={subtitle.language_full || subtitle.language || t('infoUnknown')}
        />
      ))}
    </InfoSection>
  );
}
