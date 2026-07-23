'use client';

import { forwardRef, useCallback, useEffect, useRef } from 'react';
import ModalOverlay from '@/components/shared/ModalOverlay';

/**
 * Bottom sheet on mobile, centered dialog on sm+.
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
  const dialogRef = useRef(null);

  const setDialogRef = useCallback(
    (node) => {
      dialogRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref]
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) {
      return undefined;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [open]);

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
      <dialog
        ref={setDialogRef}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        className={panelClass}
      >
        {children}
      </dialog>
    </ModalOverlay>
  );
});

export default ModalSheet;
