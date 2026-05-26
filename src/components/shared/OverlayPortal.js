'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children into document.body so fixed overlays escape sidebar/filter stacking contexts.
 */
export default function OverlayPortal({ children, open }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(children, document.body);
}
