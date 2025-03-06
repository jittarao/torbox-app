import { Geist, Geist_Mono } from 'next/font/google';
import { FileHandler } from '@/components/shared/FileHandler';
import { PostHogProvider } from './providers';

import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

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
  description: 'TorBox Manager',
  manifest: '/manifest.json',
  appleWebAppCapable: 'yes',
  appleWebAppStatusBarStyle: 'black-translucent',
};

export const viewport = {
  themeColor: '#000000',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default async function LocaleLayout({ children, params }) {
  // Ensure that the incoming `locale` is valid
  const { locale } = await params;
  if (!routing.locales.includes(locale)) {
    notFound();
  }

  const messages = await getMessages();

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
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PostHogProvider>
            <FileHandler />
            {children}
          </PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
