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
  
  // Frontend context: Use window location - this is the actual deployment URL
  if (typeof window !== 'undefined' && window.location.origin) {
    const origin = window.location.origin;
    return origin;
  }
  
  // Backend context fallback: warn if no environment variable is set
  if (typeof console !== 'undefined') {
    console.warn('⚠️ No frontend URL available. Set FRONTEND_URL environment variable for proper email links.');
  }
  
  // Return empty string instead of localhost - will indicate misconfiguration
  return '';
}

/**
 * Get the proper backend base URL for API calls
 * Handles Codespaces, localhost development, and production environments
 */
export function getBackendBaseUrl() {
  // Check environment variable first
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Backend context: Check Node.js process.env
  if (typeof process !== 'undefined' && process.env && process.env.BACKEND_URL) {
    return process.env.BACKEND_URL.replace(/\/$/, '');
  }
  
  // Frontend context: Derive from window location
  if (typeof window !== 'undefined' && window.location.origin) {
    const { protocol, host, origin } = window.location;
    
    // Codespaces format: abc-5175.app.github.dev -> abc-3001.app.github.dev
    const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
    if (m) return `${protocol}//${m[1]}-3001${m[3]}`;
    
    // Local development: localhost:5175 -> localhost:3001
    if (origin.includes(':5175')) return origin.replace(':5175', ':3001');
    if (origin.includes(':5176')) return origin.replace(':5176', ':3001');
    
    // Production: derive backend URL from frontend origin
    // For same-domain deployments or specific backends, try common patterns
    if (origin.includes('localhost')) {
      return origin.replace(/:\d+/, ':3001');
    }
    
    // For cloud deployments (Vercel, Railway, Heroku, etc), assume API on same domain
    // or configure via VITE_API_BASE_URL
    return origin;
  }
  
  // Fallback: empty string indicates misconfiguration
  return '';
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
