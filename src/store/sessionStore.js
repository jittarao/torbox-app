import { create } from 'zustand';
import { isValidTorboxApiKey } from '@/utils/apiKeyValidation';
import { fetchUserProfile, getUserPermissions } from '@/utils/userProfile';
import { useTagsStore } from '@/store/tagsStore';
import { useDownloadTagsStore } from '@/store/downloadTagsStore';
import { useCustomViewsStore } from '@/store/customViewsStore';
import { useAutomationRulesStore } from '@/store/automationRulesStore';
import { useNotificationsStore } from '@/store/notificationsStore';
import { useHealthStore } from '@/store/healthStore';
import { useRssStore } from '@/store/rssStore';
import { useDownloadsSelectionStore } from '@/store/downloadsSelectionStore';

function readStoredApiKey() {
  if (typeof localStorage === 'undefined') return '';

  try {
    const storedKey = localStorage.getItem('torboxApiKey');
    if (storedKey) return storedKey;

    const storedKeys = localStorage.getItem('torboxApiKeys');
    if (storedKeys) {
      const keys = JSON.parse(storedKeys);
      if (keys.length > 0) {
        localStorage.setItem('torboxApiKey', keys[0].key);
        return keys[0].key;
      }
    }
  } catch (error) {
    console.error('Error loading API key from localStorage:', error);
  }

  return '';
}

let permissionsLoadPromise = null;
let permissionsLoadKey = null;

function fanOutApiKey(apiKey, prevApiKey) {
  const keyChanged = prevApiKey !== apiKey;
  if (keyChanged) {
    useDownloadsSelectionStore.getState().resetForApiKey(apiKey);
  } else {
    useDownloadsSelectionStore.getState().setApiKeyScope(apiKey);
  }

  useTagsStore.getState().setApiKey(apiKey);
  useDownloadTagsStore.getState().setApiKey(apiKey);
  useCustomViewsStore.getState().setApiKey(apiKey);
  useAutomationRulesStore.getState().setApiKey(apiKey);
  useNotificationsStore.getState().setApiKey(apiKey);
  useHealthStore.getState().setApiKey(apiKey);
  useRssStore.getState().setApiKey(apiKey);
}

export const useSessionStore = create((set, get) => ({
  apiKey: '',
  hydrated: false,
  permissions: null,
  permissionsLoading: false,

  hydrateFromStorage: () => {
    if (get().hydrated) return;
    const apiKey = readStoredApiKey();
    set({ apiKey, hydrated: true });
    if (apiKey) {
      fanOutApiKey(apiKey, '');
    }
  },

  /** Sync session from route/AppShell apiKey prop (fan-out + permissions). */
  syncApiKey: (apiKey) => {
    const trimmed = (apiKey || '').trim();
    if (trimmed !== '' && !isValidTorboxApiKey(trimmed)) {
      return;
    }

    const { apiKey: current } = get();
    set({ hydrated: true });

    if (current !== trimmed) {
      set({
        apiKey: trimmed,
        permissions: null,
        permissionsLoading: Boolean(trimmed),
      });
    }

    fanOutApiKey(trimmed, current);

    if (trimmed) {
      get().loadPermissions(trimmed);
    } else {
      set({ permissions: null, permissionsLoading: false });
    }
  },

  setApiKey: (newKey) => {
    const trimmed = (newKey || '').trim();
    if (trimmed !== '' && !isValidTorboxApiKey(trimmed)) {
      return;
    }

    const { apiKey: current } = get();

    set({
      apiKey: trimmed,
      permissions: null,
      permissionsLoading: Boolean(trimmed),
    });

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('torboxApiKey', trimmed);
    }

    fanOutApiKey(trimmed, current);

    if (trimmed) {
      get().loadPermissions(trimmed);
    } else {
      set({ permissions: null, permissionsLoading: false });
    }
  },

  loadPermissions: async (apiKey = get().apiKey) => {
    if (!apiKey || apiKey.length < 20) {
      set({ permissions: null, permissionsLoading: false });
      return null;
    }

    if (permissionsLoadPromise && permissionsLoadKey === apiKey) {
      return permissionsLoadPromise;
    }

    permissionsLoadKey = apiKey;
    set({ permissionsLoading: true });

    permissionsLoadPromise = (async () => {
      try {
        const userData = await fetchUserProfile(apiKey);
        if (get().apiKey !== apiKey) {
          return null;
        }
        const permissions = userData ? getUserPermissions(userData) : null;
        set({ permissions, permissionsLoading: false });
        return permissions;
      } catch (error) {
        console.error('Error fetching user profile:', error);
        if (get().apiKey === apiKey) {
          set({ permissions: null, permissionsLoading: false });
        }
        return null;
      } finally {
        if (permissionsLoadKey === apiKey) {
          permissionsLoadPromise = null;
          permissionsLoadKey = null;
        }
      }
    })();

    return permissionsLoadPromise;
  },
}));
