import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';

/**
 * Middleware to add correlation ID to each request
 */
export function correlationId(req, res, next) {
  // Check if correlation ID already exists in headers (from upstream proxy/load balancer)
  const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || uuidv4();
  
  // Store in request object
  req.correlationId = correlationId;
  
  // Add to response headers
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
}

/**
 * Morgan token for correlation ID
 */
morgan.token('correlation-id', (req) => req.correlationId);

/**
 * Morgan token for user ID
 */
morgan.token('user-id', (req) => req.user?.id || 'anonymous');

/**
 * Custom morgan format that includes correlation ID
 */
const morganFormat = ':correlation-id :method :url :status :response-time ms - :res[content-length] - :user-id';

/**
 * Morgan stream that writes to Winston logger
 */
const morganStream = {
  write: (message) => {
    // Remove trailing newline
    logger.http(message.trim());
  },
};

/**
 * Request logging middleware using Morgan
 */
export const requestLogger = morgan(morganFormat, {
  stream: morganStream,
  // Skip logging for health check endpoint to reduce noise
  skip: (req) => req.url === '/health',
});

/**
 * Enhanced error logging middleware
 */
export function errorLogger(err, req, res, next) {
  logger.error('Request error', {
    correlationId: req.correlationId,
    method: req.method,
    url: req.url,
    userId: req.user?.id,
    error: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500,
  });
  
  next(err);
}
