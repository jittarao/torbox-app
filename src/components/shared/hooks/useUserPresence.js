import { useEffect, useRef, useCallback } from 'react';
import { useUserPresenceStore } from '@/store/userPresenceStore';
import { POLLING_CONFIG } from './pollingConfig';
import { shouldReEngageOnMediaUnpause } from './userPresenceTransitions';

const USER_ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'];

/**
 * Tracks tab visibility, desktop window presence, and user idle state.
 * Publishes state to userPresenceStore and calls optional re-engage/disengage callbacks.
 *
 * @param {Object} options
 * @param {boolean} options.pollingPaused
 * @param {(immediateRefresh?: boolean) => void} [options.onReEngaged]
 * @param {() => void} [options.onDisengaged]
 */
export function useUserPresence({ pollingPaused, onReEngaged, onDisengaged }) {
  const lastImmediateRefreshAtRef = useRef(0);
  const idleTimeoutIdRef = useRef(null);
  const onReEngagedRef = useRef(onReEngaged);
  const onDisengagedRef = useRef(onDisengaged);
  const prevPollingPausedRef = useRef(pollingPaused);

  useEffect(() => {
    onReEngagedRef.current = onReEngaged;
  }, [onReEngaged]);
  useEffect(() => {
    onDisengagedRef.current = onDisengaged;
  }, [onDisengaged]);

  const setPresence = useCallback((partial) => {
    useUserPresenceStore.getState().setPresence(partial);
  }, []);

  const clearIdleTimeout = useCallback(() => {
    if (idleTimeoutIdRef.current) {
      clearTimeout(idleTimeoutIdRef.current);
      idleTimeoutIdRef.current = null;
    }
  }, []);

  const isEffectivelyPresent = useCallback(() => {
    const { isVisible, desktopDisengaged } = useUserPresenceStore.getState();
    return isVisible && !desktopDisengaged;
  }, []);

  const notifyReEngaged = useCallback(
    (immediateRefresh) => {
      setPresence({ awaySince: null, wasDisengaged: false });
      if (immediateRefresh) {
        lastImmediateRefreshAtRef.current = Date.now();
      }
      onReEngagedRef.current?.(immediateRefresh);
    },
    [setPresence]
  );

  const notifyDisengaged = useCallback(() => {
    onDisengagedRef.current?.();
  }, []);

  const resetIdleTimer = useCallback(() => {
    clearIdleTimeout();
    if (!isEffectivelyPresent() || pollingPaused) return;
    idleTimeoutIdRef.current = setTimeout(() => {
      idleTimeoutIdRef.current = null;
      if (!isEffectivelyPresent() || pollingPaused) return;
      const { awaySince } = useUserPresenceStore.getState();
      setPresence({
        isUserIdle: true,
        awaySince: awaySince ?? Date.now(),
        wasDisengaged: true,
      });
      notifyDisengaged();
    }, POLLING_CONFIG.userIdleThresholdMs);
  }, [pollingPaused, clearIdleTimeout, isEffectivelyPresent, setPresence, notifyDisengaged]);

  const applyDesktopEngaged = useCallback(
    (engaged) => {
      const { awaySince, wasDisengaged } = useUserPresenceStore.getState();

      if (!engaged) {
        setPresence({
          desktopDisengaged: true,
          isUserIdle: false,
          awaySince: awaySince ?? Date.now(),
          wasDisengaged: true,
        });
        clearIdleTimeout();
        notifyDisengaged();
        return;
      }

      setPresence({ desktopDisengaged: false, isUserIdle: false });
      const immediateRefresh = wasDisengaged;
      notifyReEngaged(immediateRefresh);
      resetIdleTimer();
    },
    [clearIdleTimeout, notifyReEngaged, resetIdleTimer, setPresence, notifyDisengaged]
  );

  useEffect(() => {
    let cancelled = false;
    /** @type {import('@tauri-apps/api/event').UnlistenFn | null} */
    let unlisten = null;

    (async () => {
      const { isTauriEnvironment, getWindowEngaged } = await import('@/desktop/desktopBridge');
      if (!isTauriEnvironment() || cancelled) return;

      const engaged = await getWindowEngaged();
      if (!cancelled && engaged != null) {
        applyDesktopEngaged(engaged);
      }

      const { onWindowPresenceChanged } = await import('@/desktop/events');
      unlisten = await onWindowPresenceChanged((payload) => {
        if (cancelled) return;

        applyDesktopEngaged(payload?.engaged === true);
      });
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [applyDesktopEngaged]);

  useEffect(() => {
    const wasPaused = prevPollingPausedRef.current;
    prevPollingPausedRef.current = pollingPaused;

    if (
      shouldReEngageOnMediaUnpause({
        wasPaused,
        pollingPaused,
        isEffectivelyPresent: isEffectivelyPresent(),
        isUserIdle: useUserPresenceStore.getState().isUserIdle,
      })
    ) {
      notifyReEngaged(true);
      resetIdleTimer();
    }
  }, [pollingPaused, isEffectivelyPresent, notifyReEngaged, resetIdleTimer]);

  useEffect(() => {
    const { isVisible } = useUserPresenceStore.getState();
    if (!isVisible) {
      setPresence({
        awaySince: Date.now(),
        wasDisengaged: true,
      });
    }

    const markUserActive = () => {
      if (!isEffectivelyPresent() || pollingPaused) return;
      const { isUserIdle } = useUserPresenceStore.getState();
      const wasIdle = isUserIdle;
      setPresence({ isUserIdle: false });
      resetIdleTimer();
      if (wasIdle) {
        const refreshedRecently = Date.now() - lastImmediateRefreshAtRef.current < 2_000;
        notifyReEngaged(!refreshedRecently);
      }
    };

    const handlePageShow = (event) => {
      if (!event.persisted) return;
      const visible = document.visibilityState === 'visible';
      setPresence({ isVisible: visible });
      if (!visible || !isEffectivelyPresent()) return;
      setPresence({ isUserIdle: false });
      const { wasDisengaged } = useUserPresenceStore.getState();
      notifyReEngaged(wasDisengaged);
      resetIdleTimer();
    };

    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setPresence({ isVisible: visible });
      if (!visible) {
        setPresence({
          awaySince: Date.now(),
          wasDisengaged: true,
          isUserIdle: false,
        });
        clearIdleTimeout();
        notifyDisengaged();
        return;
      }

      if (!isEffectivelyPresent()) return;

      setPresence({ isUserIdle: false });
      const { wasDisengaged } = useUserPresenceStore.getState();
      notifyReEngaged(wasDisengaged);
      resetIdleTimer();
    };

    const handleWindowFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      if (!isEffectivelyPresent() || pollingPaused) return;
      const { wasDisengaged } = useUserPresenceStore.getState();
      if (wasDisengaged) {
        notifyReEngaged(true);
      }
      markUserActive();
    };

    const onUserActivity = () => {
      markUserActive();
    };

    if (isEffectivelyPresent()) {
      resetIdleTimer();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleWindowFocus);
    USER_ACTIVITY_EVENTS.forEach((name) =>
      document.addEventListener(name, onUserActivity, { passive: true })
    );

    return () => {
      clearIdleTimeout();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleWindowFocus);
      USER_ACTIVITY_EVENTS.forEach((name) => document.removeEventListener(name, onUserActivity));
    };
  }, [
    pollingPaused,
    resetIdleTimer,
    clearIdleTimeout,
    notifyReEngaged,
    isEffectivelyPresent,
    setPresence,
    notifyDisengaged,
  ]);
}
