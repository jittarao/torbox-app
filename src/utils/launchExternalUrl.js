export const EXTERNAL_APP_NOT_INSTALLED = 'EXTERNAL_APP_NOT_INSTALLED';

const DEFAULT_LAUNCH_TIMEOUT_MS = 2000;

/**
 * Attempt to open a custom-scheme URL (e.g. infuse://, iina://).
 * Browsers do not throw when no handler is registered, so we infer success
 * when the page blurs or becomes hidden shortly after the click.
 *
 * @param {string} url
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<void>}
 */
export function launchExternalUrl(url, { timeoutMs = DEFAULT_LAUNCH_TIMEOUT_MS } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('launchExternalUrl requires a browser environment'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('blur', onLikelyLaunched);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };

    const settle = (outcome) => {
      if (settled) return;
      settled = true;
      cleanup();
      outcome();
    };

    const onLikelyLaunched = () => settle(resolve);
    const onVisibilityChange = () => {
      if (document.hidden) onLikelyLaunched();
    };

    const timeoutId = setTimeout(
      () =>
        settle(() => {
          const error = new Error(EXTERNAL_APP_NOT_INSTALLED);
          error.code = EXTERNAL_APP_NOT_INSTALLED;
          reject(error);
        }),
      timeoutMs
    );

    window.addEventListener('blur', onLikelyLaunched);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const link = document.createElement('a');
    link.href = url;
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}
