'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import ApiKeyInput from '@/components/torrent/ApiKeyInput';
import ItemsTable from '@/components/torrent/ItemsTable';
import LandingPage from '@/components/LandingPage';
import { Inter } from 'next/font/google';
import { useFileHandler } from '@/hooks/useFileHandler';
import { useUpload } from '../components/shared/hooks/useUpload';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { setLinkInput, validateAndAddFiles } = useUpload(apiKey, 'torrents');

  useEffect(() => {
    setMounted(true);
    const storedKey = localStorage.getItem('torboxApiKey');
    if (storedKey) {
      setApiKey(storedKey);
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
      console.log('Received magnet link:', magnetLink);
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
      console.log('Received torrent file:', file.name);
      validateAndAddFiles([file]);
    } else if (file.name.endsWith('.nzb')) {
      // Handle NZB file
      console.log('Received NZB file:', file.name);
      validateAndAddFiles([file]);
    }
  });

  // Handle API key change
  const handleKeyChange = (newKey) => {
    setApiKey(newKey);
    localStorage.setItem('torboxApiKey', newKey);
  };

  // Don't render anything until client-side hydration is complete
  if (!mounted)
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
            <ApiKeyInput value={apiKey} onKeyChange={handleKeyChange} />
            <ItemsTable apiKey={apiKey} />
          </div>
        </>
      )}
    </main>
  );
}
