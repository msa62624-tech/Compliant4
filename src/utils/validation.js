/**
 * Enterprise-grade input validation utilities
 * 
 * Uses Zod for schema-based validation
 * Provides reusable validation functions for common input types
 */

import { z } from 'zod';
import logger from './logger.js';

// Common validation patterns
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,50}$/;
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;

// Password strength requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

/**
 * Authentication validation schemas
 */
export const authSchemas = {
  username: z.string()
    .trim()
    .min(1, 'Username is required')
    .max(50, 'Username must be 50 characters or less')
    .regex(USERNAME_REGEX, 'Username can only contain letters, numbers, underscores, dots, and hyphens'),

  email: z.string()
    .trim()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email must be 255 characters or less')
    .regex(EMAIL_REGEX, 'Please enter a valid email address'),

  password: z.string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH, `Password must be ${PASSWORD_MAX_LENGTH} characters or less`),

  passwordStrong: z.string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH, `Password must be ${PASSWORD_MAX_LENGTH} characters or less`)
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),

  login: z.object({
    username: z.string()
      .trim()
      .min(1, 'Username is required')
      .max(50, 'Username must be 50 characters or less'),
    password: z.string()
      .min(1, 'Password is required')
  }),

  token: z.string()
    .min(1, 'Token is required')
    .max(500, 'Invalid token format')
};

/**
 * Contact information validation schemas
 */
export const contactSchemas = {
  phone: z.string()
    .trim()
    .min(1, 'Phone number is required')
    .regex(PHONE_REGEX, 'Please enter a valid phone number'),

  phoneOptional: z.string()
    .trim()
    .regex(PHONE_REGEX, 'Please enter a valid phone number')
    .optional()
    .or(z.literal('')),

  name: z.string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),

  companyName: z.string()
    .trim()
    .min(1, 'Company name is required')
    .max(200, 'Company name must be 200 characters or less')
};

/**
 * URL and identifier validation schemas
 */
export const urlSchemas = {
  url: z.string()
    .trim()
    .min(1, 'URL is required')
    .regex(URL_REGEX, 'Please enter a valid URL'),

  urlOptional: z.string()
    .trim()
    .regex(URL_REGEX, 'Please enter a valid URL')
    .optional()
    .or(z.literal('')),

  uuid: z.string()
    .uuid('Invalid ID format'),

  id: z.union([
    z.string().min(1, 'ID is required'),
    z.number().int().positive('ID must be a positive number')
  ]),

  token: z.string()
    .min(1, 'Token is required')
    .max(500, 'Invalid token format')
};

/**
 * Broker information validation schema
 */
export const brokerSchemas = {
  broker: z.object({
    broker_name: contactSchemas.name,
    broker_email: authSchemas.email,
    broker_phone: contactSchemas.phoneOptional,
    broker_company: contactSchemas.companyName.optional().or(z.literal(''))
  }),

  globalBroker: z.object({
    broker_name: contactSchemas.name,
    broker_email: authSchemas.email,
    broker_phone: contactSchemas.phoneOptional,
    broker_company: contactSchemas.companyName.optional().or(z.literal(''))
  }),

  perPolicyBroker: z.object({
    name: contactSchemas.name,
    email: authSchemas.email,
    phone: contactSchemas.phoneOptional,
    policies: z.array(z.string()).min(1, 'At least one policy must be selected')
  })
};

/**
 * URL parameter validation schemas
 */
export const urlParamSchemas = {
  brokerUploadParams: z.object({
    type: z.enum(['global', 'per-policy'], {
      errorMap: () => ({ message: 'Invalid upload type. Must be "global" or "per-policy"' })
    }).optional(),
    subId: z.string()
      .min(1, 'Subcontractor ID is required')
      .max(100, 'Invalid subcontractor ID')
      .optional(),
    token: z.string()
      .min(1, 'Access token is required')
      .max(500, 'Invalid token format')
      .optional()
  })
};

/**
 * Validate data against a Zod schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {any} data - Data to validate
 * @param {object} options - Validation options
 * @param {boolean} options.throwOnError - Throw error on validation failure (default: false)
 * @returns {object} - Validation result { success: boolean, data?: any, errors?: array }
 */
export function validate(schema, data, options = {}) {
  const { throwOnError = false } = options;

  try {
    const validatedData = schema.parse(data);
    logger.debug('Validation successful', { schema: schema.description });
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));

      logger.warn('Validation failed', {
        errors,
        schema: schema.description
      });

      if (throwOnError) {
        const firstError = errors[0];
        throw new Error(firstError.message);
      }

      return { success: false, errors };
    }

    // Unexpected error
    logger.error('Unexpected validation error', {
      error: error.message,
      schema: schema.description
    });

    if (throwOnError) {
      throw error;
    }

    return {
      success: false,
      errors: [{ field: 'unknown', message: 'Validation failed', code: 'unknown' }]
    };
  }
}

/**
 * Validate and sanitize email address
 * @param {string} email - Email to validate
 * @returns {object} - { valid: boolean, email?: string, error?: string }
 */
export function validateEmail(email) {
  const result = validate(authSchemas.email, email);
  if (result.success) {
    return { valid: true, email: result.data };
  }
  return { valid: false, error: result.errors[0]?.message };
}

/**
 * Validate and sanitize username
 * @param {string} username - Username to validate
 * @returns {object} - { valid: boolean, username?: string, error?: string }
 */
export function validateUsername(username) {
  const result = validate(authSchemas.username, username);
  if (result.success) {
    return { valid: true, username: result.data };
  }
  return { valid: false, error: result.errors[0]?.message };
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @param {boolean} requireStrong - Require strong password (default: false)
 * @returns {object} - { valid: boolean, strength?: string, error?: string }
 */
export function validatePassword(password, requireStrong = false) {
  const schema = requireStrong ? authSchemas.passwordStrong : authSchemas.password;
  const result = validate(schema, password);
  
  if (result.success) {
    // Calculate strength
    let strength = 'weak';
    if (password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && 
        /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)) {
      strength = 'strong';
    } else if (password.length >= 10 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password)) {
      strength = 'medium';
    }
    
    return { valid: true, strength };
  }
  
  return { valid: false, error: result.errors[0]?.message };
}

/**
 * Validate login credentials
 * @param {object} credentials - { username, password }
 * @returns {object} - { valid: boolean, data?: object, errors?: array }
 */
export function validateLoginCredentials(credentials) {
  return validate(authSchemas.login, credentials);
}

/**
 * Validate URL parameters
 * @param {URLSearchParams|object} params - URL parameters to validate
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {object} - { valid: boolean, data?: object, errors?: array }
 */
export function validateUrlParams(params, schema) {
  // Convert URLSearchParams to object if needed
  const paramsObject = params instanceof URLSearchParams
    ? Object.fromEntries(params.entries())
    : params;

  return validate(schema, paramsObject);
}

/**
 * Sanitize string input (remove potentially dangerous characters)
 * @param {string} input - Input to sanitize
 * @param {object} options - Sanitization options
 * @param {boolean} options.allowHtml - Allow HTML tags (default: false)
 * @returns {string} - Sanitized string
 */
export function sanitizeString(input, options = {}) {
  if (typeof input !== 'string') {
    return '';
  }

  const { allowHtml = false } = options;

  let sanitized = input.trim();

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // If HTML not allowed, escape HTML entities
  if (!allowHtml) {
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  return sanitized;
}

/**
 * Check if value is a valid ID (string or positive number)
 * @param {any} value - Value to check
 * @returns {boolean} - True if valid ID
 */
export function isValidId(value) {
  if (typeof value === 'string' && value.length > 0) return true;
  if (typeof value === 'number' && value > 0 && Number.isInteger(value)) return true;
  return false;
}

export default {
  validate,
  validateEmail,
  validateUsername,
  validatePassword,
  validateLoginCredentials,
  validateUrlParams,
  sanitizeString,
  isValidId,
  schemas: {
    auth: authSchemas,
    contact: contactSchemas,
    url: urlSchemas,
    broker: brokerSchemas,
    urlParam: urlParamSchemas
  }
};
