'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { formatTimeRemaining } from '../utils/formatters';
import { SKIP_SECONDS, POSITION_SAVE_INTERVAL_SEC } from './constants';
import {
  loadPosition,
  loadSpeed,
  loadVolume,
  savePosition,
  saveSpeed,
  saveVolume,
} from './storage';
import PlayerHeader from './PlayerHeader';
import PlayerError from './PlayerError';
import ProgressBar from './ProgressBar';
import PlaybackControls from './PlaybackControls';
import SpeedMenu from './SpeedMenu';
import TimerMenu from './TimerMenu';
import VolumeControl from './VolumeControl';
import ChaptersPanel from './ChaptersPanel';
import { useAudioKeyboard } from './useAudioKeyboard';

/** Placeholder cover area (no cover image yet) */
const CoverPlaceholder = (
  <div className="flex items-center justify-center w-full aspect-square mx-auto max-w-xl max-h-[200px] rounded-2xl bg-white/5 mb-4">
    <svg className="w-16 h-16 text-white/20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  </div>
);

/** Only .m4b and .m4a support chapter metadata; these trigger the chapters API and chapter UI. */
const hasChapterSupportFileName = (name) => {
  if (!name) return false;
  const lower = String(name).toLowerCase();
  return lower.endsWith('.m4b') || lower.endsWith('.m4a');
};

export default function AudioPlayer({
  audioUrl,
  fileName,
  itemId,
  fileId,
  apiKey,
  onClose,
  onRefreshUrl,
}) {
  const hasChaptersSupport = hasChapterSupportFileName(fileName);
  const audioRef = useRef(null);
  const wasPlayingBeforeSeekRef = useRef(false);
  const isSeekingRef = useRef(false);
  const isSeekingInProgressRef = useRef(false);
  /** True only when seek was started by user (skip/goToChapter/handleSeek); avoid saving on programmatic/initial seek */
  const userInitiatedSeekRef = useRef(false);
  /** Stored position to restore on load; applied when duration becomes available (loadedmetadata/canplay/durationchange) */
  const initialPositionRef = useRef(null);
  const hasAppliedInitialPositionRef = useRef(false);
  /** Last playback position (seconds) at which we saved to localStorage; throttle periodic saves */
  const lastSavedPositionRef = useRef(-1);
  /** Last time we committed to state; used to ignore stale timeupdate (e.g. 0 on pause) */
  const lastCommittedTimeRef = useRef(null);
  /** Only auto-play once when player opens (e.g. from FileRow play button) */
  const hasAutoPlayedRef = useRef(false);
  const volumeBeforeMuteRef = useRef(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isSeekingInProgress, setIsSeekingInProgress] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [status, setStatus] = useState('ready');
  const [errorMessage, setErrorMessage] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [chaptersLoading, setChaptersLoading] = useState(hasChaptersSupport);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [sleepTimer, setSleepTimer] = useState(null);
  const [showChaptersPanel, setShowChaptersPanel] = useState(false);

  // Lock body scroll while player is open
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = previous;
    };
  }, []);

  const fetchChapters = useCallback(async () => {
    if (!hasChaptersSupport) {
      setChapters([]);
      setChaptersLoading(false);
      return;
    }
    if (itemId == null || fileId == null || !audioUrl) {
      setChaptersLoading(false);
      return;
    }
    setChaptersLoading(true);
    try {
      const res = await fetch('/api/audiobook/chapters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'x-api-key': apiKey }),
        },
        body: JSON.stringify({
          id: String(itemId),
          file_id: String(fileId),
          url: audioUrl,
        }),
      });
      const data = await res.json();
      if (data.chapters && Array.isArray(data.chapters)) {
        setChapters(data.chapters);
      } else {
        setChapters([]);
      }
    } catch {
      setChapters([]);
    } finally {
      setChaptersLoading(false);
    }
  }, [hasChaptersSupport, itemId, fileId, audioUrl, apiKey]);

  useEffect(() => {
    fetchChapters();
  }, [fetchChapters]);

  useEffect(() => {
    setPlaybackSpeed(loadSpeed(itemId, fileId));
  }, [itemId, fileId]);

  useEffect(() => {
    setVolume(loadVolume());
  }, []);

  useEffect(() => {
    if (!sleepTimer) return;
    const interval = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;
      if (sleepTimer.endAt != null) {
        if (Date.now() >= sleepTimer.endAt) {
          audio.pause();
          setIsPlaying(false);
          setSleepTimer(null);
          setShowTimerMenu(false);
        }
        return;
      }
      if (sleepTimer.endAtChapter != null && chapters.length > 0) {
        const endSec = chapters[sleepTimer.endAtChapter + 1]?.startSeconds ?? duration;
        if (Number.isFinite(endSec) && audio.currentTime >= endSec) {
          audio.pause();
          setIsPlaying(false);
          setSleepTimer(null);
          setShowTimerMenu(false);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimer, chapters, duration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    initialPositionRef.current = loadPosition(itemId, fileId);
    hasAppliedInitialPositionRef.current = false;
    lastSavedPositionRef.current = -1;
    lastCommittedTimeRef.current = null;
    hasAutoPlayedRef.current = false;
    setErrorMessage(null);
    audio.src = audioUrl;
    audio.load();

    const tryApplyInitialPosition = () => {
      if (hasAppliedInitialPositionRef.current) return;
      const d = audio.duration;
      const durationReady = (Number.isFinite(d) || d === Infinity) && d > 0;
      if (!durationReady) return;
      const stored = initialPositionRef.current;
      const pos =
        stored != null ? Math.max(0, Math.min(stored, Number.isFinite(d) ? d : stored)) : 0;
      if (!Number.isFinite(pos) || pos < 0) return;
      hasAppliedInitialPositionRef.current = true;
      audio.currentTime = pos;
      lastCommittedTimeRef.current = pos;
      setDuration(d);
      setCurrentTime(pos);
      setSeekValue(Number.isFinite(d) && d > 0 ? (pos / d) * 100 : 0);
    };

    const onLoadedMetadata = () => {
      const d = audio.duration;
      if (Number.isFinite(d)) setDuration(d);
      tryApplyInitialPosition();
    };

    const onCanPlay = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      tryApplyInitialPosition();
      if (!hasAutoPlayedRef.current) {
        hasAutoPlayedRef.current = true;
        audio.play().catch((err) => {
          setStatus('error');
          setErrorMessage(err.message || 'Play failed');
        });
      }
    };

    const onTimeUpdate = () => {
      if (isSeekingRef.current || isSeekingInProgressRef.current) return;
      const t = audio.currentTime;
      const d = audio.duration;
      if (!Number.isFinite(t)) return;
      const last = lastCommittedTimeRef.current;
      if (last != null && t < last - 1) return;
      lastCommittedTimeRef.current = t;
      setCurrentTime(t);
      if (d && Number.isFinite(d)) setSeekValue((t / d) * 100);
      if (t - lastSavedPositionRef.current >= POSITION_SAVE_INTERVAL_SEC) {
        lastSavedPositionRef.current = t;
        savePosition(itemId, fileId, t);
      }
    };

    const onDurationChange = () => {
      const d = audio.duration;
      if (Number.isFinite(d) || d === Infinity) setDuration(d);
      tryApplyInitialPosition();
    };

    const onProgress = () => {
      if (audio.buffered.length > 0) {
        const end = audio.buffered.end(audio.buffered.length - 1);
        const d = audio.duration;
        setBuffered(d && Number.isFinite(d) ? (end / d) * 100 : 0);
      }
    };

    const onSeeking = () => {
      isSeekingInProgressRef.current = true;
      setIsSeekingInProgress(true);
    };

    const onSeeked = () => {
      const shouldSavePosition = userInitiatedSeekRef.current;
      userInitiatedSeekRef.current = false;
      isSeekingInProgressRef.current = false;
      setIsSeekingInProgress(false);
      const t = audio.currentTime;
      const d = audio.duration;
      lastCommittedTimeRef.current = t;
      setCurrentTime(t);
      if (d && Number.isFinite(d)) setSeekValue((t / d) * 100);
      if (shouldSavePosition) {
        savePosition(itemId, fileId, t);
        lastSavedPositionRef.current = t;
      }
      if (wasPlayingBeforeSeekRef.current) {
        wasPlayingBeforeSeekRef.current = false;
        audio.play().catch(() => {});
      }
    };

    const onPlaying = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    const onError = (e) => {
      setStatus('error');
      setErrorMessage(audio.error?.message || e?.message || 'Playback failed');
      setIsPlaying(false);
    };

    const onEnded = () => {
      lastCommittedTimeRef.current = 0;
      savePosition(itemId, fileId, 0);
      setCurrentTime(0);
      setSeekValue(0);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('progress', onProgress);
    audio.addEventListener('seeking', onSeeking);
    audio.addEventListener('seeked', onSeeked);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);

    return () => {
      if (audio.duration && !isNaN(audio.currentTime)) {
        savePosition(itemId, fileId, audio.currentTime);
      }
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('progress', onProgress);
      audio.removeEventListener('seeking', onSeeking);
      audio.removeEventListener('seeked', onSeeked);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl, itemId, fileId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = playbackSpeed;
  }, [playbackSpeed, itemId, fileId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
    }
  }, [volume]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      const t = audio.currentTime;
      savePosition(itemId, fileId, t);
      lastSavedPositionRef.current = t;
    } else {
      audio.play().catch((err) => {
        setStatus('error');
        setErrorMessage(err.message || 'Play failed');
      });
    }
  };

  const skip = (delta) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    wasPlayingBeforeSeekRef.current = isPlaying;
    userInitiatedSeekRef.current = true;
    isSeekingInProgressRef.current = true;
    setIsSeekingInProgress(true);
    const time = Math.max(0, Math.min(audio.duration, audio.currentTime + delta));
    audio.currentTime = time;
    lastCommittedTimeRef.current = time;
    setCurrentTime(time);
    setSeekValue((time / audio.duration) * 100);
    savePosition(itemId, fileId, time);
  };

  const currentChapterIndex = chapters.findIndex(
    (ch, i) =>
      currentTime >= ch.startSeconds &&
      (i === chapters.length - 1 || currentTime < chapters[i + 1].startSeconds)
  );
  const currentChapter = currentChapterIndex >= 0 ? chapters[currentChapterIndex] : null;
  const chapterRemainingRaw =
    currentChapterIndex >= 0 && chapters[currentChapterIndex + 1]
      ? chapters[currentChapterIndex + 1].startSeconds - currentTime
      : duration - currentTime;
  const chapterRemaining = Math.max(
    0,
    Number.isFinite(chapterRemainingRaw) ? chapterRemainingRaw : 0
  );
  const totalRemaining = Math.max(0, duration - currentTime);

  const goToPrevChapter = () => {
    if (currentChapterIndex <= 0) {
      skip(-SKIP_SECONDS);
      return;
    }
    goToChapter(currentChapterIndex - 1);
  };

  const goToNextChapter = () => {
    if (currentChapterIndex < 0 || currentChapterIndex >= chapters.length - 1) {
      skip(SKIP_SECONDS);
      return;
    }
    goToChapter(currentChapterIndex + 1);
  };

  const goToChapter = (index) => {
    const ch = chapters[index];
    const audio = audioRef.current;
    if (!ch || !audio || !Number.isFinite(audio.duration)) return;
    wasPlayingBeforeSeekRef.current = isPlaying;
    userInitiatedSeekRef.current = true;
    isSeekingInProgressRef.current = true;
    setIsSeekingInProgress(true);
    const time = Math.max(0, Math.min(ch.startSeconds, audio.duration));
    audio.currentTime = time;
    lastCommittedTimeRef.current = time;
    setCurrentTime(time);
    setSeekValue((time / audio.duration) * 100);
    savePosition(itemId, fileId, time);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX ?? e.changedTouches?.[0]?.clientX;
    if (clientX == null) return;
    wasPlayingBeforeSeekRef.current = isPlaying;
    userInitiatedSeekRef.current = true;
    isSeekingInProgressRef.current = true;
    setIsSeekingInProgress(true);
    const pct = (clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(audio.duration, pct * audio.duration));
    audio.currentTime = time;
    lastCommittedTimeRef.current = time;
    setCurrentTime(time);
    setSeekValue((time / audio.duration) * 100);
    savePosition(itemId, fileId, time);
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    saveSpeed(itemId, fileId, speed);
    setShowSpeedMenu(false);
  };

  const handleVolumeChange = (v) => {
    setVolume(v);
    saveVolume(v);
    if (v > 0) volumeBeforeMuteRef.current = v;
  };

  const handleMuteToggle = () => {
    if (volume > 0) {
      volumeBeforeMuteRef.current = volume;
      setVolume(0);
      saveVolume(0);
    } else {
      const restore = volumeBeforeMuteRef.current || 1;
      setVolume(restore);
      saveVolume(restore);
    }
  };

  const handleVolumeDelta = useCallback((delta) => {
    setVolume((v) => {
      const next = Math.max(0, Math.min(1, v + delta));
      saveVolume(next);
      if (next > 0) volumeBeforeMuteRef.current = next;
      return next;
    });
  }, []);

  useAudioKeyboard({
    onPlayPause: handlePlayPause,
    onSeek: skip,
    onVolumeChange: handleVolumeDelta,
    onToggleChapters: hasChaptersSupport ? () => setShowChaptersPanel((s) => !s) : undefined,
  });

  const setTimer = (option) => {
    if (option === 'end') {
      if (currentChapterIndex >= 0) {
        setSleepTimer({ endAtChapter: currentChapterIndex, endAt: null });
      }
      setShowTimerMenu(false);
      return;
    }
    const minutes = Number(option);
    if (!Number.isFinite(minutes)) return;
    setSleepTimer({ endAt: Date.now() + minutes * 60 * 1000, endAtChapter: null });
    setShowTimerMenu(false);
  };

  const handleRetry = async () => {
    if (!onRefreshUrl) return;
    setErrorMessage(null);
    try {
      const newUrl = await onRefreshUrl();
      if (newUrl && audioRef.current) {
        audioRef.current.src = newUrl;
        audioRef.current.load();
        setStatus('ready');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Failed to refresh link');
    }
  };

  const handleProgressBarSeekStart = () => {
    isSeekingRef.current = true;
  };

  const handleProgressBarSeekEnd = () => {
    isSeekingRef.current = false;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0d1117] text-gray-100">
      <audio ref={audioRef} preload="auto" crossOrigin="anonymous" />

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
              {/* Player */}
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
                        className="w-5 h-5"
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

              {/* Right: chapters + Now Playing mini bar when panel open */}
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
