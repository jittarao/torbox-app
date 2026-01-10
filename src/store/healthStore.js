import { create } from 'zustand';

const API_HEALTH_TIMEOUT = 5000; // 5 seconds

export const useHealthStore = create((set, get) => ({
  localHealth: 'unknown',
  apiHealth: 'unknown',
  lastCheck: null,
  error: null,
  currentApiKey: null,
  checkingHealth: false,

  // Reset health when API key changes
  setApiKey: (apiKey) => {
    const { currentApiKey } = get();
    if (currentApiKey !== apiKey) {
      set({
        currentApiKey: apiKey,
        apiHealth: 'unknown',
        error: null,
      });
    }
  },

  // Check local application health
  checkLocalHealth: async () => {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        signal: AbortSignal.timeout(API_HEALTH_TIMEOUT),
      });

      if (response.ok) {
        const data = await response.json();
        set({
          localHealth: data.status === 'healthy' ? 'healthy' : 'unhealthy',
          error: null,
        });
      } else {
        set({
          localHealth: 'unhealthy',
          error: 'Local health check failed',
        });
      }
    } catch (err) {
      set({
        localHealth: 'unhealthy',
        error: err.message,
      });
    }
  },

  // Check TorBox API health (only if we have an API key)
  checkApiHealth: async (apiKey) => {
    if (!apiKey) {
      set({ apiHealth: 'no-key' });
      return;
    }

    const { currentApiKey } = get();

    // Update API key in store (this will reset apiHealth if changed)
    get().setApiKey(apiKey);

    try {
      const response = await fetch('/api/health/torbox', {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
        },
        signal: AbortSignal.timeout(API_HEALTH_TIMEOUT),
      });

      if (response.ok) {
        const data = await response.json();
        set({
          apiHealth: data.status,
          error: data.status === 'healthy' ? null : data.message,
        });
      } else {
        set({
          apiHealth: 'unhealthy',
          error: 'Failed to check TorBox API health',
        });
      }
    } catch (err) {
      set({
        apiHealth: 'unhealthy',
        error: err.message,
      });
    }
  },

  // Combined health check
  performHealthCheck: async (apiKey) => {
    const { checkingHealth } = get();

    // Prevent duplicate concurrent calls
    if (checkingHealth) {
      return;
    }

    set({ lastCheck: new Date(), checkingHealth: true });

    try {
      // Check both local and API health in parallel
      await Promise.all([
        get().checkLocalHealth(),
        get().checkApiHealth(apiKey),
      ]);
    } finally {
      set({ checkingHealth: false });
    }
  },
}));
