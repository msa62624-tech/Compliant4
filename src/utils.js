import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Map friendly page keys to actual routed paths (case-insensitive)
const PATH_ALIASES = {
  'subcontractordashboard': '/subcontractor-dashboard',
  'subcontractor-dashboard': '/subcontractor-dashboard',
  'subenterbrokerinfo': '/sub-enter-broker-info',
  'sub-enter-broker-info': '/sub-enter-broker-info',
  'brokerdashboard': '/broker-dashboard',
  'broker-dashboard': '/broker-dashboard',
  'brokeruploadcoi': '/broker-upload-coi',
  'broker-upload-coi': '/broker-upload-coi',
  'brokerupload': '/broker-upload',
  'broker-upload': '/broker-upload',
  'brokerportal': '/broker-portal',
  'broker-portal': '/broker-portal',
  'gcdashboard': '/gc-dashboard',
  'gc-dashboard': '/gc-dashboard',
  'gcprojects': '/gc-projects',
  'gc-projects': '/gc-projects',
  'gcdetails': '/gc-details',
  'gc-details': '/gc-details',
  'gcproject': '/gc-project',
  'gc-project': '/gc-project',
  'gclogin': '/gc-login',
  'gc-login': '/gc-login',
  'projectdetails': '/project-details',
  'projectssetup': '/projects-setup',
  'pendingreviews': '/pending-reviews',
  'expiringpolicies': '/expiring-policies',
  'subcontractorsmanagement': '/subcontractors-management',
  'contractors': '/contractors',
  'messages': '/messages',
  'archives': '/archives',
  'insuranceprograms': '/insurance-programs',
  'upload-documents': '/upload-documents',
  'uploaddocuments': '/upload-documents',
  'resetpassword': '/reset-password',
  'reset-password': '/reset-password',
  'admin': '/admin',
  'admindashboard': '/admin',
  'admin-dashboard': '/admin',
  'coireview': '/COIReview',
  'contractor-dashboard': '/contractor-dashboard',
};

export function createPageUrl(path) {
  if (!path) return '/';

  // Separate query string if provided
  const [rawPath, query = ''] = path.split('?');
  const cleanPath = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
  const normalized = PATH_ALIASES[cleanPath.toLowerCase()] || `/${cleanPath}`;

  return query ? `${normalized}?${query}` : normalized;
}

/**
 * Normalize subcontractor trade types to an array
 * Handles both legacy single trade_type and new trade_types array
 * @param {Object} subcontractor - The subcontractor object
 * @returns {Array<string>} - Array of trade types
 */
export function normalizeSubcontractorTrades(subcontractor) {
  if (!subcontractor) return [];
  return subcontractor.trade_types || 
         (subcontractor.trade_type ? [subcontractor.trade_type] : []);
} 