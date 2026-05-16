'use client';

import { useEffect, useState } from 'react';

export default function HeaderDropdownPanel({
  open,
  children,
  className = '',
  widthClass = 'w-48',
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      role="menu"
      className={`ui-dropdown-panel ${widthClass} ${className} ${
        visible ? 'ui-dropdown-panel--open' : 'ui-dropdown-panel--closing'
      }`}
    >
      {children}
    </div>
  );
}
