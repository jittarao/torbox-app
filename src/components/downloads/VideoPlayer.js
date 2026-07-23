'use client';

import { useEffect, useRef } from 'react';

/**
 * @param {HTMLVideoElement} video
 * @param {Object} callbacks
 * @param {import('react').RefObject<boolean>} isSeekingRef
 */
function subscribeVideoDomEvents(
  video,
  { onTimeUpdate, onDurationChange, onPlayStateChange, onLoadingChange },
  isSeekingRef
) {
  const handleTimeUpdate = () => {
    if (video && !isSeekingRef.current) {
      onTimeUpdate?.(video.currentTime);
    }
    if (video && video.duration > 0) {
      onDurationChange?.(video.duration);
    }
  };

  const handlePlay = () => onPlayStateChange?.(true);
  const handlePause = () => onPlayStateChange?.(false);

  const handleLoadedMetadata = () => {
    if (video && video.duration > 0) {
      onDurationChange?.(video.duration);
      onTimeUpdate?.(video.currentTime || 0);
    }
    onLoadingChange?.(false);
  };

  const handleCanPlay = () => {
    if (video && video.duration > 0) {
      onDurationChange?.(video.duration);
      onTimeUpdate?.(video.currentTime || 0);
    }
    onLoadingChange?.(false);
  };

  const handleVolumeChange = () => {};

  video.addEventListener('timeupdate', handleTimeUpdate);
  video.addEventListener('play', handlePlay);
  video.addEventListener('pause', handlePause);
  video.addEventListener('loadedmetadata', handleLoadedMetadata);
  video.addEventListener('canplay', handleCanPlay);
  video.addEventListener('volumechange', handleVolumeChange);

  return () => {
    video.removeEventListener('timeupdate', handleTimeUpdate);
    video.removeEventListener('play', handlePlay);
    video.removeEventListener('pause', handlePause);
    video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    video.removeEventListener('canplay', handleCanPlay);
    video.removeEventListener('volumechange', handleVolumeChange);
  };
}

/**
 * @param {Object} options
 * @param {HTMLVideoElement} options.video
 * @param {string} options.streamUrl
 * @param {number|null} options.initialSeekTime
 * @param {boolean} options.shouldAutoPlay
 * @param {import('react').RefObject<import('shaka-player').Player | null>} options.playerRef
 * @param {import('react').RefObject<boolean>} options.isCancelledRef
 * @param {Object} options.callbacks
 */
function subscribeShakaVideoPlayer({
  video,
  streamUrl,
  initialSeekTime,
  shouldAutoPlay,
  playerRef,
  isCancelledRef,
  callbacks: { onTimeUpdate, onDurationChange, onError, onLoadingChange },
}) {
  isCancelledRef.current = false;

  const timeouts = [];
  const safeTimeout = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timeouts.push(id);
    return id;
  };

  let shakaPlayer = null;
  let seekMetadataListener = null;

  const initPlayer = async () => {
    try {
      onLoadingChange?.(true);
      onError?.(null);

      if (isCancelledRef.current) return;

      const shaka = await import('shaka-player');

      if (isCancelledRef.current) return;

      shaka.polyfill.installAll();

      if (!shaka.Player.isBrowserSupported()) {
        onError?.('Video player is not supported in this browser');
        onLoadingChange?.(false);
        return;
      }

      const player = new shaka.Player(video);
      playerRef.current = player;
      shakaPlayer = player;

      video.controls = false;

      player.configure({
        streaming: {
          bufferingGoal: 30,
          rebufferingGoal: 2,
          bufferBehind: 30,
          retryParameters: {
            timeout: 30000,
            maxAttempts: 3,
            baseDelay: 1000,
            backoffFactor: 2,
            fuzzFactor: 0.5,
          },
        },
        abr: {
          enabled: true,
          useNetworkInformation: true,
        },
        manifest: {
          retryParameters: {
            timeout: 30000,
            maxAttempts: 3,
            baseDelay: 1000,
            backoffFactor: 2,
            fuzzFactor: 0.5,
          },
        },
      });

      player.addEventListener('loading', () => {
        if (isCancelledRef.current) return;
        onLoadingChange?.(true);
        onError?.(null);
      });

      player.addEventListener('loaded', () => {
        if (isCancelledRef.current) return;
        onLoadingChange?.(false);
        onError?.(null);

        if (video && video.duration > 0) {
          onDurationChange?.(video.duration);
          onTimeUpdate?.(video.currentTime || 0);
        }

        if (initialSeekTime !== null && initialSeekTime > 0 && video) {
          const seekToTime = () => {
            if (isCancelledRef.current) return;
            if (video && video.readyState >= 2 && video.duration > 0) {
              const seekTime = Math.min(initialSeekTime, video.duration);
              video.currentTime = seekTime;
              onTimeUpdate?.(seekTime);

              if (shouldAutoPlay) {
                safeTimeout(() => {
                  if (isCancelledRef.current) return;
                  if (video && video.paused) {
                    video.play().catch(() => {});
                  }
                }, 300);
              }
            } else if (video) {
              safeTimeout(seekToTime, 200);
            }
          };

          seekMetadataListener = seekToTime;
          video.addEventListener('loadedmetadata', seekMetadataListener, { once: true });
          safeTimeout(seekToTime, 500);
        } else if (shouldAutoPlay) {
          safeTimeout(() => {
            if (isCancelledRef.current) return;
            if (video && video.paused) {
              video.play().catch(() => {});
            }
          }, 500);
        }
      });

      player.addEventListener('error', (event) => {
        if (isCancelledRef.current) return;
        onLoadingChange?.(false);
        const error = event.detail;
        const errorMessage = error?.message || 'Failed to load stream';
        onError?.(errorMessage);
        console.error('Shaka Player error:', error);
      });

      if (isCancelledRef.current) return;

      await player.load(streamUrl);
    } catch (error) {
      if (isCancelledRef.current) return;
      onLoadingChange?.(false);
      const errorMessage = error?.message || error?.toString() || 'Failed to load stream';
      onError?.(errorMessage);
      console.error('Error initializing player:', error);
    }
  };

  void initPlayer();

  return () => {
    isCancelledRef.current = true;
    timeouts.forEach(clearTimeout);
    timeouts.length = 0;

    if (seekMetadataListener) {
      video.removeEventListener('loadedmetadata', seekMetadataListener);
      seekMetadataListener = null;
    }

    if (shakaPlayer) {
      shakaPlayer.destroy();
      shakaPlayer = null;
    }
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
  };
}

/**
 * VideoPlayer - Shaka Player wrapper component
 * @param {Object} props
 * @param {string} props.streamUrl - HLS stream URL
 * @param {Function} props.onTimeUpdate - Callback for time updates
 * @param {Function} props.onDurationChange - Callback for duration changes
 * @param {Function} props.onPlayStateChange - Callback for play/pause state
 * @param {Function} props.onError - Callback for errors
 * @param {Function} props.onLoadingChange - Callback for loading state
 * @param {Function} props.onVideoRef - Callback to receive video element ref
 * @param {number|null} props.initialSeekTime - Initial time to seek to
 * @param {boolean} props.shouldAutoPlay - Whether to autoplay
 * @param {Function} props.onClick - Click handler
 * @param {Function} props.onDoubleClick - Double click handler
 */
export default function VideoPlayer({
  streamUrl,
  onTimeUpdate,
  onDurationChange,
  onPlayStateChange,
  onError,
  onLoadingChange,
  onVideoRef,
  initialSeekTime = null,
  shouldAutoPlay = false,
  onClick,
  onDoubleClick,
}) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const isSeekingRef = useRef(false);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    return subscribeVideoDomEvents(
      video,
      { onTimeUpdate, onDurationChange, onPlayStateChange, onLoadingChange },
      isSeekingRef
    );
  }, [streamUrl, onTimeUpdate, onDurationChange, onPlayStateChange, onLoadingChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    return subscribeShakaVideoPlayer({
      video,
      streamUrl,
      initialSeekTime,
      shouldAutoPlay,
      playerRef,
      isCancelledRef,
      callbacks: { onTimeUpdate, onDurationChange, onError, onLoadingChange },
    });
  }, [
    streamUrl,
    initialSeekTime,
    shouldAutoPlay,
    onTimeUpdate,
    onDurationChange,
    onError,
    onLoadingChange,
  ]);

  useEffect(() => {
    if (onVideoRef && videoRef.current) {
      onVideoRef(videoRef.current);
    }
    return () => {
      if (onVideoRef) {
        onVideoRef(null);
      }
    };
  }, [onVideoRef]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-contain cursor-pointer"
      crossOrigin="anonymous"
      playsInline
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <track kind="captions" />
    </video>
  );
}
