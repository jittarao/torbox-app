'use client';

import { useEffect, useSyncExternalStore } from 'react';
import AppShell from '@/components/navigation/AppShell';
import dynamic from 'next/dynamic';
import { useFileHandler } from '@/hooks/useFileHandler';
import { useUpload } from '@/components/shared/hooks/useUpload';
import { useSession } from '@/components/shared/hooks/useSession';
import { useEnsureUserDb } from '@/components/shared/hooks/useEnsureUserDb';

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
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const { setLinkInput, validateAndAddFiles } = useUpload(apiKey, 'torrents');

  useEffect(() => {
    // Register protocol handler
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

    // Handle magnet links
    const urlParams = new URLSearchParams(window.location.search);
    const magnetLink = urlParams.get('magnet');
    if (magnetLink) {
      setLinkInput(magnetLink);
    }
  }, [setLinkInput]);

  useEnsureUserDb(apiKey);

  // Handle received files
  useFileHandler((file) => {
    if (!apiKey) {
      alert('Please enter your API key first');
      return;
    }

    // Here you can handle the file based on its type
    if (file.name.endsWith('.torrent')) {
      // Handle torrent file
      validateAndAddFiles([file]);
    } else if (file.name.endsWith('.nzb')) {
      // Handle NZB file
      validateAndAddFiles([file]);
    }
  });

  const handleKeyChange = (newKey) => {
    setApiKey(newKey);
  };

  if (!isClient || !hydrated) {
    return <div className={`min-h-screen bg-[#0a0a0b] font-sans`} aria-hidden />;
  }

  if (!apiKey) {
    return <LandingPage onKeyChange={handleKeyChange} />;
  }

  return (
    <AppShell
      apiKey={apiKey}
      className={`min-h-screen bg-surface dark:bg-surface-dark font-sans`}
    >
      <div className="container-downloads mx-auto px-2 sm:px-4 pt-2 pb-4">
        <Downloads apiKey={apiKey} onApiKeyChange={handleKeyChange} />
      </div>
    </AppShell>
  );
}
