/**
 * Input sanitization middleware to prevent XSS and injection attacks
 */

/**
 * Sanitize string input by removing potentially dangerous characters
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  
  // Remove null bytes
  let sanitized = str.replace(/\0/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Sanitize HTML by escaping dangerous characters
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  
  const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return str.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char]);
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj, escapeHtmlContent = false) {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, escapeHtmlContent));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value, escapeHtmlContent);
    }
    return sanitized;
  }
  
  if (typeof obj === 'string') {
    const sanitized = sanitizeString(obj);
    return escapeHtmlContent ? escapeHtml(sanitized) : sanitized;
  }
  
  return obj;
}

/**
 * Middleware to sanitize request body, query, and params
 */
export function sanitizeInput(options = {}) {
  const { escapeHtml: shouldEscapeHtml = false } = options;
  
  return (req, res, next) => {
    // Sanitize body
    if (req.body) {
      req.body = sanitizeObject(req.body, shouldEscapeHtml);
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query, shouldEscapeHtml);
    }
    
    // Sanitize URL parameters
    if (req.params) {
      req.params = sanitizeObject(req.params, shouldEscapeHtml);
    }
    
    next();
  };
}

/**
 * Validate that required fields are present
 */
export function validateRequired(fields) {
  return (req, res, next) => {
    const missing = [];
    
    for (const field of fields) {
      const value = req.body?.[field];
      if (value === undefined || value === null || value === '') {
        missing.push(field);
      }
    }
    
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Required fields are missing',
        missing,
      });
    }
    
    next();
  };
}

/**
 * Validate string length
 */
export function validateStringLength(field, min, max) {
  return (req, res, next) => {
    const value = req.body?.[field];
    
    if (value && typeof value === 'string') {
      if (min && value.length < min) {
        return res.status(400).json({
          error: 'Validation failed',
          message: `Field '${field}' must be at least ${min} characters long`,
        });
      }
      
      if (max && value.length > max) {
        return res.status(400).json({
          error: 'Validation failed',
          message: `Field '${field}' must not exceed ${max} characters`,
        });
      }
    }
    
    next();
  };
}

/**
 * Validate email format
 */
export function validateEmail(field) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  return (req, res, next) => {
    const value = req.body?.[field];
    
    if (value && !emailRegex.test(value)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Field '${field}' must be a valid email address`,
      });
    }
    
    next();
  };
}

/**
 * Validate enum values
 */
export function validateEnum(field, allowedValues) {
  return (req, res, next) => {
    const value = req.body?.[field];
    
    if (value && !allowedValues.includes(value)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Field '${field}' must be one of: ${allowedValues.join(', ')}`,
        allowed: allowedValues,
      });
    }
    
    next();
  };
}

export default {
  sanitizeString,
  escapeHtml,
  sanitizeObject,
  sanitizeInput,
  validateRequired,
  validateStringLength,
  validateEmail,
  validateEnum,
};
