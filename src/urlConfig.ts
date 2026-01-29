/**
 * Get the proper frontend base URL for email links
 * Uses environment variable or derives from current origin
 * Works on both frontend and backend contexts
 */
export function getFrontendBaseUrl(): string {
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
export function getBackendBaseUrl(): string {
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
export function createBrokerDashboardLink(brokerName?: string, brokerEmail?: string): string {
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
 * Create a broker upload link for COI uploads
 * @param coiToken - The COI token for direct upload access
 * @param step - The step in the upload process (1=COI, 2=Policies, 3=Signature)
 * @param action - Action type (default: 'upload')
 */
export function createBrokerUploadLink(coiToken: string, step: number = 1, action: string = 'upload'): string {
  const baseUrl = getFrontendBaseUrl();
  return `${baseUrl}/broker-upload-coi?token=${coiToken}&step=${step}&action=${action}`;
}

/**
 * Create a subcontractor dashboard link
 */
export function createSubcontractorDashboardLink(subId: string): string {
  const baseUrl = getFrontendBaseUrl();
  return `${baseUrl}/subcontractor-dashboard?id=${subId}`;
}

/**
 * Create a COI review link
 * @param coiId - COI ID
 */
export function createCOIReviewLink(coiId: string): string {
  const baseUrl = getFrontendBaseUrl();
  return `${baseUrl}/coi-review?id=${coiId}`;
}

/**
 * Create a project details link
 * @param projectId - Project ID
 * @param section - Optional section to navigate to (e.g., 'subcontractors')
 */
export function createProjectDetailsLink(projectId: string, section?: string): string {
  const baseUrl = getFrontendBaseUrl();
  const url = new URL(`${baseUrl}/project-details`);
  url.searchParams.set('id', projectId);
  if (section) url.searchParams.set('section', section);
  return url.toString();
}

/**
 * Create a GC project link
 * @param projectId - Project ID
 * @param gcId - GC ID
 */
export function createGCProjectLink(projectId: string, gcId: string): string {
  const baseUrl = getFrontendBaseUrl();
  return `${baseUrl}/gc-project?project=${projectId}&id=${gcId}`;
}

/**
 * Create a GC login link
 */
export function createGCLoginLink(): string {
  const baseUrl = getFrontendBaseUrl();
  return `${baseUrl}/gc-login`;
}

/**
 * Create an admin dashboard link
 * @param section - Optional section to navigate to
 * @param coiId - Optional COI ID for direct navigation
 */
export function createAdminDashboardLink(section?: string, coiId?: string): string {
  const baseUrl = getFrontendBaseUrl();
  const url = new URL(`${baseUrl}/admin-dashboard`);
  if (section) url.searchParams.set('section', section);
  if (coiId) url.searchParams.set('coiId', coiId);
  return url.toString();
}

/**
 * Create a subcontractor dashboard link with optional parameters
 * @param subId - Subcontractor ID
 * @param section - Optional section (e.g., 'certificates', 'projects', 'active_projects')
 * @param projectId - Optional project ID for filtering
 */
export function createSubcontractorDashboardLinkWithParams(subId: string, section?: string, projectId?: string): string {
  const baseUrl = getFrontendBaseUrl();
  const url = new URL(`${baseUrl}/subcontractor-dashboard`);
  url.searchParams.set('id', subId);
  if (section) url.searchParams.set('section', section);
  if (projectId) url.searchParams.set('projectId', projectId);
  return url.toString();
}

/**
 * Create a broker portal link with optional COI
 * @param brokerName - Broker name
 * @param coiId - Optional COI ID for direct navigation
 */
export function createBrokerPortalLink(brokerName: string, coiId?: string): string {
  const baseUrl = getFrontendBaseUrl();
  const url = new URL(`${baseUrl}/broker-dashboard`);
  url.searchParams.set('name', brokerName);
  if (coiId) url.searchParams.set('coiId', coiId);
  return url.toString();
}

/**
 * Create a broker sign link
 * @param coiToken - The COI token for signing
 * @param step - The step in the signing process (default: 3)
 */
export function createBrokerSignLink(coiToken: string, step: number = 3): string {
  const baseUrl = getFrontendBaseUrl();
  return `${baseUrl}/broker-upload-coi?token=${coiToken}&action=sign&step=${step}`;
}
