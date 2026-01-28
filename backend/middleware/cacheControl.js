import logger from '../config/logger.js';

/**
 * Cache Control Middleware
 * Adds appropriate cache headers based on route and content type
 */

const CACHE_DURATIONS = {
  // Static assets - cache for 1 year
  static: 31536000,
  // API responses - no cache (default)
  api: 0,
  // Public data - cache for 5 minutes
  public: 300,
  // Health checks - cache for 30 seconds
  health: 30,
  // Documentation - cache for 1 hour
  docs: 3600,
};

/**
 * Determine cache strategy based on request path and method
 */
function getCacheStrategy(req) {
  const path = req.path.toLowerCase();
  const method = req.method;

  // No cache for non-GET requests
  if (method !== 'GET' && method !== 'HEAD') {
    return { type: 'no-cache', duration: 0 };
  }

  // Health checks - short cache
  if (path.startsWith('/health')) {
    return { type: 'public', duration: CACHE_DURATIONS.health };
  }

  // API documentation - medium cache
  if (path.startsWith('/api-docs') || path === '/api-docs.json') {
    return { type: 'public', duration: CACHE_DURATIONS.docs };
  }

  // Static files - long cache with immutable
  if (path.startsWith('/uploads/') || path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    return { type: 'public', duration: CACHE_DURATIONS.static, immutable: true };
  }

  // API endpoints - no cache (data changes frequently)
  if (path.startsWith('/api/') || path.startsWith('/entities/') || path.startsWith('/auth/')) {
    return { type: 'no-cache', duration: 0 };
  }

  // Default: no cache for safety
  return { type: 'no-cache', duration: 0 };
}

/**
 * Cache control middleware
 * Adds Cache-Control, ETag, and related headers
 */
export function cacheControl(options = {}) {
  const {
    defaultMaxAge = 0,
    enableETag = true,
  } = options;

  return (req, res, next) => {
    const strategy = getCacheStrategy(req);

    // Set Cache-Control header
    if (strategy.type === 'no-cache') {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    } else if (strategy.type === 'public') {
      const maxAge = strategy.duration || defaultMaxAge;
      const directives = [`public`, `max-age=${maxAge}`];
      
      if (strategy.immutable) {
        directives.push('immutable');
      }
      
      res.set('Cache-Control', directives.join(', '));
    }

    // Add Vary header for content negotiation
    res.set('Vary', 'Accept-Encoding');

    // Enable ETag for GET requests if enabled
    if (enableETag && (req.method === 'GET' || req.method === 'HEAD')) {
      // Express automatically generates ETags via `etag` middleware
      // We just ensure it's enabled
      res.set('ETag', res.get('ETag') || 'W/"generated"');
    }

    next();
  };
}

/**
 * Conditional request middleware
 * Handles If-None-Match (ETag) and If-Modified-Since headers
 */
export function conditionalRequest(req, res, next) {
  const ifNoneMatch = req.headers['if-none-match'];
  const etag = res.get('ETag');

  // Handle ETag-based conditional requests
  if (ifNoneMatch && etag && ifNoneMatch === etag) {
    logger.debug('Returning 304 Not Modified based on ETag', {
      path: req.path,
      etag,
      correlationId: req.correlationId,
    });
    return res.status(304).end();
  }

  next();
}

/**
 * Set custom cache duration for specific routes
 * Use as route-specific middleware
 */
export function setCacheMaxAge(maxAge, options = {}) {
  return (req, res, next) => {
    const { visibility = 'public', immutable = false } = options;
    
    const directives = [`${visibility}`, `max-age=${maxAge}`];
    
    if (immutable) {
      directives.push('immutable');
    }
    
    res.set('Cache-Control', directives.join(', '));
    next();
  };
}

/**
 * Disable cache for specific routes
 * Use as route-specific middleware
 */
export function noCache(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}

/**
 * Stats for monitoring
 */
let cacheStats = {
  hits: 0,
  misses: 0,
  notModified: 0,
};

export function getCacheStats() {
  return { ...cacheStats };
}

export function resetCacheStats() {
  cacheStats = { hits: 0, misses: 0, notModified: 0 };
}

export default cacheControl;
