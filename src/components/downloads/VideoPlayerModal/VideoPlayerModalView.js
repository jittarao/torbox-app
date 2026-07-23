'use client';

import VideoPlayer from '../VideoPlayer';
import LoadingOverlay from './components/LoadingOverlay';
import ErrorOverlay from './components/ErrorOverlay';
import SkipIntroButton from './components/SkipIntroButton';
import MobilePlayerChrome from './components/mobile/MobilePlayerChrome';
import SeekFeedback from './components/mobile/SeekFeedback';
import VideoInfoOverlay from './components/VideoInfoOverlay';
import VideoPlayerModalDesktopChrome from './VideoPlayerModalDesktopChrome';

export default function VideoPlayerModalView({
  t,
  playerFlags,
  playbackState,
  menuState,
  formFactor,
  containerRef,
  playerAreaRef,
  streamUrl,
  videoRef,
  handleVideoRef,
  capturedSeekTime,
  wasPlayingBeforeTrackChange,
  handleVideoClick,
  toggleFullscreen,
  setCurrentTime,
  setDuration,
  setIsPlaying,
  setError,
  setIsLoading,
  seekFeedback,
  handleSeekFeedbackDone,
  handleSkipIntro,
  error,
  handleErrorRetry,
  setShowInfo,
  metadata,
  fileName,
  audios,
  subtitles,
  onClose,
  controlsVisible,
  displayTime,
  duration,
  progress,
  volume,
  selectedAudioIndex,
  selectedSubtitleIndex,
  playbackSpeed,
  handlePlayPause,
  handleRewind,
  handleForward,
  handleSeek,
  handleSeekbarMouseDown,
  handleVolumeChange,
  handleMuteToggle,
  setShowVolumeSlider,
  handleAudioTrackSelect,
  handleSubtitleTrackSelect,
  setShowAudioMenu,
  setShowSubtitleMenu,
  handlePlaybackSpeedChange,
  setShowPlaybackSpeedMenu,
  audioMenuRef,
  subtitleMenuRef,
  playbackSpeedMenuRef,
  volumeRef,
  seekBarRef,
  controlsBarRef,
  handleSeekPointerDown,
  handleSeekPointerMove,
  handleSeekPointerUp,
  handleSeekClick,
  setShowSettingsSheet,
  setShowInfoSheet,
  seekTime,
  handleSeekBack10,
  handleSeekForward10,
  setVolume,
  setIsMuted,
}) {
  const { touch: isTouchPlayer, inIntroRange: isInIntroRange, loading: isLoading } = playerFlags;
  const {
    playing: isPlaying,
    seeking: isSeeking,
    muted: isMuted,
    fullscreen: isFullscreen,
  } = playbackState;
  const {
    volumeSlider: showVolumeSlider,
    audio: showAudioMenu,
    subtitle: showSubtitleMenu,
    playbackSpeed: showPlaybackSpeedMenu,
    info: showInfo,
    settingsSheet: showSettingsSheet,
    infoSheet: showInfoSheet,
  } = menuState;

  return (
    <div
      className={`z-50 bg-neutral-950 ${
        isTouchPlayer ? 'player-visual-viewport' : 'fixed inset-0 player-safe-chrome'
      }`}
      ref={containerRef}
    >
      <div
        ref={playerAreaRef}
        className="relative w-full h-full flex items-center justify-center"
        onWheel={
          isTouchPlayer
            ? undefined
            : (e) => {
                e.preventDefault();
                if (videoRef.current) {
                  const delta = e.deltaY > 0 ? -0.05 : 0.05;
                  const newVolume = Math.max(0, Math.min(1, videoRef.current.volume + delta));
                  videoRef.current.volume = newVolume;
                  setVolume(newVolume);
                  setIsMuted(newVolume === 0);
                }
              }
        }
      >
        {streamUrl && (
          <VideoPlayer
            key={streamUrl}
            streamUrl={streamUrl}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
            onPlayStateChange={setIsPlaying}
            onError={setError}
            onLoadingChange={setIsLoading}
            onVideoRef={handleVideoRef}
            initialSeekTime={capturedSeekTime}
            shouldAutoPlay={capturedSeekTime !== null ? wasPlayingBeforeTrackChange : true}
            onClick={handleVideoClick}
            onDoubleClick={
              isTouchPlayer
                ? undefined
                : (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFullscreen();
                  }
            }
          />
        )}

        {seekFeedback && (
          <SeekFeedback
            side={seekFeedback.side}
            seconds={seekFeedback.seconds}
            onDone={handleSeekFeedbackDone}
          />
        )}

        {isInIntroRange && !isLoading && !error && <SkipIntroButton onSkip={handleSkipIntro} />}

        {isLoading && !error && <LoadingOverlay />}
        {error && <ErrorOverlay error={error} onRetry={handleErrorRetry} />}

        {!isTouchPlayer && (
          <VideoInfoOverlay
            isOpen={showInfo}
            onClose={() => setShowInfo(false)}
            metadata={metadata}
            fileName={fileName}
            audios={audios}
            subtitles={subtitles}
          />
        )}

        {!isLoading && !error && !isTouchPlayer && (
          <VideoPlayerModalDesktopChrome
            t={t}
            visibility={{ controls: controlsVisible }}
            playback={{
              playing: isPlaying,
              seeking: isSeeking,
              muted: isMuted,
              fullscreen: isFullscreen,
            }}
            menus={{
              volumeSlider: showVolumeSlider,
              audio: showAudioMenu,
              subtitle: showSubtitleMenu,
              playbackSpeed: showPlaybackSpeedMenu,
              info: showInfo,
            }}
            displayTime={displayTime}
            duration={duration}
            progress={progress}
            volume={volume}
            audios={audios}
            subtitles={subtitles}
            selectedAudioIndex={selectedAudioIndex}
            selectedSubtitleIndex={selectedSubtitleIndex}
            playbackSpeed={playbackSpeed}
            fileName={fileName}
            onClose={onClose}
            handlePlayPause={handlePlayPause}
            handleRewind={handleRewind}
            handleForward={handleForward}
            handleSeek={handleSeek}
            handleSeekbarMouseDown={handleSeekbarMouseDown}
            handleVolumeChange={handleVolumeChange}
            handleMuteToggle={handleMuteToggle}
            setShowVolumeSlider={setShowVolumeSlider}
            handleAudioTrackSelect={handleAudioTrackSelect}
            handleSubtitleTrackSelect={handleSubtitleTrackSelect}
            setShowAudioMenu={setShowAudioMenu}
            setShowSubtitleMenu={setShowSubtitleMenu}
            handlePlaybackSpeedChange={handlePlaybackSpeedChange}
            setShowPlaybackSpeedMenu={setShowPlaybackSpeedMenu}
            setShowInfo={setShowInfo}
            toggleFullscreen={toggleFullscreen}
            audioMenuRef={audioMenuRef}
            subtitleMenuRef={subtitleMenuRef}
            playbackSpeedMenuRef={playbackSpeedMenuRef}
            volumeRef={volumeRef}
            seekBarRef={seekBarRef}
            controlsBarRef={controlsBarRef}
          />
        )}

        {!isLoading && !error && isTouchPlayer && (
          <MobilePlayerChrome
            formFactor={formFactor}
            fileName={fileName}
            playback={{
              visible: controlsVisible,
              playing: isPlaying,
              seeking: isSeeking,
              muted: isMuted,
              fullscreen: isFullscreen,
            }}
            sheets={{ settings: showSettingsSheet, info: showInfoSheet }}
            onClose={onClose}
            currentTime={displayTime}
            duration={duration}
            progress={progress}
            previewTime={seekTime}
            seekBarRef={seekBarRef}
            controlsBarRef={controlsBarRef}
            onSeekPointerDown={handleSeekPointerDown}
            onSeekPointerMove={handleSeekPointerMove}
            onSeekPointerUp={handleSeekPointerUp}
            onSeekClick={handleSeekClick}
            onPlayPause={handlePlayPause}
            onSeekBack={handleSeekBack10}
            onSeekForward={handleSeekForward10}
            onOpenSettings={() => setShowSettingsSheet(true)}
            onCloseSettings={() => setShowSettingsSheet(false)}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={handlePlaybackSpeedChange}
            audios={audios}
            subtitles={subtitles}
            selectedAudioIndex={selectedAudioIndex}
            selectedSubtitleIndex={selectedSubtitleIndex}
            onAudioSelect={handleAudioTrackSelect}
            onSubtitleSelect={handleSubtitleTrackSelect}
            volume={volume}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            onOpenInfo={() => {
              setShowSettingsSheet(false);
              setShowInfoSheet(true);
            }}
            onCloseInfo={() => setShowInfoSheet(false)}
            metadata={metadata}
            onFullscreen={toggleFullscreen}
          />
        )}
      </div>
    </div>
  );
}
