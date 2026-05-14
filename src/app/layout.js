import { Suspense } from 'react';
import { defaultLocale } from '@/i18n/settings';
import '@/app/globals.css';
import { RootDocumentAsync, RootDocumentShell } from './RootDocument';

export default function RootLayout({ children }) {
  return (
    <Suspense
      fallback={
        <RootDocumentShell locale={defaultLocale}>{children}</RootDocumentShell>
      }
    >
      <RootDocumentAsync>{children}</RootDocumentAsync>
    </Suspense>
  );
}
