/**
 * User-facing message for client errors. Hides minified React production strings.
 * @param {Error | null | undefined} error
 * @param {string} [fallback]
 */
export function getClientErrorMessage(error, fallback = 'Something went wrong.') {
  const message = error?.message?.trim() || '';

  if (process.env.NODE_ENV !== 'production') {
    return message || fallback;
  }

  if (!message) {
    return fallback;
  }

  if (
    message.includes('Minified React error') ||
    message.includes('Maximum update depth exceeded') ||
    message.includes('Too many re-renders')
  ) {
    return fallback;
  }

  if (message.length > 240) {
    return fallback;
  }

  return message;
}

/**
 * @param {Error} error
 * @param {{ componentStack?: string }} [errorInfo]
 */
export function reportClientError(error, errorInfo) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('Client error:', error, errorInfo);
    return;
  }

  if (process.env.SENTRY_ENABLED === 'true' || process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true') {
    import('@sentry/nextjs')
      .then((Sentry) => {
        Sentry.captureException(error, {
          extra: { componentStack: errorInfo?.componentStack },
        });
      })
      .catch(() => {});
  }
}
