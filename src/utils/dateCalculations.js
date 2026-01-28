/**
 * Calculate days until a specific date from today
 * @param {Date|string} targetDate - The target date
 * @returns {number} - Number of days until the target date (can be negative if date is in the past)
 */
export function calculateDaysUntil(targetDate) {
  const today = new Date();
  const target = new Date(targetDate);
  return Math.floor((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days until policy expiry
 * @param {Date|string} expiryDate - The expiry date
 * @returns {number} - Number of days until expiry
 */
export function calculateDaysUntilExpiry(expiryDate) {
  return calculateDaysUntil(expiryDate);
}
