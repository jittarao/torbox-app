import { FileHandler } from '@/components/shared/FileHandler';
import { ErrorHandlerInitializer } from '@/components/shared/ErrorHandlerInitializer';
import { PostHogProvider } from './providers';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Suspense } from 'react';

import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { locales } from '@/i18n/settings';

export const metadata = {
  title: 'TorBox Manager',
  description: "A power user's alternative to TorBox UI. Built for speed and efficiency.",
  manifest: '/manifest.json',
  appleWebAppCapable: 'yes',
  appleWebAppStatusBarStyle: 'black-translucent',
  openGraph: {
    title: 'TorBox Manager',
    description: "A power user's alternative to TorBox UI. Built for speed and efficiency.",
    type: 'website',
    locale: 'en_US',
    siteName: 'TorBox Manager',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TorBox Manager',
    description: "A power user's alternative to TorBox UI. Built for speed and efficiency.",
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

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function MessagesLoader({ locale, children }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <ThemeProvider>
      <Suspense
        fallback={
          <div className="flex justify-center items-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        }
      >
        <MessagesLoader locale={locale}>
          <PostHogProvider>
            <ErrorHandlerInitializer />
            <FileHandler />
            {children}
          </PostHogProvider>
        </MessagesLoader>
      </Suspense>
    </ThemeProvider>
  );
}
