'use client';

import { useEffect } from 'react';
import { useDesktopStore } from '@/store/desktopStore';

export function DesktopBridgeInit() {
  const initialize = useDesktopStore((state) => state.initialize);

  useEffect(() => {
    initialize().catch((error) => {
      console.error('[desktop] Bridge initialization failed:', error);
    });
  }, [initialize]);

  return null;
}
