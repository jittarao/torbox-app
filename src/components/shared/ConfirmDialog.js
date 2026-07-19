'use client';

import ModalSheet from '@/components/shared/ModalSheet';

export default function ConfirmDialog({
  open,
  message,
  title,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmVariant = 'danger',
}) {
  const titleId = 'confirm-dialog-title';
  const confirmClass =
    confirmVariant === 'danger'
      ? 'inline-flex w-full items-center justify-center rounded-xl bg-label-danger-text px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-95 sm:w-auto dark:bg-label-danger-text-dark dark:hover:brightness-110'
      : 'ui-btn-primary w-full justify-center sm:w-auto';

  return (
    <ModalSheet open={open} onClose={onCancel} closeLabel={cancelLabel} aria-labelledby={titleId}>
      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
        {title ? (
          <h3
            id={titleId}
            className="text-lg font-semibold text-primary-text dark:text-primary-text-dark"
          >
            {title}
          </h3>
        ) : (
          <h3 id={titleId} className="sr-only">
            Confirm
          </h3>
        )}
        <p
          className={`whitespace-pre-line text-sm text-primary-text/70 dark:text-primary-text-dark/70 ${
            title ? 'mt-3' : ''
          }`}
        >
          {message}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="ui-btn-ghost w-full justify-center sm:w-auto"
          >
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={confirmClass}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalSheet>
  );
}
