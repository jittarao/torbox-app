import { create } from 'zustand';
import { startTransition } from 'react';
import { isValidTorboxApiKey } from '@/utils/apiKeyValidation';
import { fetchUserProfile, getUserPermissions } from '@/utils/userProfile';
import { getItem, setItem } from '@/utils/storage';
import { useTagsStore } from '@/store/tagsStore';
import { useDownloadTagsStore } from '@/store/downloadTagsStore';
import { useCustomViewsStore } from '@/store/customViewsStore';
import { useAutomationRulesStore } from '@/store/automationRulesStore';
import { useNotificationsStore } from '@/store/notificationsStore';
import { useHealthStore } from '@/store/healthStore';
import { useRssStore } from '@/store/rssStore';
import { useDownloadsSelectionStore } from '@/store/downloadsSelectionStore';
import { useSearchStore } from '@/store/searchStore';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { useDownloadsPlayerStore } from '@/store/downloadsPlayerStore';
import { useFileInteractionStore } from '@/store/fileInteractionStore';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';

function readStoredApiKey() {
  try {
    const storedKey = getItem('torboxApiKey');
    if (storedKey) return storedKey;

    const storedKeys = getItem('torboxApiKeys');
    if (storedKeys) {
      const keys = JSON.parse(storedKeys);
      if (keys.length > 0) {
        setItem('torboxApiKey', keys[0].key);
        return keys[0].key;
      }
    }
  } catch (error) {
    console.error('Error loading API key from localStorage:', error);
  }

  return '';
}

function fanOutApiKey(apiKey, prevApiKey) {
  startTransition(() => {
    const keyChanged = prevApiKey !== apiKey;
    if (keyChanged && prevApiKey) {
      useDownloadsSelectionStore.getState().resetForApiKey(apiKey);
      useSearchStore.getState().resetForSession();
      useDownloadsUiStore.getState().resetUi();
      useDownloadsPlayerStore.getState().closeAll();
      useFileInteractionStore.getState().clearAll();
      useDownloadHistoryStore.getState().clearDownloadHistory();
    } else if (keyChanged) {
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
  });
}

export const useSessionStore = create((set, get) => ({
  apiKey: '',
  hydrated: false,
  userData: null,
  permissions: null,
  permissionsLoading: false,
  _permissionsLoadPromise: null,
  _permissionsLoadKey: null,

  hydrateFromStorage: () => {
    const { hydrated, apiKey: current } = get();
    const storedKey = readStoredApiKey();

    if (hydrated && current) return;
    if (hydrated && !storedKey) return;

    set({ apiKey: storedKey, hydrated: true });
    if (storedKey && storedKey !== current) {
      fanOutApiKey(storedKey, current);
    }
  },

  /** Sync session from route/AppShell apiKey prop (fan-out + permissions). */
  syncApiKey: (apiKey) => {
    const trimmed = (apiKey || '').trim();
    if (trimmed !== '' && !isValidTorboxApiKey(trimmed)) {
      return;
    }

    const { apiKey: current } = get();
    // AppShell can mount before useSession reads localStorage; ignore stale empty props.
    if (trimmed === '' && current) {
      return;
    }
    set({ hydrated: true });

    if (current !== trimmed) {
      set({
        apiKey: trimmed,
        userData: null,
        permissions: null,
        permissionsLoading: Boolean(trimmed),
      });
    }

    fanOutApiKey(trimmed, current);

    if (trimmed) {
      get().loadPermissions(trimmed);
    } else {
      set({ userData: null, permissions: null, permissionsLoading: false });
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
      userData: null,
      permissions: null,
      permissionsLoading: Boolean(trimmed),
    });

    setItem('torboxApiKey', trimmed);

    fanOutApiKey(trimmed, current);

    if (trimmed) {
      get().loadPermissions(trimmed);
    } else {
      set({ userData: null, permissions: null, permissionsLoading: false });
    }
  },

  loadPermissions: async (apiKey = get().apiKey) => {
    if (!apiKey || apiKey.length < 20) {
      set({ userData: null, permissions: null, permissionsLoading: false });
      return null;
    }

    const { _permissionsLoadPromise, _permissionsLoadKey } = get();
    if (_permissionsLoadPromise && _permissionsLoadKey === apiKey) {
      return _permissionsLoadPromise;
    }

    set({ _permissionsLoadKey: apiKey, permissionsLoading: true });

    const promise = (async () => {
      try {
        const userData = await fetchUserProfile(apiKey);
        if (get().apiKey !== apiKey) {
          return null;
        }
        const permissions = userData ? getUserPermissions(userData) : null;
        set({ userData, permissions, permissionsLoading: false });
        return permissions;
      } catch (error) {
        console.error('Error fetching user profile:', error);
        if (get().apiKey === apiKey) {
          set({ userData: null, permissions: null, permissionsLoading: false });
        }
        return null;
      } finally {
        if (get()._permissionsLoadKey === apiKey) {
          set({ _permissionsLoadPromise: null, _permissionsLoadKey: null });
        }
      }
    })();

    set({ _permissionsLoadPromise: promise });
    return promise;
  },
}));
