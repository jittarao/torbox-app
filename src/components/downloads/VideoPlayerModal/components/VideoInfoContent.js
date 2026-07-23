'use client';

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

  return (
    <div className="space-y-6">
      <VideoInfoSearchMetadata searchMetadata={metadata?.search_metadata} />
      <VideoInfoTechnicalDetails fileName={fileName} videoInfo={videoInfo} />
      <VideoInfoAudioTracks audios={audios} />
      <VideoInfoSubtitleTracks subtitles={subtitles} />
    </div>
  );
}
