'use client';

import AudioPlayerView from './AudioPlayerView';
import { useAudioPlayer } from './useAudioPlayer';

export default function AudioPlayer(props) {
  const viewProps = useAudioPlayer(props);
  return (
    <AudioPlayerView
      {...viewProps}
      fileName={props.fileName}
      onClose={props.onClose}
      onRefreshUrl={props.onRefreshUrl}
    />
  );
}
