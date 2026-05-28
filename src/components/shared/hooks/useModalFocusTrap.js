'use client';

import { useEffect } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap Tab focus inside an open modal container and focus the first control on open.
 */
export function useModalFocusTrap(isOpen, containerRef) {
  useEffect(() => {
    if (!isOpen || !containerRef?.current) return;

    const container = containerRef.current;
    const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first?.focus();

    const onKeyDown = (event) => {
      if (event.key !== 'Tab' || focusable.length === 0) return;

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => container.removeEventListener('keydown', onKeyDown);
  }, [isOpen, containerRef]);
}
