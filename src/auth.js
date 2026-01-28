// Simple auth helper: stores bearer token in localStorage and provides login/logout helpers.
import logger from './utils/logger';

const STORAGE_KEY = 'insuretrack_token';
const REFRESH_KEY = 'insuretrack_refresh_token';
const LEGACY_SESSION_KEY = 'token'; // Legacy sessionStorage key for backward compatibility
const apiBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  : null;

let refreshPromise = null;

// In-memory fallback storage for when localStorage fails (e.g., privacy mode)
let memoryStorage = {
  token: null,
  refreshToken: null
};

let useMemoryStorage = false;

export function getToken() {
  // Use memory storage if localStorage failed
  if (useMemoryStorage) {
    const token = memoryStorage.token;
    logger.debug('getToken from memory', { hasToken: !!token });
    return token;
  }
  
  try {
    const token = localStorage.getItem(STORAGE_KEY);
    logger.debug('getToken from localStorage', { hasToken: !!token });
    return token;
  } catch (e) {
    logger.error('Failed to retrieve authentication token from storage', { error: e.message });
    // Fall back to memory storage
    useMemoryStorage = true;
    const token = memoryStorage.token;
    logger.debug('getToken fallback to memory', { hasToken: !!token });
    return token;
  }
}

export function setToken(token, refreshToken = null) {
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
      logger.error('Failed to store token in localStorage', { error: e.message });
      logger.warn('Switching to in-memory storage mode (tokens will not persist across page reloads)');
      useMemoryStorage = true;
    }
  } else {
    logger.debug('Token stored in memory storage (localStorage unavailable)');
  }
  
  // Notify listeners (e.g., App) when auth state changes so UI can react
  try { window.dispatchEvent(new Event('auth-changed')); } catch (e) {}
}

export function clearToken() {
  // Clear all storage: memory, localStorage, and legacy sessionStorage
  setToken(null, null);
  
  // Also clear legacy sessionStorage token for backward compatibility
  try {
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch (e) {
    // Ignore if sessionStorage is not available
  }
}

export async function login({ username, password }) {
  // Demo-mode fallback: if no backend URL, allow local login
  if (!apiBase) {
    const demoToken = `demo-${Date.now()}`;
    setToken(demoToken, null);
    return { accessToken: demoToken, user: { username, demo: true } };
  }
  const res = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include'
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Login failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  // Expect response { accessToken: '...', refreshToken?: '...' }
  if (data?.accessToken) setToken(data.accessToken, data.refreshToken || null);
  return data;
}

export function isConfigured() {
  return !!apiBase;
}

export async function refreshAccessToken() {
  // Prevent multiple concurrent refresh calls
  if (refreshPromise) return refreshPromise;
  
  refreshPromise = (async () => {
    try {
      // Get refresh token from localStorage or memory
      let refreshToken;
      if (useMemoryStorage) {
        refreshToken = memoryStorage.refreshToken;
      } else {
        try {
          refreshToken = localStorage.getItem(REFRESH_KEY);
        } catch (e) {
          // Fall back to memory if localStorage fails
          useMemoryStorage = true;
          refreshToken = memoryStorage.refreshToken;
        }
      }
      
      if (!refreshToken || !apiBase) {
        clearToken();
        return null;
      }
      
      const res = await fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        credentials: 'include'
      });
      
      if (!res.ok) {
        clearToken();
        return null;
      }
      
      const data = await res.json();
      if (data?.accessToken) {
        setToken(data.accessToken, data.refreshToken || refreshToken);
        return data.accessToken;
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
}

export function getAuthHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default {
  getToken,
  setToken,
  clearToken,
  login,
  refreshAccessToken,
  getAuthHeader,
  isConfigured
};

