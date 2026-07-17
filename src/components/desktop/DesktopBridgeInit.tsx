'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import * as desktopEvents from '@/desktop/events';
import { useDesktopStore } from '@/store/desktopStore';

export function DesktopBridgeInit() {
  const initialize = useDesktopStore((state) => state.initialize);
  const router = useRouter();

  useEffect(() => {
    initialize().catch((error) => {
      console.error('[desktop] Bridge initialization failed:', error);
    });
  }, [initialize]);

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
