/**
 * Production-safe logger utility
 * 
 * Logs to console in development, can be extended to send to
 * error tracking services (Sentry, LogRocket, etc.) in production
 */

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

export const logger = {
  /**
   * Log informational messages (development only)
   * @param {...any} args - Arguments to log
   */
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log warnings (always logged)
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    console.warn(...args);
    // TODO: Send to error tracking service in production
  },

  /**
   * Log errors (always logged)
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    console.error(...args);
    // TODO: Send to error tracking service in production
    // Example: Sentry.captureException(args[0]);
  },

  /**
   * Log debug information (development only)
   * @param {...any} args - Arguments to log
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
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
