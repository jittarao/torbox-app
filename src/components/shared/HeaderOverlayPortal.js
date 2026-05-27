'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

export default function HeaderOverlayPortal({ children, open }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!open || !mounted) {
    return null;
  }

  return createPortal(children, document.body);
}
