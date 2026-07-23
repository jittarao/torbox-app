'use client';

import { useState } from 'react';
import { Play, X } from '@/components/icons';
import TrackSelectionModalContent from './TrackSelectionModalContent';

const EMPTY_OBJECT = {};

/**
 * TrackSelectionModal - Modal for selecting video/audio/subtitle tracks before playback
 */
export default function TrackSelectionModal({
  isOpen,
  onClose,
  onPlay,
  metadata = EMPTY_OBJECT,
  introInformation = null,
  fileName = 'Video',
}) {
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(null);

  const video = metadata?.video || {};
  const audios = metadata?.audios || [];
  const subtitles = metadata?.subtitles || [];

  const defaultAudioIndex =
    audios.length === 0
      ? 0
      : (() => {
          const index = audios.findIndex((audio) => audio.default);
          return index !== -1 ? index : 0;
        })();

  const [prevAudios, setPrevAudios] = useState(audios);
  const [audioOverrideIndex, setAudioOverrideIndex] = useState(null);

  if (audios !== prevAudios) {
    setPrevAudios(audios);
    setAudioOverrideIndex(null);
  }

  const resolvedAudioIndex = audioOverrideIndex ?? defaultAudioIndex;

  const handleAudioIndexChange = (index) => {
    setAudioOverrideIndex(index);
  };

  const handlePlay = () => {
    const selectedStreamData = {
      video_track_idx: 0,
      audio_track_idx: resolvedAudioIndex,
      subtitle_track_idx: selectedSubtitleIndex,
      intro_info: introInformation,
    };
    onPlay(selectedStreamData);
  };

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 bg-black/50 z-40 cursor-default"
        onClick={onClose}
        aria-label="Close"
      />

      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
          bg-surface dark:bg-surface-dark
          border border-border dark:border-border-dark
          rounded-lg shadow-xl
          w-[calc(100vw-2rem)] sm:w-full max-w-2xl
          max-h-[90vh]
          overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border dark:border-border-dark">
          <div className="flex items-center gap-3">
            <Play className="size-6 text-accent dark:text-accent-dark" />
            <div>
              <h2 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
                Select Tracks
              </h2>
              {fileName && (
                <p className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 truncate max-w-md">
                  {fileName}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-alt dark:hover:bg-surface-alt-dark
              text-primary-text dark:text-primary-text-dark
              transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <TrackSelectionModalContent
          video={video}
          audios={audios}
          subtitles={subtitles}
          selectedAudioIndex={resolvedAudioIndex}
          selectedSubtitleIndex={selectedSubtitleIndex}
          introInformation={introInformation}
          onSelectAudio={handleAudioIndexChange}
          onSelectSubtitle={setSelectedSubtitleIndex}
        />

        <div className="flex items-center justify-end gap-3 p-4 border-t border-border dark:border-border-dark">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-alt dark:bg-surface-alt-dark
              hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark
              text-primary-text dark:text-primary-text-dark
              transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePlay}
            className="px-4 py-2 rounded-lg bg-accent dark:bg-accent-dark
              hover:bg-accent/90 dark:hover:bg-accent-dark/90
              text-white
              transition-colors font-medium flex items-center gap-2"
          >
            <Play className="size-4" />
            Play
          </button>
        </div>
      </div>
    </>
  );
}
