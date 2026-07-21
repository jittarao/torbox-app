'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import useIsMobile from '@/hooks/useIsMobile';

export default function HeaderDropdownPanel({
  open,
  children,
  className = '',
  widthClass = 'w-48',
  onBackdropClick,
  placement = 'default',
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const isMobile = useIsMobile();

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

  if (!mounted) {
    return null;
  }

  const animationClass = visible ? 'ui-dropdown-panel--open' : 'ui-dropdown-panel--closing';

  const placementClass =
    placement === 'sidebar' ? 'ui-dropdown-panel--sidebar' : 'ui-dropdown-panel';

  const panel = (
    <div
      role="menu"
      data-header-dropdown-panel
      className={
        isMobile
          ? `ui-dropdown-panel-floating w-full max-w-sm max-h-[min(90vh,32rem)] overflow-auto ${className} ${animationClass}`
          : `${placementClass} ${widthClass} ${className} ${animationClass}`
      }
    >
      {children}
    </div>
  );

  if (isMobile && mounted) {
    const container =
      (typeof document !== 'undefined' && document.querySelector('dialog[open]')) || document.body;

    return createPortal(
      <div data-header-overlay>
        <div
          className="z-overlay-backdrop fixed inset-0 bg-black/60"
          onClick={onBackdropClick}
          aria-hidden
        />
        <div className="z-overlay-panel fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {panel}
          </div>
        </div>
      </div>,
      container
    );
  }

  return panel;
}
