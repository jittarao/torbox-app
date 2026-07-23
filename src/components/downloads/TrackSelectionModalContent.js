import { Eye, Play, Question } from '@/components/icons';

export default function TrackSelectionModalContent({
  video,
  audios,
  subtitles,
  selectedAudioIndex,
  selectedSubtitleIndex,
  introInformation,
  onSelectAudio,
  onSelectSubtitle,
}) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {video && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark flex items-center gap-2">
            <Play className="size-4" />
            Video Track
          </h3>
          <div className="bg-surface-alt dark:bg-surface-alt-dark rounded-lg p-4 border border-border dark:border-border-dark">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {video.width && video.height && (
                <div>
                  <span className="text-primary-text/60 dark:text-primary-text-dark/60">
                    Resolution:
                  </span>
                  <span className="ml-2 text-primary-text dark:text-primary-text-dark font-medium">
                    {video.width}x{video.height}
                  </span>
                </div>
              )}
              {video.codec && (
                <div>
                  <span className="text-primary-text/60 dark:text-primary-text-dark/60">
                    Codec:
                  </span>
                  <span className="ml-2 text-primary-text dark:text-primary-text-dark font-medium uppercase">
                    {video.codec}
                  </span>
                </div>
              )}
              {video.frame_rate && (
                <div>
                  <span className="text-primary-text/60 dark:text-primary-text-dark/60">
                    Frame Rate:
                  </span>
                  <span className="ml-2 text-primary-text dark:text-primary-text-dark font-medium">
                    {video.frame_rate} fps
                  </span>
                </div>
              )}
              {video.duration && (
                <div>
                  <span className="text-primary-text/60 dark:text-primary-text-dark/60">
                    Duration:
                  </span>
                  <span className="ml-2 text-primary-text dark:text-primary-text-dark font-medium">
                    {video.duration}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {audios.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark flex items-center gap-2">
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
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
                type="button"
                key={`${audio.language || ''}-${audio.language_full || ''}-${audio.codec || ''}-${audio.channels || ''}`}
                onClick={() => onSelectAudio(idx)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedAudioIndex === idx
                    ? 'bg-accent/10 dark:bg-accent-dark/10 border-accent dark:border-accent-dark'
                    : 'bg-surface-alt dark:bg-surface-alt-dark border-border dark:border-border-dark hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`size-4 rounded-full border-2 flex items-center justify-center ${
                        selectedAudioIndex === idx
                          ? 'border-accent dark:border-accent-dark'
                          : 'border-primary-text/30 dark:border-primary-text-dark/30'
                      }`}
                    >
                      {selectedAudioIndex === idx && (
                        <div className="size-2 rounded-full bg-accent dark:bg-accent-dark" />
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
                    {audio.channels && <span className="ml-2">{audio.channels}ch</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {subtitles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark flex items-center gap-2">
            <Eye className="size-4" />
            Subtitle Tracks
          </h3>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onSelectSubtitle(null)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedSubtitleIndex === null
                  ? 'bg-accent/10 dark:bg-accent-dark/10 border-accent dark:border-accent-dark'
                  : 'bg-surface-alt dark:bg-surface-alt-dark border-border dark:border-border-dark hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`size-4 rounded-full border-2 flex items-center justify-center ${
                    selectedSubtitleIndex === null
                      ? 'border-accent dark:border-accent-dark'
                      : 'border-primary-text/30 dark:border-primary-text-dark/30'
                  }`}
                >
                  {selectedSubtitleIndex === null && (
                    <div className="size-2 rounded-full bg-accent dark:bg-accent-dark" />
                  )}
                </div>
                <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
                  Off
                </span>
              </div>
            </button>
            {subtitles.map((subtitle, idx) => (
              <button
                type="button"
                key={`${subtitle.language || ''}-${subtitle.language_full || ''}-${subtitle.codec || ''}`}
                onClick={() => onSelectSubtitle(idx)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedSubtitleIndex === idx
                    ? 'bg-accent/10 dark:bg-accent-dark/10 border-accent dark:border-accent-dark'
                    : 'bg-surface-alt dark:bg-surface-alt-dark border-border dark:border-border-dark hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`size-4 rounded-full border-2 flex items-center justify-center ${
                      selectedSubtitleIndex === idx
                        ? 'border-accent dark:border-accent-dark'
                        : 'border-primary-text/30 dark:border-primary-text-dark/30'
                    }`}
                  >
                    {selectedSubtitleIndex === idx && (
                      <div className="size-2 rounded-full bg-accent dark:bg-accent-dark" />
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

      {introInformation &&
        introInformation.start_time !== undefined &&
        introInformation.end_time !== undefined &&
        introInformation.end_time > 0 && (
          <div className="bg-accent/5 dark:bg-accent-dark/5 rounded-lg p-4 border border-accent/20 dark:border-accent-dark/20">
            <div className="flex items-center gap-2 mb-2">
              <Question className="size-4 text-accent dark:text-accent-dark" />
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
  );
}
