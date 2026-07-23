'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useStream } from '../../../shared/hooks/useStream';
import { useControlsVisibility } from './useControlsVisibility';
import { useTouchPlayer } from './useTouchPlayer';
import { usePlayerFormFactor } from './usePlayerLayout';
import { useFullscreen } from './useFullscreen';
import { useSeek } from './useSeek';
import { useVisualViewport } from './useVisualViewport';
import { useVideoPlayerTrackSwitch } from './useVideoPlayerTrackSwitch';
import { useVideoPlayerPlaybackHandlers } from './useVideoPlayerPlaybackHandlers';
import { useVideoPlayerModalEffects } from './useVideoPlayerModalEffects';
import { useVideoPlayerTouchGestures } from './useVideoPlayerTouchGestures';

export function useVideoPlayerModal({
  isOpen,
  onClose,
  initialStreamUrl,
  audios,
  subtitles,
  metadata,
  apiKey,
  itemId,
  fileId,
  streamType,
  onStreamUrlChange,
  introInformation,
  initialAudioIndex,
  initialSubtitleIndex,
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

  useVisualViewport({
    enabled: isOpen && isTouchPlayer,
    targetRef: containerRef,
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

  const { toggleControls, revealControls } = useControlsVisibility({
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

  const { handleSeekFeedbackDone } = useVideoPlayerTouchGestures({
    isOpen,
    isTouchPlayer,
    isLoading,
    error,
    isFullscreen,
    exitFullscreen,
    onClose,
    videoRef,
    playerAreaRef,
    toggleControls,
    revealControls,
    setCurrentTime,
    setSeekFeedback,
    isSeeking,
    showSettingsSheet,
    showInfoSheet,
    showInfo,
  });

  useVideoPlayerModalEffects({
    isOpen,
    isTouchPlayer,
    initialStreamUrl,
    isManualStreamUpdateRef,
    setStreamUrl,
    hasInitializedTracksRef,
    initialAudioIndex,
    initialSubtitleIndex,
    introInformation,
    setIsLoading,
    setError,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setShowControls,
    setShowVolumeSlider,
    setShowAudioMenu,
    setShowSubtitleMenu,
    setShowPlaybackSpeedMenu,
    setShowInfo,
    setShowSettingsSheet,
    setShowInfoSheet,
    setPlaybackSpeed,
    setSelectedStreamData,
    setSelectedSubtitleIndex,
    setSelectedAudioIndex,
    volumeRef,
    audioMenuRef,
    subtitleMenuRef,
    playbackSpeedMenuRef,
    volumeSliderTimeoutRef,
  });

  const { handleAudioTrackSelect, handleSubtitleTrackSelect } = useVideoPlayerTrackSwitch({
    audios,
    apiKey,
    itemId,
    fileId,
    streamType,
    isPlaying,
    selectedSubtitleIndex,
    selectedAudioIndex,
    selectedStreamData,
    createStream,
    onStreamUrlChange,
    videoRef,
    setIsLoading,
    setError,
    setCapturedSeekTime,
    setWasPlayingBeforeTrackChange,
    setSelectedStreamData,
    setSelectedAudioIndex,
    setSelectedSubtitleIndex,
    setShowAudioMenu,
    setShowSubtitleMenu,
    setShowSettingsSheet,
    isManualStreamUpdateRef,
    setStreamUrl,
  });

  const {
    handleVideoRef,
    handlePlayPause,
    handleRewind,
    handleForward,
    handleSeekBack10,
    handleSeekForward10,
    handleVideoClick,
    handleSeek,
    handleSeekbarMouseDown,
    handleVolumeChange,
    handleMuteToggle,
    handlePlaybackSpeedChange,
    handleErrorRetry,
  } = useVideoPlayerPlaybackHandlers({
    videoRef,
    isPlaying,
    isTouchPlayer,
    duration,
    playbackSpeed,
    toggleFullscreen,
    handleSeekPointerDown,
    lastClickTimeRef,
    streamUrl,
    setVolume,
    setIsMuted,
    setPlaybackSpeed,
    setShowPlaybackSpeedMenu,
    setShowInfo,
    setShowInfoSheet,
    setError,
    setIsLoading,
    setStreamUrl,
    isOpen,
    isFullscreen,
    showInfo,
    showInfoSheet,
  });

  const handleSkipIntro = useCallback(() => {
    const introInfo = introInformation || selectedStreamData.intro_info;
    if (videoRef.current && introInfo && introInfo.end_time !== undefined) {
      videoRef.current.currentTime = introInfo.end_time;
      setCurrentTime(introInfo.end_time);
    }
  }, [introInformation, selectedStreamData.intro_info]);

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

  return {
    t,
    isTouchPlayer,
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
    isInIntroRange,
    handleSkipIntro,
    isLoading,
    error,
    handleErrorRetry,
    showInfo,
    setShowInfo,
    metadata,
    audios,
    subtitles,
    controlsVisible,
    displayTime,
    duration,
    progress,
    isPlaying,
    isSeeking,
    volume,
    isMuted,
    showVolumeSlider,
    selectedAudioIndex,
    selectedSubtitleIndex,
    showAudioMenu,
    showSubtitleMenu,
    playbackSpeed,
    showPlaybackSpeedMenu,
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
    isFullscreen,
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
    showSettingsSheet,
    setShowSettingsSheet,
    showInfoSheet,
    setShowInfoSheet,
    seekTime,
    handleSeekBack10,
    handleSeekForward10,
    setVolume,
    setIsMuted,
  };
}
