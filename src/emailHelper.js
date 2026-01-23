import { getAuthHeader } from '@/auth.js';

/**
 * Direct email sending helper - uses backend API directly
 */
export const sendEmail = async (payload) => {
  const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin.replace(':5173', ':3001').replace(':5175', ':3001');
  // First try the authenticated endpoint (preferred in normal usage)
  const res = await fetch(`${apiBase}/integrations/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  if (res.ok) {
    return await res.json();
  }

  // If unauthorized in development-like environments, fall back to public endpoint
  const isAuthError = res.status === 401 || res.status === 403;
  const isDevLike = (
    (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') ||
    (typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.app.github.dev')
    ))
  );

  if (isAuthError && isDevLike) {
    try {
      const fallback = await fetch(`${apiBase}/public/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (fallback.ok) {
        return await fallback.json();
      }
      const fallbackErr = await fallback.text().catch(() => '');
      throw new Error(`Public email fallback failed: ${fallback.status} ${fallbackErr}`);
    } catch (e) {
      const originalErr = await res.text().catch(() => '');
      throw new Error(`Email send failed (auth) and public fallback failed. Original: ${res.status} ${originalErr}. Fallback error: ${e.message}`);
    }
  } else {
    const error = await res.text().catch(() => '');
    throw new Error(`Email send failed: ${res.status} ${error}`);
  }
};
