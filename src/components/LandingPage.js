'use client';

import { useState } from 'react';
import { Syne } from 'next/font/google';
import ApiKeyInput from './downloads/ApiKeyInput';
import { useTranslations } from 'next-intl';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

export default function LandingPage({ onKeyChange }) {
  const t = useTranslations('LandingPage');
  const referralT = useTranslations('Referral');
  const [showCopied, setShowCopied] = useState(false);

  const features = [
    {
      key: 'batchUpload',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      ),
    },
    {
      key: 'search',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      ),
    },
    {
      key: 'automation',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className={`${syne.variable} min-h-screen bg-[#0a0a0b] text-zinc-100 antialiased overflow-x-hidden`}
      style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
    >
      {/* Background: gradient + grid + grain */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(251,191,36,0.08),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        {/* Hero */}
        <header className="text-center mb-20 sm:mb-28">
          <h1
            className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-6 text-white"
            style={{
              animation: 'landing-fade-in-up 0.7s ease-out forwards',
              opacity: 0,
            }}
          >
            {t('title')}
          </h1>
          <p
            className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto font-normal leading-relaxed"
            style={{
              animation: 'landing-fade-in-up 0.7s ease-out 0.12s forwards',
              opacity: 0,
            }}
          >
            {t('subtitle')}
          </p>
        </header>

        {/* Features */}
        <section
          className="grid sm:grid-cols-3 gap-4 sm:gap-6 mb-20"
          style={{
            animation: 'landing-fade-in-up 0.7s ease-out 0.24s forwards',
            opacity: 0,
          }}
        >
          {features.map(({ key, icon }, i) => (
            <div
              key={key}
              className="group relative p-6 sm:p-8 rounded-2xl border border-zinc-800/80 bg-white/[0.02] backdrop-blur-sm transition-all duration-300 hover:border-amber-500/30 hover:bg-white/[0.04] hover:shadow-[0_0_40px_-12px_rgba(251,191,36,0.15)]"
              style={{
                animation: `landing-fade-in-up 0.6s ease-out ${0.32 + i * 0.08}s forwards`,
                opacity: 0,
              }}
            >
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-5 transition-colors duration-300 group-hover:bg-amber-500/20 [&_svg]:w-5 [&_svg]:h-5">
                {icon}
              </div>
              <h3
                className="text-lg font-semibold text-white mb-2"
                style={{ fontFamily: 'var(--font-syne), system-ui' }}
              >
                {t(`features.${key}.title`)}
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {t(`features.${key}.description`)}
              </p>
            </div>
          ))}
        </section>

        {/* CTA: API Key */}
        <section
          className="max-w-lg mx-auto"
          style={{
            animation: 'landing-fade-in-up 0.7s ease-out 0.56s forwards',
            opacity: 0,
          }}
        >
          <div className="relative p-8 sm:p-10 rounded-2xl border border-zinc-800 bg-white/[0.03] backdrop-blur-sm shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
            <h2
              className="text-xl font-semibold text-white mb-6 text-center"
              style={{ fontFamily: 'var(--font-syne), system-ui' }}
            >
              {t('apiKeyInput.title')}
            </h2>
            <ApiKeyInput onKeyChange={onKeyChange} />
            <p className="mt-5 text-sm text-zinc-500 text-center">
              {t('apiKeyInput.description')}{' '}
              <a
                href="https://torbox.app/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
              >
                {t('apiKeyInput.link')}
              </a>
            </p>
          </div>
        </section>

        {/* Referral */}
        <div
          className="max-w-lg mx-auto mt-8 text-center"
          style={{
            animation: 'landing-fade-in 0.6s ease-out 0.72s forwards',
            opacity: 0,
          }}
        >
          <div className="text-sm text-zinc-500">
            <p>{referralT('landingDescription')}</p>
            <a
              href="https://torbox.app/subscription?referral=7908ea44-023c-45f5-86ce-564bc6edaf34"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
            >
              {referralT('signUp')}
            </a>{' '}
            or{' '}
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText('7908ea44-023c-45f5-86ce-564bc6edaf34');
                setShowCopied(true);
                setTimeout(() => setShowCopied(false), 2000);
              }}
              className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
            >
              {showCopied ? referralT('copied') : referralT('copyCode')}
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer
          className="mt-16 pt-8 border-t border-zinc-800/60 text-center text-sm text-zinc-600"
          style={{
            animation: 'landing-fade-in 0.6s ease-out 0.84s forwards',
            opacity: 0,
          }}
        >
          <p>
            {t('footer.description')}{' '}
            <a
              href="https://github.com/jittarao/torbox-app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400/90 hover:text-amber-400 underline underline-offset-2 transition-colors"
            >
              {t('footer.github')}
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
