import posthog from 'posthog-js';

export const phEvent = (eventName, optionalProps = {}) => {
  if (process.env.NODE_ENV !== 'production') return;
  if (typeof window !== 'undefined' && window.__TBM_RYBBIT__) {
    return;
  }
  if (posthog) {
    posthog.capture(eventName, optionalProps);
  }
};
