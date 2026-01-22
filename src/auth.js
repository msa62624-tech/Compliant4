// Simple auth helper: stores bearer token in localStorage and provides login/logout helpers.
const STORAGE_KEY = 'insuretrack_token';
const REFRESH_KEY = 'insuretrack_refresh_token';
const apiBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  : null;

let refreshPromise = null;

export function getToken() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

export function setToken(token, refreshToken = null) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    else localStorage.removeItem(REFRESH_KEY);
    // Notify listeners (e.g., App) when auth state changes so UI can react
    try { window.dispatchEvent(new Event('auth-changed')); } catch (e) {}
  } catch (e) {
    // ignore
  }
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
      const refreshToken = localStorage.getItem(REFRESH_KEY);
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

