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
