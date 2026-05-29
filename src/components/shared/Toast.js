'use client';

import { useEffect } from 'react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 border
      ${
        type === 'success'
          ? 'bg-label-success-bg dark:bg-label-success-bg-dark text-label-success-text dark:text-label-success-text-dark border-label-success-text/25'
          : 'bg-label-danger-bg dark:bg-label-danger-bg-dark text-label-danger-text dark:text-label-danger-text-dark border-label-danger-text/25'
      }`}
    >
      {message}
      <button type="button" onClick={onClose} className="ml-2 opacity-70 hover:opacity-100" aria-label="Close notification">
        ✕
      </button>
    </div>
  );
}
