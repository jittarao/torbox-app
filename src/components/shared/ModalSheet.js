'use client';

import { forwardRef } from 'react';
import ModalOverlay from '@/components/shared/ModalOverlay';

/**
 * Bottom sheet on mobile, centered dialog on sm+.
 *
 * Intentionally a div[role=dialog] inside ModalOverlay — not a native <dialog>
 * with showModal(). Native dialogs escape to the top layer and break the shared
 * stacking context ModalOverlay relies on; WKWebView/Tauri then fails to paint
 * sheet content (or only paints solid-colored buttons).
 */
const ModalSheet = forwardRef(function ModalSheet(
  {
    children,
    open,
    onClose,
    closeLabel = 'Close',
    className = '',
    overlayClassName = '',
    wide = false,
    dock = false,
    lockScroll = true,
    closeOnEscape = true,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
  },
  ref
) {
  const panelClass = [
    'ui-modal-sheet',
    wide ? 'ui-modal-sheet--wide' : '',
    dock ? 'ui-modal-sheet--dock' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ModalOverlay
      open={open}
      onClose={onClose}
      closeLabel={closeLabel}
      className={overlayClassName}
      lockScroll={lockScroll}
      closeOnEscape={closeOnEscape}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        className={panelClass}
      >
        {children}
      </div>
    </ModalOverlay>
  );
});

export default ModalSheet;
