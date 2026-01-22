/**
 * Detect the correct frontend URL based on the current environment
 * This is used by the backend when generating email links
 */

export function getFrontendUrl(req) {
  // If FRONTEND_URL is explicitly configured, use it
  if (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost')) {
    return process.env.FRONTEND_URL.replace(/\/$/, '');
  }

  // If a request object is provided, try to detect from origin header
  if (req && req.headers && req.headers.origin) {
    const origin = req.headers.origin;
    // Use the origin as-is, it's the most accurate
    return origin.replace(/\/$/, '');
  }

  // Fallback to configured FRONTEND_URL (for localhost development)
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.replace(/\/$/, '');
  }

  // Last resort fallback
  return 'http://localhost:5175';
}

export default getFrontendUrl;
