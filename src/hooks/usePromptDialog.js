'use client';

import { useCallback, useRef, useState } from 'react';
import PromptDialog from '@/components/shared/PromptDialog';

/**
 * Promise-based prompt dialog for environments where window.prompt is unavailable
 * (e.g. Tauri/WKWebView on macOS).
 */
export function usePromptDialog(defaults = {}) {
  const [dialogState, setDialogState] = useState(null);
  const resolveRef = useRef(null);

  const prompt = useCallback(
    (message, defaultValue = '', options = {}) => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setDialogState({ message, defaultValue, ...defaults, ...options });
      });
    },
    [defaults]
  );

  const close = useCallback((result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setDialogState(null);
  }, []);

  const PromptDialogPortal = useCallback(
    () =>
      dialogState ? (
        <PromptDialog
          open
          message={dialogState.message}
          title={dialogState.title}
          defaultValue={dialogState.defaultValue}
          confirmLabel={dialogState.confirmLabel}
          cancelLabel={dialogState.cancelLabel}
          onConfirm={(value) => close(value)}
          onCancel={() => close(null)}
        />
      ) : null,
    [dialogState, close]
  );

  return { prompt, PromptDialog: PromptDialogPortal };
}
