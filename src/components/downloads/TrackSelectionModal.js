'use client';

import { useState, useEffect } from 'react';
import Icons from '@/components/icons';

/**
 * TrackSelectionModal - Modal for selecting video/audio/subtitle tracks before playback
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback to close modal
 * @param {Function} props.onPlay - Callback when play is clicked with selectedStreamData
 * @param {Object} props.metadata - Metadata object with video, audios, subtitles
 * @param {Object} props.introInformation - Intro information object with start_time, end_time, title
 * @param {string} props.fileName - Name of the file
 */
export default function TrackSelectionModal({
  isOpen,
  onClose,
  onPlay,
  metadata = {},
  introInformation = null,
  fileName = 'Video',
}) {
  const [selectedAudioIndex, setSelectedAudioIndex] = useState(0);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(null);

  const video = metadata?.video || {};
  const audios = metadata?.audios || [];
  const subtitles = metadata?.subtitles || [];

  // Set default audio to the first default track, or first track if no default
  useEffect(() => {
    if (audios.length > 0) {
      const defaultAudioIndex = audios.findIndex(audio => audio.default);
      if (defaultAudioIndex !== -1) {
        setSelectedAudioIndex(defaultAudioIndex);
      } else {
        setSelectedAudioIndex(0);
      }
    }
  }, [audios]);

  // Handle play button click
  const handlePlay = () => {
    const selectedStreamData = {
      video_track_idx: 0, // Usually only one video track
      audio_track_idx: selectedAudioIndex,
      subtitle_track_idx: selectedSubtitleIndex,
      intro_info: introInformation,
    };
    onPlay(selectedStreamData);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
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
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border dark:border-border-dark">
          <div className="flex items-center gap-3">
            <Icons.Play className="w-6 h-6 text-accent dark:text-accent-dark" />
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
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Video Track Info */}
          {video && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark flex items-center gap-2">
                <Icons.Play className="w-4 h-4" />
                Video Track
              </h3>
              <div className="bg-surface-alt dark:bg-surface-alt-dark rounded-lg p-4 border border-border dark:border-border-dark">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {video.width && video.height && (
                    <div>
                      <span className="text-primary-text/60 dark:text-primary-text-dark/60">Resolution:</span>
                      <span className="ml-2 text-primary-text dark:text-primary-text-dark font-medium">
                        {video.width}x{video.height}
                      </span>
                    </div>
                  )}
                  {video.codec && (
                    <div>
                      <span className="text-primary-text/60 dark:text-primary-text-dark/60">Codec:</span>
                      <span className="ml-2 text-primary-text dark:text-primary-text-dark font-medium uppercase">
                        {video.codec}
                      </span>
                    </div>
                  )}
                  {video.frame_rate && (
                    <div>
                      <span className="text-primary-text/60 dark:text-primary-text-dark/60">Frame Rate:</span>
                      <span className="ml-2 text-primary-text dark:text-primary-text-dark font-medium">
                        {video.frame_rate} fps
                      </span>
                    </div>
                  )}
                  {video.duration && (
                    <div>
                      <span className="text-primary-text/60 dark:text-primary-text-dark/60">Duration:</span>
                      <span className="ml-2 text-primary-text dark:text-primary-text-dark font-medium">
                        {video.duration}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Audio Tracks */}
          {audios.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M2 10v3" />
                  <path d="M6 6v11" />
                  <path d="M10 3v18" />
                  <path d="M14 8v7" />
                  <path d="M18 5v13" />
                  <path d="M22 10v3" />
                </svg>
                Audio Tracks
              </h3>
              <div className="space-y-2">
                {audios.map((audio, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedAudioIndex(idx)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedAudioIndex === idx
                        ? 'bg-accent/10 dark:bg-accent-dark/10 border-accent dark:border-accent-dark'
                        : 'bg-surface-alt dark:bg-surface-alt-dark border-border dark:border-border-dark hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedAudioIndex === idx
                            ? 'border-accent dark:border-accent-dark'
                            : 'border-primary-text/30 dark:border-primary-text-dark/30'
                        }`}>
                          {selectedAudioIndex === idx && (
                            <div className="w-2 h-2 rounded-full bg-accent dark:bg-accent-dark" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
                          {audio.language_full || audio.language || `Track ${idx + 1}`}
                        </span>
                        {audio.default && (
                          <span className="px-2 py-0.5 rounded text-xs bg-accent/20 dark:bg-accent-dark/20 text-accent dark:text-accent-dark border border-accent/30 dark:border-accent-dark/30">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-primary-text/60 dark:text-primary-text-dark/60">
                        {audio.codec && <span className="uppercase">{audio.codec}</span>}
                        {audio.channels && (
                          <span className="ml-2">{audio.channels}ch</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subtitle Tracks */}
          {subtitles.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark flex items-center gap-2">
                <Icons.Eye className="w-4 h-4" />
                Subtitle Tracks
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedSubtitleIndex(null)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedSubtitleIndex === null
                      ? 'bg-accent/10 dark:bg-accent-dark/10 border-accent dark:border-accent-dark'
                      : 'bg-surface-alt dark:bg-surface-alt-dark border-border dark:border-border-dark hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedSubtitleIndex === null
                        ? 'border-accent dark:border-accent-dark'
                        : 'border-primary-text/30 dark:border-primary-text-dark/30'
                    }`}>
                      {selectedSubtitleIndex === null && (
                        <div className="w-2 h-2 rounded-full bg-accent dark:bg-accent-dark" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
                      Off
                    </span>
                  </div>
                </button>
                {subtitles.map((subtitle, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSubtitleIndex(idx)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedSubtitleIndex === idx
                        ? 'bg-accent/10 dark:bg-accent-dark/10 border-accent dark:border-accent-dark'
                        : 'bg-surface-alt dark:bg-surface-alt-dark border-border dark:border-border-dark hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedSubtitleIndex === idx
                          ? 'border-accent dark:border-accent-dark'
                          : 'border-primary-text/30 dark:border-primary-text-dark/30'
                      }`}>
                        {selectedSubtitleIndex === idx && (
                          <div className="w-2 h-2 rounded-full bg-accent dark:bg-accent-dark" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
                        {subtitle.language_full || subtitle.language || `Track ${idx + 1}`}
                      </span>
                      {subtitle.codec && (
                        <span className="px-2 py-0.5 rounded text-xs bg-surface dark:bg-surface-dark text-primary-text/60 dark:text-primary-text-dark/60 border border-border dark:border-border-dark font-mono">
                          {subtitle.codec.toUpperCase()}
                        </span>
                      )}
                      {subtitle.default && (
                        <span className="px-2 py-0.5 rounded text-xs bg-accent/20 dark:bg-accent-dark/20 text-accent dark:text-accent-dark border border-accent/30 dark:border-accent-dark/30">
                          Default
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Intro Information */}
          {introInformation && 
           introInformation.start_time !== undefined && 
           introInformation.end_time !== undefined && 
           introInformation.end_time > 0 && (
            <div className="bg-accent/5 dark:bg-accent-dark/5 rounded-lg p-4 border border-accent/20 dark:border-accent-dark/20">
              <div className="flex items-center gap-2 mb-2">
                <Icons.Question className="w-4 h-4 text-accent dark:text-accent-dark" />
                <span className="text-sm font-semibold text-primary-text dark:text-primary-text-dark">
                  Intro Detected
                </span>
              </div>
              {introInformation.title && (
                <p className="text-sm text-primary-text/80 dark:text-primary-text-dark/80 mb-1">
                  {introInformation.title}
                </p>
              )}
              <p className="text-xs text-primary-text/60 dark:text-primary-text-dark/60">
                You can skip the intro during playback
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
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
            <Icons.Play className="w-4 h-4" />
            Play
          </button>
        </div>
      </div>
    </>
  );
}
