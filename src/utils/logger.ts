/**
 * Enterprise-grade logger utility
 * 
 * Features:
 * - Structured logging with context and metadata
 * - Environment-aware logging (dev vs production)
 * - Integration points for error tracking services
 * - Correlation ID support for request tracking
 * - Performance monitoring hooks
 * - Protected from console suppression via marker symbol
 */

// Import marker from suppressDebugMessages to bypass console suppression
import { LOGGER_MARKER } from '@/suppressDebugMessages';

// Type definitions
interface ErrorTrackingService {
  captureException: (_error: Error, _options?: { extra?: Record<string, unknown> }) => void;
  captureMessage: (_message: string, _options?: { level?: string; extra?: Record<string, unknown> }) => void;
}

interface LoggerOptions {
  errorTracking?: ErrorTrackingService;
}

interface LogContext {
  [key: string]: unknown;
  correlationId?: string;
  includeCorrelationId?: boolean;
  error?: Error;
  important?: boolean;
  level?: string;
}

interface StructuredLog {
  timestamp: string;
  level: string;
  message: string;
  environment: string;
  correlationId?: string;
  [key: string]: unknown;
}

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'performance';

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';

// Store reference to external error tracking service (set via initialize())
let errorTrackingService: ErrorTrackingService | null = null;

/**
 * Initialize logger with external services
 */
export const initializeLogger = (options: LoggerOptions = {}): void => {
  if (options.errorTracking) {
    errorTrackingService = options.errorTracking;
    logger.info('Logger initialized with error tracking service');
  }
};

/**
 * Generate correlation ID for request tracking
 */
const generateCorrelationId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Format log message with structured context
 */
const createStructuredLog = (level: string, message: string, context: LogContext = {}): StructuredLog => {
  const timestamp = new Date().toISOString();
  const structuredLog: StructuredLog = {
    timestamp,
    level,
    message,
    ...context,
    environment: import.meta.env.MODE as string,
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
 */
const formatMessage = (message: string, context?: LogContext): [string, LogContext?] | [string] => {
  if (context && Object.keys(context).length > 0) {
    return [message, context];
  }
  return [message];
};

/**
 * Send error to external tracking service
 */
const sendToErrorTracking = (message: string, context: LogContext = {}): void => {
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
    console.error(LOGGER_MARKER, 'Failed to send to error tracking service:', e);
  }
};

export const logger = {
  /**
   * Log informational messages
   */
  log: (message: string, context?: LogContext): void => {
    if (isDevelopment) {
      console.log(LOGGER_MARKER, ...formatMessage(message, context));
    }
    // In production, could send to log aggregation service
  },

  /**
   * Log info messages
   */
  info: (message: string, context?: LogContext): void => {
    if (isDevelopment) {
      console.log(LOGGER_MARKER, ...formatMessage(message, context));
    }
    
    // In production, send structured logs to aggregation service
    if (isProduction && context?.important) {
      const structured = createStructuredLog('info', message, context);
      // Hook for log aggregation service (e.g., CloudWatch, Datadog)
      // logAggregationService.info(structured);
      void structured; // Suppress unused warning
    }
  },

  /**
   * Log warnings (always logged)
   */
  warn: (message: string, context?: LogContext): void => {
    createStructuredLog('warn', message, context); // For future log aggregation
    console.warn(LOGGER_MARKER, ...formatMessage(message, context));
    
    // Send warnings to error tracking in production
    if (isProduction) {
      sendToErrorTracking(message, { ...context, level: 'warning' });
    }
  },

  /**
   * Log errors (always logged)
   */
  error: (message: string, context?: LogContext): void => {
    createStructuredLog('error', message, context); // For future log aggregation
    console.error(LOGGER_MARKER, ...formatMessage(message, context));
    
    // Always send errors to error tracking service
    sendToErrorTracking(message, { ...context, level: 'error' });
  },

  /**
   * Log debug information (development only)
   */
  debug: (message: string, context?: LogContext): void => {
    if (isDevelopment) {
      console.debug(LOGGER_MARKER, ...formatMessage(message, context));
    }
  },

  /**
   * Log table data (development only)
   */
  table: (data: unknown): void => {
    if (isDevelopment) {
      console.table(data);
    }
  },

  /**
   * Log performance metrics
   */
  performance: (operation: string, duration: number, context: LogContext = {}): void => {
    createStructuredLog('performance', `${operation} completed`, {
      operation,
      duration,
      durationMs: `${duration}ms`,
      ...context
    }); // For future log aggregation
    
    if (isDevelopment) {
      console.log(LOGGER_MARKER, `⏱️ ${operation}: ${duration}ms`, context);
    }
    
    // In production, send to performance monitoring service
    if (isProduction) {
      // Hook for performance monitoring (e.g., New Relic, Datadog)
      // performanceMonitoring.recordMetric(operation, duration, context);
    }
  },

  /**
   * Create a timer for performance measurement
   */
  startTimer: (operation: string): ((_context?: LogContext) => number) => {
    const startTime = performance.now();
    return (context: LogContext = {}): number => {
      const duration = Math.round(performance.now() - startTime);
      logger.performance(operation, duration, context);
      return duration;
    };
  },

  /**
   * Log with correlation ID for request tracking
   */
  withCorrelation: (correlationId: string, level: Exclude<LogLevel, 'performance'>, message: string, context: LogContext = {}): void => {
    const enrichedContext = { ...context, correlationId };
    switch (level) {
      case 'info':
        logger.info(message, enrichedContext);
        break;
      case 'warn':
        logger.warn(message, enrichedContext);
        break;
      case 'error':
        logger.error(message, enrichedContext);
        break;
      case 'debug':
        logger.debug(message, enrichedContext);
        break;
    }
  }
};

export default logger;
