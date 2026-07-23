'use client';

import { formatTimeRemaining } from '../utils/formatters';
import PlayerHeader from './PlayerHeader';
import PlayerError from './PlayerError';
import ProgressBar from './ProgressBar';
import PlaybackControls from './PlaybackControls';
import SpeedMenu from './SpeedMenu';
import TimerMenu from './TimerMenu';
import VolumeControl from './VolumeControl';
import ChaptersPanel from './ChaptersPanel';

const CoverPlaceholder = (
  <div className="flex items-center justify-center w-full aspect-square mx-auto max-w-xl max-h-[200px] rounded-2xl bg-white/5 mb-4">
    <svg className="size-16 text-white/20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  </div>
);

export default function AudioPlayerView({
  fileName,
  onClose,
  onRefreshUrl,
  audioUrl,
  hasChaptersSupport,
  audioRef,
  isPlaying,
  currentTime,
  duration,
  buffered,
  volume,
  playbackSpeed,
  isSeekingInProgress,
  seekValue,
  status,
  errorMessage,
  chapters,
  chaptersLoading,
  showSpeedMenu,
  setShowSpeedMenu,
  showTimerMenu,
  setShowTimerMenu,
  showVolumeSlider,
  setShowVolumeSlider,
  sleepTimer,
  setSleepTimer,
  showChaptersPanel,
  setShowChaptersPanel,
  handlePlayPause,
  skip,
  currentChapterIndex,
  currentChapter,
  chapterRemaining,
  totalRemaining,
  goToPrevChapter,
  goToNextChapter,
  goToChapter,
  handleSeek,
  handleSpeedChange,
  handleVolumeChange,
  handleMuteToggle,
  setTimer,
  handleRetry,
  handleProgressBarSeekStart,
  handleProgressBarSeekEnd,
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0d1117] text-gray-100">
      <audio ref={audioRef} preload="auto" crossOrigin="anonymous">
        <track kind="captions" />
      </audio>

      <PlayerHeader fileName={fileName} onClose={onClose} />

      {status === 'error' && (
        <PlayerError
          errorMessage={errorMessage}
          onRetry={handleRetry}
          showRetry={Boolean(onRefreshUrl)}
        />
      )}

      {status !== 'error' && (
        <>
          <div className="flex-1 flex flex-col min-h-0 px-4 pb-6 max-w-lg sm:max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[96rem] mx-auto w-full">
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex flex-col min-h-0 min-w-0 shrink-0">
                {CoverPlaceholder}

                <p className="text-center text-gray-400 text-sm mb-1">
                  {currentChapter ? currentChapter.title : '—'}
                </p>

                <p className="text-center text-gray-400 text-xs mb-2">
                  {formatTimeRemaining(totalRemaining)} remaining
                </p>

                <ProgressBar
                  seekValue={seekValue}
                  buffered={buffered}
                  currentTime={currentTime}
                  chapterRemaining={chapterRemaining}
                  chapters={chapters}
                  duration={duration}
                  onSeek={handleSeek}
                  onSeekStart={handleProgressBarSeekStart}
                  onSeekEnd={handleProgressBarSeekEnd}
                  onSeekEndTouch={handleSeek}
                />

                <PlaybackControls
                  isPlaying={isPlaying}
                  duration={duration}
                  isBuffering={
                    (status === 'ready' &&
                      !!audioUrl &&
                      (!Number.isFinite(duration) || duration <= 0)) ||
                    isSeekingInProgress ||
                    (buffered > 0 &&
                      duration > 0 &&
                      Number.isFinite(buffered) &&
                      currentTime + 2 > (buffered / 100) * duration)
                  }
                  onPlayPause={handlePlayPause}
                  onPrevChapter={goToPrevChapter}
                  onNextChapter={goToNextChapter}
                  onSkip={skip}
                />

                <div className="flex items-center justify-center gap-8 pt-2 border-t border-white/10">
                  <SpeedMenu
                    playbackSpeed={playbackSpeed}
                    showSpeedMenu={showSpeedMenu}
                    onToggle={(v) => {
                      if (v === false) setShowSpeedMenu(false);
                      else {
                        setShowSpeedMenu((s) => !s);
                        setShowTimerMenu(false);
                        setShowVolumeSlider(false);
                      }
                    }}
                    onSelectSpeed={handleSpeedChange}
                    onClose={() => setShowTimerMenu(false)}
                  />
                  <TimerMenu
                    sleepTimer={sleepTimer}
                    showTimerMenu={showTimerMenu}
                    hasChapters={chapters.length > 0}
                    onToggle={(v) => {
                      if (v === false) setShowTimerMenu(false);
                      else {
                        setShowTimerMenu((s) => !s);
                        setShowSpeedMenu(false);
                        setShowVolumeSlider(false);
                      }
                    }}
                    onSetTimer={setTimer}
                    onCancelTimer={() => setSleepTimer(null)}
                  />
                  <VolumeControl
                    volume={volume}
                    isMuted={volume === 0}
                    showVolumeSlider={showVolumeSlider}
                    onToggle={(v) => {
                      if (v === false) setShowVolumeSlider(false);
                      else {
                        setShowVolumeSlider((s) => !s);
                        setShowSpeedMenu(false);
                        setShowTimerMenu(false);
                      }
                    }}
                    onVolumeChange={handleVolumeChange}
                    onMuteToggle={handleMuteToggle}
                  />
                  {hasChaptersSupport && (
                    <button
                      type="button"
                      onClick={() => setShowChaptersPanel((v) => !v)}
                      className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors"
                    >
                      <svg
                        className="size-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        viewBox="0 0 24 24"
                      >
                        <path d="M4 4.5L20 4.5" />
                        <path d="M4 14.5L20 14.5" />
                        <path d="M4 9.5L20 9.5" />
                        <path d="M4 19.5L20 19.5" />
                      </svg>
                      <span className="text-xs">Chapters</span>
                    </button>
                  )}
                </div>
              </div>

              {showChaptersPanel && (
                <ChaptersPanel
                  chapters={chapters}
                  chaptersLoading={chaptersLoading}
                  currentChapterIndex={currentChapterIndex}
                  showChaptersPanel={showChaptersPanel}
                  onToggleChapters={setShowChaptersPanel}
                  onSelectChapter={goToChapter}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
