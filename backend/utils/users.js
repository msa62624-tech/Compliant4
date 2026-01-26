import { ADMIN_PASSWORD_HASH } from '../config/env.js';

// Default users array
export let users = [
  { 
    id: '1', 
    username: 'admin', 
    password: ADMIN_PASSWORD_HASH, 
    email: 'miriamsabel@insuretrack.onmicrosoft.com', 
    name: 'Miriam Sabel', 
    role: 'super_admin' 
  }
];

// Password reset tokens storage (in production, use a database with TTL)
// Format: { email: { token, expiresAt, used, userType } }
export const passwordResetTokens = new Map();

/**
 * Find user by username or email
 * @param {string} identifier - Username or email
 * @returns {Object|undefined} User object
 */
export function findUser(identifier) {
  return users.find(u => u.username === identifier || u.email === identifier);
}

/**
 * Find user by ID
 * @param {string} id - User ID
 * @returns {Object|undefined} User object
 */
export function findUserById(id) {
  return users.find(u => u.id === id);
}
