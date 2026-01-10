// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

// Only initialize Sentry if explicitly enabled
// Note: This file is only loaded when withSentryConfig is used in next.config.mjs
// If Sentry is disabled, this file won't be loaded at all
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true') {
  import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || 'https://7350595443a6a2817f8f7a54ff6ebf6b@o4508884378714112.ingest.de.sentry.io/4508884380024912',

      // Add optional integrations for additional features
      integrations: [Sentry.replayIntegration()],

      // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
      tracesSampleRate: 1,

      // Define how likely Replay events are sampled.
      // This sets the sample rate to be 10%. You may want this to be 100% while
      // in development and sample at a lower rate in production
      replaysSessionSampleRate: 0.1,

      // Define how likely Replay events are sampled when an error occurs.
      replaysOnErrorSampleRate: 1.0,

      // Setting this option to true will print useful information to the console while you're setting up Sentry.
      debug: false,
    });
  });
}
