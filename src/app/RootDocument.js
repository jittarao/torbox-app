import { headers } from 'next/headers';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import { RybbitHeadScripts } from '@/components/RybbitHeadScripts';
import { defaultLocale } from '@/i18n/settings';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const themeScript = `
              (function() {
                try {
                  var stored = localStorage.getItem('darkMode');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var isDark = stored !== null ? stored === 'true' : prefersDark;
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `;

export function RootDocumentShell({ locale, children }) {
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <RybbitHeadScripts />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#000000" />
        <Script id="theme-script" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}

export async function RootDocumentAsync({ children }) {
  const h = await headers();
  const locale = h.get('x-tbm-locale') ?? defaultLocale;
  return <RootDocumentShell locale={locale}>{children}</RootDocumentShell>;
}
