let posthogPromise = null;
function getPosthog() {
  if (!posthogPromise && typeof window !== 'undefined') {
    posthogPromise = import('posthog-js').then(
      (mod) => mod.default || mod.posthog,
      () => null
    );
  }
  return posthogPromise ?? Promise.resolve(null);
}

export async function phEvent(eventName, optionalProps = {}) {
  if (process.env.NODE_ENV !== 'production') return;
  if (typeof window !== 'undefined' && window.__TBM_RYBBIT__) return;
  const ph = await getPosthog();
  if (ph) {
    ph.capture(eventName, optionalProps);
  }
}
