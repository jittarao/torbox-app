'use client';

import { X } from '@/components/icons';
import DesktopVideoControls from './components/desktop/DesktopVideoControls';

export default function VideoPlayerModalDesktopChrome({
  t,
  visibility,
  playback,
  menus,
  displayTime,
  duration,
  progress,
  volume,
  audios,
  subtitles,
  selectedAudioIndex,
  selectedSubtitleIndex,
  playbackSpeed,
  fileName,
  onClose,
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
  setShowInfo,
  toggleFullscreen,
  audioMenuRef,
  subtitleMenuRef,
  playbackSpeedMenuRef,
  volumeRef,
  seekBarRef,
  controlsBarRef,
}) {
  const { controls: controlsVisible } = visibility;

  return (
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
        visibility={visibility}
        playback={playback}
        menus={menus}
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
        onAudioMenuToggle={(open) => setShowAudioMenu(open !== undefined ? open : !menus.audio)}
        onSubtitleMenuToggle={(open) =>
          setShowSubtitleMenu(open !== undefined ? open : !menus.subtitle)
        }
        onPlaybackSpeedChange={handlePlaybackSpeedChange}
        onPlaybackSpeedMenuToggle={(open) =>
          setShowPlaybackSpeedMenu(open !== undefined ? open : !menus.playbackSpeed)
        }
        onInfoToggle={() => setShowInfo(!menus.info)}
        onFullscreen={toggleFullscreen}
        audioMenuRef={audioMenuRef}
        subtitleMenuRef={subtitleMenuRef}
        playbackSpeedMenuRef={playbackSpeedMenuRef}
        volumeRef={volumeRef}
        seekBarRef={seekBarRef}
        controlsBarRef={controlsBarRef}
      />
      {fileName && (
        <div
          className={`absolute top-4 left-4 z-20 px-4 py-2 mr-2 rounded-lg
            bg-black/60 backdrop-blur-md text-white
            border border-white/20 transition-opacity duration-300
            ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <p className="text-sm font-medium truncate max-w-[50vw]">{fileName}</p>
        </div>
      )}
    </>
  );
}
