'use client';

import VideoInfoHero from './VideoInfoHero';
import VideoInfoSearchMetadata from './VideoInfoSearchMetadata';
import {
  VideoInfoAudioTracks,
  VideoInfoSubtitleTracks,
  VideoInfoTechnicalDetails,
} from './VideoInfoSections';

const EMPTY_ARRAY = [];

export default function VideoInfoContent({
  metadata,
  fileName,
  audios = EMPTY_ARRAY,
  subtitles = EMPTY_ARRAY,
}) {
  const videoInfo = metadata?.video || {};
  const searchMetadata = metadata?.search_metadata;
  const heroTitle = searchMetadata?.title || fileName;
  const technicalFileName = fileName && heroTitle !== fileName ? fileName : null;

  return (
    <div>
      <VideoInfoHero searchMetadata={searchMetadata} fileName={fileName} videoInfo={videoInfo} />
      <VideoInfoSearchMetadata searchMetadata={searchMetadata} />
      <VideoInfoTechnicalDetails fileName={technicalFileName} videoInfo={videoInfo} />
      <VideoInfoAudioTracks audios={audios} />
      <VideoInfoSubtitleTracks subtitles={subtitles} />
    </div>
  );
}
