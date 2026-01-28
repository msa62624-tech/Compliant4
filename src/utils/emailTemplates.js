/**
 * Shared email template utilities to reduce duplication across notification files
 */

/**
 * Standard email signature used across all system emails
 */
export const EMAIL_SIGNATURE = 'Best regards,\nInsureTrack System';

/**
 * Format insurance type from database format to human-readable format
 * Converts underscore-separated values to space-separated capitalized words
 * @param {string} type - Insurance type from database (e.g., 'general_liability')
 * @returns {string} - Formatted insurance type (e.g., 'General Liability')
 */
export function formatInsuranceType(type) {
  if (!type || typeof type !== 'string') return '';
  
  return type
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Create standardized email greeting
 * @param {string} recipientType - Type of recipient ('broker', 'gc', 'subcontractor', 'admin')
 * @param {string|null} name - Recipient name (optional)
 * @returns {string} - Formatted greeting
 */
export function createEmailGreeting(recipientType, name = null) {
  const fallbackNames = {
    broker: 'Insurance Broker',
    gc: 'General Contractor',
    subcontractor: 'Subcontractor',
    admin: 'Admin',
  };
  
  const recipientName = name || fallbackNames[recipientType] || 'User';
  return `Dear ${recipientName},`;
}

/**
 * Format a list of items for email display
 * @param {Array} items - Array of items to format
 * @param {string} separator - Separator to use (default: ', ')
 * @returns {string} - Formatted list
 */
export function formatEmailList(items, separator = ', ') {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items.join(separator);
}

/**
 * Build email subject line with optional urgency prefix
 * @param {string} subject - Main subject text
 * @param {string|null} urgency - Urgency level ('URGENT', 'HIGH', 'STANDARD', null)
 * @returns {string} - Formatted subject line
 */
export function buildEmailSubject(subject, urgency = null) {
  if (!urgency || urgency === 'STANDARD') {
    return subject;
  }
  return `${urgency}: ${subject}`;
}
