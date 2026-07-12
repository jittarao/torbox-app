/**
 * Module-level backend availability cache (replaces backendModeStore).
 * Safe on server: isBackendAvailable() is always false during SSR.
 */

let snapshot = {
  mode: 'local',
  isLoading: true,
  error: null,
  hasChecked: false,
  isChecking: false,
};

let checkPromise = null;
let loggedOnce = false;

const listeners = new Set();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function setSnapshot(patch) {
  snapshot = { ...snapshot, ...patch };
  emit();
}

export function getBackendModeSnapshot() {
  return snapshot;
}

const serverSnapshot = {
  mode: 'local',
  isLoading: true,
  error: null,
  hasChecked: false,
  isChecking: false,
};

export function getServerBackendModeSnapshot() {
  return serverSnapshot;
}

export function subscribeBackendMode(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * True when the app is using the TorBox Manager backend (not local-only mode).
 */
export function isBackendAvailable() {
  if (typeof window === 'undefined') return false;
  return snapshot.mode === 'backend';
}

export async function checkBackendAvailability() {
  if (snapshot.isChecking || snapshot.hasChecked) {
    return checkPromise;
  }

  setSnapshot({ isChecking: true, isLoading: true, error: null });

  checkPromise = (async () => {
    try {
      const response = await fetch('/api/backend/status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        const detectedMode = data.available ? 'backend' : 'local';
        setSnapshot({
          mode: detectedMode,
          isLoading: false,
          isChecking: false,
          hasChecked: true,
        });
      } else {
        setSnapshot({
          mode: 'local',
          isLoading: false,
          isChecking: false,
          hasChecked: true,
        });
      }
    } catch (err) {
      if (typeof window !== 'undefined' && !loggedOnce) {
        console.log('Backend not available, using local storage mode');
        loggedOnce = true;
      }
      setSnapshot({
        mode: 'local',
        error: err.message,
        isLoading: false,
        isChecking: false,
        hasChecked: true,
      });
    } finally {
      checkPromise = null;
    }
  })();

  return checkPromise;
}

/** Reset cache (tests only). */
export function resetBackendModeCacheForTests() {
  snapshot = {
    mode: 'local',
    isLoading: true,
    error: null,
    hasChecked: false,
    isChecking: false,
  };
  checkPromise = null;
  loggedOnce = false;
  emit();
}

/** Force backend availability for tests (avoids mock.module cache issues). */
export function setBackendAvailableForTests(available = true) {
  setSnapshot({
    mode: available ? 'backend' : 'local',
    hasChecked: true,
    isLoading: false,
    isChecking: false,
  });
}
