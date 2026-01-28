/**
 * Enterprise-grade logger utility
 * 
 * Features:
 * - Structured logging with context and metadata
 * - Environment-aware logging (dev vs production)
 * - Integration points for error tracking services
 * - Correlation ID support for request tracking
 * - Performance monitoring hooks
 */

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';

// Store reference to external error tracking service (set via initialize())
let errorTrackingService = null;

/**
 * Initialize logger with external services
 * @param {object} options - Configuration options
 * @param {object} options.errorTracking - Error tracking service (e.g., Sentry)
 */
export const initializeLogger = (options = {}) => {
  if (options.errorTracking) {
    errorTrackingService = options.errorTracking;
    logger.info('Logger initialized with error tracking service');
  }
};

/**
 * Generate correlation ID for request tracking
 * @returns {string} - Unique correlation ID
 */
const generateCorrelationId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Format log message with structured context
 * @param {string} level - Log level (info, warn, error, etc.)
 * @param {string} message - The log message
 * @param {object} context - Additional context data
 * @returns {object} - Structured log object
 */
const createStructuredLog = (level, message, context = {}) => {
  const timestamp = new Date().toISOString();
  const structuredLog = {
    timestamp,
    level,
    message,
    ...context,
    environment: import.meta.env.MODE,
    // Include correlation ID if available in context or generate new one
    correlationId: context.correlationId || (context.includeCorrelationId ? generateCorrelationId() : undefined)
  };
  
  // Remove undefined values
  Object.keys(structuredLog).forEach(key => {
    if (structuredLog[key] === undefined) {
      delete structuredLog[key];
    }
  });
  
  return structuredLog;
};

/**
 * Format message for console output
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

/**
 * Send error to external tracking service
 * @param {string} message - Error message
 * @param {object} context - Error context
 */
const sendToErrorTracking = (message, context = {}) => {
  if (!errorTrackingService || !isProduction) {
    return;
  }
  
  try {
    // If context contains an error object, capture it as exception
    if (context.error instanceof Error) {
      errorTrackingService.captureException(context.error, {
        extra: { message, ...context }
      });
    } else {
      // Otherwise capture as message
      errorTrackingService.captureMessage(message, {
        level: context.level || 'error',
        extra: context
      });
    }
  } catch (e) {
    // Fail silently to avoid breaking the application
    console.error('Failed to send to error tracking service:', e);
  }
};

export const logger = {
  /**
   * Log informational messages
   * @param {string} message - Log message
   * @param {object} context - Optional context data
   */
  log: (message, context) => {
    if (isDevelopment) {
      console.log(...formatMessage(message, context));
    }
    // In production, could send to log aggregation service
  },

  /**
   * Log info messages
   * @param {string} message - Log message
   * @param {object} context - Optional context data
   */
  info: (message, context) => {
    const structured = createStructuredLog('info', message, context);
    
    if (isDevelopment) {
      console.log(...formatMessage(message, context));
    }
    
    // In production, send structured logs to aggregation service
    if (isProduction && context?.important) {
      // Hook for log aggregation service (e.g., CloudWatch, Datadog)
      // logAggregationService.info(structured);
    }
  },

  /**
   * Log warnings (always logged)
   * @param {string} message - Log message
   * @param {object} context - Optional context data
   */
  warn: (message, context) => {
    const structured = createStructuredLog('warn', message, context);
    console.warn(...formatMessage(message, context));
    
    // Send warnings to error tracking in production
    if (isProduction) {
      sendToErrorTracking(message, { ...context, level: 'warning' });
    }
  },

  /**
   * Log errors (always logged)
   * @param {string} message - Log message
   * @param {object} context - Optional context data
   */
  error: (message, context) => {
    const structured = createStructuredLog('error', message, context);
    console.error(...formatMessage(message, context));
    
    // Always send errors to error tracking service
    sendToErrorTracking(message, { ...context, level: 'error' });
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

  /**
   * Log performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {object} context - Optional context data
   */
  performance: (operation, duration, context = {}) => {
    const structured = createStructuredLog('performance', `${operation} completed`, {
      operation,
      duration,
      durationMs: `${duration}ms`,
      ...context
    });
    
    if (isDevelopment) {
      console.log(`⏱️ ${operation}: ${duration}ms`, context);
    }
    
    // In production, send to performance monitoring service
    if (isProduction) {
      // Hook for performance monitoring (e.g., New Relic, Datadog)
      // performanceMonitoring.recordMetric(operation, duration, context);
    }
  },

  /**
   * Create a timer for performance measurement
   * @param {string} operation - Operation name
   * @returns {Function} - Function to call when operation completes
   */
  startTimer: (operation) => {
    const startTime = performance.now();
    return (context = {}) => {
      const duration = Math.round(performance.now() - startTime);
      logger.performance(operation, duration, context);
      return duration;
    };
  },

  /**
   * Log with correlation ID for request tracking
   * @param {string} correlationId - Correlation ID
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {object} context - Optional context data
   */
  withCorrelation: (correlationId, level, message, context = {}) => {
    logger[level](message, { ...context, correlationId });
  }
};

export default logger;
