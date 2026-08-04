'use client';

import dynamic from 'next/dynamic';
import useIsClient from '@/hooks/useIsClient';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { useSession } from '@/components/shared/hooks/useSession';

const landingShell = <div className="min-h-dvh bg-[#0a0a0b]" aria-hidden />;

const LandingPage = dynamic(() => import('@/components/LandingPage'), {
  loading: () => landingShell,
  ssr: false,
});

export default function ApiKeyGate({ children }) {
  const { apiKey, hydrated, setApiKey } = useSession();
  const isClient = useIsClient();

  if (!isClient || !hydrated) {
    return <div className="min-h-dvh bg-[#0a0a0b] font-sans" aria-hidden inert />;
  }

  if (!apiKey) {
    return (
      <SectionErrorBoundary>
        <LandingPage onKeyChange={setApiKey} />
      </SectionErrorBoundary>
    );
  }

  return children;
}
