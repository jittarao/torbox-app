'use client';

import { useEffect, useId, useRef, useState } from 'react';
import ModalSheet from '@/components/shared/ModalSheet';

export default function PromptDialog({
  open,
  message,
  title,
  defaultValue = '',
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const inputRef = useRef(null);
  const [value, setValue] = useState(defaultValue);
  const heading = title || message || 'Prompt';
  const description = title && message ? message : null;

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open, defaultValue]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onConfirm(value);
  };

  return (
    <ModalSheet open={open} onClose={onCancel} closeLabel={cancelLabel} aria-labelledby={titleId}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
        <h3
          id={titleId}
          className="text-lg font-semibold text-primary-text dark:text-primary-text-dark"
        >
          {heading}
        </h3>
        {description ? (
          <p className="mt-2 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            {description}
          </p>
        ) : null}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={`w-full rounded-xl border border-border/80 bg-surface px-3 py-2 text-sm text-primary-text focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15 dark:border-border-dark/80 dark:bg-surface-dark dark:text-primary-text-dark dark:focus:ring-accent-dark/15 ${
            description ? 'mt-3' : 'mt-4'
          }`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
        />
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="ui-btn-ghost w-full justify-center sm:w-auto"
          >
            {cancelLabel}
          </button>
          <button type="submit" className="ui-btn-primary w-full justify-center sm:w-auto">
            {confirmLabel}
          </button>
        </div>
      </form>
    </ModalSheet>
  );
}
