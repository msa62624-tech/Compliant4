import logger from '../config/logger.js';
import { saveEntities } from '../config/database.js';
import { cleanupIdempotency } from './idempotency.js';

// Track active connections
let activeConnections = new Set();
let isShuttingDown = false;

/**
 * Track active request
 */
export function trackConnection(req, res, next) {
  if (isShuttingDown) {
    res.setHeader('Connection', 'close');
    return res.status(503).json({
      error: 'Server is shutting down',
      message: 'Please retry your request in a moment',
    });
  }
  
  const connectionId = Symbol('connection');
  activeConnections.add(connectionId);
  
  // Remove connection when response finishes
  res.on('finish', () => {
    activeConnections.delete(connectionId);
  });
  
  next();
}

/**
 * Get count of active connections
 */
export function getActiveConnectionCount() {
  return activeConnections.size;
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal', { signal });
    return;
  }
  
  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new connections
  logger.info('Stopping new connections...');
  
  // Wait for active connections to finish
  const timeout = parseInt(process.env.SHUTDOWN_TIMEOUT || '30000', 10); // 30 seconds default
  const checkInterval = 100; // Check every 100ms
  const maxWait = timeout;
  let waited = 0;
  
  while (activeConnections.size > 0 && waited < maxWait) {
    logger.info(`Waiting for ${activeConnections.size} active connections to finish...`);
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    waited += checkInterval;
  }
  
  if (activeConnections.size > 0) {
    logger.warn(`Shutdown timeout reached, forcing shutdown with ${activeConnections.size} active connections`);
  } else {
    logger.info('All connections closed');
  }
  
  // Save any pending data
  try {
    logger.info('Saving data before shutdown...');
    saveEntities();
    logger.info('Data saved successfully');
  } catch (error) {
    logger.error('Error saving data during shutdown', { error: error.message, stack: error.stack });
  }
  
  // Cleanup idempotency interval
  try {
    cleanupIdempotency();
  } catch (error) {
    logger.error('Error cleaning up idempotency', { error: error.message, stack: error.stack });
  }
  
  // Perform any other cleanup
  logger.info('Graceful shutdown complete');
  
  // Exit process
  process.exit(0);
}

/**
 * Setup graceful shutdown handlers
 */
export function setupGracefulShutdown() {
  // Handle termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack,
    });
    gracefulShutdown('uncaughtException');
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString(),
    });
  });
  
  logger.info('Graceful shutdown handlers configured');
}

export default {
  trackConnection,
  getActiveConnectionCount,
  gracefulShutdown,
  setupGracefulShutdown,
};
