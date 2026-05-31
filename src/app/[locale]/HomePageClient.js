'use client';

import { Suspense, useEffect, useRef } from 'react';
import AppShell from '@/components/navigation/AppShell';
import dynamic from 'next/dynamic';
import { useFileHandler } from '@/hooks/useFileHandler';
import useIsClient from '@/hooks/useIsClient';
import { useUpload } from '@/components/shared/hooks/useUpload';
import { useSession } from '@/components/shared/hooks/useSession';
import { useEnsureUserDb } from '@/components/shared/hooks/useEnsureUserDb';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';

const landingShell = <div className="min-h-screen bg-[#0a0a0b]" aria-hidden />;

const Downloads = dynamic(() => import('@/components/downloads/Downloads'), {
  loading: () => (
    <div className="flex justify-center items-center p-8">
      <div className="animate-spin rounded-full size-8 border-2 border-amber-500/30 border-t-amber-500"></div>
    </div>
  ),
  ssr: false,
});

const LandingPage = dynamic(() => import('@/components/LandingPage'), {
  loading: () => landingShell,
  ssr: false,
});

export default function HomePageClient() {
  const { apiKey, hydrated, setApiKey } = useSession();
  const isClient = useIsClient();
  const mainRef = useRef(null);
  const didFocusMainRef = useRef(false);
  const { setLinkInput, validateAndAddFiles } = useUpload(apiKey, 'torrents');

  useEffect(() => {
    if (
      'registerProtocolHandler' in navigator &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches)
    ) {
      try {
        navigator.registerProtocolHandler(
          'magnet',
          `${window.location.origin}/?magnet=%s`,
          'TorBox Manager'
        );
      } catch (error) {
        console.error('Failed to register protocol handler:', error);
      }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const magnetLink = urlParams.get('magnet');
    if (magnetLink) {
      setLinkInput(magnetLink);
    }
  }, [setLinkInput]);

  useEnsureUserDb(apiKey);

  useFileHandler((file) => {
    if (!apiKey) {
      alert('Please enter your API key first');
      return;
    }

    if (file.name.endsWith('.torrent')) {
      validateAndAddFiles([file]);
    } else if (file.name.endsWith('.nzb')) {
      validateAndAddFiles([file]);
    }
  });

  useEffect(() => {
    if (!isClient || !hydrated || didFocusMainRef.current) return;
    didFocusMainRef.current = true;
    const el = mainRef.current;
    if (el && typeof el.focus === 'function') {
      el.focus({ preventScroll: true });
    }
  }, [isClient, hydrated]);

  const handleKeyChange = (newKey) => {
    setApiKey(newKey);
  };

  if (!isClient || !hydrated) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] font-sans" aria-hidden inert />
    );
  }

  if (!apiKey) {
    return (
      <SectionErrorBoundary>
        <LandingPage onKeyChange={handleKeyChange} />
      </SectionErrorBoundary>
    );
  }

  return (
    <AppShell
      apiKey={apiKey}
      className="min-h-screen bg-surface dark:bg-surface-dark font-sans"
    >
      <div
        ref={mainRef}
        tabIndex={-1}
        className="container-downloads mx-auto px-2 sm:px-4 pt-2 pb-4 outline-none"
      >
        <Suspense
          fallback={
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full size-8 border-2 border-amber-500/30 border-t-amber-500" />
            </div>
          }
        >
          <Downloads apiKey={apiKey} onApiKeyChange={handleKeyChange} />
        </Suspense>
      </div>
    </AppShell>
  );
}
