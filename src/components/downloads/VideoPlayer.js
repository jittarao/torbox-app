'use client';

import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    const initPlayer = async () => {
      try {
        onLoadingChange?.(true);
        onError?.(null);

        const shaka = await import('shaka-player');
        shaka.polyfill.installAll();

        if (!shaka.Player.isBrowserSupported()) {
          onError?.('Video player is not supported in this browser');
          onLoadingChange?.(false);
          return;
        }

        const player = new shaka.Player(video);
        playerRef.current = player;

        // Disable native controls
        video.controls = false;

        // Configure player for HLS streaming
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

        // Video event handlers
        const handleTimeUpdate = () => {
          if (video && !isSeekingRef.current) {
            onTimeUpdate?.(video.currentTime);
          }
          // Always update duration when available
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
          // Volume changes are handled by parent via videoRef
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('volumechange', handleVolumeChange);

        // Player event handlers
        player.addEventListener('loading', () => {
          onLoadingChange?.(true);
          onError?.(null);
        });

        player.addEventListener('loaded', () => {
          onLoadingChange?.(false);
          onError?.(null);

          // Set duration immediately when available
          if (video && video.duration > 0) {
            onDurationChange?.(video.duration);
            onTimeUpdate?.(video.currentTime || 0);
          }

          // Handle initial seek if provided
          if (initialSeekTime !== null && initialSeekTime > 0 && video) {
            const seekToTime = () => {
              if (video && video.readyState >= 2 && video.duration > 0) {
                const seekTime = Math.min(initialSeekTime, video.duration);
                video.currentTime = seekTime;
                onTimeUpdate?.(seekTime);

                // Auto play if requested
                if (shouldAutoPlay) {
                  setTimeout(() => {
                    if (video && video.paused) {
                      video.play().catch(() => {
                        // Autoplay may fail due to browser policies
                      });
                    }
                  }, 300);
                }
              } else if (video) {
                setTimeout(seekToTime, 200);
              }
            };

            // Wait for video to be ready
            video.addEventListener('loadedmetadata', seekToTime, { once: true });
            setTimeout(seekToTime, 500);
          } else if (shouldAutoPlay) {
            // Normal autoplay
            setTimeout(() => {
              if (video && video.paused) {
                video.play().catch(() => {
                  // Autoplay may fail due to browser policies
                });
              }
            }, 500);
          }
        });

        player.addEventListener('error', (event) => {
          onLoadingChange?.(false);
          const error = event.detail;
          const errorMessage = error?.message || 'Failed to load stream';
          onError?.(errorMessage);
          console.error('Shaka Player error:', error);
        });

        // Load the stream
        await player.load(streamUrl);

        // Cleanup function
        return () => {
          video.removeEventListener('timeupdate', handleTimeUpdate);
          video.removeEventListener('play', handlePlay);
          video.removeEventListener('pause', handlePause);
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
          video.removeEventListener('canplay', handleCanPlay);
          video.removeEventListener('volumechange', handleVolumeChange);
          if (playerRef.current) {
            try {
              playerRef.current.destroy();
            } catch (e) {
              console.error('Error destroying player:', e);
            }
            playerRef.current = null;
          }
        };
      } catch (error) {
        onLoadingChange?.(false);
        const errorMessage = error?.message || error?.toString() || 'Failed to load stream';
        onError?.(errorMessage);
        console.error('Error initializing player:', error);
      }
    };

    initPlayer();

    // Cleanup on unmount or streamUrl change
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.error('Error destroying player:', e);
        }
        playerRef.current = null;
      }
    };
  }, [streamUrl, initialSeekTime, shouldAutoPlay, onTimeUpdate, onDurationChange, onPlayStateChange, onError, onLoadingChange]);

  // Expose video ref to parent
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
    />
  );
}
