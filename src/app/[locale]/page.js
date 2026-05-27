'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/navigation/AppShell';
import { isValidTorboxApiKey } from '@/utils/apiKeyValidation';
import dynamic from 'next/dynamic';

const Downloads = dynamic(() => import('@/components/downloads/Downloads'), {
  loading: () => (
    <div className="flex justify-center items-center p-8">
      <div className="animate-spin rounded-full size-8 border-2 border-amber-500/30 border-t-amber-500"></div>
    </div>
  ),
  ssr: false,
});

const landingShell = <div className="min-h-screen bg-[#0a0a0b]" aria-hidden />;

const LandingPage = dynamic(() => import('@/components/LandingPage'), {
  loading: () => landingShell,
  ssr: false,
});
import { Inter } from 'next/font/google';
import { useFileHandler } from '@/hooks/useFileHandler';
import { useUpload } from '@/components/shared/hooks/useUpload';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function Home() {
  const [apiKey, setApiKey] = useState(() => {
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
  });
  const [isClient, setIsClient] = useState(false);
  const { setLinkInput, validateAndAddFiles } = useUpload(apiKey, 'torrents');

  useEffect(() => {
    setIsClient(true);

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
  }, []);

  useEffect(() => {
    if (apiKey) {
      import('@/utils/ensureUserDb').then(({ ensureUserDb }) => {
        ensureUserDb(apiKey)
          .then((result) => {
            if (result.success && result.wasCreated) {
              console.log('User database created for existing API key');
            }
          })
          .catch((error) => {
            console.error('Error ensuring user database on load:', error);
          });
      });
    }
  }, [apiKey]);

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

  // Only store when empty or valid UUID; never overwrite a valid key with invalid input.
  const handleKeyChange = (newKey) => {
    const trimmed = (newKey || '').trim();
    if (trimmed === '' || isValidTorboxApiKey(trimmed)) {
      setApiKey(trimmed);
      localStorage.setItem('torboxApiKey', trimmed);
    }
  };

  if (!isClient) {
    return <div className={`min-h-screen bg-[#0a0a0b] ${inter.variable} font-sans`} aria-hidden />;
  }

  if (!apiKey) {
    return <LandingPage onKeyChange={handleKeyChange} />;
  }

  return (
    <AppShell
      apiKey={apiKey}
      className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}
    >
      <div className="container-downloads mx-auto px-2 sm:px-4 pt-2 pb-4">
        <Downloads apiKey={apiKey} onApiKeyChange={handleKeyChange} />
      </div>
    </AppShell>
  );
}
