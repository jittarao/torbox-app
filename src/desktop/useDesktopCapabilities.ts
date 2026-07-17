'use client';

import { useDesktopStore } from '@/store/desktopStore';

export function useDesktopCapabilities() {
  const available = useDesktopStore((state) => state.available);
  const initialized = useDesktopStore((state) => state.initialized);
  const hello = useDesktopStore((state) => state.hello);
  const credentialStatus = useDesktopStore((state) => state.credentialStatus);
  const refreshCredentialStatus = useDesktopStore((state) => state.refreshCredentialStatus);

  return {
    available,
    initialized,
    hello,
    capabilities: hello?.capabilities ?? null,
    platform: hello?.platform ?? null,
    appVersion: hello?.appVersion ?? null,
    protocolVersion: hello?.protocolVersion ?? null,
    instanceUrl: hello?.instanceUrl ?? null,
    credentialStatus,
    refreshCredentialStatus,
  };
}
