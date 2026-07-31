import { create } from 'zustand';
import { readJsonFromResponse } from '@/utils/fetchResponse';
import { useSessionStore } from '@/store/sessionStore';
import { getItem } from '@/utils/storage';

function getApiKey() {
  return useSessionStore.getState().apiKey || getItem('torboxApiKey');
}

function authHeaders(apiKey) {
  return { 'x-api-key': apiKey };
}

let fetchGeneration = 0;
let fetchAbortController = null;
let fetchPromise = null;

function abortFetch() {
  fetchAbortController?.abort();
  fetchAbortController = null;
  fetchPromise = null;
  fetchGeneration += 1;
}

export const useTmdbCredentialsStore = create((set, get) => ({
  configured: false,
  loading: false,
  mutating: false,
  error: null,
  hasLoaded: false,

  resetForSession: () => {
    abortFetch();
    set({ configured: false, loading: false, mutating: false, error: null, hasLoaded: false });
  },

  fetchStatus: async (options = {}) => {
    const force = options.force === true;
    const apiKey = getApiKey();
    if (!apiKey) {
      abortFetch();
      set({ error: 'API key is missing', configured: false, loading: false, hasLoaded: false });
      return;
    }

    if (!force && fetchPromise) {
      return fetchPromise;
    }

    if (!force && get().hasLoaded) {
      return;
    }

    abortFetch();
    const generation = fetchGeneration;
    const controller = new AbortController();
    fetchAbortController = controller;

    set({ loading: true, error: null });

    fetchPromise = (async () => {
      try {
        const res = await fetch('/api/tmdb/credentials', {
          headers: authHeaders(apiKey),
          signal: controller.signal,
        });
        if (generation !== fetchGeneration) return;

        const { ok, data } = await readJsonFromResponse(res);
        if (generation !== fetchGeneration) return;

        if (!ok || data.success === false || data.error) {
          set({
            loading: false,
            error: data.error || `Request failed: ${res.status}`,
            configured: false,
            hasLoaded: true,
          });
          return;
        }
        set({
          configured: Boolean(data.configured),
          loading: false,
          error: null,
          hasLoaded: true,
        });
      } catch (error) {
        if (error?.name === 'AbortError' || generation !== fetchGeneration) return;
        set({
          loading: false,
          error: 'Failed to load TMDB key status',
          configured: false,
          hasLoaded: true,
        });
      } finally {
        if (generation === fetchGeneration) {
          fetchPromise = null;
        }
      }
    })();

    return fetchPromise;
  },

  saveKey: async (apiKeyInput) => {
    const sessionKey = getApiKey();
    if (!sessionKey) return { success: false, error: 'API key is missing' };

    const trimmed = String(apiKeyInput || '').trim();
    if (!trimmed) return { success: false, error: 'TMDB API key is required' };

    set({ mutating: true, error: null });
    try {
      const res = await fetch('/api/tmdb/credentials', {
        method: 'PUT',
        headers: { ...authHeaders(sessionKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const { ok, data } = await readJsonFromResponse(res);
      if (!ok || data.success === false) {
        const error = data.error || data.code || `Request failed: ${res.status}`;
        set({ mutating: false, error });
        return { success: false, error };
      }
      set({ mutating: false, configured: true, error: null, hasLoaded: true });
      return { success: true };
    } catch {
      const error = 'Failed to save TMDB API key';
      set({ mutating: false, error });
      return { success: false, error };
    }
  },

  removeKey: async () => {
    const sessionKey = getApiKey();
    if (!sessionKey) return { success: false, error: 'API key is missing' };

    set({ mutating: true, error: null });
    try {
      const res = await fetch('/api/tmdb/credentials', {
        method: 'DELETE',
        headers: authHeaders(sessionKey),
      });
      const { ok, data } = await readJsonFromResponse(res);
      if (!ok || data.success === false) {
        const error = data.error || `Request failed: ${res.status}`;
        set({ mutating: false, error });
        return { success: false, error };
      }
      set({ mutating: false, configured: false, error: null, hasLoaded: true });
      return { success: true };
    } catch {
      const error = 'Failed to remove TMDB API key';
      set({ mutating: false, error });
      return { success: false, error };
    }
  },
}));
