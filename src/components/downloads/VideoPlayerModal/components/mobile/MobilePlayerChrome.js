'use client';

import { memo } from 'react';
import PlayerHeader from './PlayerHeader';
import MobileSeekBar from './MobileSeekBar';
import MobileControlBar from './MobileControlBar';
import PlayerSettingsSheet from './PlayerSettingsSheet';
import PlayerInfoSheet from './PlayerInfoSheet';

function MobilePlayerChrome({
  formFactor,
  fileName,
  isVisible,
  onClose,
  currentTime,
  duration,
  progress,
  isPlaying,
  isSeeking,
  previewTime,
  seekBarRef,
  controlsBarRef,
  onSeekPointerDown,
  onSeekPointerMove,
  onSeekPointerUp,
  onSeekClick,
  onPlayPause,
  onSeekBack,
  onSeekForward,
  showSettingsSheet,
  onOpenSettings,
  onCloseSettings,
  playbackSpeed,
  onPlaybackSpeedChange,
  audios,
  subtitles,
  selectedAudioIndex,
  selectedSubtitleIndex,
  onAudioSelect,
  onSubtitleSelect,
  volume,
  isMuted,
  onVolumeChange,
  onMuteToggle,
  showInfoSheet,
  onOpenInfo,
  onCloseInfo,
  metadata,
  onFullscreen,
  isFullscreen,
}) {
  const isLandscape = formFactor === 'landscape';

  return (
    <>
      <PlayerHeader
        fileName={fileName}
        isVisible={isVisible}
        onClose={onClose}
        onFullscreen={onFullscreen}
        isFullscreen={isFullscreen}
      />

      <div
        className={`absolute inset-x-0 bottom-0 z-20 pointer-events-none transition-opacity duration-300 motion-reduce:transition-none ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        role="presentation"
      >
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40
            bg-gradient-to-t from-black/85 via-black/45 to-transparent"
          aria-hidden="true"
        />
        <div
          ref={controlsBarRef}
          className={`relative ${isVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
          data-player-control
          style={{ '--mobile-controls-height': isLandscape ? '3.5rem' : '6.5rem' }}
        >
          <MobileSeekBar
            seekBarRef={seekBarRef}
            progress={progress}
            isSeeking={isSeeking}
            previewTime={previewTime}
            onPointerDown={onSeekPointerDown}
            onPointerMove={onSeekPointerMove}
            onPointerUp={onSeekPointerUp}
            onClick={onSeekClick}
          />
          <MobileControlBar
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onPlayPause={onPlayPause}
            onSeekBack={onSeekBack}
            onSeekForward={onSeekForward}
            onOpenSettings={onOpenSettings}
            onFullscreen={onFullscreen}
            isFullscreen={isFullscreen}
          />
        </div>
      </div>

      <PlayerSettingsSheet
        open={showSettingsSheet}
        onClose={onCloseSettings}
        playbackSpeed={playbackSpeed}
        onPlaybackSpeedChange={onPlaybackSpeedChange}
        audios={audios}
        subtitles={subtitles}
        selectedAudioIndex={selectedAudioIndex}
        selectedSubtitleIndex={selectedSubtitleIndex}
        onAudioSelect={onAudioSelect}
        onSubtitleSelect={onSubtitleSelect}
        volume={volume}
        isMuted={isMuted}
        onVolumeChange={onVolumeChange}
        onMuteToggle={onMuteToggle}
        onInfoOpen={onOpenInfo}
        onFullscreen={onFullscreen}
        isFullscreen={isFullscreen}
      />

      <PlayerInfoSheet
        open={showInfoSheet}
        onClose={onCloseInfo}
        metadata={metadata}
        fileName={fileName}
        audios={audios}
        subtitles={subtitles}
      />
    </>
  );
}

export default memo(MobilePlayerChrome);
