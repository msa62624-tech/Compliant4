// Simple auth helper: stores bearer token in localStorage and provides login/logout helpers.
const STORAGE_KEY = 'insuretrack_token';
const REFRESH_KEY = 'insuretrack_refresh_token';
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

// Test if localStorage is available and working
function testLocalStorage() {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.warn('⚠️ localStorage not available, using in-memory storage (tokens will not persist across page reloads)');
    return false;
  }
}

export function getToken() {
  // Use memory storage if localStorage failed
  if (useMemoryStorage) {
    return memoryStorage.token;
  }
  
  try {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
      console.warn('⚠️ No authentication token found in storage');
    }
    return token;
  } catch (e) {
    console.error('❌ Failed to retrieve authentication token from storage:', e);
    // Fall back to memory storage
    useMemoryStorage = true;
    return memoryStorage.token;
  }
}

export function setToken(token, refreshToken = null) {
  // Update memory storage first (always works)
  memoryStorage.token = token;
  memoryStorage.refreshToken = refreshToken;
  
  // Try localStorage if not already failed
  if (!useMemoryStorage) {
    try {
      if (token) {
        localStorage.setItem(STORAGE_KEY, token);
        console.log('✅ Token stored in localStorage');
      } else {
        localStorage.removeItem(STORAGE_KEY);
        console.log('🗑️ Token removed from localStorage');
      }
      if (refreshToken) {
        localStorage.setItem(REFRESH_KEY, refreshToken);
        console.log('✅ Refresh token stored in localStorage');
      } else {
        localStorage.removeItem(REFRESH_KEY);
      }
    } catch (e) {
      // Log storage errors and switch to memory-only mode
      console.error('❌ Failed to store token in localStorage:', e);
      console.warn('⚠️ Switching to in-memory storage mode (tokens will not persist across page reloads)');
      console.warn('   This may be due to browser privacy mode, storage quota exceeded, or permissions');
      useMemoryStorage = true;
    }
  } else {
    console.log('✅ Token stored in memory (localStorage unavailable)');
  }
  
  // Notify listeners (e.g., App) when auth state changes so UI can react
  try { window.dispatchEvent(new Event('auth-changed')); } catch (e) {}
}

export function clearToken() {
  setToken(null);
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

