'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

export default function HeaderDropdownPanel({
  open,
  children,
  className = '',
  widthClass = 'w-48',
  onBackdropClick,
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

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

  const panel = (
    <div
      role="menu"
      data-header-dropdown-panel
      className={
        isMobile
          ? `ui-dropdown-panel-floating w-full max-w-sm max-h-[min(90vh,32rem)] overflow-auto ${className} ${animationClass}`
          : `ui-dropdown-panel ${widthClass} ${className} ${animationClass}`
      }
    >
      {children}
    </div>
  );

  if (isMobile && portalReady) {
    return createPortal(
      <>
        <div className="fixed inset-0 z-[200] bg-black/60" onClick={onBackdropClick} aria-hidden />
        <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {panel}
          </div>
        </div>
      </>,
      document.body
    );
  }

  return panel;
}
