'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X } from '@/components/icons';
import { useStream } from '../../shared/hooks/useStream';
import VideoPlayer from '../VideoPlayer';
import LoadingOverlay from './components/LoadingOverlay';
import ErrorOverlay from './components/ErrorOverlay';
import SkipIntroButton from './components/SkipIntroButton';
import DesktopVideoControls from './components/desktop/DesktopVideoControls';
import MobilePlayerChrome from './components/mobile/MobilePlayerChrome';
import SeekFeedback from './components/mobile/SeekFeedback';
import VideoInfoOverlay from './components/VideoInfoOverlay';
import { useVideoPlayerKeyboard } from './hooks/useVideoPlayerKeyboard';
import { useControlsVisibility } from './hooks/useControlsVisibility';
import { useTouchPlayer } from './hooks/useTouchPlayer';
import { usePlayerFormFactor } from './hooks/usePlayerLayout';
import { useFullscreen } from './hooks/useFullscreen';
import { useSeek } from './hooks/useSeek';
import { usePlayerGestures } from './hooks/usePlayerGestures';

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

export default function VideoPlayerModal({
  isOpen,
  onClose,
  streamUrl: initialStreamUrl,
  fileName,
  subtitles = EMPTY_ARRAY,
  audios = EMPTY_ARRAY,
  metadata = EMPTY_OBJECT,
  apiKey,
  itemId,
  fileId,
  streamType = 'torrent',
  onStreamUrlChange,
  introInformation = null,
  initialAudioIndex = 0,
  initialSubtitleIndex = null,
}) {
  const t = useTranslations('VideoPlayer');
  const isTouchPlayer = useTouchPlayer();
  const formFactor = usePlayerFormFactor();

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const seekBarRef = useRef(null);
  const { createStream } = useStream(apiKey);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState(initialStreamUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState(0);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showPlaybackSpeedMenu, setShowPlaybackSpeedMenu] = useState(false);
  const [selectedStreamData, setSelectedStreamData] = useState({
    video_track_idx: 0,
    audio_track_idx: 0,
    subtitle_track_idx: null,
    intro_info: null,
  });
  const [capturedSeekTime, setCapturedSeekTime] = useState(null);
  const [wasPlayingBeforeTrackChange, setWasPlayingBeforeTrackChange] = useState(false);
  const [seekFeedback, setSeekFeedback] = useState(null);

  const volumeRef = useRef(null);
  const audioMenuRef = useRef(null);
  const subtitleMenuRef = useRef(null);
  const playbackSpeedMenuRef = useRef(null);
  const controlsBarRef = useRef(null);
  const playerAreaRef = useRef(null);
  const lastClickTimeRef = useRef(0);
  const volumeSliderTimeoutRef = useRef(null);
  const isManualStreamUpdateRef = useRef(false);
  const hasInitializedTracksRef = useRef(false);

  const { isFullscreen, toggleFullscreen, exitFullscreen } = useFullscreen({
    enabled: isOpen,
    containerRef,
    videoRef,
  });

  const handleTimeCommit = useCallback((time) => {
    setCurrentTime(time);
  }, []);

  const {
    isSeeking,
    seekTime,
    handleSeekPointerDown,
    handleSeekPointerMove,
    handleSeekPointerUp,
    handleSeekClick,
  } = useSeek({
    duration,
    videoRef,
    seekBarRef,
    onTimeCommit: handleTimeCommit,
  });

  const { toggleControls } = useControlsVisibility({
    isOpen,
    isPlaying,
    isSeeking,
    showControls,
    setShowControls,
    playerRef: playerAreaRef,
    controlsBarRef,
    showVolumeSlider,
    showAudioMenu,
    showSubtitleMenu,
    showPlaybackSpeedMenu,
    showSettingsSheet,
    showInfoSheet: showInfoSheet || (showInfo && !isTouchPlayer),
    volumeRef,
    audioMenuRef,
    subtitleMenuRef,
    playbackSpeedMenuRef,
    isTouchPlayer,
  });

  const handleDoubleTapSeek = useCallback((deltaSeconds, side) => {
    if (videoRef.current) {
      const next = Math.max(
        0,
        Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + deltaSeconds)
      );
      videoRef.current.currentTime = next;
      setCurrentTime(next);
    }
    setSeekFeedback({ side, seconds: deltaSeconds });
  }, []);

  const handleSwipeDown = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
      return;
    }
    onClose();
  }, [isFullscreen, exitFullscreen, onClose]);

  const { bindGestures } = usePlayerGestures({
    enabled: isOpen && isTouchPlayer && !isLoading && !error,
    targetRef: playerAreaRef,
    onToggleControls: toggleControls,
    onDoubleTapSeek: handleDoubleTapSeek,
    onSwipeDown: handleSwipeDown,
    isBlocked: () =>
      isSeeking || showSettingsSheet || showInfoSheet || showInfo || Boolean(seekFeedback),
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    return bindGestures();
  }, [isOpen, bindGestures]);

  useEffect(() => {
    if (isOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !hasInitializedTracksRef.current) {
      hasInitializedTracksRef.current = true;
      setIsLoading(true);
      setError(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setShowControls(true);
      setShowVolumeSlider(false);
      setShowAudioMenu(false);
      setShowSubtitleMenu(false);
      setShowPlaybackSpeedMenu(false);
      setShowInfo(false);
      setShowSettingsSheet(false);
      setShowInfoSheet(false);
      setPlaybackSpeed(1.0);
      setSelectedStreamData({
        video_track_idx: 0,
        audio_track_idx: initialAudioIndex,
        subtitle_track_idx: initialSubtitleIndex,
        intro_info: introInformation,
      });
      setSelectedSubtitleIndex(initialSubtitleIndex);
      setSelectedAudioIndex(initialAudioIndex);
    } else if (!isOpen) {
      hasInitializedTracksRef.current = false;
    }
  }, [isOpen, introInformation, initialAudioIndex, initialSubtitleIndex]);

  useEffect(() => {
    if (!isOpen || isTouchPlayer) return;

    const handleClickOutside = (e) => {
      if (volumeRef.current && !volumeRef.current.contains(e.target)) {
        if (volumeSliderTimeoutRef.current) clearTimeout(volumeSliderTimeoutRef.current);
        setShowVolumeSlider(false);
      }
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target)) {
        setShowAudioMenu(false);
      }
      if (subtitleMenuRef.current && !subtitleMenuRef.current.contains(e.target)) {
        setShowSubtitleMenu(false);
      }
      if (playbackSpeedMenuRef.current && !playbackSpeedMenuRef.current.contains(e.target)) {
        setShowPlaybackSpeedMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, isTouchPlayer]);

  useEffect(() => {
    if (initialStreamUrl && !isManualStreamUpdateRef.current) {
      setStreamUrl(initialStreamUrl);
    }
  }, [initialStreamUrl]);

  const handleVideoRef = useCallback(
    (videoElement) => {
      videoRef.current = videoElement;
      if (videoElement) {
        setVolume(videoElement.volume);
        setIsMuted(videoElement.muted);
        if (videoElement.playbackRate !== playbackSpeed) {
          videoElement.playbackRate = playbackSpeed;
        }
      }
    },
    [playbackSpeed]
  );

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
  }, [isPlaying]);

  const handleRewind = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 30);
    }
  }, []);

  const handleForward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(
        videoRef.current.duration || 0,
        videoRef.current.currentTime + 30
      );
    }
  }, []);

  const handleSeekBack10 = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    }
  }, []);

  const handleSeekForward10 = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(
        videoRef.current.duration || 0,
        videoRef.current.currentTime + 10
      );
    }
  }, []);

  const handleVideoClick = useCallback(
    (e) => {
      if (isTouchPlayer) return;
      if (e.target.closest('[data-seekbar]') || e.target.closest('[data-player-control]')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      const timeSinceLastClick = now - lastClickTimeRef.current;

      if (timeSinceLastClick < 300) {
        toggleFullscreen();
        lastClickTimeRef.current = 0;
      } else {
        lastClickTimeRef.current = now;
        handlePlayPause();
      }
    },
    [isTouchPlayer, toggleFullscreen, handlePlayPause]
  );

  const handleSeek = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (videoRef.current && duration) {
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        videoRef.current.currentTime = pos * duration;
      }
    },
    [duration]
  );

  const handleSeekbarMouseDown = useCallback(
    (e) => {
      if (isTouchPlayer) return;
      e.preventDefault();
      e.stopPropagation();
      handleSeekPointerDown(e);
    },
    [isTouchPlayer, handleSeekPointerDown]
  );

  const handleVolumeChange = useCallback((newVolume) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  }, []);

  const handleMuteToggle = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }, []);

  const handlePlaybackSpeedChange = useCallback((speed) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowPlaybackSpeedMenu(false);
    }
  }, []);

  useVideoPlayerKeyboard({
    isOpen,
    isPlaying,
    isFullscreen,
    showInfo: showInfo || showInfoSheet,
    videoRef,
    onPlayPause: handlePlayPause,
    onFullscreen: toggleFullscreen,
    onMuteToggle: handleMuteToggle,
    onInfoClose: () => {
      setShowInfo(false);
      setShowInfoSheet(false);
    },
    onVolumeChange: handleVolumeChange,
  });

  const handleAudioTrackSelect = useCallback(
    async (index) => {
      if (!audios || audios.length <= index || !apiKey || !itemId || fileId === undefined) {
        console.error('Missing required data for audio track selection');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const capturedTime = videoRef.current?.currentTime || 0;
        const wasPlaying = isPlaying;
        setCapturedSeekTime(capturedTime);
        setWasPlayingBeforeTrackChange(wasPlaying);

        if (videoRef.current && wasPlaying) videoRef.current.pause();

        const streamMetadata = await createStream(
          itemId,
          fileId,
          streamType,
          selectedSubtitleIndex !== null && selectedSubtitleIndex !== undefined
            ? selectedSubtitleIndex
            : selectedStreamData.subtitle_track_idx,
          index
        );

        const data = streamMetadata.data || streamMetadata;
        const newStreamUrl = data.hls_url || streamMetadata.hls_url;
        if (!newStreamUrl) throw new Error('No stream URL in response');

        setSelectedStreamData((prev) => ({ ...prev, audio_track_idx: index }));
        isManualStreamUpdateRef.current = true;
        setStreamUrl(newStreamUrl);
        onStreamUrlChange?.(newStreamUrl);
        setTimeout(() => {
          isManualStreamUpdateRef.current = false;
        }, 500);

        setSelectedAudioIndex(index);
        setShowAudioMenu(false);
        setShowSettingsSheet(false);
        setIsLoading(false);
      } catch (err) {
        console.error('Error selecting audio track:', err);
        setIsLoading(false);
        setError(err?.message || err?.toString() || 'Failed to change audio track');
      }
    },
    [
      audios,
      apiKey,
      itemId,
      fileId,
      streamType,
      isPlaying,
      selectedSubtitleIndex,
      selectedStreamData.subtitle_track_idx,
      createStream,
      onStreamUrlChange,
    ]
  );

  const handleSubtitleTrackSelect = useCallback(
    async (index) => {
      if (!apiKey || !itemId || fileId === undefined) {
        console.error('Missing required data for subtitle track selection');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const capturedTime = videoRef.current?.currentTime || 0;
        const wasPlaying = isPlaying;
        setCapturedSeekTime(capturedTime);
        setWasPlayingBeforeTrackChange(wasPlaying);

        if (videoRef.current && wasPlaying) videoRef.current.pause();

        const streamMetadata = await createStream(
          itemId,
          fileId,
          streamType,
          index,
          selectedAudioIndex
        );

        const data = streamMetadata.data || streamMetadata;
        const newStreamUrl = data.hls_url || streamMetadata.hls_url;
        if (!newStreamUrl) throw new Error('No stream URL in response');

        setSelectedStreamData((prev) => ({ ...prev, subtitle_track_idx: index }));
        setSelectedSubtitleIndex(index);
        isManualStreamUpdateRef.current = true;
        setStreamUrl(newStreamUrl);
        onStreamUrlChange?.(newStreamUrl);
        setTimeout(() => {
          isManualStreamUpdateRef.current = false;
        }, 500);

        setShowSubtitleMenu(false);
        setShowSettingsSheet(false);
        setIsLoading(false);
      } catch (err) {
        console.error('Error selecting subtitle track:', err);
        setIsLoading(false);
        setError(err?.message || err?.toString() || 'Failed to change subtitle track');
      }
    },
    [
      apiKey,
      itemId,
      fileId,
      streamType,
      isPlaying,
      selectedAudioIndex,
      createStream,
      onStreamUrlChange,
    ]
  );

  const handleSkipIntro = useCallback(() => {
    const introInfo = introInformation || selectedStreamData.intro_info;
    if (videoRef.current && introInfo && introInfo.end_time !== undefined) {
      videoRef.current.currentTime = introInfo.end_time;
      setCurrentTime(introInfo.end_time);
    }
  }, [introInformation, selectedStreamData.intro_info]);

  const handleErrorRetry = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      if (streamUrl) {
        setStreamUrl(streamUrl);
        setIsLoading(false);
      } else {
        throw new Error('No stream URL available to retry');
      }
    } catch (retryError) {
      console.error('Error retrying stream:', retryError);
      setIsLoading(false);
      setError(retryError.message || 'Failed to retry stream. Please close and reopen the player.');
    }
  }, [streamUrl]);

  if (!isOpen) return null;

  const displayTime = isSeeking && seekTime !== null ? seekTime : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  const introInfo = introInformation || selectedStreamData.intro_info;
  const isInIntroRange =
    introInfo &&
    introInfo.start_time !== undefined &&
    introInfo.end_time !== undefined &&
    introInfo.end_time > 0 &&
    currentTime >= introInfo.start_time &&
    currentTime <= introInfo.end_time;

  const controlsVisible = showControls && !isLoading && !error;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950 player-safe-chrome" ref={containerRef}>
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
            onDone={() => setSeekFeedback(null)}
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
              isVisible={controlsVisible}
              currentTime={displayTime}
              duration={duration}
              progress={progress}
              isPlaying={isPlaying}
              isSeeking={isSeeking}
              volume={volume}
              isMuted={isMuted}
              showVolumeSlider={showVolumeSlider}
              audios={audios}
              subtitles={subtitles}
              selectedAudioIndex={selectedAudioIndex}
              selectedSubtitleIndex={selectedSubtitleIndex}
              showAudioMenu={showAudioMenu}
              showSubtitleMenu={showSubtitleMenu}
              playbackSpeed={playbackSpeed}
              showPlaybackSpeedMenu={showPlaybackSpeedMenu}
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
              isFullscreen={isFullscreen}
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
            isVisible={controlsVisible}
            onClose={onClose}
            currentTime={displayTime}
            duration={duration}
            progress={progress}
            isPlaying={isPlaying}
            isSeeking={isSeeking}
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
            showSettingsSheet={showSettingsSheet}
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
            isMuted={isMuted}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            showInfoSheet={showInfoSheet}
            onOpenInfo={() => {
              setShowSettingsSheet(false);
              setShowInfoSheet(true);
            }}
            onCloseInfo={() => setShowInfoSheet(false)}
            metadata={metadata}
            onFullscreen={toggleFullscreen}
            isFullscreen={isFullscreen}
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
