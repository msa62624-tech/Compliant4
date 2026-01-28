/**
 * Production-safe logger utility
 * 
 * Logs to console in development, can be extended to send to
 * error tracking services (Sentry, LogRocket, etc.) in production
 */

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

/**
 * Format log message with optional context
 * @param {string} message - The log message
 * @param {object} context - Additional context data
 * @returns {Array} - Formatted arguments for console
 */
const formatMessage = (message, context) => {
  if (context && Object.keys(context).length > 0) {
    return [message, context];
  }
  return [message];
};

export const logger = {
  /**
   * Log informational messages (development only)
   * @param {string} message - Log message
   * @param {object} context - Optional context data
   */
  log: (message, context) => {
    if (isDevelopment) {
      console.log(...formatMessage(message, context));
    }
  },

  /**
   * Log info messages (development only)
   * @param {string} message - Log message
   * @param {object} context - Optional context data
   */
  info: (message, context) => {
    if (isDevelopment) {
      console.log(...formatMessage(message, context));
    }
  },

  /**
   * Log warnings (always logged)
   * @param {string} message - Log message
   * @param {object} context - Optional context data
   */
  warn: (message, context) => {
    console.warn(...formatMessage(message, context));
    // TODO: Send to error tracking service in production
  },

  /**
   * Log errors (always logged)
   * @param {string} message - Log message
   * @param {object} context - Optional context data
   */
  error: (message, context) => {
    console.error(...formatMessage(message, context));
    // TODO: Send to error tracking service in production
    // Example: Sentry.captureException(context?.error || new Error(message));
  },

  /**
   * Log debug information (development only)
   * @param {string} message - Log message
   * @param {object} context - Optional context data
   */
  debug: (message, context) => {
    if (isDevelopment) {
      console.debug(...formatMessage(message, context));
    }
  },

  /**
   * Log table data (development only)
   * @param {any} data - Data to display in table format
   */
  table: (data) => {
    if (isDevelopment) {
      console.table(data);
    }
  },
};

export default logger;
