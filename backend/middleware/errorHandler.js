import logger from '../config/logger.js';

/**
 * Custom Error Classes for Enterprise Error Handling
 */
export class ApplicationError extends Error {
  constructor(message, statusCode = 500, details = null, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message, details = null) {
    super(message, 400, details, true);
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message = 'Authentication failed', details = null) {
    super(message, 401, details, true);
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message = 'Insufficient permissions', details = null) {
    super(message, 403, details, true);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource = 'Resource', details = null) {
    super(`${resource} not found`, 404, details, true);
  }
}

export class ConflictError extends ApplicationError {
  constructor(message = 'Resource conflict', details = null) {
    super(message, 409, details, true);
  }
}

export class RateLimitError extends ApplicationError {
  constructor(message = 'Too many requests', details = null) {
    super(message, 429, details, true);
  }
}

export class DatabaseError extends ApplicationError {
  constructor(message = 'Database operation failed', details = null) {
    super(message, 500, details, false);
  }
}

export class ExternalServiceError extends ApplicationError {
  constructor(service = 'External service', message = 'Service unavailable', details = null) {
    super(`${service}: ${message}`, 503, details, false);
  }
}

/**
 * Global error handler middleware
 * Catches all errors and formats them consistently
 */
export function errorHandler(err, req, res, next) {
  // Default to 500 server error if not set
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational !== undefined ? err.isOperational : false;

  // Log error with correlation ID
  const errorContext = {
    correlationId: req.correlationId,
    userId: req.user?.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    statusCode,
    isOperational,
  };

  // Log operational errors at warn level, unexpected errors at error level
  if (isOperational) {
    logger.warn(err.message, {
      ...errorContext,
      error: err.message,
      details: err.details,
    });
  } else {
    logger.error(err.message, {
      ...errorContext,
      error: err.message,
      stack: err.stack,
      details: err.details,
    });
  }

  // Don't expose internal error details in production
  const errorResponse = {
    error: err.message || 'Internal server error',
    correlationId: req.correlationId,
  };

  // Include details only for operational errors or in development
  if (isOperational || process.env.NODE_ENV !== 'production') {
    if (err.details) {
      errorResponse.details = err.details;
    }
  }

  // Include stack trace only in development
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Async handler wrapper to catch promise rejections
 * Eliminates need for try-catch in every async route handler
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(req, res) {
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.socket.remoteAddress,
    correlationId: req.correlationId,
  });

  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    correlationId: req.correlationId,
    availableEndpoints: {
      documentation: '/api-docs',
      health: '/health',
      authentication: '/auth/login',
    },
  });
}

/**
 * Validates that error status codes are valid HTTP codes
 */
export function validateStatusCode(statusCode) {
  const validCodes = [400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504];
  return validCodes.includes(statusCode) ? statusCode : 500;
}

/**
 * Helper to format validation errors from express-validator
 */
export function formatValidationErrors(errors) {
  return errors.reduce((acc, error) => {
    const field = error.path || error.param || 'unknown';
    if (!acc[field]) {
      acc[field] = [];
    }
    acc[field].push(error.msg);
    return acc;
  }, {});
}
