// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

// Only initialize Sentry if explicitly enabled
// This file is only loaded when withSentryConfig is used in next.config.mjs
// If Sentry is disabled, this file won't be loaded at all
(async () => {
  if (process.env.SENTRY_ENABLED === 'true') {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN || 'https://7350595443a6a2817f8f7a54ff6ebf6b@o4508884378714112.ingest.de.sentry.io/4508884380024912',

      // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
      tracesSampleRate: 1,

      // Setting this option to true will print useful information to the console while you're setting up Sentry.
      debug: false,
    });
  }
})();

// Export empty object to make this a valid module
export {};
