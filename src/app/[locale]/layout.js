import { Geist, Geist_Mono } from 'next/font/google';
import { FileHandler } from '@/components/shared/FileHandler';
import { PostHogProvider } from './providers';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Suspense } from 'react';

import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { locales } from '@/i18n/settings';

import '@/app/globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  title: 'TorBox Manager',
  description: 'A power user\'s alternative to TorBox UI. Built for speed and efficiency.',
  manifest: '/manifest.json',
  appleWebAppCapable: 'yes',
  appleWebAppStatusBarStyle: 'black-translucent',
  openGraph: {
    title: 'TorBox Manager',
    description: 'A power user\'s alternative to TorBox UI. Built for speed and efficiency.',
    type: 'website',
    locale: 'en_US',
    siteName: 'TorBox Manager',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TorBox Manager',
    description: 'A power user\'s alternative to TorBox UI. Built for speed and efficiency.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#000000',
};

// Generate static params for all locales
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Messages loader component - dynamic (uses headers() internally via getMessages)
async function MessagesLoader({ locale, children }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

export default async function LocaleLayout({ children, params }) {
  // Ensure that the incoming `locale` is valid
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="theme-color" content="#000000" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-white dark:bg-gray-900 antialiased`}
      >
        <ThemeProvider>
          <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div></div>}>
            <MessagesLoader locale={locale}>
              <PostHogProvider>
                <FileHandler />
                {children}
              </PostHogProvider>
            </MessagesLoader>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
