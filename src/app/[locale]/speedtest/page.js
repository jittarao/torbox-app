'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import ApiKeyInput from '@/components/downloads/ApiKeyInput';
import SpeedtestComponent from '@/components/Speedtest';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function SpeedtestPage() {
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
    <main
      className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans
                  text-primary-text dark:text-primary-text-dark`}
    >
      <Header apiKey={apiKey} />
      <div className="max-w-7xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-primary-text dark:text-primary-text-dark mb-2">
            Speed Test
          </h1>
          <p className="text-secondary-text dark:text-secondary-text-dark">
            Test your connection speed to TorBox servers worldwide
          </p>
        </div>
        
        <SpeedtestComponent apiKey={apiKey} />
      </div>
    </main>
  );
}
