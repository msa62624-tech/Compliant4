/**
 * Get the proper frontend base URL for email links
 * Uses environment variable or derives from current origin
 * Works on both frontend and backend contexts
 */
export function getFrontendBaseUrl() {
  // Backend context: Check Node.js process.env (e.g., FRONTEND_URL)
  if (typeof process !== 'undefined' && process.env && process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.replace(/\/$/, ''); // Remove trailing slash
  }
  
  // Frontend context: Check Vite environment variable
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FRONTEND_URL) {
    return import.meta.env.VITE_FRONTEND_URL;
  }
  
  // Frontend context: Use window location
  if (typeof window !== 'undefined' && window.location.origin) {
    const origin = window.location.origin;
    
    // Replace Codespaces URL with production domain if needed
    // This would be set in .env.production or similar
    if (origin.includes('app.github.dev')) {
      // For now, return the origin as-is, but this can be overridden
      return origin;
    }
    
    return origin;
  }
  
  // Development fallback - warn if used
  if (typeof console !== 'undefined') {
    console.warn('⚠️ Using fallback URL for frontend base. Set VITE_FRONTEND_URL or FRONTEND_URL environment variable.');
  }
  return 'http://localhost:5175';
}

/**
 * Create a broker dashboard link
 */
export function createBrokerDashboardLink(brokerName, brokerEmail) {
  const baseUrl = getFrontendBaseUrl();
  // Prefer email for reliability; include name when email unavailable
  if (brokerEmail) {
    const url = new URL(`${baseUrl}/broker-dashboard`);
    url.searchParams.set('email', brokerEmail);
    if (brokerName) url.searchParams.set('name', brokerName);
    return url.toString();
  }
  if (brokerName) {
    return `${baseUrl}/broker-dashboard?name=${encodeURIComponent(brokerName)}`;
  }
  return `${baseUrl}/broker-dashboard`;
}

/**
 * Create a broker upload link
 */
export function createBrokerUploadLink(subId, type = 'global') {
  const baseUrl = getFrontendBaseUrl();
  return `${baseUrl}/broker-upload?type=${type}&subId=${subId}`;
}

/**
 * Create a subcontractor dashboard link
 */
export function createSubcontractorDashboardLink(subId) {
  const baseUrl = getFrontendBaseUrl();
  return `${baseUrl}/subcontractor-dashboard?id=${subId}`;
}
