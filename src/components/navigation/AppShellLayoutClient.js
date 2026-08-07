'use client';

import AppShell from '@/components/navigation/AppShell';
import ActivityBeacon from '@/components/shared/ActivityBeacon';
import { FileHandler } from '@/components/shared/FileHandler';
import { useSession } from '@/components/shared/hooks/useSession';

/**
 * Persistent chrome for authenticated main-app routes.
 * Mounted once under (app)/layout (inside ApiKeyGate) so sidebar/polling
 * survive client navigations. Only renders when a session API key is present.
 *
 * ActivityBeacon / FileHandler live here (not locale layout) so landing,
 * session-await, and admin never mount share-target listeners or activity pings.
 */
export default function AppShellLayoutClient({ children }) {
  const { apiKey } = useSession();

  return (
    <AppShell apiKey={apiKey} className="min-h-dvh bg-surface dark:bg-surface-dark font-sans">
      <FileHandler />
      <ActivityBeacon />
      {children}
    </AppShell>
  );
}
