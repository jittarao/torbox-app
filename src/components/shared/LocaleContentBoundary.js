'use client';

import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';

/** Catches page-level errors inside the locale layout (below providers). */
export function LocaleContentBoundary({ children }) {
  return (
    <SectionErrorBoundary showReload fallbackClassName="min-h-[50vh] my-8">
      {children}
    </SectionErrorBoundary>
  );
}
