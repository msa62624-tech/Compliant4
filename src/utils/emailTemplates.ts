/**
 * Shared email template utilities to reduce duplication across notification files
 */

type RecipientType = 'broker' | 'gc' | 'subcontractor' | 'admin';
type UrgencyLevel = 'URGENT' | 'HIGH' | 'STANDARD' | null;

/**
 * Standard email signature used across all system emails
 */
export const EMAIL_SIGNATURE = 'Best regards,\nInsureTrack System';

/**
 * Format insurance type from database format to human-readable format
 * Converts underscore-separated values to space-separated capitalized words
 * @param type - Insurance type from database (e.g., 'general_liability')
 * @returns Formatted insurance type (e.g., 'General Liability')
 */
export function formatInsuranceType(type: string): string {
  if (!type || typeof type !== 'string') return '';
  
  return type
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Create standardized email greeting
 * @param recipientType - Type of recipient ('broker', 'gc', 'subcontractor', 'admin')
 * @param name - Recipient name (optional)
 * @returns Formatted greeting
 */
export function createEmailGreeting(recipientType: RecipientType, name: string | null = null): string {
  const fallbackNames: Record<RecipientType, string> = {
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
 * @param items - Array of items to format
 * @param separator - Separator to use (default: ', ')
 * @returns Formatted list
 */
export function formatEmailList(items: string[], separator: string = ', '): string {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items.join(separator);
}

/**
 * Build email subject line with optional urgency prefix
 * @param subject - Main subject text
 * @param urgency - Urgency level ('URGENT', 'HIGH', 'STANDARD', null)
 * @returns Formatted subject line
 */
export function buildEmailSubject(subject: string, urgency: UrgencyLevel = null): string {
  if (!urgency || urgency === 'STANDARD') {
    return subject;
  }
  return `${urgency}: ${subject}`;
}
