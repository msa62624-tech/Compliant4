import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function createPageUrl(path) {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `/${cleanPath}`;
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