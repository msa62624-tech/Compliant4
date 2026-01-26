import jwt from 'jsonwebtoken';
import { sendError } from './validation.js';

// Auth middleware
export function authenticateToken(jwtSecret) {
  return (req, res, next) => {
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
