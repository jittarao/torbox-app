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

  const container =
    (typeof document !== 'undefined' && document.querySelector('dialog[open]')) || document.body;

  return createPortal(children, container);
}
