'use client';

import { X } from '@/components/icons';
import VideoPlayer from '../VideoPlayer';
import LoadingOverlay from './components/LoadingOverlay';
import ErrorOverlay from './components/ErrorOverlay';
import SkipIntroButton from './components/SkipIntroButton';
import DesktopVideoControls from './components/desktop/DesktopVideoControls';
import MobilePlayerChrome from './components/mobile/MobilePlayerChrome';
import SeekFeedback from './components/mobile/SeekFeedback';
import VideoInfoOverlay from './components/VideoInfoOverlay';

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
          <>
            <button
              type="button"
              onClick={onClose}
              className={`group absolute top-4 right-4 z-30
                size-10 flex items-center justify-center
                rounded-full
                bg-black/40 hover:bg-black/70
                backdrop-blur-sm hover:backdrop-blur-md
                text-white/90 hover:text-white
                transition-all duration-300 ease-out
                hover:scale-110 active:scale-95
                border border-white/10 hover:border-white/30
                shadow-lg hover:shadow-xl
                focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent
                ${controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
              aria-label={t('close')}
              tabIndex={controlsVisible ? 0 : -1}
            >
              <X className="size-5 transition-transform duration-300 group-hover:rotate-90" />
            </button>
            <DesktopVideoControls
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
              }}
              currentTime={displayTime}
              duration={duration}
              progress={progress}
              volume={volume}
              audios={audios}
              subtitles={subtitles}
              selectedAudioIndex={selectedAudioIndex}
              selectedSubtitleIndex={selectedSubtitleIndex}
              playbackSpeed={playbackSpeed}
              onPlayPause={handlePlayPause}
              onRewind={handleRewind}
              onForward={handleForward}
              onSeek={handleSeek}
              onSeekStart={handleSeekbarMouseDown}
              onVolumeChange={handleVolumeChange}
              onMuteToggle={handleMuteToggle}
              onVolumeSliderShow={() => setShowVolumeSlider(true)}
              onVolumeSliderHide={() => setShowVolumeSlider(false)}
              onAudioSelect={handleAudioTrackSelect}
              onSubtitleSelect={handleSubtitleTrackSelect}
              onAudioMenuToggle={(open) =>
                setShowAudioMenu(open !== undefined ? open : !showAudioMenu)
              }
              onSubtitleMenuToggle={(open) =>
                setShowSubtitleMenu(open !== undefined ? open : !showSubtitleMenu)
              }
              onPlaybackSpeedChange={handlePlaybackSpeedChange}
              onPlaybackSpeedMenuToggle={(open) =>
                setShowPlaybackSpeedMenu(open !== undefined ? open : !showPlaybackSpeedMenu)
              }
              onInfoToggle={() => setShowInfo(!showInfo)}
              onFullscreen={toggleFullscreen}
              audioMenuRef={audioMenuRef}
              subtitleMenuRef={subtitleMenuRef}
              playbackSpeedMenuRef={playbackSpeedMenuRef}
              volumeRef={volumeRef}
              seekBarRef={seekBarRef}
              controlsBarRef={controlsBarRef}
            />
          </>
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

        {!isLoading && !error && !isTouchPlayer && fileName && (
          <div
            className={`absolute top-4 left-4 z-20 px-4 py-2 mr-2 rounded-lg
            bg-black/60 backdrop-blur-md text-white
            border border-white/20 transition-opacity duration-300
            ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <p className="text-sm font-medium truncate max-w-[50vw]">{fileName}</p>
          </div>
        )}
      </div>
    </div>
  );
}
