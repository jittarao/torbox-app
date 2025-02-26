'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import ApiKeyInput from '@/components/torrent/ApiKeyInput';
import ItemsTable from '@/components/torrent/ItemsTable';
import LandingPage from '@/components/LandingPage';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
