'use client';

import { useEffect } from 'react';

const HEADER_PANEL_SELECTOR = '[data-header-dropdown-panel]';
const HEADER_OVERLAY_SELECTOR = '[data-header-overlay]';

/** True when the event target is inside a header dropdown panel or mobile overlay. */
function isEventInsideHeaderDropdown(event) {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(HEADER_PANEL_SELECTOR) || target.closest(HEADER_OVERLAY_SELECTOR));
}

/**
 * Closes a header dropdown on outside pointer, page scroll (not in-panel scroll), resize, or Escape.
 * Listeners are only active while `isOpen` is true.
 */
export default function useHeaderDropdownDismiss({
  isOpen,
  onClose,
  anchorRef,
  closeOnScroll = true,
  closeOnResize = true,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event) => {
      if (anchorRef.current?.contains(event.target)) return;
      if (isEventInsideHeaderDropdown(event)) return;
      onClose();
    };

    const handleScroll = (event) => {
      if (!closeOnScroll) return;
      if (isEventInsideHeaderDropdown(event)) return;
      onClose();
    };

    const handleResize = () => {
      if (closeOnResize) onClose();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef, closeOnScroll, closeOnResize]);
}
