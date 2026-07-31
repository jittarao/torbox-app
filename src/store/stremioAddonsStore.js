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
/** In-flight list fetch; concurrent callers share this promise. */
let fetchPromise = null;

function abortFetchAddons() {
  fetchAbortController?.abort();
  fetchAbortController = null;
  fetchPromise = null;
  fetchGeneration += 1;
}

/**
 * After addon list settles, retry a search that was waiting on addons.
 */
function retryPendingSearch() {
  // Lazy import avoids circular init issues (searchStore imports this store).
  import('@/store/searchStore')
    .then(({ useSearchStore }) => {
      const { pendingSearchQuery, pendingSearchOptions, fetchResults } = useSearchStore.getState();
      if (pendingSearchQuery) {
        fetchResults(pendingSearchQuery, pendingSearchOptions || {});
      }
    })
    .catch(() => {});
}

export const useStremioAddonsStore = create((set, get) => ({
  addons: [],
  loading: false,
  error: null,
  mutating: false,
  /** True after a list fetch settles (success or error) for the current session. */
  hasLoaded: false,

  resetForSession: () => {
    abortFetchAddons();
    set({ addons: [], loading: false, error: null, mutating: false, hasLoaded: false });
  },

  /**
   * Load installed addons. Concurrent callers share one in-flight request.
   * Subsequent calls no-op once hasLoaded unless `{ force: true }`.
   */
  fetchAddons: async (options = {}) => {
    const force = options.force === true;
    const apiKey = getApiKey();
    if (!apiKey) {
      abortFetchAddons();
      set({ error: 'API key is missing', addons: [], loading: false, hasLoaded: false });
      return;
    }

    if (!force && fetchPromise) {
      return fetchPromise;
    }

    if (!force && get().hasLoaded) {
      return;
    }

    abortFetchAddons();
    const generation = fetchGeneration;
    const controller = new AbortController();
    fetchAbortController = controller;

    set({ loading: true, error: null });

    fetchPromise = (async () => {
      try {
        const res = await fetch('/api/stremio/addons', {
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
            addons: [],
            hasLoaded: true,
          });
          return;
        }
        set({ addons: data.addons || [], loading: false, error: null, hasLoaded: true });
        retryPendingSearch();
      } catch (error) {
        if (error?.name === 'AbortError' || generation !== fetchGeneration) return;
        set({ loading: false, error: 'Failed to load addons', addons: [], hasLoaded: true });
      } finally {
        if (generation === fetchGeneration) {
          fetchPromise = null;
        }
      }
    })();

    return fetchPromise;
  },

  addAddon: async (manifestUrl) => {
    const apiKey = getApiKey();
    if (!apiKey) return { success: false, error: 'API key is missing' };

    set({ mutating: true, error: null });
    try {
      const res = await fetch('/api/stremio/addons', {
        method: 'POST',
        headers: { ...authHeaders(apiKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest_url: manifestUrl }),
      });
      const { ok, data } = await readJsonFromResponse(res);
      if (!ok || !data.success) {
        set({ mutating: false });
        return { success: false, error: data.error || `Request failed: ${res.status}` };
      }
      set((state) => ({
        addons: [...state.addons, data.addon],
        mutating: false,
      }));
      return { success: true, addon: data.addon };
    } catch {
      set({ mutating: false });
      return { success: false, error: 'Failed to add addon' };
    }
  },

  setEnabled: async (id, enabled) => {
    const apiKey = getApiKey();
    if (!apiKey) return { success: false, error: 'API key is missing' };

    const prevAddon = get().addons.find((a) => a.id === id);
    if (!prevAddon) return { success: false, error: 'Addon not found' };

    set((state) => ({
      addons: state.addons.map((a) => (a.id === id ? { ...a, enabled } : a)),
      mutating: true,
    }));

    try {
      const res = await fetch(`/api/stremio/addons/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(apiKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const { ok, data } = await readJsonFromResponse(res);
      if (!ok || !data.success) {
        set((state) => ({
          addons: state.addons.map((a) => (a.id === id ? { ...a, enabled: prevAddon.enabled } : a)),
          mutating: false,
        }));
        return { success: false, error: data.error || 'Failed to update addon' };
      }
      set((state) => ({
        addons: state.addons.map((a) => (a.id === id ? data.addon : a)),
        mutating: false,
      }));
      if (!enabled) {
        import('@/store/searchStore').then(({ useSearchStore }) => {
          useSearchStore.getState().invalidateAddonResults({
            addonRowId: id,
            addonId: data.addon?.addon_id || prevAddon.addon_id,
          });
        });
      }
      return { success: true };
    } catch {
      set((state) => ({
        addons: state.addons.map((a) => (a.id === id ? { ...a, enabled: prevAddon.enabled } : a)),
        mutating: false,
      }));
      return { success: false, error: 'Failed to update addon' };
    }
  },

  refreshAddon: async (id) => {
    const apiKey = getApiKey();
    if (!apiKey) return { success: false, error: 'API key is missing' };

    set({ mutating: true });
    try {
      const res = await fetch(`/api/stremio/addons/${id}/refresh`, {
        method: 'POST',
        headers: authHeaders(apiKey),
      });
      const { ok, data } = await readJsonFromResponse(res);
      if (!ok || !data.success) {
        set({ mutating: false });
        return { success: false, error: data.error || 'Failed to refresh addon' };
      }
      set((state) => ({
        addons: state.addons.map((a) => (a.id === id ? data.addon : a)),
        mutating: false,
      }));
      return { success: true };
    } catch {
      set({ mutating: false });
      return { success: false, error: 'Failed to refresh addon' };
    }
  },

  removeAddon: async (id) => {
    const apiKey = getApiKey();
    if (!apiKey) return { success: false, error: 'API key is missing' };

    const prevAddon = get().addons.find((a) => a.id === id);
    if (!prevAddon) return { success: false, error: 'Addon not found' };

    set((state) => ({
      addons: state.addons.filter((a) => a.id !== id),
      mutating: true,
    }));

    try {
      const res = await fetch(`/api/stremio/addons/${id}`, {
        method: 'DELETE',
        headers: authHeaders(apiKey),
      });
      const { ok, data } = await readJsonFromResponse(res);
      if (!ok || !data.success) {
        set((state) => {
          // Restore only this addon if still missing
          if (state.addons.some((a) => a.id === id)) {
            return { mutating: false };
          }
          return {
            addons: [...state.addons, prevAddon].sort(
              (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
            ),
            mutating: false,
          };
        });
        return { success: false, error: data.error || 'Failed to remove addon' };
      }
      set({ mutating: false });
      import('@/store/searchStore').then(({ useSearchStore }) => {
        useSearchStore.getState().invalidateAddonResults({
          addonRowId: id,
          addonId: prevAddon.addon_id,
        });
      });
      return { success: true };
    } catch {
      set((state) => {
        if (state.addons.some((a) => a.id === id)) {
          return { mutating: false };
        }
        return {
          addons: [...state.addons, prevAddon].sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
          ),
          mutating: false,
        };
      });
      return { success: false, error: 'Failed to remove addon' };
    }
  },

  reorderAddons: async (orderedIds) => {
    const apiKey = getApiKey();
    if (!apiKey) return { success: false, error: 'API key is missing' };

    const snapshot = get().addons.map((a) => ({ ...a }));
    const byId = new Map(snapshot.map((a) => [a.id, a]));
    const next = orderedIds
      .map((id, index) => {
        const addon = byId.get(id);
        return addon ? { ...addon, sort_order: index } : null;
      })
      .filter(Boolean);

    set({ addons: next, mutating: true });

    try {
      const res = await fetch('/api/stremio/addons/reorder', {
        method: 'PATCH',
        headers: { ...authHeaders(apiKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: orderedIds }),
      });
      const { ok, data } = await readJsonFromResponse(res);
      if (!ok || !data.success) {
        set({ addons: snapshot, mutating: false });
        return { success: false, error: data.error || 'Failed to reorder addons' };
      }
      set({ mutating: false });
      return { success: true };
    } catch {
      set({ addons: snapshot, mutating: false });
      return { success: false, error: 'Failed to reorder addons' };
    }
  },
}));
