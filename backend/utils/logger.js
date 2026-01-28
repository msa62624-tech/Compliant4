/**
 * Backend production-safe logger utility
 * 
 * Logs to console in development, can be extended to send to
 * error tracking services in production
 */

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
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
   * Log informational messages (always logged)
   * Useful for important events that should be tracked
   * @param {...any} args - Arguments to log
   */
  info: (...args) => {
    console.info(...args);
  },
};

module.exports = logger;
