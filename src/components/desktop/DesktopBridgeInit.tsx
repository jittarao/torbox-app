'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import * as desktopEvents from '@/desktop/events';
import { setLastWebPath } from '@/desktop/desktopBridge';
import { useDesktopStore } from '@/store/desktopStore';

const WEB_PATH_SAVE_DEBOUNCE_MS = 300;

export function DesktopBridgeInit() {
  const initialize = useDesktopStore((state) => state.initialize);
  const available = useDesktopStore((state) => state.available);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    initialize().catch((error) => {
      console.error('[desktop] Bridge initialization failed:', error);
    });
  }, [initialize]);

  useEffect(() => {
    if (!available) {
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const reportPath = () => {
      const path = `${window.location.pathname}${window.location.search}`;
      void setLastWebPath(path);
    };

    timeout = setTimeout(reportPath, WEB_PATH_SAVE_DEBOUNCE_MS);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [available, pathname]);

  useEffect(() => {
    let cleanup: (() => void) | null = null;

    desktopEvents
      .onTrayOpenSettings(() => {
        router.push('/desktop');
      })
      .then((unlisten) => {
        cleanup = () => {
          unlisten?.();
        };
      });

    return () => {
      cleanup?.();
    };
  }, [router]);

  return null;
}
