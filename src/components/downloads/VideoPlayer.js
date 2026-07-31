'use client';

import { useEffect, useRef } from 'react';
import { isAdaptiveStreamUrl, formatPlayerError } from '@/utils/streamUrl';

/**
 * @param {HTMLVideoElement} video
 * @param {Object} callbacks
 * @param {import('react').RefObject<boolean>} isSeekingRef
 */
function subscribeVideoDomEvents(
  video,
  { onTimeUpdate, onDurationChange, onPlayStateChange, onLoadingChange, onVolumeStateChange },
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

  const handleVolumeChange = () => {
    onVolumeStateChange?.({ volume: video.volume, muted: video.muted });
  };

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
 * Enable the first audio track when the AudioTrackList API exposes disabled tracks.
 * @param {HTMLVideoElement} video
 */
function enableDefaultAudioTrack(video) {
  const tracks = video.audioTracks;
  if (!tracks || tracks.length === 0) return;
  let anyEnabled = false;
  for (let i = 0; i < tracks.length; i++) {
    if (tracks[i].enabled) {
      anyEnabled = true;
      break;
    }
  }
  if (!anyEnabled) {
    tracks[0].enabled = true;
  }
}

/**
 * @param {HTMLVideoElement} video
 * @param {{ onVolumeStateChange?: Function }} callbacks
 */
async function playWithAutoplayFallback(video, callbacks) {
  enableDefaultAudioTrack(video);
  video.defaultMuted = false;
  video.muted = false;
  if (video.volume === 0) {
    video.volume = 1;
  }
  callbacks.onVolumeStateChange?.({ volume: video.volume, muted: false });

  try {
    await video.play();
    callbacks.onVolumeStateChange?.({ volume: video.volume, muted: video.muted });
  } catch (err) {
    // Autoplay with sound is often blocked after async work. Fall back to muted
    // autoplay and sync UI so the user can unmute with one click.
    if (err?.name === 'NotAllowedError') {
      video.muted = true;
      callbacks.onVolumeStateChange?.({ volume: video.volume, muted: true });
      try {
        await video.play();
      } catch {
        // ignore
      }
      return;
    }
    throw err;
  }
}

/**
 * Progressive CDN URLs (TorBox download links) usually lack CORS for MSE.
 * Native HTMLMediaElement can play them without CORS; Shaka cannot.
 */
function subscribeNativeVideoPlayer({
  video,
  streamUrl,
  initialSeekTime,
  shouldAutoPlay,
  isCancelledRef,
  callbacks: { onTimeUpdate, onDurationChange, onError, onLoadingChange, onVolumeStateChange },
}) {
  isCancelledRef.current = false;
  const timeouts = [];
  const safeTimeout = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timeouts.push(id);
    return id;
  };

  onLoadingChange?.(true);
  onError?.(null);

  video.controls = false;
  video.removeAttribute('crossorigin');
  video.removeAttribute('muted');
  video.defaultMuted = false;
  video.muted = false;
  if (video.volume === 0) video.volume = 1;
  onVolumeStateChange?.({ volume: video.volume, muted: false });

  const handleError = () => {
    if (isCancelledRef.current) return;
    onLoadingChange?.(false);
    const mediaError = video.error;
    let message = 'Failed to load stream';
    if (mediaError?.code === mediaError?.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      message =
        'This format cannot be played in the browser. Try Download, or open in an external player.';
    } else if (mediaError?.message) {
      message = mediaError.message;
    }
    onError?.(message);
  };

  const handleLoadedMetadata = () => {
    if (isCancelledRef.current) return;
    onLoadingChange?.(false);
    onError?.(null);
    enableDefaultAudioTrack(video);
    if (video.duration > 0) {
      onDurationChange?.(video.duration);
      onTimeUpdate?.(video.currentTime || 0);
    }

    if (initialSeekTime !== null && initialSeekTime > 0) {
      const seekTime = Math.min(initialSeekTime, video.duration || initialSeekTime);
      video.currentTime = seekTime;
      onTimeUpdate?.(seekTime);
    }

    if (shouldAutoPlay) {
      safeTimeout(() => {
        if (isCancelledRef.current) return;
        if (video.paused) {
          playWithAutoplayFallback(video, { onVolumeStateChange }).catch(() => {});
        }
      }, 200);
    }
  };

  const handlePlaying = () => {
    if (isCancelledRef.current) return;
    enableDefaultAudioTrack(video);
    onVolumeStateChange?.({ volume: video.volume, muted: video.muted });
  };

  video.addEventListener('error', handleError);
  video.addEventListener('loadedmetadata', handleLoadedMetadata);
  video.addEventListener('playing', handlePlaying);

  video.src = streamUrl;
  video.load();

  return () => {
    isCancelledRef.current = true;
    timeouts.forEach(clearTimeout);
    timeouts.length = 0;
    video.removeEventListener('error', handleError);
    video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    video.removeEventListener('playing', handlePlaying);
    video.removeAttribute('src');
    video.load();
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
  callbacks: { onTimeUpdate, onDurationChange, onError, onLoadingChange, onVolumeStateChange },
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

      // MSE / Shaka fetches require CORS; TorBox HLS transcoder URLs provide it.
      video.crossOrigin = 'anonymous';

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
                    playWithAutoplayFallback(video, { onVolumeStateChange }).catch(() => {});
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
              playWithAutoplayFallback(video, { onVolumeStateChange }).catch(() => {});
            }
          }, 500);
        }
      });

      player.addEventListener('error', (event) => {
        if (isCancelledRef.current) return;
        onLoadingChange?.(false);
        const error = event.detail;
        onError?.(formatPlayerError(error));
        console.error('Shaka Player error:', error);
      });

      if (isCancelledRef.current) return;

      await player.load(streamUrl);
    } catch (error) {
      if (isCancelledRef.current) return;
      onLoadingChange?.(false);
      onError?.(formatPlayerError(error));
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
 * VideoPlayer - Shaka for HLS/DASH; native element for progressive CDN URLs
 * @param {Object} props
 * @param {string} props.streamUrl - HLS or progressive media URL
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
  onVolumeStateChange,
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
  const useAdaptivePlayer = isAdaptiveStreamUrl(streamUrl);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    return subscribeVideoDomEvents(
      video,
      {
        onTimeUpdate,
        onDurationChange,
        onPlayStateChange,
        onLoadingChange,
        onVolumeStateChange,
      },
      isSeekingRef
    );
  }, [
    streamUrl,
    onTimeUpdate,
    onDurationChange,
    onPlayStateChange,
    onLoadingChange,
    onVolumeStateChange,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    const callbacks = {
      onTimeUpdate,
      onDurationChange,
      onError,
      onLoadingChange,
      onVolumeStateChange,
    };

    if (useAdaptivePlayer) {
      return subscribeShakaVideoPlayer({
        video,
        streamUrl,
        initialSeekTime,
        shouldAutoPlay,
        playerRef,
        isCancelledRef,
        callbacks,
      });
    }

    return subscribeNativeVideoPlayer({
      video,
      streamUrl,
      initialSeekTime,
      shouldAutoPlay,
      isCancelledRef,
      callbacks,
    });
  }, [
    streamUrl,
    useAdaptivePlayer,
    initialSeekTime,
    shouldAutoPlay,
    onTimeUpdate,
    onDurationChange,
    onError,
    onLoadingChange,
    onVolumeStateChange,
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
      crossOrigin={useAdaptivePlayer ? 'anonymous' : undefined}
      playsInline
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    />
  );
}
