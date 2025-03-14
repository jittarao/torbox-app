'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import ApiKeyInput from '@/components/downloads/ApiKeyInput';
import Downloads from '@/components/downloads/Downloads';
import LandingPage from '@/components/LandingPage';
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
    const storedKeys = localStorage.getItem('torboxApiKeys');

    if (storedKey) {
      setApiKey(storedKey);
    } else if (storedKeys) {
      // If no active key but we have stored keys, use the first one
      const keys = JSON.parse(storedKeys);
      if (keys.length > 0) {
        setApiKey(keys[0].key);
        localStorage.setItem('torboxApiKey', keys[0].key);
      }
    }
    setLoading(false);

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

  // Handle API key change
  const handleKeyChange = (newKey) => {
    setApiKey(newKey);
    localStorage.setItem('torboxApiKey', newKey);
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
          <Header />
          <div className="container mx-auto p-4">
            <ApiKeyInput
              value={apiKey}
              onKeyChange={handleKeyChange}
              allowKeyManager={true}
            />
            <Downloads apiKey={apiKey} />
          </div>
        </>
      )}
    </main>
  );
}
