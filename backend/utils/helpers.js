import path from 'path';
import fs from 'fs';
import logger from '../config/logger.js';

/**
 * Validate and sanitize filename to prevent directory traversal
 * @param {string} name - Filename to sanitize
 * @returns {string} Sanitized filename
 */
export function validateAndSanitizeFilename(name) {
  if (!name || typeof name !== 'string') throw new Error('Invalid filename');
  // Check for path traversal patterns before sanitization
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new Error('Invalid filename - path traversal detected');
  }
  // Only allow letters, numbers, dot, underscore, hyphen
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safe) {
    throw new Error('Invalid filename - no valid characters');
  }
  return safe;
}

/**
 * Verify that a resolved path is within a base directory
 * @param {string} resolvedPath - Path to verify
 * @param {string} baseDir - Base directory path
 */
export function verifyPathWithinDirectory(resolvedPath, baseDir) {
  const normalizedBase = path.resolve(baseDir) + path.sep;
  const normalizedPath = path.resolve(resolvedPath);
  if (!normalizedPath.startsWith(normalizedBase)) {
    throw new Error('Path traversal detected');
  }
}

/**
 * Email validation helper
 * SECURITY FIX: Improved email validation regex to be more strict
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export function validateEmail(email) {
  // More comprehensive regex that validates proper email format
  // Requires: local-part@domain.tld format with proper structure
  // Prevents consecutive dots in domain part
  const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254; // RFC 5321 max length
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath - Directory path
 */
export function ensureDirectoryExists(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.info('Directory created', { path: dirPath });
    }
  } catch (e) {
    logger.warn('Could not ensure directory exists', { path: dirPath, error: e?.message });
  }
}

/**
 * Mask sensitive email address for logging
 * Preserves privacy while maintaining traceability
 * @param {string} email - Email address to mask
 * @returns {string} Masked email address
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') {
    return 'unknown';
  }

  if (!email.includes('@')) {
    // Not a valid email format, return masked version
    return email.length > 3 ? `${email.substring(0, 3)}***` : '***';
  }

  const parts = email.split('@');
  const localPart = parts[0] || '';
  const domain = parts[1] || 'unknown';

  const maskedLocal = localPart.length > 3
    ? `${localPart.substring(0, 3)}***`
    : '***';

  return `${maskedLocal}@${domain}`;
}

/**
 * Validate if a string is a valid UUID v4
 * @param {string} uuid - String to validate
 * @returns {boolean} True if valid UUID v4
 */
export function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Safely parse JSON with fallback
 * @param {string} jsonString - JSON string to parse
 * @param {any} defaultValue - Default value if parsing fails
 * @returns {any} Parsed object or default value
 */
export function safeJSONParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    logger.warn('JSON parse failed', { error: error.message });
    return defaultValue;
  }
}

/**
 * Generate a random alphanumeric string
 * @param {number} length - Length of string to generate
 * @returns {string} Random string
 */
export function generateRandomString(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
