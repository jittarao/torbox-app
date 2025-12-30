'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import ApiKeyInput from '@/components/downloads/ApiKeyInput';
import dynamic from 'next/dynamic';

const Downloads = dynamic(() => import('@/components/downloads/Downloads'), {
  loading: () => <div className="flex justify-center items-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div></div>,
  ssr: false
});

const LandingPage = dynamic(() => import('@/components/LandingPage'), {
  ssr: false
});
import { Inter } from 'next/font/google';
import { useFileHandler } from '@/hooks/useFileHandler';
import { useUpload } from '@/components/shared/hooks/useUpload';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const { setLinkInput, validateAndAddFiles } = useUpload(apiKey, 'torrents');

  useEffect(() => {
    setIsClient(true);

    // Load API key from storage
    const storedKey = localStorage.getItem('torboxApiKey');

    const initializeKeys = async () => {
      // 1. Try fetching from server first
      let serverKeys = [];
      try {
        const response = await fetch('/api/keys');
        if (response.ok) {
          serverKeys = await response.json();
        }
      } catch (error) {
        console.error('Error fetching API keys from server:', error);
      }

      // 2. Migration: If server is empty but we have local keys, sync them
      if (serverKeys.length === 0) {
        const storedKeys = localStorage.getItem('torboxApiKeys');
        if (storedKeys) {
          try {
            const parsedKeys = JSON.parse(storedKeys);
            for (const k of parsedKeys) {
              await fetch('/api/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: k.label, key: k.key }),
              });
            }
            // Refresh server keys after migration
            const response = await fetch('/api/keys');
            if (response.ok) serverKeys = await response.json();
          } catch (e) {
            console.error('Migration failed:', e);
          }
        }
      }

      // 3. Set the active key
      if (storedKey) {
        setApiKey(storedKey);
      } else if (serverKeys.length > 0) {
        const firstKey = serverKeys[0].key;
        setApiKey(firstKey);
        localStorage.setItem('torboxApiKey', firstKey);
      }

      setLoading(false);
    };

    initializeKeys();

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
          'TorBox Manager',
        );
      } catch (error) {
        console.error('Failed to register protocol handler:', error);
      }
    }

    // Set up file handling
    if ('launchQueue' in window && 'LaunchParams' in window) {
      window.launchQueue.setConsumer(async (launchParams) => {
        if (!launchParams.files.length) return;

        const fileHandles = launchParams.files;
        for (const fileHandle of fileHandles) {
          try {
            const file = await fileHandle.getFile();
            if (file.name.endsWith('.torrent') || file.name.endsWith('.nzb')) {
              window.dispatchEvent(
                new CustomEvent('fileReceived', {
                  detail: {
                    name: file.name,
                    type: file.type,
                    data: await file.arrayBuffer(),
                  },
                }),
              );
            }
          } catch (error) {
            console.error('Error handling file:', error);
          }
        }
      });
    }

    // Handle magnet links
    const urlParams = new URLSearchParams(window.location.search);
    const magnetLink = urlParams.get('magnet');
    if (magnetLink) {
      setLinkInput(magnetLink);
    }
  }, []);

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

  const syncTimeoutRef = useRef(null);

  // Handle API key change
  const handleKeyChange = (newKey, label = 'Main Key') => {
    setApiKey(newKey);
    localStorage.setItem('torboxApiKey', newKey);

    // Debounce server synchronization
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    if (newKey && newKey.length > 10) { // Only sync if it looks like a real key
      syncTimeoutRef.current = setTimeout(async () => {
        try {
          await fetch('/api/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label, key: newKey }),
          });
        } catch (error) {
          // Silent fail for background sync
          console.warn('Background sync to server failed:', error);
        }
      }, 1000);
    }
  };

  // Don't render anything until client-side hydration is complete
  if (!isClient)
    return (
      <div
        className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}
      ></div>
    );

  if (loading) return null;

  return (
    <main
      className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}
    >
      {!apiKey ? (
        <LandingPage onKeyChange={handleKeyChange} />
      ) : (
        <>
          <Header apiKey={apiKey} />
          <div className="container mx-auto p-4">
            <Downloads apiKey={apiKey} />
          </div>
        </>
      )}
    </main>
  );
}
