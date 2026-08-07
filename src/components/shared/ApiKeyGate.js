'use client';

import dynamic from 'next/dynamic';
import useIsClient from '@/hooks/useIsClient';
import AppShellLayoutClient from '@/components/navigation/AppShellLayoutClient';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { useSession } from '@/components/shared/hooks/useSession';

const landingShell = <div className="min-h-dvh bg-[#0a0a0b]" aria-hidden />;

const LandingPage = dynamic(() => import('@/components/LandingPage'), {
  loading: () => landingShell,
  ssr: false,
});

/** Full-viewport placeholder while session hydrates — no chrome. */
const awaitingShell = <div className="min-h-dvh bg-[#0a0a0b] font-sans" aria-hidden inert />;

/**
 * Auth boundary for (app) routes.
 * Always keeps `{children}` (the page segment) in the tree so Instant Navigation
 * can validate routes. AppShell mounts only when authenticated; landing/await
 * show chrome-free UI and hide the page segment visually.
 */
export default function ApiKeyGate({ children }) {
  const { apiKey, hydrated, setApiKey } = useSession();
  const isClient = useIsClient();

  const ready = isClient && hydrated;
  const authed = Boolean(ready && apiKey);

  const page = authed ? (
    <AppShellLayoutClient>{children}</AppShellLayoutClient>
  ) : (
    <div hidden inert aria-hidden>
      {children}
    </div>
  );

  if (!ready) {
    return (
      <>
        {awaitingShell}
        {page}
      </>
    );
  }

  if (!apiKey) {
    return (
      <>
        <SectionErrorBoundary>
          <LandingPage onKeyChange={setApiKey} />
        </SectionErrorBoundary>
        {page}
      </>
    );
  }

  return page;
}
