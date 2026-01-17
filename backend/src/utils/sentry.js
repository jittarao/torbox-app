/**
 * Sentry configuration for TorBox Backend
 * Initializes Sentry for error tracking and performance monitoring
 */

let Sentry = null;

/**
 * Initialize Sentry if enabled
 */
export async function initSentry() {
  // Only initialize if explicitly enabled
  if (process.env.SENTRY_ENABLED !== 'true' && process.env.NEXT_PUBLIC_SENTRY_ENABLED !== 'true') {
    return null;
  }

  try {
    // @sentry/node uses named exports
    // Dynamic import returns a module namespace object with all exports
    const sentryModule = await import('@sentry/node');

    // Use the module namespace directly - it contains all named exports
    Sentry = sentryModule;

    const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) {
      console.warn('Sentry is enabled but SENTRY_DSN is not set. Sentry will not be initialized.');
      return null;
    }

    // Verify essential exports are available
    if (typeof Sentry.init !== 'function') {
      console.error('Sentry.init is not available. Module structure:', Object.keys(sentryModule));
      return null;
    }

    // Initialize Sentry first
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',

      // Performance monitoring
      tracesSampleRate:
        process.env.NODE_ENV === 'production'
          ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1')
          : 1.0,

      // Release tracking
      release: process.env.npm_package_version || undefined,

      // Additional options
      debug: process.env.SENTRY_DEBUG === 'true',

      // Stack trace configuration - ensure full stack traces are captured
      attachStacktrace: true,
      maxBreadcrumbs: 100, // Increase breadcrumb limit for better trace context

      // Add Express integration explicitly for v10
      // In v10, expressIntegration handles request and tracing automatically
      integrations: [
        ...(Sentry.defaultIntegrations || []),
        // Express integration provides automatic request/tracing instrumentation
        ...(typeof Sentry.expressIntegration === 'function'
          ? [Sentry.expressIntegration()]
          : []),
      ],

      // Filter out health check endpoints and other noise
      beforeSend(event, hint) {
        // Filter out certain errors if needed
        if (event.request?.url?.includes('/health')) {
          return null; // Don't send health check errors
        }

        // Ensure stack traces are included
        if (event.exception) {
          event.exception.values?.forEach((exception) => {
            if (exception.stacktrace) {
              // Ensure stacktrace frames are included
              exception.stacktrace.frames = exception.stacktrace.frames || [];
            }
          });
        }

        return event;
      },

      // Enhance event with additional context before sending
      beforeSendTransaction(event) {
        // Include transaction context for performance traces
        return event;
      },
    });

    // Verify Express handlers are available (in @sentry/node v10+, use expressErrorHandler instead of Handlers.errorHandler)
    // Note: In v10, requestHandler and tracingHandler are handled automatically by expressIntegration
    const hasExpressIntegration = typeof Sentry.expressIntegration === 'function';
    const hasExpressErrorHandler = typeof Sentry.expressErrorHandler === 'function';
    const hasSetupExpressErrorHandler = typeof Sentry.setupExpressErrorHandler === 'function';

    console.log('Sentry initialized successfully');
    if (hasExpressIntegration && hasExpressErrorHandler) {
      console.log('Sentry Express integration available (expressIntegration, expressErrorHandler)');
      if (hasSetupExpressErrorHandler) {
        console.log('Sentry setupExpressErrorHandler also available');
      }
    } else {
      console.warn('Some Sentry Express handlers are not available:', {
        expressIntegration: hasExpressIntegration,
        expressErrorHandler: hasExpressErrorHandler,
        setupExpressErrorHandler: hasSetupExpressErrorHandler,
      });
    }
    return Sentry;
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
    return null;
  }
}

/**
 * Get the Sentry instance (null if not initialized)
 */
export function getSentry() {
  return Sentry;
}

/**
 * Capture an exception and send it to Sentry
 * @param {Error} error - Error object to capture
 * @param {Object} context - Additional context (authId, requestId, etc.)
 */
export function captureException(error, context = {}) {
  if (!Sentry) return;

  Sentry.withScope((scope) => {
    // Set user context if authId is provided
    if (context.authId) {
      scope.setUser({ id: context.authId });
    }

    // Add tags for filtering
    if (context.requestId) {
      scope.setTag('requestId', context.requestId);
    }
    if (context.endpoint) {
      scope.setTag('endpoint', context.endpoint);
    }
    if (context.method) {
      scope.setTag('method', context.method);
    }

    // Extract error details for context
    const errorContext = {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };

    // Include any additional error properties
    if (error.code) errorContext.code = error.code;
    if (error.statusCode) errorContext.statusCode = error.statusCode;
    if (error.errno) errorContext.errno = error.errno;
    if (error.syscall) errorContext.syscall = error.syscall;
    if (error.path) errorContext.path = error.path;

    // Include HTTP response data if available
    if (error.response) {
      errorContext.response = {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data,
      };
    }

    // Include request data if available
    if (error.request) {
      errorContext.request = {
        method: error.request.method,
        url: error.request.url,
        headers: error.request.headers,
      };
    }

    // Add error details as context
    scope.setContext('error', errorContext);

    // Add log message if provided
    if (context.logMessage) {
      scope.setContext('log', {
        message: context.logMessage,
      });
    }

    // Add additional context (excluding special fields)
    const specialFields = ['authId', 'requestId', 'endpoint', 'method', 'logMessage'];
    const additionalContext = {};
    Object.keys(context).forEach((key) => {
      if (!specialFields.includes(key) && context[key] !== undefined) {
        additionalContext[key] = context[key];
      }
    });

    if (Object.keys(additionalContext).length > 0) {
      scope.setContext('additional', additionalContext);
    }

    // Set fingerprint for better grouping (optional - can help group similar errors)
    if (context.fingerprint) {
      scope.setFingerprint(context.fingerprint);
    }

    // Set level
    scope.setLevel(context.level || 'error');

    // Capture the exception with full stack trace
    Sentry.captureException(error);
  });
}

/**
 * Capture a message and send it to Sentry
 * @param {string} message - Message to capture
 * @param {string} level - Log level (error, warning, info)
 * @param {Object} context - Additional context
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (!Sentry) return;

  Sentry.withScope((scope) => {
    if (context.authId) {
      scope.setUser({ id: context.authId });
    }
    if (context.requestId) {
      scope.setTag('requestId', context.requestId);
    }

    Object.keys(context).forEach((key) => {
      if (key !== 'authId' && key !== 'requestId') {
        scope.setContext(key, context[key]);
      }
    });

    Sentry.captureMessage(message, level);
  });
}

/**
 * Set user context for Sentry
 * @param {Object} user - User object with id, email, etc.
 */
export function setUser(user) {
  if (!Sentry) return;
  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser() {
  if (!Sentry) return;
  Sentry.setUser(null);
}

/**
 * Add breadcrumb to Sentry
 * @param {Object} breadcrumb - Breadcrumb data
 */
export function addBreadcrumb(breadcrumb) {
  if (!Sentry) return;
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Flush Sentry events (useful before shutdown)
 */
export async function flush(timeout = 2000) {
  if (!Sentry) return;
  await Sentry.flush(timeout);
}

export default {
  initSentry,
  getSentry,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  flush,
};
