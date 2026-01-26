import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DATA_DIR } from './database.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env with explicit path
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Default admin email list for notifications (comma-separated)
export const DEFAULT_ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

// JWT_SECRET persistence: Load from env or generate and persist to file
// This ensures tokens remain valid across server restarts in development
const JWT_SECRET_FILE = path.join(DATA_DIR, '.jwt-secret');

export const JWT_SECRET = (() => {
  // Priority 1: Use environment variable if set
  if (process.env.JWT_SECRET) {
    console.log('✅ Using JWT_SECRET from environment variable');
    return process.env.JWT_SECRET;
  }
  
  // Priority 2: Require JWT_SECRET in production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  
  // Priority 3: Load or generate persistent secret for development
  try {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(JWT_SECRET_FILE)) {
      const secretFromDisk = fs.readFileSync(JWT_SECRET_FILE, 'utf8').trim();
      if (secretFromDisk) {
        console.log('🔐 Loaded JWT secret from disk');
        return secretFromDisk;
      }
    }

    const newSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(JWT_SECRET_FILE, newSecret, 'utf8');
    console.log('🔐 Generated and persisted new JWT secret');
    return newSecret;
  } catch (e) {
    console.warn('⚠️ Failed to persist JWT secret, using ephemeral secret in memory');
    return crypto.randomBytes(32).toString('hex');
  }
})();

// Admin password hash with production requirement
// SECURITY FIX: Require ADMIN_PASSWORD_HASH in production, no default fallback
export const ADMIN_PASSWORD_HASH = (() => {
  if (process.env.ADMIN_PASSWORD_HASH) {
    return process.env.ADMIN_PASSWORD_HASH;
  }
  
  // In production, fail fast if admin password not configured
  const isProduction = process.env.NODE_ENV === 'production' || 
                       process.env.NODE_ENV === 'prod' ||
                       process.env.NODE_ENV === 'live';
  
  if (isProduction) {
    throw new Error('ADMIN_PASSWORD_HASH environment variable is required in production');
  }
  
  // Development fallback with warning
  console.warn('⚠️ WARNING: Using default admin password hash for development. Set ADMIN_PASSWORD_HASH in production!');
  return '$2b$10$SdlYpKRtZWyeRtelxZazJ.E34HJK70pJCuAy4qXely62Z/LAvAzBO';
})();

// Renewal configuration
export const RENEWAL_LOOKAHEAD_DAYS = Number(process.env.RENEWAL_LOOKAHEAD_DAYS || 30);
export const BINDER_WINDOW_DAYS = Number(process.env.BINDER_WINDOW_DAYS || 30);

// Server configuration
export const PORT = process.env.PORT || 3001;
export const FRONTEND_URL = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5175';
export const NODE_ENV = process.env.NODE_ENV || 'development';
