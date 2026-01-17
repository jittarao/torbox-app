import winston from 'winston';
import { captureException, captureMessage, addBreadcrumb } from './sentry.js';

/**
 * Logger utility for TorBox Backend
 * Outputs structured JSON logs that are Docker-friendly
 * Integrates with Sentry for error tracking
 */
class Logger {
  constructor() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

    // Create Winston logger with JSON format for Docker
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'torbox-backend',
        version: process.env.npm_package_version || '0.1.0',
      },
      transports: [
        // Console transport - outputs JSON for Docker logs
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          ),
        }),
      ],
      // Don't exit on handled exceptions
      exitOnError: false,
    });

    // In development, also add a human-readable format
    if (isDevelopment) {
      this.logger.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              let msg = `${timestamp} [${level}]: ${message}`;
              if (Object.keys(meta).length > 0) {
                // Filter out default meta fields for cleaner output
                const filteredMeta = { ...meta };
                delete filteredMeta.service;
                delete filteredMeta.version;
                if (Object.keys(filteredMeta).length > 0) {
                  msg += ` ${JSON.stringify(filteredMeta)}`;
                }
              }
              return msg;
            })
          ),
        })
      );
    }
  }

  /**
   * Log an error with full context
   * @param {string} message - Error message
   * @param {Error|Object} error - Error object or metadata
   * @param {Object} context - Additional context (authId, requestId, etc.)
   */
  error(message, error = null, context = {}) {
    const logData = {
      ...context,
    };

    if (error instanceof Error) {
      logData.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
      // Include any additional error properties
      if (error.code) logData.error.code = error.code;
      if (error.statusCode) logData.error.statusCode = error.statusCode;
      if (error.response) {
        logData.error.response = {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        };
      }

      // Send to Sentry with full context and trace
      captureException(error, {
        ...context,
        logMessage: message,
        // Include error details in context
        errorCode: error.code,
        errorStatusCode: error.statusCode,
        errorName: error.name,
      });
    } else if (error && typeof error === 'object') {
      logData.error = error;

      // Send error message to Sentry if it's a significant error
      if (error.severity !== 'low') {
        captureMessage(message, 'error', {
          ...context,
          error: error,
        });
      }
    } else {
      // Just a message, send to Sentry as error level
      captureMessage(message, 'error', context);
    }

    this.logger.error(message, logData);
  }

  /**
   * Log a warning
   * @param {string} message - Warning message
   * @param {Object} context - Additional context
   */
  warn(message, context = {}) {
    // Add breadcrumb to Sentry for warnings
    addBreadcrumb({
      message,
      level: 'warning',
      data: context,
    });

    this.logger.warn(message, context);
  }

  /**
   * Log an info message (only if DEBUG env variable is set)
   * @param {string} message - Info message
   * @param {Object} context - Additional context
   */
  info(message, context = {}) {
    const isDebug = process.env.DEBUG === 'true';
    if (!isDebug) {
      return;
    }

    // Add breadcrumb to Sentry for important info messages
    if (context.important || context.critical) {
      addBreadcrumb({
        message,
        level: 'info',
        data: context,
      });
    }

    this.logger.info(message, context);
  }

  /**
   * Log a debug message (only if DEBUG env variable is set)
   * @param {string} message - Debug message
   * @param {Object} context - Additional context
   */
  debug(message, context = {}) {
    const isDebug = process.env.DEBUG === 'true';
    if (!isDebug) {
      return;
    }

    this.logger.debug(message, context);
  }

  /**
   * Log an HTTP request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {number} duration - Request duration in ms
   */
  http(req, res, duration = null) {
    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    if (duration !== null) {
      logData.duration = `${duration}ms`;
    }

    if (req.query?.authId || req.headers['x-auth-id']) {
      logData.authId = req.query?.authId || req.headers['x-auth-id'];
    }

    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    this.logger[level](`${req.method} ${req.originalUrl || req.url} ${res.statusCode}`, logData);
  }
}

// Export singleton instance
const logger = new Logger();
export default logger;
