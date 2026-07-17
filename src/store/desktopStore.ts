import { create } from 'zustand';
import * as desktopBridge from '@/desktop/desktopBridge';
import type { CredentialStatus, HelloResponse } from '@/desktop/capabilities';

type DesktopStoreState = {
  initialized: boolean;
  available: boolean;
  hello: HelloResponse | null;
  credentialStatus: CredentialStatus | null;
  initialize: () => Promise<void>;
  refreshHello: () => Promise<void>;
  refreshCredentialStatus: () => Promise<void>;
  setInstanceUrl: (url: string) => Promise<string | null>;
  syncApiKey: (apiKey: string) => Promise<boolean>;
  clearCredential: () => Promise<boolean>;
};

export const useDesktopStore = create<DesktopStoreState>((set, get) => ({
  initialized: false,
  available: false,
  hello: null,
  credentialStatus: null,

  initialize: async () => {
    if (get().initialized) {
      return;
    }

    const available = await desktopBridge.isAvailable();
    if (!available) {
      set({ initialized: true, available: false, hello: null, credentialStatus: null });
      return;
    }

    const hello = await desktopBridge.hello();
    const credentialStatus = await desktopBridge.getCredentialStatus();
    set({
      initialized: true,
      available: true,
      hello,
      credentialStatus,
    });
  },

  refreshHello: async () => {
    if (!(await desktopBridge.isAvailable())) {
      set({ available: false, hello: null });
      return;
    }
    const hello = await desktopBridge.hello();
    set({ available: true, hello });
  },

  refreshCredentialStatus: async () => {
    if (!(await desktopBridge.isAvailable())) {
      set({ credentialStatus: null });
      return;
    }
    const credentialStatus = await desktopBridge.getCredentialStatus();
    set({ credentialStatus });
  },

  setInstanceUrl: async (url: string) => {
    const normalized = await desktopBridge.setInstanceUrl(url);
    if (normalized) {
      await get().refreshHello();
    }
    return normalized;
  },

  syncApiKey: async (apiKey: string) => {
    const ok = await desktopBridge.syncApiKeyToDesktop(apiKey);
    if (ok) {
      await get().refreshCredentialStatus();
    }
    return ok;
  },

  clearCredential: async () => {
    const ok = await desktopBridge.clearDesktopCredential();
    if (ok) {
      await get().refreshCredentialStatus();
    }
    return ok;
  },
}));
