import { getAuthHeader } from '@/auth.js';

/**
 * Direct email sending helper - uses backend API directly
 */
export const sendEmail = async (payload) => {
  const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin.replace(':5173', ':3001').replace(':5175', ':3001');
  const res = await fetch(`${apiBase}/integrations/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Email send failed: ${error}`);
  }
  return await res.json();
};
