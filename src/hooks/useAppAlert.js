'use client';

import { useCallback, useState } from 'react';
import Toast from '@/components/shared/Toast';

/**
 * Toast-based alerts for environments where window.alert is unavailable
 * (e.g. Tauri/WKWebView on macOS).
 */
export function useAppAlert() {
  const [toast, setToast] = useState(null);

  const alert = useCallback((message, type = 'error') => {
    setToast({ message, type });
  }, []);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  const AppAlert = useCallback(
    () => (toast ? <Toast message={toast.message} type={toast.type} onClose={dismiss} /> : null),
    [toast, dismiss]
  );

  return { alert, AppAlert, dismiss };
}
