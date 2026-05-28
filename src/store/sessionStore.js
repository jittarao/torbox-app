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

function fanOutApiKey(apiKey) {
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
      fanOutApiKey(apiKey);
    }
  },

  setApiKey: (newKey) => {
    const trimmed = (newKey || '').trim();
    if (trimmed !== '' && !isValidTorboxApiKey(trimmed)) {
      return;
    }

    set({ apiKey: trimmed, permissions: trimmed ? get().permissions : null });

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('torboxApiKey', trimmed);
    }

    fanOutApiKey(trimmed);

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

    set({ permissionsLoading: true });

    try {
      const userData = await fetchUserProfile(apiKey);
      const permissions = userData ? getUserPermissions(userData) : null;
      set({ permissions, permissionsLoading: false });
      return permissions;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      set({ permissions: null, permissionsLoading: false });
      return null;
    }
  },
}));
