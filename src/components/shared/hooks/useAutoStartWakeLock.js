import { useEffect, useRef } from 'react';

/** @type {WakeLockSentinel | null} */
let activeWakeLock = null;

async function requestScreenWakeLock() {
  if (typeof navigator === 'undefined' || !navigator.wakeLock?.request) {
    return;
  }

  try {
    if (activeWakeLock && !activeWakeLock.released) {
      return;
    }
    activeWakeLock = await navigator.wakeLock.request('screen');
    activeWakeLock.addEventListener('release', () => {
      activeWakeLock = null;
    });
  } catch {
    // Unsupported or denied — non-fatal.
  }
}

function releaseScreenWakeLock() {
  if (activeWakeLock && !activeWakeLock.released) {
    activeWakeLock.release().catch(() => {});
  }
  activeWakeLock = null;
}

/**
 * Keep the screen awake while auto-start has queued work to process.
 *
 * @param {Object} options
 * @param {boolean} options.enabled
 * @param {boolean} options.hasWork
 */
export function useAutoStartWakeLock({ enabled, hasWork }) {
  const shouldHold = enabled && hasWork;
  const shouldHoldRef = useRef(shouldHold);

  useEffect(() => {
    shouldHoldRef.current = shouldHold;
  }, [shouldHold]);

  useEffect(() => {
    if (!shouldHold) {
      releaseScreenWakeLock();
      return;
    }

    requestScreenWakeLock();

    const handleVisibility = () => {
      if (!shouldHoldRef.current) return;
      if (document.visibilityState === 'visible') {
        requestScreenWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      releaseScreenWakeLock();
    };
  }, [shouldHold]);
}

/** @internal — test helper */
export function resetWakeLockForTests() {
  releaseScreenWakeLock();
}
