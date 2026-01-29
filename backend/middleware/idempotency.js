import logger from '../config/logger.js';
import crypto from 'crypto';

/**
 * In-memory idempotency store
 * In production, use Redis for distributed systems
 */
const idempotencyStore = new Map();

// TTL for idempotency keys (15 minutes)
const IDEMPOTENCY_TTL = 15 * 60 * 1000;

// Cleanup interval duration (5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Start or restart the cleanup interval
 * Starts the cleanup interval for removing expired idempotency keys
 * @private
 * @returns {NodeJS.Timeout} The interval timer reference
 */
function startCleanupInterval() {
  return setInterval(() => {
    const now = Date.now();
    for (const [key, value] of idempotencyStore.entries()) {
      if (now - value.timestamp > IDEMPOTENCY_TTL) {
        idempotencyStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

// Cleanup expired keys every 5 minutes
// Store interval reference to allow cleanup and prevent memory leak
// Use let instead of const to allow restart in testing
let cleanupInterval = startCleanupInterval();

// Allow process to exit if this is the only active resource
// but keep running when other resources are active
cleanupInterval.unref();

let isCleanedUp = false;

/**
 * Cleanup function to stop the interval and prevent memory leak
 * Call this during graceful shutdown
 */
export function cleanupIdempotency() {
  if (isCleanedUp) {
    return;
  }
  
  isCleanedUp = true;
  clearInterval(cleanupInterval);
  cleanupInterval = null;
  idempotencyStore.clear();
  logger.info('Idempotency cleanup completed');
}

/**
 * Reset cleanup state (for testing purposes only)
 * Restarts the cleanup interval to ensure proper test isolation
 * @private
 */
export function resetIdempotencyForTesting() {
  isCleanedUp = false;
  idempotencyStore.clear();
  
  // Restart the cleanup interval if it was stopped
  // This ensures test isolation when tests call cleanupIdempotency()
  clearInterval(cleanupInterval);
  cleanupInterval = startCleanupInterval();
  
  // Allow process to exit if this is the only active resource
  cleanupInterval.unref();
}

/**
 * Generate idempotency key from request
 * Uses: method + path + body + user ID
 */
function generateIdempotencyKey(req) {
  // Use explicit idempotency key if provided
  const explicitKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (explicitKey) {
    return `explicit:${req.user?.id || 'anonymous'}:${explicitKey}`;
  }

  // Generate key from request content
  const bodyHash = req.body ? crypto
    .createHash('sha256')
    .update(JSON.stringify(req.body))
    .digest('hex')
    .substring(0, 16) : 'nobody';

  return `auto:${req.method}:${req.path}:${req.user?.id || 'anonymous'}:${bodyHash}`;
}

/**
 * Idempotency middleware
 * Prevents duplicate operations from being executed multiple times
 * 
 * Use on POST/PUT/PATCH endpoints that modify data
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Enable/disable idempotency (default: true)
 * @param {number} options.ttl - TTL in milliseconds (default: 15 minutes)
 */
export function idempotency(options = {}) {
  const { enabled = true, ttl = IDEMPOTENCY_TTL } = options;

  return async (req, res, next) => {
    // Skip for GET/HEAD/OPTIONS (idempotent by nature)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Skip if disabled
    if (!enabled) {
      return next();
    }

    const idempotencyKey = generateIdempotencyKey(req);

    // Check if we've seen this request before
    const cachedResponse = idempotencyStore.get(idempotencyKey);
    if (cachedResponse) {
      const age = Date.now() - cachedResponse.timestamp;

      // Return cached response if still valid
      if (age < ttl) {
        logger.info('Returning cached response for duplicate request', {
          idempotencyKey,
          age,
          correlationId: req.correlationId,
          userId: req.user?.id,
        });

        return res
          .status(cachedResponse.statusCode)
          .set('X-Idempotency-Hit', 'true')
          .set('X-Idempotency-Age', age.toString())
          .json(cachedResponse.body);
      } else {
        // Expired, remove from cache
        idempotencyStore.delete(idempotencyKey);
      }
    }

    // Capture the response
    const originalJson = res.json.bind(res);
    res.json = function(body) {
      // Only cache successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        idempotencyStore.set(idempotencyKey, {
          statusCode: res.statusCode,
          body,
          timestamp: Date.now(),
        });

        logger.debug('Cached response for idempotency', {
          idempotencyKey,
          statusCode: res.statusCode,
          correlationId: req.correlationId,
        });
      }

      // Set header to indicate this is a new response
      res.set('X-Idempotency-Hit', 'false');
      
      return originalJson(body);
    };

    next();
  };
}

/**
 * Manual idempotency check
 * For cases where automatic middleware doesn't work
 */
export function checkIdempotency(req, customKey = null) {
  const key = customKey || generateIdempotencyKey(req);
  return idempotencyStore.get(key);
}

/**
 * Store result for idempotency
 */
export function storeIdempotencyResult(req, result, customKey = null) {
  const key = customKey || generateIdempotencyKey(req);
  idempotencyStore.set(key, {
    statusCode: 200,
    body: result,
    timestamp: Date.now(),
  });
}

/**
 * Get cache stats for monitoring
 */
export function getIdempotencyStats() {
  return {
    totalKeys: idempotencyStore.size,
    keys: Array.from(idempotencyStore.keys()).map(key => ({
      key: key.substring(0, 50) + '...',
      age: Date.now() - idempotencyStore.get(key).timestamp,
    })),
  };
}

export default idempotency;
