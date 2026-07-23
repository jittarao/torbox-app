'use client';

import VideoPlayerModalView from './VideoPlayerModalView';
import { useVideoPlayerModal } from './hooks/useVideoPlayerModal';

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

export default function VideoPlayerModal({
  isOpen,
  onClose,
  streamUrl: initialStreamUrl,
  fileName,
  subtitles = EMPTY_ARRAY,
  audios = EMPTY_ARRAY,
  metadata = EMPTY_OBJECT,
  apiKey,
  itemId,
  fileId,
  streamType = 'torrent',
  onStreamUrlChange,
  introInformation = null,
  initialAudioIndex = 0,
  initialSubtitleIndex = null,
}) {
  const viewProps = useVideoPlayerModal({
    isOpen,
    onClose,
    initialStreamUrl,
    audios,
    subtitles,
    metadata,
    apiKey,
    itemId,
    fileId,
    streamType,
    onStreamUrlChange,
    introInformation,
    initialAudioIndex,
    initialSubtitleIndex,
  });

  if (!isOpen) return null;

  return <VideoPlayerModalView {...viewProps} fileName={fileName} onClose={onClose} />;
}
