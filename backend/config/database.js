import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Core directories for data and uploads
export const DATA_DIR = path.join(__dirname, '..', 'data');
export const DATA_FILE = path.join(DATA_DIR, 'entities.json');
export const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// ========== Entities ==========
// Start empty; persisted data in entities.json will be loaded at startup.
export const entities = {
  InsuranceDocument: [],
  Project: [],
  Contractor: [],
  User: [],
  ProjectSubcontractor: [],
  BrokerAssignment: [],
  Broker: [],
  BrokerLogin: [],
  GCPortal: [],
  gcLogin: [],
  BrokerUpload: [],
  COIDeficiency: [],
  EmailNotification: [],
  HoldHarmlessAgreement: [],
  ProgramWorkflow: [],
  Program: [],
  UserActivity: [],
  PaymentHistory: [],
  InsuranceRequirement: [],
  Portal: [],
  AdminUser: [],
  SubInsuranceRequirement: [],
  StateRequirement: [],
  GeneratedCOI: [],
  Trade: [],
  InsuranceProgram: [],
  InsuranceProgramTier: [],
  CertificateHolder: [],
  RequiredEndorsement: [],
  Policy: [],
  PolicyTemplate: [],
  PolicyAnalysis: [],
  EmailLog: [],
  Notification: [],
  Task: [],
  AuditLog: [],
  BrokerPortal: [],
  AdminSettings: [],
  FormTemplate: [],
  GCPolicyRequirement: [],
  AdditionalInsured: [],
  Endorsement: [],
  PolicyRequirement: [],
  NYCDOBRecord: [],
  NYCACRISRecord: [],
  SiteSafetyPlan: [],
  IncidentReport: [],
  InsuranceClaim: [],
  Payment: [],
  StripeSession: [],
  GCSubscription: [],
  WebhookLog: [],
  UploadLog: [],
  SystemConfig: [],
  AuthSession: [],
  EmailTemplate: [],
  GCProgram: [],
  PolicyRenewal: [],
  PolicyRenewalTask: [],
  ComplianceAction: [],
  ComplianceEvent: [],
  PolicyQuote: [],
  Subscription: [],
  ProgramTemplate: [],
  Message: []
};

// ========== Persistent Storage Functions ==========

/**
 * Load entities from disk on server start
 */
export function loadEntities() {
  try {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log('📁 Created data directory:', DATA_DIR);
    }

    // Load existing data if file exists
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      
      // Parse JSON with error handling
      let loadedEntities;
      try {
        loadedEntities = JSON.parse(data);
      } catch (parseError) {
        console.error('❌ Failed to parse entities.json:', parseError.message);
        console.log('⚠️ File may be corrupted. Starting with default data.');
        saveEntities(); // Overwrite corrupted file
        return;
      }
      
      // Merge loaded data with default entities structure
      Object.keys(entities).forEach(key => {
        if (loadedEntities[key]) {
          entities[key] = loadedEntities[key];
        }
      });
      
      // Warn about unknown entity types in loaded data
      Object.keys(loadedEntities).forEach(key => {
        if (!(key in entities)) {
          console.warn(`⚠️ Unknown entity type "${key}" found in data file (ignored)`);
        }
      });
      
      console.log('✅ Loaded persisted data from:', DATA_FILE);
      console.log('📊 Contractors loaded:', entities.Contractor?.length || 0);
      console.log('📊 Projects loaded:', entities.Project?.length || 0);
    } else {
      console.log('ℹ️ No existing data file, starting with empty data');
      // Save initial empty data
      saveEntities();
    }
  } catch (error) {
    console.error('❌ Error loading entities:', error.message);
    console.log('⚠️ Starting with default in-memory data');
  }
}

/**
 * Save entities to disk
 */
export function saveEntities() {
  try {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Write data to file
    fs.writeFileSync(DATA_FILE, JSON.stringify(entities, null, 2), 'utf8');
    
    // More informative logging based on environment
    const isEphemeralPlatform = !!process.env.RENDER || !!process.env.VERCEL || !!process.env.DYNO;
    if (isEphemeralPlatform) {
      console.log('💾 Data saved (ephemeral - will reset on restart/redeploy)');
    } else {
      console.log('💾 Data persisted to disk');
    }
  } catch (error) {
    console.error('❌ Error saving entities:', error.message);
  }
}

/**
 * Debounced save to avoid too frequent writes
 */
let saveTimeout = null;
export function debouncedSave() {
  // Clear existing timeout if any
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  // Schedule new save
  saveTimeout = setTimeout(() => {
    try {
      saveEntities();
    } catch (error) {
      console.error('❌ Error in debounced save:', error.message);
    } finally {
      saveTimeout = null;
    }
  }, 1000); // Save 1 second after last change
}

/**
 * Find a valid (non-expired, active) GeneratedCOI for a subcontractor.
 * Returns the most recently created valid COI or null if none found.
 */
export function findValidCOIForSub(subId) {
  if (!subId) return null;
  const now = Date.now();
  const cois = (entities.GeneratedCOI || []).filter(c => {
    if (!c) return false;
    if (c.subcontractor_id !== subId && c.subcontractor_id !== String(subId)) return false;
    // If policy_expiration_date is present, ensure it's in the future
    if (c.policy_expiration_date) {
      const exp = new Date(c.policy_expiration_date).getTime();
      if (isNaN(exp) || exp <= now) return false;
    }
    // Exclude explicitly expired or revoked COIs
    if (c.status === 'expired' || c.status === 'revoked') return false;
    return true;
  });

  if (!cois || cois.length === 0) return null;
  // Return the most recent by created_date or id timestamp
  cois.sort((a, b) => {
    const ta = a.created_date ? new Date(a.created_date).getTime() : 0;
    const tb = b.created_date ? new Date(b.created_date).getTime() : 0;
    return tb - ta;
  });
  return cois[0] || null;
}
