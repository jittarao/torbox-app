'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { desktopBtnPrimary, desktopBtnSecondary } from '@/components/desktop/DesktopUi';

type DesktopConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  children: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export default function DesktopConfirmDialog({
  open,
  onClose,
  titleId,
  title,
  children,
  cancelLabel,
  confirmLabel,
  onConfirm,
}: DesktopConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return undefined;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }

    return undefined;
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="ui-confirm-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h4 id={titleId} className="text-lg font-semibold text-text dark:text-text-dark">
        {title}
      </h4>
      <div className="mt-2 text-sm leading-relaxed text-muted dark:text-muted-dark">{children}</div>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={desktopBtnSecondary}>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm} className={desktopBtnPrimary}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
