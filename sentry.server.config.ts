// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

// Only initialize Sentry if explicitly enabled and DSN is provided
const isEnabled = process.env.SENTRY_ENABLED === 'true' || process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true';
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (isEnabled && dsn) {
  Sentry.init({
    dsn,

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: process.env.SENTRY_DEBUG === 'true',

    // Environment configuration
    environment: process.env.NODE_ENV || 'development',
  });
} else if (isEnabled && !dsn) {
  console.warn('[Sentry] Sentry is enabled but DSN is not configured. Please set SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN.');
}
