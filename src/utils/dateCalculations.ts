/**
 * Calculate days until a specific date from today
 * @param targetDate - The target date
 * @returns Number of days until the target date (can be negative if date is in the past)
 */
export function calculateDaysUntil(targetDate: Date | string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to midnight for accurate day calculation
  
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0); // Normalize to midnight for accurate day calculation
  
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days until policy expiry
 * @param expiryDate - The expiry date
 * @returns Number of days until expiry
 */
export function calculateDaysUntilExpiry(expiryDate: Date | string): number {
  return calculateDaysUntil(expiryDate);
}
