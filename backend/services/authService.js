import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Passwords are hashed using bcrypt with salt rounds = 10
// Admin password loaded from environment variable for security
// SECURITY FIX: Require ADMIN_PASSWORD_HASH in production, no default fallback

// Dummy password hash for timing attack prevention in login endpoints
// Used when user not found or has no password to ensure bcrypt comparison takes consistent time
export const DUMMY_PASSWORD_HASH = '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhashdummy';

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @param {number} saltRounds - Number of salt rounds (default: 10)
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password, saltRounds = 10) {
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Compare a plain text password with a hashed password
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if passwords match
 */
export async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token
 * @param {Object} payload - Token payload
 * @param {string} secret - JWT secret
 * @param {string} expiresIn - Token expiration (default: '24h')
 * @returns {string} JWT token
 */
export function generateToken(payload, secret, expiresIn = '24h') {
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verify a JWT token
 * @param {string} token - JWT token
 * @param {string} secret - JWT secret
 * @returns {Object|null} Decoded token or null if invalid
 */
export function verifyToken(token, secret) {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    console.log('Token verification failed:', err.message);
    return null;
  }
}

/**
 * Generate a password reset token
 * @returns {string} Random token
 */
export function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Safe, timing-attack-resistant string comparison used for token checks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings match
 */
export function timingSafeEqual(a, b) {
  if (a === undefined || b === undefined) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (err) {
    console.warn('timingSafeEqual comparison failed:', err?.message || err);
    return false;
  }
}
