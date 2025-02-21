'use client';
import { useState, useEffect } from 'react';
import ApiKeyInput from '@/components/torrent/ApiKeyInput';
import TorrentTable from '@/components/torrent/TorrentTable';
import TorrentUploader from '@/components/torrent/TorrentUploader';
import LandingPage from '@/components/LandingPage';
import { Inter } from 'next/font/google'
import Header from '@/components/Header';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedKey = localStorage.getItem('torboxApiKey');
    if (storedKey) {
      setApiKey(storedKey);
    }
    setLoading(false);
  }, []);

  const handleKeyChange = (newKey) => {
    setApiKey(newKey);
    localStorage.setItem('torboxApiKey', newKey);
  };

  if (loading) return null;

  return (
    <main className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}>
      {!apiKey ? (
        <LandingPage onKeyChange={handleKeyChange} />
      ) : (
        <>
          <Header />
          <div className="container mx-auto p-4">
            <ApiKeyInput value={apiKey} onKeyChange={handleKeyChange} />
            <>
              <TorrentUploader apiKey={apiKey} />
              <TorrentTable apiKey={apiKey} />
            </>
          </div>
        </>
      )}
    </main>
  );
}
