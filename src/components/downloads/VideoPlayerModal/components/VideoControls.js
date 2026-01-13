'use client';

import { formatTime } from '../../utils/formatters';
import ProgressBar from './ProgressBar';
import VolumeControl from './VolumeControl';
import TrackSelector from './TrackSelector';

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
 * @param {Function} props.onOverlayClick - Callback when overlay is clicked
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
  audios = [],
  subtitles = [],
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
  onOverlayClick,
}) {
  const displayTime = isSeeking && currentTime !== null ? currentTime : currentTime;

  return (
    <div 
      className="absolute inset-0 z-20 flex flex-col justify-end
        bg-gradient-to-t from-black/80 via-black/40 to-transparent
        transition-opacity duration-300 pointer-events-none"
      onClick={(e) => {
        // Only handle clicks on the overlay itself (not on child elements)
        if (e.target === e.currentTarget && onOverlayClick) {
          onOverlayClick(e);
        }
      }}
    >
      {/* Progress Bar and Controls Bar Container - for hover detection */}
      <div ref={controlsBarRef} className="pointer-events-auto">
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
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 22c-1.25 0 -2.42085 -0.23335 -3.5125 -0.7 -1.09165 -0.46665 -2.04585 -1.10835 -2.8625 -1.925 -0.816665 -0.81665 -1.458335 -1.77085 -1.925 -2.8625C3.233335 15.42085 3 14.25 3 13h1.5c0 2.08335 0.72765 3.85415 2.183 5.3125C8.13835 19.77085 9.91065 20.5 12 20.5s3.86165 -0.72765 5.317 -2.183C18.77235 16.86165 19.5 15.08935 19.5 13s-0.70835 -3.86165 -2.125 -5.317C15.95835 6.22765 14.20835 5.5 12.125 5.5h-0.55l1.825 1.825 -1.05 1.05 -3.675 -3.675005 3.675 -3.675 1.025 1.025 -1.95 1.95H12c1.25 0 2.42085 0.23333 3.5125 0.7 1.09165 0.466655 2.04585 1.108355 2.8625 1.925005 0.81665 0.81665 1.45835 1.77085 1.925 2.8625C20.76665 10.57915 21 11.75 21 13s-0.23335 2.42085 -0.7 3.5125c-0.46665 1.09165 -1.10835 2.04585 -1.925 2.8625 -0.81665 0.81665 -1.77085 1.45835 -2.8625 1.925C14.42085 21.76665 13.25 22 12 22Zm-4.975 -5.75V15h3.025v-1.4H8v-1.225h2.05V10.95h-3.025v-1.225h4.275V16.25h-4.275Zm5.7 0V9.725H17V16.25h-4.275Zm1.25 -1.25h1.775v-4.05h-1.775V15Z" />
          </svg>
        </button>

        {/* Play/Pause Button */}
        <button
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
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Forward 30s Button */}
        <button
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
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7.025 16.25V15h3.025v-1.4H8v-1.225h2.05V10.95h-3.025v-1.225h4.275V16.25h-4.275Zm5.7 0V9.725H17V16.25h-4.275Zm1.25 -1.25h1.775v-4.05h-1.775V15ZM12 22c-1.25 0 -2.42085 -0.2333 -3.5125 -0.7 -1.09165 -0.46665 -2.04585 -1.1083 -2.8625 -1.925 -0.816665 -0.81665 -1.458335 -1.7708 -1.925 -2.8625C3.233335 15.42085 3 14.25 3 13s0.233335 -2.4208 0.7 -3.5125c0.466665 -1.09165 1.108335 -2.0458 1.925 -2.8625 0.81665 -0.81665 1.77085 -1.4583 2.8625 -1.924975 1.09165 -0.466665 2.2625 -0.7 3.5125 -0.7h0.525l-1.95 -1.95 1.025 -1.025 3.675 3.675L11.6 8.375l-1.025 -1.025 1.85 -1.85H12c-2.08935 0 -3.86165 0.7277 -5.317 2.183C5.22765 9.13835 4.5 10.9107 4.5 13c0 2.08935 0.72765 3.8617 2.183 5.317C8.13835 19.77235 9.91065 20.5 12 20.5s3.86165 -0.72765 5.317 -2.183C18.77235 16.8617 19.5 15.08935 19.5 13h1.5c0 1.25 -0.23335 2.42085 -0.7 3.5125 -0.46665 1.0917 -1.10835 2.04585 -1.925 2.8625 -0.81665 0.8167 -1.77085 1.45835 -2.8625 1.925C14.42085 21.7667 13.25 22 12 22Z" />
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
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10.175 15.875c0.38335 0.38335 0.9375 0.5625 1.6625 0.5375 0.725 -0.025 1.25415 -0.2958 1.5875 -0.8125l5.4 -8.475L10.45 12.6c-0.5 0.33335 -0.76665 0.8667 -0.8 1.6 -0.03335 0.73335 0.14165 1.2917 0.525 1.675ZM11.95 4.025025c0.95 0 1.94165 0.154165 2.975 0.4625S16.95 5.325 17.9 6.075L16.6 7c-0.75 -0.5 -1.55415 -0.8708 -2.4125 -1.1125 -0.85835 -0.24165 -1.60435 -0.3625 -2.238 -0.3625 -2.34115 0 -4.33475 0.8352 -5.98075 2.5055C4.322915 9.7007 3.5 11.7237 3.5 14.0995c0 0.75035 0.104165 1.50885 0.3125 2.2755C4.020835 17.1417 4.316665 17.85 4.7 18.5h14.475c0.36665 -0.6 0.65835 -1.3 0.875 -2.1s0.325 -1.5833 0.325 -2.35c0 -0.7 -0.10415 -1.45415 -0.3125 -2.2625 -0.20835 -0.8083 -0.57915 -1.55415 -1.1125 -2.2375l0.975 -1.3c0.63335 0.93335 1.10835 1.87085 1.425 2.8125 0.31665 0.9417 0.49165 1.8875 0.525 2.8375 0.03335 1 -0.06665 1.9417 -0.3 2.825 -0.23335 0.88335 -0.575 1.7 -1.025 2.45 -0.2 0.38335 -0.4125 0.6167 -0.6375 0.7 -0.225 0.08335 -0.50415 0.125 -0.8375 0.125H4.8c-0.283335 0 -0.5625 -0.0708 -0.8375 -0.2125 -0.275 -0.14165 -0.479165 -0.3458 -0.6125 -0.6125 -0.433335 -0.8 -0.766665 -1.6125 -1 -2.4375 -0.233335 -0.825 -0.35 -1.70415 -0.35 -2.6375 0 -1.3833 0.2625 -2.6875 0.7875 -3.9125 0.525 -1.225 1.2375 -2.29165 2.1375 -3.2 0.9 -0.9083 1.95565 -1.62915 3.167 -2.162475 1.21135 -0.533335 2.49735 -0.8 3.858 -0.8Z" />
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
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.325 17h1.5V11h-1.5v6Zm0.6745 -7.85c0.23365 0 0.42965 -0.07665 0.588 -0.23 0.15835 -0.15335 0.2375 -0.34335 0.2375 -0.57 0 -0.24085 -0.079 -0.44265 -0.237 -0.6055 -0.158 -0.163 -0.35385 -0.2445 -0.5875 -0.2445 -0.23365 0 -0.42965 0.0815 -0.588 0.2445 -0.15835 0.16285 -0.2375 0.36465 -0.2375 0.6055 0 0.22665 0.079 0.41665 0.237 0.57 0.158 0.15335 0.35385 0.23 0.5875 0.23Zm0.00725 12.85c-1.379 0 -2.67485 -0.2625 -3.8875 -0.7875 -1.21285 -0.525 -2.2734 -1.24165 -3.18175 -2.15 -0.908335 -0.90835 -1.625 -1.9695 -2.15 -3.1835C2.2625 14.665 2 13.36785 2 11.9875s0.2625 -2.6775 0.7875 -3.8915c0.525 -1.214 1.241665 -2.271 2.15 -3.171 0.90835 -0.9 1.9695 -1.6125 3.1835 -2.1375C9.335 2.2625 10.63215 2 12.0125 2s2.6775 0.2625 3.8915 0.7875c1.214 0.525 2.271 1.2375 3.171 2.1375 0.9 0.9 1.6125 1.95835 2.1375 3.175C21.7375 9.31665 22 10.6144 22 11.99325c0 1.379 -0.2625 2.67485 -0.7875 3.8875 -0.525 1.21285 -1.2375 2.2719 -2.1375 3.17725 -0.9 0.90515 -1.95835 1.62185 -3.175 2.15C14.68335 21.736 13.3856 22 12.00675 22Zm0.00575 -1.5c2.35835 0 4.3625 -0.82915 6.0125 -2.4875 1.65 -1.65835 2.475 -3.66665 2.475 -6.025s-0.8234 -4.3625 -2.47025 -6.0125C16.3829 4.325 14.373 3.5 12 3.5c-2.35 0 -4.35415 0.823415 -6.0125 2.47025C4.329165 7.6171 3.5 9.627 3.5 12c0 2.35 0.829165 4.35415 2.4875 6.0125C7.64585 19.67085 9.65415 20.5 12.0125 20.5Z" />
          </svg>
        </button>

        {/* Fullscreen Button */}
        <button
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
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          )}
        </button>
        </div>
      </div>
    </div>
  );
}
