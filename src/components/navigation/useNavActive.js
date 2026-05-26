'use client';

import { useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { locales } from '@/i18n/settings';

export default function useNavActive() {
  const pathname = usePathname();

  const isActive = useCallback(
    (path) => {
      if (path === '/') {
        return (
          pathname === '/' ||
          locales.some((locale) => pathname === `/${locale}` || pathname === `/${locale}/`)
        );
      }
      return pathname === path || locales.some((locale) => pathname === `/${locale}${path}`);
    },
    [pathname]
  );

  return { isActive, pathname };
}
