import { create } from 'zustand';

import {
  appendHistoryEntry,
  loadHealthHistory,
  saveHealthHistory,
  statusToSegment,
} from '@/utils/healthHistory';
import { useBackendModeStore } from '@/store/backendModeStore';
import { usePollingPauseStore } from '@/store/pollingPauseStore';

/** Interval between automatic platform / TorBox / backend status checks */
const HEALTH_CHECK_INTERVAL_MS = 180000; // 3 minutes

/** Minimum time between non-forced health checks (e.g. opening the status panel) */
const MIN_HEALTH_CHECK_GAP_MS = 60000; // 1 minute

const HEALTH_TIMEOUT_MS = 10000;

let healthPollTimer = null;
let healthPollApiKey = null;
let healthPollSubscribers = 0;

const initialCheckState = () => ({
  status: 'unknown',
  message: null,
  responseTime: null,
});

export const useHealthStore = create((set, get) => ({
  platformHealth: initialCheckState(),
  connectionHealth: initialCheckState(),
  backendHealth: initialCheckState(),
  lastCheck: null,
  currentApiKey: null,
  checkingHealth: false,
  historyLoaded: false,
  platformHistory: [],

  loadHistory: () => {
    if (get().historyLoaded) {
      return;
    }
    set({
      historyLoaded: true,
      platformHistory: loadHealthHistory(),
    });
  },

  recordPlatformSnapshot: () => {
    const { platformHealth, platformHistory } = get();
    const nextPlatform = appendHistoryEntry(
      platformHistory,
      statusToSegment(platformHealth.status, platformHealth.responseTime)
    );

    saveHealthHistory(nextPlatform);
    set({ platformHistory: nextPlatform });
  },

  setApiKey: (apiKey) => {
    const { currentApiKey } = get();
    if (currentApiKey !== apiKey) {
      set({
        currentApiKey: apiKey,
        connectionHealth: initialCheckState(),
      });
    }
  },

  checkPlatformHealth: async () => {
    try {
      const response = await fetch('/api/health/platform', {
        method: 'GET',
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });

      const data = await response.json().catch(() => ({}));
      set({
        platformHealth: {
          status: data.status === 'healthy' ? 'healthy' : 'unhealthy',
          message: data.status === 'healthy' ? null : data.message,
          responseTime: data.responseTime ?? null,
        },
      });
    } catch (err) {
      set({
        platformHealth: {
          status: 'unhealthy',
          message: err.message,
          responseTime: null,
        },
      });
    }
  },

  checkConnectionHealth: async (apiKey) => {
    if (!apiKey) {
      set({
        connectionHealth: {
          status: 'no-key',
          message: null,
          responseTime: null,
        },
      });
      return;
    }

    get().setApiKey(apiKey);

    try {
      if (get().currentApiKey !== apiKey) {
        return;
      }

      const response = await fetch('/api/health/torbox', {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
        },
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });

      if (get().currentApiKey !== apiKey) {
        return;
      }

      const data = await response.json().catch(() => ({}));
      const status = data.status || 'unhealthy';

      set({
        connectionHealth: {
          status,
          message: status === 'healthy' ? null : data.message,
          responseTime: data.responseTime ?? null,
        },
      });
    } catch (err) {
      if (get().currentApiKey !== apiKey) {
        return;
      }
      set({
        connectionHealth: {
          status: 'unhealthy',
          message: err.message,
          responseTime: null,
        },
      });
    }
  },

  checkBackendHealth: async () => {
    const backendStore = useBackendModeStore.getState();

    const applyBackendMode = (mode) => {
      set({
        backendHealth: {
          status: mode === 'backend' ? 'healthy' : 'unavailable',
          message: null,
          responseTime: null,
        },
      });
    };

    if (backendStore.hasChecked) {
      applyBackendMode(backendStore.mode);
      return;
    }

    if (!backendStore.isChecking) {
      await backendStore.checkBackend();
    }

    const { mode, hasChecked } = useBackendModeStore.getState();
    if (hasChecked) {
      applyBackendMode(mode);
      return;
    }

    try {
      const response = await fetch('/api/backend/status', {
        method: 'GET',
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });

      const data = await response.json().catch(() => ({}));
      applyBackendMode(data.available ? 'backend' : 'local');
    } catch (err) {
      set({
        backendHealth: {
          status: 'unavailable',
          message: err.message,
          responseTime: null,
        },
      });
    }
  },

  performHealthCheck: async (apiKey, options = {}) => {
    const { force = false } = options;
    const { checkingHealth, lastCheck } = get();

    if (checkingHealth) {
      return;
    }

    if (!force && lastCheck && Date.now() - lastCheck.getTime() < MIN_HEALTH_CHECK_GAP_MS) {
      return;
    }

    set({ lastCheck: new Date(), checkingHealth: true });

    try {
      await Promise.all([
        get().checkPlatformHealth(),
        get().checkConnectionHealth(apiKey),
        get().checkBackendHealth(),
      ]);
    } finally {
      get().recordPlatformSnapshot();
      set({ checkingHealth: false });
    }
  },

  startHealthPolling: (apiKey) => {
    healthPollSubscribers += 1;
    healthPollApiKey = apiKey;

    if (healthPollTimer) {
      return;
    }

    get().performHealthCheck(apiKey, { force: true });

    healthPollTimer = setInterval(() => {
      if (usePollingPauseStore.getState().isPollingPaused()) {
        return;
      }
      get().performHealthCheck(healthPollApiKey, { force: true });
    }, HEALTH_CHECK_INTERVAL_MS);
  },

  stopHealthPolling: () => {
    healthPollSubscribers = Math.max(0, healthPollSubscribers - 1);
    if (healthPollSubscribers > 0) {
      return;
    }
    if (healthPollTimer) {
      clearInterval(healthPollTimer);
      healthPollTimer = null;
    }
    healthPollApiKey = null;
  },
}));
