'use client';

import { useState, useEffect, useRef } from 'react';
import Icons from '@/components/icons';
import { useStream } from '../../shared/hooks/useStream';
import VideoPlayer from '../VideoPlayer';
import LoadingOverlay from './components/LoadingOverlay';
import ErrorOverlay from './components/ErrorOverlay';
import SkipIntroButton from './components/SkipIntroButton';
import VideoControls from './components/VideoControls';
import VideoInfoOverlay from './components/VideoInfoOverlay';
import { useVideoPlayerKeyboard } from './hooks/useVideoPlayerKeyboard';
import { useControlsVisibility } from './hooks/useControlsVisibility';

/**
 * VideoPlayerModal - Full-screen edge-to-edge video player with themed UI
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback to close modal
 * @param {string} props.streamUrl - URL of the video stream (HLS)
 * @param {string} props.fileName - Name of the file being played
 * @param {Array} props.subtitles - Array of available subtitle tracks from metadata
 * @param {Array} props.audios - Array of available audio tracks from metadata
 * @param {Object} props.metadata - Full metadata object from stream response
 * @param {string} props.apiKey - TorBox API key
 * @param {number} props.itemId - Download ID
 * @param {number} props.fileId - File ID
 * @param {string} props.streamType - Stream type: 'torrent', 'usenet', or 'webdownload'
 * @param {Function} props.onStreamUrlChange - Callback when stream URL changes
 * @param {Object} props.introInformation - Intro information with start_time, end_time, title
 * @param {number} props.initialAudioIndex - Initial audio track index that was selected
 * @param {number|null} props.initialSubtitleIndex - Initial subtitle track index that was selected (null for none)
 */
export default function VideoPlayerModal({
  isOpen,
  onClose,
  streamUrl: initialStreamUrl,
  fileName,
  subtitles = [],
  audios = [],
  metadata = {},
  apiKey,
  itemId,
  fileId,
  streamType = 'torrent',
  onStreamUrlChange,
  introInformation = null,
  initialAudioIndex = 0,
  initialSubtitleIndex = null,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const { createStream } = useStream(apiKey);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState(initialStreamUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekTime, setSeekTime] = useState(null);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState(0);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
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
  const volumeRef = useRef(null);
  const audioMenuRef = useRef(null);
  const subtitleMenuRef = useRef(null);
  const playbackSpeedMenuRef = useRef(null);
  const controlsBarRef = useRef(null);
  const lastClickTimeRef = useRef(0);
  const volumeSliderTimeoutRef = useRef(null);
  const isSeekingRef = useRef(false);
  const isManualStreamUpdateRef = useRef(false);
  const hasInitializedTracksRef = useRef(false);

  // Handle body scroll lock when modal is open
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

  // Reset state when modal opens
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

  // Handle fullscreen changes
  useEffect(() => {
    if (!isOpen) return;

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isOpen]);

  // Use controls visibility hook
  useControlsVisibility({
    isOpen,
    isPlaying,
    showControls,
    setShowControls,
    controlsBarRef,
    showVolumeSlider,
    showAudioMenu,
    showSubtitleMenu,
    showPlaybackSpeedMenu,
    volumeRef,
    audioMenuRef,
    subtitleMenuRef,
    playbackSpeedMenuRef,
  });

  // Close menus when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (volumeRef.current && !volumeRef.current.contains(e.target)) {
        if (volumeSliderTimeoutRef.current) {
          clearTimeout(volumeSliderTimeoutRef.current);
        }
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (volumeSliderTimeoutRef.current) {
        clearTimeout(volumeSliderTimeoutRef.current);
      }
    };
  }, [isOpen]);

  // Update streamUrl when initialStreamUrl changes
  useEffect(() => {
    if (initialStreamUrl && !isManualStreamUpdateRef.current) {
      setStreamUrl(initialStreamUrl);
    }
  }, [initialStreamUrl]);

  // Get video ref from VideoPlayer component
  const handleVideoRef = (videoElement) => {
    videoRef.current = videoElement;
    if (videoElement) {
      setVolume(videoElement.volume);
      setIsMuted(videoElement.muted);
      // Set initial playback speed
      if (videoElement.playbackRate !== playbackSpeed) {
        videoElement.playbackRate = playbackSpeed;
      }
    }
  };

  // Apply playback speed when video ref changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Update seeking ref when isSeeking changes
  useEffect(() => {
    isSeekingRef.current = isSeeking;
  }, [isSeeking]);

  // Handle play/pause
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  // Handle rewind 30 seconds
  const handleRewind = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 30);
    }
  };

  // Handle forward 30 seconds
  const handleForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(
        videoRef.current.duration || 0,
        videoRef.current.currentTime + 30
      );
    }
  };

  // Handle video click (single click = play/pause, double click = fullscreen)
  const handleVideoClick = (e) => {
    if (e.target.closest('[data-seekbar]') || e.target.closest('.pointer-events-auto')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTimeRef.current;
    
    if (timeSinceLastClick < 300) {
      handleFullscreen();
      lastClickTimeRef.current = 0;
    } else {
      lastClickTimeRef.current = now;
      handlePlayPause();
    }
  };

  // Handle seek
  const handleSeek = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (videoRef.current && duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = pos * duration;
    }
  };

  // Handle seekbar drag
  const handleSeekbarMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSeeking(true);
    if (duration && containerRef.current) {
      const progressBar = containerRef.current.querySelector('[data-seekbar]');
      if (progressBar) {
        const rect = progressBar.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const newTime = pos * duration;
        setSeekTime(newTime);
      }
    }
  };

  // Handle seekbar drag move
  useEffect(() => {
    if (!isSeeking) return;

    const handleMouseMove = (e) => {
      if (duration && containerRef.current) {
        const progressBar = containerRef.current.querySelector('[data-seekbar]');
        if (progressBar) {
          const rect = progressBar.getBoundingClientRect();
          const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const newTime = pos * duration;
          setSeekTime(newTime);
        }
      }
    };

    const handleMouseUp = () => {
      if (videoRef.current && seekTime !== null) {
        videoRef.current.currentTime = seekTime;
        setCurrentTime(seekTime);
      }
      setIsSeeking(false);
      setSeekTime(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSeeking, duration, seekTime]);

  // Handle volume change
  const handleVolumeChange = (newVolume) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  // Handle mute toggle
  const handleMuteToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  // Handle playback speed change
  const handlePlaybackSpeedChange = (speed) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowPlaybackSpeedMenu(false);
    }
  };

  // Handle fullscreen
  const handleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  // Handle keyboard shortcuts (must be after all handlers are defined)
  useVideoPlayerKeyboard({
    isOpen,
    isPlaying,
    isFullscreen,
    showInfo,
    videoRef,
    onPlayPause: handlePlayPause,
    onFullscreen: handleFullscreen,
    onMuteToggle: handleMuteToggle,
    onInfoClose: () => setShowInfo(false),
    onVolumeChange: handleVolumeChange,
  });

  // Handle audio track selection
  const handleAudioTrackSelect = async (index) => {
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
      
      if (videoRef.current && wasPlaying) {
        videoRef.current.pause();
      }
      
      const audioRelativeIndex = index;
      const currentSubtitleRelativeIndex = selectedSubtitleIndex !== null && selectedSubtitleIndex !== undefined 
        ? selectedSubtitleIndex 
        : selectedStreamData.subtitle_track_idx;

      const streamMetadata = await createStream(
        itemId,
        fileId,
        streamType,
        currentSubtitleRelativeIndex,
        audioRelativeIndex
      );

      const data = streamMetadata.data || streamMetadata;
      const newStreamUrl = data.hls_url || streamMetadata.hls_url;

      if (!newStreamUrl) {
        throw new Error('No stream URL in response');
      }

      setSelectedStreamData(prev => ({
        ...prev,
        audio_track_idx: index,
      }));
      
      setCapturedSeekTime(capturedTime);
      setWasPlayingBeforeTrackChange(wasPlaying);
      
      isManualStreamUpdateRef.current = true;
      
      setStreamUrl(newStreamUrl);
      if (onStreamUrlChange) {
        onStreamUrlChange(newStreamUrl);
      }
      
      setTimeout(() => {
        isManualStreamUpdateRef.current = false;
      }, 500);

      setSelectedAudioIndex(index);
      setShowAudioMenu(false);
      setIsLoading(false);
    } catch (error) {
      console.error('Error selecting audio track:', error);
      setIsLoading(false);
      const errorMessage = error?.message || error?.toString() || 'Failed to change audio track';
      setError(errorMessage);
    }
  };

  // Handle subtitle track selection
  const handleSubtitleTrackSelect = async (index) => {
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
      
      if (videoRef.current && wasPlaying) {
        videoRef.current.pause();
      }
      
      const audioRelativeIndex = selectedAudioIndex;
      const subtitleRelativeIndex = index;

      const streamMetadata = await createStream(
        itemId,
        fileId,
        streamType,
        subtitleRelativeIndex,
        audioRelativeIndex
      );

      const data = streamMetadata.data || streamMetadata;
      const newStreamUrl = data.hls_url || streamMetadata.hls_url;

      if (!newStreamUrl) {
        throw new Error('No stream URL in response');
      }

      setSelectedStreamData(prev => ({
        ...prev,
        subtitle_track_idx: index,
      }));
      setSelectedSubtitleIndex(index);
      
      setCapturedSeekTime(capturedTime);
      setWasPlayingBeforeTrackChange(wasPlaying);
      
      isManualStreamUpdateRef.current = true;
      
      setStreamUrl(newStreamUrl);
      if (onStreamUrlChange) {
        onStreamUrlChange(newStreamUrl);
      }
      
      setTimeout(() => {
        isManualStreamUpdateRef.current = false;
      }, 500);

      setShowSubtitleMenu(false);
      setIsLoading(false);
    } catch (error) {
      console.error('Error selecting subtitle track:', error);
      setIsLoading(false);
      const errorMessage = error?.message || error?.toString() || 'Failed to change subtitle track';
      setError(errorMessage);
    }
  };

  // Handle Skip Intro button click
  const handleSkipIntro = () => {
    const introInfo = introInformation || selectedStreamData.intro_info;
    if (videoRef.current && introInfo && introInfo.end_time !== undefined) {
      videoRef.current.currentTime = introInfo.end_time;
      setCurrentTime(introInfo.end_time);
    }
  };

  // Handle error retry
  const handleErrorRetry = async () => {
    setError(null);
    setIsLoading(true);
    
    try {
      // Try to reload the current stream URL
      if (streamUrl) {
        // Force VideoPlayer to reload by updating the key
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
  };

  if (!isOpen) return null;

  // Use seekTime for smooth dragging, otherwise use currentTime
  const displayTime = isSeeking && seekTime !== null ? seekTime : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;
  
  // Check if we're in intro time range
  const introInfo = introInformation || selectedStreamData.intro_info;
  const isInIntroRange = introInfo && 
    introInfo.start_time !== undefined && 
    introInfo.end_time !== undefined &&
    introInfo.end_time > 0 &&
    currentTime >= introInfo.start_time && 
    currentTime <= introInfo.end_time;

  return (
    <div className="fixed inset-0 z-50 bg-black" ref={containerRef}>
      {/* Video Container */}
      <div 
        className="relative w-full h-full flex items-center justify-center"
        onMouseMove={() => setShowControls(true)}
        onMouseLeave={() => {
          if (isPlaying) {
            setTimeout(() => setShowControls(false), 2000);
          }
        }}
        onWheel={(e) => {
          e.preventDefault();
          if (videoRef.current) {
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            const newVolume = Math.max(0, Math.min(1, videoRef.current.volume + delta));
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            setIsMuted(newVolume === 0);
          }
        }}
      >
        {/* Video Player Component */}
        {streamUrl && isOpen && (
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
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleFullscreen();
            }}
          />
        )}

        {/* Skip Intro Button */}
        {isInIntroRange && !isLoading && !error && (
          <SkipIntroButton onSkip={handleSkipIntro} />
        )}

        {/* Loading Overlay */}
        {isLoading && !error && <LoadingOverlay />}

        {/* Error Overlay */}
        {error && <ErrorOverlay error={error} onRetry={handleErrorRetry} />}

        {/* Close Button */}
        {showControls && (
          <button
            type="button"
            onClick={onClose}
            className="group absolute top-4 right-4 z-30 
              w-10 h-10 flex items-center justify-center
              rounded-full 
              bg-black/40 hover:bg-black/70 
              backdrop-blur-sm hover:backdrop-blur-md
              text-white/90 hover:text-white
              transition-all duration-300 ease-out
              hover:scale-110 active:scale-95
              border border-white/10 hover:border-white/30
              shadow-lg hover:shadow-xl
              focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent"
            aria-label="Close"
          >
            <Icons.X className="w-5 h-5 transition-transform duration-300 group-hover:rotate-90" />
          </button>
        )}

        {/* Info Overlay */}
        <VideoInfoOverlay
          isOpen={showInfo}
          onClose={() => setShowInfo(false)}
          metadata={metadata}
          fileName={fileName}
          audios={audios}
          subtitles={subtitles}
        />

        {/* Controls Overlay */}
        {showControls && !isLoading && !error && (
          <VideoControls
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
            onAudioMenuToggle={(open) => setShowAudioMenu(open !== undefined ? open : !showAudioMenu)}
            onSubtitleMenuToggle={(open) => setShowSubtitleMenu(open !== undefined ? open : !showSubtitleMenu)}
            onPlaybackSpeedChange={handlePlaybackSpeedChange}
            onPlaybackSpeedMenuToggle={(open) => setShowPlaybackSpeedMenu(open !== undefined ? open : !showPlaybackSpeedMenu)}
            onInfoToggle={() => setShowInfo(!showInfo)}
            onFullscreen={handleFullscreen}
            isFullscreen={isFullscreen}
            audioMenuRef={audioMenuRef}
            subtitleMenuRef={subtitleMenuRef}
            playbackSpeedMenuRef={playbackSpeedMenuRef}
            controlsBarRef={controlsBarRef}
            onOverlayClick={handleVideoClick}
          />
        )}

        {/* Video Title Overlay */}
        {showControls && fileName && (
          <div className="absolute top-4 left-4 z-20 px-4 py-2 mr-2 rounded-lg
            bg-black/60 backdrop-blur-md text-white
            border border-white/20">
            <p className="text-sm font-medium">{fileName}</p>
          </div>
        )}
      </div>
    </div>
  );
}
