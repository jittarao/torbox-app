import { useEffect, useRef, useCallback, useMemo } from 'react';
import { POLLING_CONFIG } from './pollingConfig';

const USER_ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'];

/**
 * Tracks tab visibility and user idle state.
 * Calls onReEngaged when the user returns (optional immediate refresh).
 * Calls onDisengaged when the tab is hidden or the user goes idle.
 *
 * @param {Object} options
 * @param {boolean} options.pollingPaused
 * @param {(immediateRefresh?: boolean) => void} options.onReEngaged
 * @param {() => void} options.onDisengaged
 */
export function useUserPresence({ pollingPaused, onReEngaged, onDisengaged }) {
  const awaySinceRef = useRef(null);
  const isVisibleRef = useRef(typeof document !== 'undefined' && document.visibilityState === 'visible');
  const userIdleRef = useRef(false);
  const wasDisengagedRef = useRef(false);
  const idleTimeoutIdRef = useRef(null);
  const onReEngagedRef = useRef(onReEngaged);
  const onDisengagedRef = useRef(onDisengaged);

  useEffect(() => { onReEngagedRef.current = onReEngaged; }, [onReEngaged]);
  useEffect(() => { onDisengagedRef.current = onDisengaged; }, [onDisengaged]);

  const clearIdleTimeout = useCallback(() => {
    if (idleTimeoutIdRef.current) {
      clearTimeout(idleTimeoutIdRef.current);
      idleTimeoutIdRef.current = null;
    }
  }, []);

  const notifyReEngaged = useCallback((immediateRefresh) => {
    awaySinceRef.current = null;
    wasDisengagedRef.current = false;
    onReEngagedRef.current?.(immediateRefresh);
  }, []);

  const resetIdleTimer = useCallback(() => {
    clearIdleTimeout();
    if (!isVisibleRef.current || pollingPaused) return;
    idleTimeoutIdRef.current = setTimeout(() => {
      idleTimeoutIdRef.current = null;
      if (!isVisibleRef.current || pollingPaused) return;
      userIdleRef.current = true;
      if (awaySinceRef.current == null) {
        awaySinceRef.current = Date.now();
      }
      wasDisengagedRef.current = true;
      onDisengagedRef.current?.();
    }, POLLING_CONFIG.userIdleThresholdMs);
  }, [pollingPaused, clearIdleTimeout]);

  useEffect(() => {
    if (!isVisibleRef.current) {
      awaySinceRef.current = Date.now();
      wasDisengagedRef.current = true;
    }

    const markUserActive = () => {
      if (!isVisibleRef.current || pollingPaused) return;
      const wasIdle = userIdleRef.current;
      userIdleRef.current = false;
      resetIdleTimer();
      if (wasIdle) {
        notifyReEngaged(true);
      }
    };

    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
      if (!isVisibleRef.current) {
        awaySinceRef.current = Date.now();
        wasDisengagedRef.current = true;
        userIdleRef.current = false;
        clearIdleTimeout();
        onDisengagedRef.current?.();
        return;
      }

      userIdleRef.current = false;
      const immediateRefresh = wasDisengagedRef.current;
      notifyReEngaged(immediateRefresh);
      resetIdleTimer();
    };

    const handleWindowFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      if (pollingPaused) return;
      if (wasDisengagedRef.current) {
        notifyReEngaged(true);
      }
      markUserActive();
    };

    const onUserActivity = () => {
      markUserActive();
    };

    if (isVisibleRef.current) {
      resetIdleTimer();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    USER_ACTIVITY_EVENTS.forEach((name) =>
      document.addEventListener(name, onUserActivity, { passive: true })
    );

    return () => {
      clearIdleTimeout();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      USER_ACTIVITY_EVENTS.forEach((name) =>
        document.removeEventListener(name, onUserActivity)
      );
    };
  }, [pollingPaused, resetIdleTimer, clearIdleTimeout, notifyReEngaged]);

  return useMemo(
    () => ({
      isVisible: () => isVisibleRef.current,
      isUserIdle: () => userIdleRef.current,
      wasDisengaged: () => wasDisengagedRef.current,
      awaySince: () => awaySinceRef.current,
      isDisengaged: () => !isVisibleRef.current || userIdleRef.current,
    }),
    []
  );
}
