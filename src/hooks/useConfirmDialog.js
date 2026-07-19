'use client';

import { useCallback, useRef, useState } from 'react';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

/**
 * Promise-based confirm dialog for environments where window.confirm is unavailable
 * (e.g. Tauri/WKWebView on macOS).
 */
export function useConfirmDialog(defaults = {}) {
  const [dialogState, setDialogState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback(
    (message, options = {}) => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setDialogState({ message, ...defaults, ...options });
      });
    },
    [defaults]
  );

  const close = useCallback((result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setDialogState(null);
  }, []);

  const ConfirmDialogPortal = useCallback(
    () =>
      dialogState ? (
        <ConfirmDialog
          open
          message={dialogState.message}
          title={dialogState.title}
          confirmLabel={dialogState.confirmLabel}
          cancelLabel={dialogState.cancelLabel}
          confirmVariant={dialogState.confirmVariant}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      ) : null,
    [dialogState, close]
  );

  return { confirm, ConfirmDialog: ConfirmDialogPortal };
}
