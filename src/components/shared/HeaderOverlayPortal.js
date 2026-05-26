'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function HeaderOverlayPortal({ children, open }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(children, document.body);
}
