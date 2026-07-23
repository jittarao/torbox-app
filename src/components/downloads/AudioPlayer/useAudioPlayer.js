import { readJsonFromResponse } from '@/utils/fetchResponse';
import { useRef, useState, useEffect, useCallback } from 'react';
import { SKIP_SECONDS, POSITION_SAVE_INTERVAL_SEC } from './constants';
import {
  loadPosition,
  loadSpeed,
  loadVolume,
  savePosition,
  saveSpeed,
  saveVolume,
} from './storage';
import { useAudioKeyboard } from './useAudioKeyboard';
import { hasChapterSupport } from '../utils/videoDetection';

export function useAudioPlayer({ audioUrl, fileName, itemId, fileId, apiKey, onRefreshUrl }) {
  const hasChaptersSupport = hasChapterSupport({ name: fileName });
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
  const [volume, setVolume] = useState(() => loadVolume());
  const volumeRef = useRef(volume);
  const [playbackSpeed, setPlaybackSpeed] = useState(() => loadSpeed(itemId, fileId));
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
      const { ok: responseOk, data } = await readJsonFromResponse(res);
      if (responseOk && data.chapters && Array.isArray(data.chapters)) {
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
    volumeRef.current = volume;
  }, [volume]);

  const handlePlayPause = useCallback(() => {
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
  }, [isPlaying, itemId, fileId]);

  const skip = useCallback(
    (delta) => {
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
    },
    [isPlaying, itemId, fileId]
  );

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
    const next = Math.max(0, Math.min(1, volumeRef.current + delta));
    volumeRef.current = next;
    setVolume(next);
    saveVolume(next);
    if (next > 0) volumeBeforeMuteRef.current = next;
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
      if (!newUrl) {
        setStatus('error');
        setErrorMessage('Could not refresh link');
        return;
      }
      setStatus('ready');
      // Parent updates audioUrl; the main useEffect (audioUrl dep) will set src and load() once
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
  return {
    audioUrl,
    playback: {
      playing: isPlaying,
      seeking: isSeekingInProgress,
      chaptersSupport: hasChaptersSupport,
    },
    audioRef,
    currentTime,
    duration,
    buffered,
    volume,
    playbackSpeed,
    seekValue,
    status,
    errorMessage,
    chapters,
    chaptersLoading,
    menus: {
      speed: showSpeedMenu,
      timer: showTimerMenu,
      volume: showVolumeSlider,
      chapters: showChaptersPanel,
    },
    setShowSpeedMenu,
    setShowTimerMenu,
    setShowVolumeSlider,
    sleepTimer,
    setSleepTimer,
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
  };
}
