import { entities, debouncedSave } from '../config/database.js';
import logger from '../config/logger.js';

// =======================
// BROKER MANAGEMENT HELPERS
// =======================

/**
 * Get an existing broker record by email (read-only, does NOT create)
 * Use this for authentication/login flows to prevent account enumeration
 * @param {string} email - Broker email address
 * @returns {Object|null} Broker record or null
 */
export function getBroker(email) {
  if (!email) return null;
  const emailLower = String(email).toLowerCase();
  const broker = (entities.Broker || []).find(b => b.email?.toLowerCase() === emailLower);
  return broker || null;
}

/**
 * Get or create a broker record by email
 * Use this for broker-initiated actions (like uploading docs) where a record is needed
 * @param {string} email - Broker email address
 * @param {Object} additionalInfo - Additional broker information
 * @returns {Object} Broker record (existing or new)
 */
export function getOrCreateBroker(email, additionalInfo = {}) {
  if (!email || typeof email !== 'string') {
    throw new Error('Valid email is required to get or create broker');
  }

  const emailLower = email.toLowerCase();
  let broker = getBroker(emailLower);

  if (!broker) {
    // Create new broker record
    broker = {
      id: `broker_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      email: emailLower,
      name: additionalInfo.name || emailLower.split('@')[0],
      company: additionalInfo.company || null,
      phone: additionalInfo.phone || null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    if (!entities.Broker) entities.Broker = [];
    entities.Broker.push(broker);
    
    debouncedSave();
    logger.info('New broker record created', { brokerId: broker.id, email: emailLower });
  }

  return broker;
}
