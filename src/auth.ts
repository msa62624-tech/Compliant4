// Simple auth helper: stores bearer token in localStorage and provides login/logout helpers.
import logger from './utils/logger';

const STORAGE_KEY = 'insuretrack_token';
const REFRESH_KEY = 'insuretrack_refresh_token';
const LEGACY_SESSION_KEY = 'token'; // Legacy sessionStorage key for backward compatibility
const apiBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  : null;

let refreshPromise: Promise<string | null> | null = null;

interface JWTPayload {
  exp?: number;
  [key: string]: unknown;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
}

interface MemoryStorage {
  token: string | null;
  refreshToken: string | null;
}

/**
 * Decode JWT token without verification (for client-side expiration check only)
 */
function decodeJWT(token: string): JWTPayload | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch (error) {
    logger.error('Failed to decode JWT token', { error: error as Error });
    return null;
  }
}

/**
 * Check if JWT token is expired or about to expire
 */
export function isTokenExpired(token: string, bufferSeconds: number = 60): boolean {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) {
    logger.warn('Token missing expiration claim');
    return true;
  }
  
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = decoded.exp;
  const isExpired = now >= (expiresAt - bufferSeconds);
  
  if (isExpired) {
    logger.debug('Token expired or about to expire', {
      expiresAt,
      now,
      remainingSeconds: expiresAt - now
    });
  }
  
  return isExpired;
}

// In-memory fallback storage for when localStorage fails (e.g., privacy mode)
let memoryStorage: MemoryStorage = {
  token: null,
  refreshToken: null
};

let useMemoryStorage = false;

export function getToken(): string | null {
  // Use memory storage if localStorage failed
  if (useMemoryStorage) {
    const token = memoryStorage.token;
    logger.debug('getToken from memory', { hasToken: !!token });
    return token;
  }
  
  try {
    const token = localStorage.getItem(STORAGE_KEY);
    logger.debug('getToken from localStorage', { hasToken: !!token });
    
    // Check if token is expired (but don't trigger refresh here to avoid blocking)
    if (token && isTokenExpired(token)) {
      logger.debug('Retrieved token is expired');
    }
    
    return token;
  } catch (e) {
    logger.error('Failed to retrieve authentication token from storage', { error: e as Error });
    // Fall back to memory storage
    useMemoryStorage = true;
    const token = memoryStorage.token;
    logger.debug('getToken fallback to memory', { hasToken: !!token });
    return token;
  }
}

/**
 * Get token and automatically refresh if expired
 * Use this for API calls that need a valid token
 */
export async function getValidToken(): Promise<string | null> {
  const token = getToken();
  
  if (!token) {
    logger.debug('No token available');
    return null;
  }
  
  // If token is expired or about to expire, attempt refresh
  if (isTokenExpired(token)) {
    logger.debug('Token expired, attempting refresh');
    const newToken = await refreshAccessToken();
    return newToken;
  }
  
  return token;
}

export function setToken(token: string | null, refreshToken: string | null = null): void {
  logger.debug('setToken called', { hasToken: !!token, hasRefreshToken: !!refreshToken });
  
  // Update memory storage first (always works)
  memoryStorage.token = token;
  memoryStorage.refreshToken = refreshToken;
  
  // Try localStorage if not already failed
  if (!useMemoryStorage) {
    try {
      if (token) {
        localStorage.setItem(STORAGE_KEY, token);
        logger.debug('Token stored in localStorage successfully');
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      if (refreshToken) {
        localStorage.setItem(REFRESH_KEY, refreshToken);
        logger.debug('Refresh token stored in localStorage successfully');
      } else {
        localStorage.removeItem(REFRESH_KEY);
      }
    } catch (e) {
      // Log storage errors and switch to memory-only mode
      logger.error('Failed to store token in localStorage', { error: e as Error });
      logger.warn('Switching to in-memory storage mode (tokens will not persist across page reloads)');
      useMemoryStorage = true;
    }
  } else {
    logger.debug('Token stored in memory storage (localStorage unavailable)');
  }
  
  // Notify listeners (e.g., App) when auth state changes so UI can react
  try { window.dispatchEvent(new Event('auth-changed')); } catch (e) { /* ignore */ }
}

export function clearToken(): void {
  // Clear all storage: memory, localStorage, and legacy sessionStorage
  setToken(null, null);
  
  // Also clear legacy sessionStorage token for backward compatibility
  try {
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch (e) {
    // Ignore if sessionStorage is not available
  }
}

export async function login({ username, password }: LoginCredentials): Promise<AuthResponse> {
  // Validate required backend configuration
  if (!apiBase) {
    logger.error('Authentication backend not configured', {
      environment: import.meta.env.MODE,
      expectedVariable: 'VITE_API_BASE_URL'
    });
    throw new Error('Authentication service is not configured. Please configure VITE_API_BASE_URL environment variable.');
  }

  // Validate input parameters
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    throw new Error('Username is required and must be a non-empty string');
  }
  if (!password || typeof password !== 'string' || password.length === 0) {
    throw new Error('Password is required and must be a non-empty string');
  }

  try {
    const res = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
      credentials: 'include',
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(30000)
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error('Login request failed', {
        status: res.status,
        statusText: res.statusText,
        username
      });
      
      // Provide specific error messages for common scenarios
      if (res.status === 401) {
        throw new Error('Invalid username or password');
      } else if (res.status === 429) {
        throw new Error('Too many login attempts. Please try again later');
      } else if (res.status === 503) {
        throw new Error('Authentication service is temporarily unavailable');
      }
      throw new Error(`Login failed: ${res.status} ${text || res.statusText}`);
    }

    const data: AuthResponse = await res.json();
    
    // Validate response structure
    if (!data?.accessToken) {
      logger.error('Invalid login response structure', { hasData: !!data });
      throw new Error('Invalid response from authentication service');
    }

    // Store tokens securely
    setToken(data.accessToken, data.refreshToken || null);
    logger.info('User logged in successfully', { username });
    
    return data;
  } catch (error) {
    // Handle timeout errors
    if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
      logger.error('Login request timed out', { username });
      throw new Error('Login request timed out. Please check your connection and try again');
    }
    
    // Re-throw other errors
    throw error;
  }
}

export function isConfigured(): boolean {
  return !!apiBase;
}

export async function refreshAccessToken(): Promise<string | null> {
  // Prevent multiple concurrent refresh calls
  if (refreshPromise) {
    logger.debug('Token refresh already in progress, waiting for existing promise');
    return refreshPromise;
  }
  
  refreshPromise = (async () => {
    try {
      // Validate backend configuration
      if (!apiBase) {
        logger.warn('Cannot refresh token: authentication backend not configured');
        clearToken();
        return null;
      }

      // Get refresh token from localStorage or memory
      let refreshToken;
      if (useMemoryStorage) {
        refreshToken = memoryStorage.refreshToken;
      } else {
        try {
          refreshToken = localStorage.getItem(REFRESH_KEY);
        } catch (e) {
          logger.error('Failed to retrieve refresh token from localStorage', { error: e as Error });
          // Fall back to memory if localStorage fails
          useMemoryStorage = true;
          refreshToken = memoryStorage.refreshToken;
        }
      }
      
      if (!refreshToken) {
        logger.warn('No refresh token available, clearing authentication state');
        clearToken();
        return null;
      }
      
      logger.debug('Attempting to refresh access token');
      
      const res = await fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        credentials: 'include',
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(15000)
      });
      
      if (!res.ok) {
        logger.warn('Token refresh failed', {
          status: res.status,
          statusText: res.statusText
        });
        
        // Clear tokens on authentication failure
        if (res.status === 401 || res.status === 403) {
          logger.info('Refresh token expired or invalid, clearing authentication state');
          clearToken();
        }
        return null;
      }
      
      const data: AuthResponse = await res.json();
      if (data?.accessToken) {
        logger.info('Access token refreshed successfully');
        setToken(data.accessToken, data.refreshToken || refreshToken);
        return data.accessToken;
      }
      
      logger.error('Invalid refresh response: missing accessToken');
      return null;
    } catch (error) {
      // Handle timeout errors
      if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
        logger.error('Token refresh request timed out');
        return null;
      }
      
      logger.error('Token refresh failed with exception', {
        error: error as Error
      });
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
}

export function getAuthHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default {
  getToken,
  getValidToken,
  setToken,
  clearToken,
  login,
  refreshAccessToken,
  getAuthHeader,
  isConfigured,
  isTokenExpired
};

