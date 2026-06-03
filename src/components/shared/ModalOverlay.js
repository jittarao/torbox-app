'use client';

import { useEffect } from 'react';
import OverlayPortal from '@/components/shared/OverlayPortal';

/**
 * Portaled modal shell: backdrop + children share one stacking context so the panel
 * paints above the dim layer on mobile Safari (backdrop-filter compositor bug).
 */
export default function ModalOverlay({
  children,
  open,
  onClose,
  closeLabel = 'Close',
  className = '',
  lockScroll = true,
  closeOnEscape = true,
}) {
  useEffect(() => {
    if (!open || !lockScroll) return undefined;

    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open, lockScroll]);

  useEffect(() => {
    if (!open || !closeOnEscape || !onClose) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  return (
    <OverlayPortal open={open}>
      <div className={`ui-modal-overlay ${className}`.trim()}>
        <button
          type="button"
          className="ui-modal-overlay__backdrop"
          onClick={onClose}
          aria-label={closeLabel}
        />
        {children}
      </div>
    </OverlayPortal>
  );
}
