'use client';

import { formatTime } from '../../utils/formatters';
import ProgressBar from './ProgressBar';
import VolumeControl from './VolumeControl';
import TrackSelector from './TrackSelector';

const EMPTY_ARRAY = [];

/**
 * VideoControls - Main controls bar with all player controls
 * @param {Object} props
 * @param {number} props.currentTime - Current playback time in seconds
 * @param {number} props.duration - Total duration in seconds
 * @param {number} props.progress - Progress percentage (0-100)
 * @param {boolean} props.isPlaying - Whether video is playing
 * @param {boolean} props.isSeeking - Whether user is seeking
 * @param {number} props.volume - Current volume (0-1)
 * @param {boolean} props.isMuted - Whether volume is muted
 * @param {boolean} props.showVolumeSlider - Whether volume slider is visible
 * @param {Array} props.audios - Array of audio tracks
 * @param {Array} props.subtitles - Array of subtitle tracks
 * @param {number} props.selectedAudioIndex - Selected audio track index
 * @param {number|null} props.selectedSubtitleIndex - Selected subtitle track index (null for off)
 * @param {boolean} props.showAudioMenu - Whether audio menu is open
 * @param {boolean} props.showSubtitleMenu - Whether subtitle menu is open
 * @param {Function} props.onPlayPause - Callback for play/pause
 * @param {Function} props.onRewind - Callback for rewind 30s
 * @param {Function} props.onForward - Callback for forward 30s
 * @param {Function} props.onSeek - Callback when seeking
 * @param {Function} props.onSeekStart - Callback when seeking starts
 * @param {Function} props.onVolumeChange - Callback when volume changes
 * @param {Function} props.onMuteToggle - Callback when mute is toggled
 * @param {Function} props.onVolumeSliderShow - Callback to show volume slider
 * @param {Function} props.onVolumeSliderHide - Callback to hide volume slider
 * @param {Function} props.onAudioSelect - Callback when audio track is selected
 * @param {Function} props.onSubtitleSelect - Callback when subtitle track is selected
 * @param {Function} props.onAudioMenuToggle - Callback to toggle audio menu
 * @param {Function} props.onSubtitleMenuToggle - Callback to toggle subtitle menu
 * @param {Function} props.onInfoToggle - Callback to toggle info overlay
 * @param {Function} props.onFullscreen - Callback for fullscreen toggle
 * @param {boolean} props.isFullscreen - Whether in fullscreen mode
 * @param {Object} props.audioMenuRef - Ref for audio menu
 * @param {Object} props.subtitleMenuRef - Ref for subtitle menu
 * @param {number} props.playbackSpeed - Current playback speed
 * @param {boolean} props.showPlaybackSpeedMenu - Whether playback speed menu is open
 * @param {Function} props.onPlaybackSpeedChange - Callback when playback speed changes
 * @param {Function} props.onPlaybackSpeedMenuToggle - Callback to toggle playback speed menu
 * @param {Object} props.playbackSpeedMenuRef - Ref for playback speed menu
 * @param {Object} props.controlsBarRef - Ref for the controls bar (bottom section with buttons)
 */
export default function VideoControls({
  currentTime,
  duration,
  progress,
  isPlaying,
  isSeeking,
  volume,
  isMuted,
  showVolumeSlider,
  audios = EMPTY_ARRAY,
  subtitles = EMPTY_ARRAY,
  selectedAudioIndex,
  selectedSubtitleIndex,
  showAudioMenu,
  showSubtitleMenu,
  playbackSpeed = 1.0,
  showPlaybackSpeedMenu = false,
  onPlaybackSpeedChange,
  onPlaybackSpeedMenuToggle,
  onPlayPause,
  onRewind,
  onForward,
  onSeek,
  onSeekStart,
  onVolumeChange,
  onMuteToggle,
  onVolumeSliderShow,
  onVolumeSliderHide,
  onAudioSelect,
  onSubtitleSelect,
  onAudioMenuToggle,
  onSubtitleMenuToggle,
  onInfoToggle,
  onFullscreen,
  isFullscreen,
  audioMenuRef,
  subtitleMenuRef,
  playbackSpeedMenuRef,
  controlsBarRef,
}) {
  const displayTime = isSeeking && currentTime !== null ? currentTime : currentTime;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none" role="presentation">
      {/* Gradient scoped to the bottom controls area only — not the full video */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-36
          bg-gradient-to-t from-black/80 via-black/40 to-transparent"
        aria-hidden="true"
      />
      {/* Progress Bar and Controls Bar Container - for hover detection */}
      <div ref={controlsBarRef} className="relative pointer-events-auto">
        {/* Progress Bar */}
        <ProgressBar
          progress={progress}
          isSeeking={isSeeking}
          onSeek={onSeek}
          onSeekStart={onSeekStart}
        />

        {/* Controls Bar */}
        <div className="px-4 sm:px-6 py-4 flex items-center gap-2 sm:gap-4">
          {/* Rewind 30s Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRewind();
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 
            backdrop-blur-sm text-white transition-all duration-200
            hover:scale-110 active:scale-95"
            aria-label="Rewind 30 seconds"
            title="Rewind 30s (Left Arrow)"
          >
            <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 22c-1.25 0 -2.42 -0.23 -3.51 -0.7 -1.09 -0.47 -2.05 -1.11 -2.86 -1.93 -0.82 -0.82 -1.46 -1.77 -1.93 -2.86C3.23 15.42 3 14.25 3 13h1.5c0 2.08 0.73 3.85 2.18 5.31C8.14 19.77 9.91 20.5 12 20.5s3.86 -0.73 5.32 -2.18C18.77 16.86 19.5 15.09 19.5 13s-0.71 -3.86 -2.13 -5.32C15.96 6.23 14.21 5.5 12.13 5.5h-0.55l1.82 1.82 -1.05 1.05 -3.67 -3.68 3.67 -3.67 1.02 1.02 -1.95 1.95H12c1.25 0 2.42 0.23 3.51 0.7 1.09 0.47 2.05 1.11 2.86 1.93 0.82 0.82 1.46 1.77 1.93 2.86C20.77 10.58 21 11.75 21 13s-0.23 2.42 -0.7 3.51c-0.47 1.09 -1.11 2.05 -1.93 2.86 -0.82 0.82 -1.77 1.46 -2.86 1.93C14.42 21.77 13.25 22 12 22Zm-4.97 -5.75V15h3.02v-1.4H8v-1.23h2.05V10.95h-3.02v-1.23h4.28V16.25h-4.28Zm5.7 0V9.72H17V16.25h-4.28Zm1.25 -1.25h1.77v-4.05h-1.77V15Z" />
            </svg>
          </button>

          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlayPause();
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 
            backdrop-blur-sm text-white transition-all duration-200
            hover:scale-110 active:scale-95"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg className="size-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="size-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Forward 30s Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onForward();
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 
            backdrop-blur-sm text-white transition-all duration-200
            hover:scale-110 active:scale-95"
            aria-label="Forward 30 seconds"
            title="Forward 30s (Right Arrow)"
          >
            <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7.03 16.25V15h3.02v-1.4H8v-1.23h2.05V10.95h-3.02v-1.23h4.28V16.25h-4.28Zm5.7 0V9.72H17V16.25h-4.28Zm1.25 -1.25h1.77v-4.05h-1.77V15ZM12 22c-1.25 0 -2.42 -0.23 -3.51 -0.7 -1.09 -0.47 -2.05 -1.11 -2.86 -1.93 -0.82 -0.82 -1.46 -1.77 -1.93 -2.86C3.23 15.42 3 14.25 3 13s0.23 -2.42 0.7 -3.51c0.47 -1.09 1.11 -2.05 1.93 -2.86 0.82 -0.82 1.77 -1.46 2.86 -1.92 1.09 -0.47 2.26 -0.7 3.51 -0.7h0.53l-1.95 -1.95 1.02 -1.02 3.67 3.67L11.6 8.38l-1.02 -1.02 1.85 -1.85H12c-2.09 0 -3.86 0.73 -5.32 2.18C5.23 9.14 4.5 10.91 4.5 13c0 2.09 0.73 3.86 2.18 5.32C8.14 19.77 9.91 20.5 12 20.5s3.86 -0.73 5.32 -2.18C18.77 16.86 19.5 15.09 19.5 13h1.5c0 1.25 -0.23 2.42 -0.7 3.51 -0.47 1.09 -1.11 2.05 -1.93 2.86 -0.82 0.82 -1.77 1.46 -2.86 1.93C14.42 21.77 13.25 22 12 22Z" />
            </svg>
          </button>

          {/* Time Display */}
          <div className="flex items-center gap-2 text-white text-sm font-mono">
            <span>{formatTime(displayTime)}</span>
            <span className="text-white/60">/</span>
            <span className="text-white/80">{formatTime(duration)}</span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Audio Track Selector */}
          <TrackSelector
            type="audio"
            tracks={audios}
            selectedIndex={selectedAudioIndex}
            isOpen={showAudioMenu}
            onSelect={onAudioSelect}
            onToggle={(e) => {
              if (e) e.stopPropagation();
              onAudioMenuToggle();
              onSubtitleMenuToggle(false);
              onPlaybackSpeedMenuToggle(false);
              onVolumeSliderHide();
            }}
            menuRef={audioMenuRef}
          />

          {/* Subtitle Track Selector */}
          <TrackSelector
            type="subtitle"
            tracks={subtitles}
            selectedIndex={selectedSubtitleIndex}
            isOpen={showSubtitleMenu}
            onSelect={onSubtitleSelect}
            onToggle={(e) => {
              if (e) e.stopPropagation();
              onSubtitleMenuToggle();
              onAudioMenuToggle(false);
              onPlaybackSpeedMenuToggle(false);
              onVolumeSliderHide();
            }}
            menuRef={subtitleMenuRef}
          />

          {/* Playback Speed Selector */}
          <div className="relative" ref={playbackSpeedMenuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlaybackSpeedMenuToggle();
                onAudioMenuToggle(false);
                onSubtitleMenuToggle(false);
                onVolumeSliderHide();
              }}
              className="relative p-2 rounded-full bg-white/10 hover:bg-white/20 
              backdrop-blur-sm text-white transition-all duration-200
              hover:scale-110 active:scale-95"
              aria-label="Playback Speed"
              title={`Playback Speed: ${playbackSpeed}x`}
            >
              <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10.18 15.88c0.38 0.38 0.94 0.56 1.66 0.54 0.72 -0.03 1.25 -0.30 1.59 -0.81l5.4 -8.47L10.45 12.6c-0.5 0.33 -0.77 0.87 -0.8 1.6 -0.03 0.73 0.14 1.29 0.53 1.68ZM11.95 4.03c0.95 0 1.94 0.15 2.98 0.46S16.95 5.33 17.9 6.08L16.6 7c-0.75 -0.5 -1.55 -0.87 -2.41 -1.11 -0.86 -0.24 -1.60 -0.36 -2.24 -0.36 -2.34 0 -4.33 0.84 -5.98 2.51C4.32 9.70 3.5 11.72 3.5 14.10c0 0.75 0.10 1.51 0.31 2.28C4.02 17.14 4.32 17.85 4.7 18.5h14.47c0.37 -0.6 0.66 -1.3 0.88 -2.1s0.33 -1.58 0.33 -2.35c0 -0.7 -0.10 -1.45 -0.31 -2.26 -0.21 -0.81 -0.58 -1.55 -1.11 -2.24l0.97 -1.3c0.63 0.93 1.11 1.87 1.43 2.81 0.32 0.94 0.49 1.89 0.53 2.84 0.03 1 -0.07 1.94 -0.3 2.83 -0.23 0.88 -0.57 1.7 -1.02 2.45 -0.2 0.38 -0.41 0.62 -0.64 0.7 -0.23 0.08 -0.50 0.13 -0.84 0.13H4.8c-0.28 0 -0.56 -0.07 -0.84 -0.21 -0.28 -0.14 -0.48 -0.35 -0.61 -0.61 -0.43 -0.8 -0.77 -1.61 -1 -2.44 -0.23 -0.82 -0.35 -1.70 -0.35 -2.64 0 -1.38 0.26 -2.69 0.79 -3.91 0.53 -1.23 1.24 -2.29 2.14 -3.2 0.9 -0.91 1.96 -1.63 3.17 -2.16 1.21 -0.53 2.50 -0.8 3.86 -0.8Z" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 text-[10px] font-bold leading-none bg-accent/80 rounded-full px-1 py-0.5 min-w-[1.25rem] text-center">
                {playbackSpeed}x
              </span>
            </button>
            {showPlaybackSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-black/90 backdrop-blur-md rounded-lg border border-white/20 overflow-hidden">
                <div className="p-2 text-xs text-white/70 px-3 py-2 border-b border-white/10">
                  Playback Speed
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((speed) => (
                    <button
                      type="button"
                      key={speed}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlaybackSpeedChange && onPlaybackSpeedChange(speed);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors ${
                        playbackSpeed === speed ? 'bg-accent/20' : ''
                      }`}
                    >
                      {speed}x {speed === 1.0 ? '(Normal)' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Volume Control */}
          <VolumeControl
            volume={volume}
            isMuted={isMuted}
            showSlider={showVolumeSlider}
            onVolumeChange={onVolumeChange}
            onMuteToggle={onMuteToggle}
            onSliderShow={() => {
              onVolumeSliderShow();
              onAudioMenuToggle(false);
              onSubtitleMenuToggle(false);
              onPlaybackSpeedMenuToggle(false);
            }}
            onSliderHide={onVolumeSliderHide}
          />

          {/* Info Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInfoToggle();
              onAudioMenuToggle(false);
              onSubtitleMenuToggle(false);
              onPlaybackSpeedMenuToggle(false);
              onVolumeSliderHide();
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 
            backdrop-blur-sm text-white transition-all duration-200
            hover:scale-110 active:scale-95"
            aria-label="Info"
          >
            <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.32 17h1.5V11h-1.5v6Zm0.67 -7.85c0.23 0 0.43 -0.08 0.59 -0.23 0.16 -0.15 0.24 -0.34 0.24 -0.57 0 -0.24 -0.08 -0.44 -0.24 -0.61 -0.16 -0.16 -0.35 -0.24 -0.59 -0.24 -0.23 0 -0.43 0.08 -0.59 0.24 -0.16 0.16 -0.24 0.36 -0.24 0.61 0 0.23 0.08 0.42 0.24 0.57 0.16 0.15 0.35 0.23 0.59 0.23Zm0.01 12.85c-1.38 0 -2.67 -0.26 -3.89 -0.79 -1.21 -0.53 -2.27 -1.24 -3.18 -2.15 -0.91 -0.91 -1.63 -1.97 -2.15 -3.18C2.26 14.66 2 13.37 2 11.99s0.26 -2.68 0.79 -3.89c0.53 -1.21 1.24 -2.27 2.15 -3.17 0.91 -0.9 1.97 -1.61 3.18 -2.14C9.34 2.26 10.63 2 12.01 2s2.68 0.26 3.89 0.79c1.21 0.53 2.27 1.24 3.17 2.14 0.9 0.9 1.61 1.96 2.14 3.17C21.74 9.32 22 10.61 22 11.99c0 1.38 -0.26 2.67 -0.79 3.89 -0.53 1.21 -1.24 2.27 -2.14 3.18 -0.9 0.91 -1.96 1.62 -3.17 2.15C14.68 21.74 13.39 22 12.01 22Zm0.01 -1.5c2.36 0 4.36 -0.83 6.01 -2.49 1.65 -1.66 2.48 -3.67 2.48 -6.03s-0.82 -4.36 -2.47 -6.01C16.38 4.33 14.37 3.5 12 3.5c-2.35 0 -4.35 0.82 -6.01 2.47C4.33 7.62 3.5 9.63 3.5 12c0 2.35 0.83 4.35 2.49 6.01C7.65 19.67 9.65 20.5 12.01 20.5Z" />
            </svg>
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFullscreen();
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 
            backdrop-blur-sm text-white transition-all duration-200
            hover:scale-110 active:scale-95"
            aria-label="Fullscreen"
          >
            {isFullscreen ? (
              <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
            ) : (
              <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
