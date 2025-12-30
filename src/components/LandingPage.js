'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Icons from '@/components/icons';
import { API_BASE } from '@/components/constants';

export default function LandingPage({ onKeyChange }) {
  const t = useTranslations('LandingPage');
  const [keyName, setKeyName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState('idle'); // idle, checking, valid, invalid
  const [showKey, setShowKey] = useState(false);

  // Key Name validation: No spaces or special characters
  const handleNameChange = (e) => {
    const value = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
    setKeyName(value);
  };

  // API Key verification
  useEffect(() => {
    if (!apiKey) {
      setStatus('idle');
      return;
    }

    const verifyKey = async () => {
      const trimmedKey = apiKey.trim();
      if (!trimmedKey) {
        setStatus('idle');
        return;
      }

      setStatus('checking');
      try {
        const response = await fetch('/api/user/me', {
          headers: {
            'x-api-key': trimmedKey,
          },
        });

        if (response.ok) {
          setStatus('valid');
        } else {
          const data = await response.json().catch(() => ({}));
          console.error('Verification failed:', data);
          setStatus('invalid');
        }
      } catch (error) {
        console.error('Verification network error:', error);
        setStatus('invalid');
      }
    };

    const timer = setTimeout(verifyKey, 800);
    return () => clearTimeout(timer);
  }, [apiKey]);

  const handleStart = () => {
    if (status === 'valid' && keyName) {
      onKeyChange(apiKey, keyName);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-surface dark:bg-surface-dark transition-colors duration-500 flex items-center justify-center">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/10 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="container mx-auto px-4 py-4 relative z-10 w-full max-w-5xl">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">

          {/* Left Column: Branding and Features */}
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-300 to-blue-300 leading-tight animate-smooth-flow">
              Torbox Enhanced
            </h1>
            <style jsx>{`
              @keyframes smoothFlow {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
              .animate-smooth-flow {
                animation: smoothFlow 15s ease-in-out infinite;
                background-size: 300% auto;
              }
            `}</style>
            <p className="text-base md:text-lg mb-8 text-primary-text/60 dark:text-primary-text-dark/60 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
              {t('subtitle')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  icon: <path d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zm6.905 9.97a.75.75 0 00-1.06 0l-3 3a.75.75 0 101.06 1.06l1.72-1.72V18a.75.75 0 001.5 0v-5.19l1.72 1.72a.75.75 0 101.06-1.06l-3-3z" />,
                  title: t('features.batchUpload.title'),
                  color: 'text-primary'
                },
                {
                  icon: <path d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" />,
                  title: t('features.search.title'),
                  color: 'text-indigo-400'
                },
                {
                  icon: <path d="M20.599 1.5c-.376 0-.743.111-1.055.32l-5.08 3.385a18.747 18.747 0 00-3.471 2.987 10.04 10.04 0 014.815 4.815 18.748 18.748 0 002.987-3.471l3.386-5.08A1.902 1.902 0 0020.599 1.5zm-8.3 14.025a18.76 18.76 0 001.896-1.207 8.026 8.026 0 00-4.513-4.513A18.75 18.75 0 008.475 11.7l-.278.5a5.26 5.26 0 013.601 3.602l.502-.278zM6.75 13.5A3.75 3.75 0 003 17.25a1.5 1.5 0 01-1.601 1.497.75.75 0 00-.7 1.123 5.25 5.25 0 009.8-2.62 3.75 3.75 0 00-3.75-3.75z" />,
                  title: t('features.debrid.title'),
                  color: 'text-accent'
                }
              ].map((feature, i) => (
                <div key={i} className="flex flex-col items-center lg:items-start p-3 glass rounded-2xl hover:scale-105 transition-all duration-300">
                  <div className={`w-8 h-8 mb-2 flex items-center justify-center rounded-lg bg-surface dark:bg-surface-alt-dark shadow-sm ${feature.color}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      {feature.icon}
                    </svg>
                  </div>
                  <h4 className="text-xs font-bold whitespace-nowrap opacity-80 uppercase tracking-tighter">
                    {feature.title}
                  </h4>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Key Input Card */}
          <div className="w-full max-w-md lg:w-[420px]">
            <div className="p-6 md:p-8 glass rounded-[2.5rem] shadow-2xl relative overflow-hidden ring-1 ring-white/10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16"></div>

              <h2 className="text-2xl font-black mb-6 text-primary-text dark:text-primary-text-dark relative z-10 text-left">
                {t('apiKeyInput.title')}
              </h2>

              <div className="relative z-10 space-y-4">
                {/* Key Name Input */}
                <div className="text-left">
                  <label className="block text-[10px] font-black text-primary-text/40 dark:text-primary-text-dark/40 mb-1.5 ml-1 uppercase tracking-[0.2em]">
                    Identification
                  </label>
                  <input
                    type="text"
                    value={keyName}
                    onChange={handleNameChange}
                    placeholder={t('apiKeyInput.keyNamePlaceholder') || 'Key Name'}
                    className="w-full px-4 py-2.5 bg-surface/40 dark:bg-surface-dark/40 border border-border/40 dark:border-border-dark/40 rounded-xl focus:ring-1 focus:ring-primary/30 focus:border-primary/50 outline-none transition-all text-primary-text dark:text-primary-text-dark font-bold text-sm"
                  />
                </div>

                {/* API Key Input */}
                <div className="text-left">
                  <label className="block text-[10px] font-black text-primary-text/40 dark:text-primary-text-dark/40 mb-1.5 ml-1 uppercase tracking-[0.2em]">
                    Security Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Paste TB-XXXXXXXXXXXX"
                      className={`w-full px-4 py-2.5 pr-20 bg-surface/40 dark:bg-surface-dark/40 border rounded-xl focus:ring-1 focus:ring-primary/30 outline-none transition-all text-primary-text dark:text-primary-text-dark font-mono text-xs
                        ${status === 'valid' ? 'border-green-500/30' : status === 'invalid' ? 'border-red-500/30' : 'border-border/40'}
                      `}
                    />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="p-1 text-primary-text/30 hover:text-primary transition-colors"
                      >
                        {showKey ? <Icons.Eye className="w-3.5 h-3.5" /> : <Icons.EyeOff className="w-3.5 h-3.5" />}
                      </button>

                      {status !== 'idle' && (
                        <>
                          <div className="w-px h-3 bg-border/30 mx-0.5"></div>
                          {status === 'checking' && <Icons.Refresh className="w-4 h-4 animate-spin text-primary" />}
                          {status === 'valid' && <Icons.CheckCircle className="w-4 h-4 text-green-500" />}
                          {status === 'invalid' && <Icons.XCircle className="w-4 h-4 text-red-500" />}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Start Button */}
                <button
                  onClick={handleStart}
                  disabled={status !== 'valid' || !keyName}
                  className={`w-full py-3.5 rounded-xl font-black text-base transition-all duration-300 transform active:scale-95 shadow-lg
                    ${status === 'valid' && keyName
                      ? 'bg-primary text-white hover:brightness-110 shadow-primary/25'
                      : 'bg-border/20 dark:bg-border-dark/20 text-primary-text/10 cursor-not-allowed'
                    }
                  `}
                >
                  {t('apiKeyInput.start') || 'Start'}
                </button>
              </div>

              <footer className="mt-8 pt-6 border-t border-border/5 dark:border-border-dark/5 flex flex-col items-center gap-2">
                <p className="text-[10px] text-primary-text/30 dark:text-primary-text-dark/30 tracking-wide">
                  {t('footer.description')} <a href="https://github.com/onkarvelhals/torbox-app-enhanced" className="text-primary/50 hover:underline font-bold">GITHUB</a>
                </p>
                <div className="flex gap-4">
                  <div className="w-1 h-1 rounded-full bg-primary/20"></div>
                  <div className="w-1 h-1 rounded-full bg-primary/40"></div>
                  <div className="w-1 h-1 rounded-full bg-primary/20"></div>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
