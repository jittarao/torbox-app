import { useEffect, useRef, useCallback } from 'react';
import { getUserPresenceSnapshot, useUserPresenceStore } from '@/store/userPresenceStore';
import { usePollTimer } from './usePollTimer';

/**
 * Visibility- and idle-aware polling for download lists.
 * Reads global presence from userPresenceStore (mounted in AppShell).
 *
 * @param {Object} options
 * @param {string} options.type - Active view type: torrents | usenet | webdl | all
 * @param {boolean} options.pollingPaused - True when any pause reason is active
 * @param {(assetType: string) => void | Promise<void>} options.onPoll - Per-type fetch
 * @param {(assetType?: string) => boolean} options.isRateLimited
 * @param {() => void} [options.onPollSkipped] - Called when a tick is skipped due to rate limiting
 * @param {(schedule: import('./pollSchedule').PollSchedule) => void} [options.onScheduleUpdate] - Poll timer state for UI
 */
export function useDownloadListPolling({
  type,
  pollingPaused,
  onPoll,
  isRateLimited,
  onPollSkipped,
  onScheduleUpdate,
}) {
  const onReEngagedRef = useRef(() => {});
  const onDisengagedRef = useRef(() => {});

  useEffect(() => {
    const unsubRe = useUserPresenceStore.getState().subscribeReEngaged((immediateRefresh) => {
      onReEngagedRef.current?.(immediateRefresh);
    });
    const unsubDis = useUserPresenceStore.getState().subscribeDisengaged(() => {
      onDisengagedRef.current?.();
    });
    return () => {
      unsubRe();
      unsubDis();
    };
  }, []);

  usePollTimer({
    type,
    pollingPaused,
    onPoll,
    isRateLimited,
    onPollSkipped,
    onScheduleUpdate,
    getUserPresence: useCallback(() => getUserPresenceSnapshot(), []),
    onReEngagedRef,
    onDisengagedRef,
  });
}
