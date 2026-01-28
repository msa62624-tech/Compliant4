/**
 * Calculate urgency level based on days until expiry
 * @param {number} daysUntilExpiry - Number of days until expiry
 * @returns {string} - Urgency level: 'URGENT', 'HIGH', or 'STANDARD'
 */
export function calculateUrgency(daysUntilExpiry) {
  if (daysUntilExpiry <= 0) return 'URGENT';
  if (daysUntilExpiry <= 7) return 'HIGH';
  return 'STANDARD';
}

/**
 * Format timeframe description based on days until expiry
 * @param {number} daysUntilExpiry - Number of days until expiry
 * @returns {string} - Timeframe description (e.g., 'TODAY', 'in 5 days')
 */
export function formatTimeframe(daysUntilExpiry) {
  if (daysUntilExpiry === 0) return 'TODAY';
  return `in ${daysUntilExpiry} days`;
}
