import logger from '../config/logger.js';

/**
 * Audit log entry types
 */
export const AuditEventType = {
  // Authentication events
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  
  // User management
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  
  // Contractor management
  CONTRACTOR_CREATED: 'CONTRACTOR_CREATED',
  CONTRACTOR_UPDATED: 'CONTRACTOR_UPDATED',
  CONTRACTOR_DELETED: 'CONTRACTOR_DELETED',
  
  // Project management
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_DELETED: 'PROJECT_DELETED',
  
  // Document operations
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  DOCUMENT_APPROVED: 'DOCUMENT_APPROVED',
  DOCUMENT_REJECTED: 'DOCUMENT_REJECTED',
  DOCUMENT_DELETED: 'DOCUMENT_DELETED',
  
  // Compliance events
  COI_GENERATED: 'COI_GENERATED',
  COMPLIANCE_STATUS_CHANGED: 'COMPLIANCE_STATUS_CHANGED',
  
  // System events
  CONFIG_CHANGED: 'CONFIG_CHANGED',
  BULK_OPERATION: 'BULK_OPERATION',
  DATA_EXPORT: 'DATA_EXPORT',
};

/**
 * Log an audit event
 */
export function logAudit(eventType, details = {}) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    ...details,
  };
  
  logger.info('AUDIT', auditEntry);
  
  return auditEntry;
}

/**
 * Middleware to automatically audit sensitive operations
 */
export function auditMiddleware(eventType) {
  return (req, res, next) => {
    // Capture original json method
    const originalJson = res.json.bind(res);
    
    // Override json method to log after successful response
    res.json = function(body) {
      // Only log on successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logAudit(eventType, {
          correlationId: req.correlationId,
          userId: req.user?.id,
          username: req.user?.username,
          method: req.method,
          url: req.url,
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          statusCode: res.statusCode,
        });
      }
      
      return originalJson(body);
    };
    
    next();
  };
}

/**
 * Helper function to log user authentication events
 */
export function logAuth(eventType, username, success, details = {}) {
  return logAudit(eventType, {
    username,
    success,
    ip: details.ip,
    userAgent: details.userAgent,
    ...details,
  });
}

/**
 * Helper function to log data changes
 */
export function logDataChange(eventType, entityType, entityId, userId, changes = {}) {
  return logAudit(eventType, {
    entityType,
    entityId,
    userId,
    changes,
  });
}

export default { logAudit, logAuth, logDataChange, auditMiddleware, AuditEventType };
