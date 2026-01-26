import jwt from 'jsonwebtoken';
import { sendError } from './validation.js';

// Create auth middleware that will be initialized with JWT_SECRET
let authMiddleware = null;

/**
 * Initialize authenticateToken middleware with JWT secret
 * @param {string} jwtSecret - JWT secret key
 */
export function initializeAuthMiddleware(jwtSecret) {
  authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('🔐 Auth check:', {
      hasAuthHeader: !!authHeader,
      hasToken: !!token,
      path: req.path
    });

    if (!token) {
      console.log('❌ No token provided');
      return sendError(res, 401, 'Authentication token required');
    }

    jwt.verify(token, jwtSecret, (err, user) => {
      if (err) {
        console.log('❌ Token verification failed:', err.message);
        return sendError(res, 403, 'Invalid or expired token');
      }
      console.log('✅ Token verified for user:', user.username);
      req.user = user;
      next();
    });
  };
}

// Export the middleware function itself
export const authenticateToken = (req, res, next) => {
  if (!authMiddleware) {
    throw new Error('Auth middleware not initialized. Call initializeAuthMiddleware(jwtSecret) first.');
  }
  return authMiddleware(req, res, next);
};

// Admin-only middleware
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return sendError(res, 401, 'Authentication required');
  }
  
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return sendError(res, 403, 'Admin access required');
  }
  
  next();
}

/**
 * Optional authentication middleware - sets req.user if token is valid, but doesn't fail if not
 * Useful for endpoints that provide different levels of detail based on authentication
 */
export const optionalAuthentication = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // No token provided - continue without setting req.user
    return next();
  }

  if (!authMiddleware) {
    // Auth not initialized - continue without setting req.user
    return next();
  }

  // Try to verify the token, but don't fail if it's invalid
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (!err) {
      // Token is valid - set req.user
      req.user = user;
    }
    // Continue regardless of token validity
    next();
  });
};
