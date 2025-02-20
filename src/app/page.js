'use client';
import { useState, useEffect } from 'react';
import ApiKeyInput from '../components/torrent/ApiKeyInput';
import TorrentTable from '../components/torrent/TorrentTable';
import TorrentUploader from '../components/torrent/TorrentUploader';
import LandingPage from '../components/LandingPage';

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
    <main className="min-h-screen bg-white dark:bg-gray-900">
      {!apiKey ? (
        <LandingPage onKeyChange={handleKeyChange} />
      ) : (
        <div className="container mx-auto p-4">
          <h1 className="text-2xl mb-4">TorBox Manager</h1>
          <ApiKeyInput value={apiKey} onKeyChange={handleKeyChange} />
          <>
            <TorrentUploader apiKey={apiKey} />
            <TorrentTable apiKey={apiKey} />
          </>
        </div>
      )}
    </main>
  );
}
