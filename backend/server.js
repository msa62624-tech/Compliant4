import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import pdfParse from 'pdf-parse';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Safe, timing-attack-resistant string comparison used for token checks
const timingSafeEqual = (a, b) => {
  if (a === undefined || b === undefined) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (err) {
    console.warn('timingSafeEqual comparison failed:', err?.message || err);
    return false;
  }
};

// Import AI and PDF integration services
import AdobePDFService from './integrations/adobe-pdf-service.js';
import AIAnalysisService from './integrations/ai-analysis-service.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env with explicit path
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for rate limiting with X-Forwarded-For header
app.set('trust proxy', 1);

// Core directories for data and uploads
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'entities.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Default admin email list for notifications (comma-separated)
const DEFAULT_ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

// JWT_SECRET persistence: Load from env or generate and persist to file
// This ensures tokens remain valid across server restarts in development
const JWT_SECRET_FILE = path.join(DATA_DIR, '.jwt-secret');
const JWT_SECRET = (() => {
  // Priority 1: Use environment variable if set
  if (process.env.JWT_SECRET) {
    console.log('✅ Using JWT_SECRET from environment variable');
    return process.env.JWT_SECRET;
  }
  
  // Priority 2: Require JWT_SECRET in production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  
  // Priority 3: Load or generate persistent secret for development
  try {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(JWT_SECRET_FILE)) {
      const secretFromDisk = fs.readFileSync(JWT_SECRET_FILE, 'utf8').trim();
      if (secretFromDisk) {
        console.log('🔐 Loaded JWT secret from disk');
        return secretFromDisk;
      }
    }

    const newSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(JWT_SECRET_FILE, newSecret, 'utf8');
    console.log('🔐 Generated and persisted new JWT secret');
    return newSecret;
  } catch (e) {
    console.warn('⚠️ Failed to persist JWT secret, using ephemeral secret in memory');
    return crypto.randomBytes(32).toString('hex');
  }
})();

// Dummy password hash for timing attack prevention in login endpoints
// Used when user not found or has no password to ensure bcrypt comparison takes consistent time
const DUMMY_PASSWORD_HASH = '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhashdummy';

// Basic file path helpers used by upload/extraction flows
function validateAndSanitizeFilename(name) {
  if (!name || typeof name !== 'string') throw new Error('Invalid filename');
  const safe = name.replace(/[^a-zA-Z0-9._\/-]/g, '');
  if (safe.includes('..')) throw new Error('Invalid filename');
  return safe;
}

function verifyPathWithinDirectory(resolvedPath, baseDir) {
  const normalizedBase = path.resolve(baseDir) + path.sep;
  const normalizedPath = path.resolve(resolvedPath);
  if (!normalizedPath.startsWith(normalizedBase)) {
    throw new Error('Path traversal detected');
  }
}

// Ensure uploads directory exists
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('⚠️ Could not ensure uploads directory:', e?.message || e);
}

// Default storage engine for multer (file uploads)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const sanitized = validateAndSanitizeFilename(file.originalname);
    cb(null, `${uniqueSuffix}-${sanitized}`);
  }
});

// Initialize multer with limits
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// ========== Entities ==========
// Start empty; persisted data in entities.json will be loaded at startup.
const entities = {
  InsuranceDocument: [],
  Project: [],
  Contractor: [],
  User: [],
  ProjectSubcontractor: [],
  BrokerAssignment: [],
  // Centralized broker records for authentication and password management
  Broker: [],
  BrokerLogin: [],
  GCPortal: [],
  gcLogin: [],
  BrokerUpload: [],
  BrokerLogin: [],
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
 * Note: Uses synchronous file operations for simplicity during startup. For production
 * optimization, consider using fs.promises.readFile with async/await.
 */
function loadEntities() {
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
 * Note: Uses synchronous file operations for simplicity. For high-traffic production
 * environments, consider using fs.promises.writeFile with async/await for better performance.
 * 
 * IMPORTANT: On cloud platforms like Render, Vercel, or Heroku with ephemeral storage,
 * data saved to disk will be lost on restart/redeploy. For production, use a database.
 */
function saveEntities() {
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
 * Uses a single timeout to prevent race conditions
 */
let saveTimeout = null;
function debouncedSave() {
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

// =======================
// BROKER MANAGEMENT HELPERS
// =======================
/**
 * Get an existing broker record by email (read-only, does NOT create)
 * Use this for authentication/login flows to prevent account enumeration
 * @param {string} email - Broker email address
 * @returns {object|null} - Broker record from entities.Broker or null if not found
 */
function getBroker(email) {
  if (!email) return null;
  
  const normalizedEmail = email.toLowerCase();
  
  // Find existing broker (read-only)
  const broker = (entities.Broker || []).find(b => 
    b.email && b.email.toLowerCase() === normalizedEmail
  );
  
  return broker || null;
}

/**
 * Get or create a broker record by email
 * Ensures centralized broker storage for password management
 * Use this ONLY when auto-creation is intentional (e.g., admin setup, migration)
 * @param {string} email - Broker email address
 * @param {object} additionalInfo - Optional broker info (name, company_name, etc.)
 * @returns {object} - Broker record from entities.Broker
 */
function getOrCreateBroker(email, additionalInfo = {}) {
  if (!email) return null;
  
  const normalizedEmail = email.toLowerCase();
  
  // Find existing broker
  let broker = (entities.Broker || []).find(b => 
    b.email && b.email.toLowerCase() === normalizedEmail
  );
  
  if (!broker) {
    // Create new broker record
    const brokerId = `broker-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    broker = {
      id: brokerId,
      email: email,
      company_name: additionalInfo.company_name || additionalInfo.broker_name || 'Unknown',
      contact_person: additionalInfo.contact_person || additionalInfo.broker_name || email,
      phone: additionalInfo.phone || '',
      status: 'active',
      password: null, // Will be set when broker sets password
      created_date: new Date().toISOString(),
      ...additionalInfo
    };
    entities.Broker.push(broker);
    console.log(`✅ Created new broker record for: ${email}`);
  }
  
  return broker;
}

/**
 * Data migration: Move broker passwords from COI records to centralized Broker table
 * This runs once on startup to ensure data consistency
 */
function migrateBrokerPasswords() {
  let migratedCount = 0;
  let cleanupSuccessful = false;
  
  try {
    const brokerPasswordMap = new Map(); // email -> {password, count, sources}
    
    // Collect all broker passwords from COI records, tracking conflicts
    (entities.GeneratedCOI || []).forEach((coi, index) => {
      if (coi.broker_email && coi.broker_password) {
        const email = coi.broker_email.toLowerCase();
        
        if (!brokerPasswordMap.has(email)) {
          brokerPasswordMap.set(email, {
            password: coi.broker_password,
            count: 1,
            sources: [index],
            uniquePasswords: new Set([coi.broker_password])
          });
        } else {
          const existing = brokerPasswordMap.get(email);
          existing.count++;
          existing.sources.push(index);
          existing.uniquePasswords.add(coi.broker_password);
          
          // Log conflict if multiple different passwords exist
          // Note: Email addresses are partially masked to reduce exposure in logs
          // while still allowing administrators to identify accounts with conflicts
          if (existing.uniquePasswords.size > 1 && !existing.conflictLogged) {
            // Mask email for logging (keep first 3 chars and domain)
            // Handle malformed emails safely to prevent runtime errors
            let maskedEmail = email || 'unknown';
            if (email && email.includes('@')) {
              const parts = email.split('@');
              const localPart = parts[0] || '';
              const domain = parts[1] || 'unknown';
              maskedEmail = localPart.length > 3 
                ? `${localPart.substring(0, 3)}***@${domain}` 
                : `***@${domain}`;
            }
            console.warn(`⚠️ Password conflict detected for broker: ${maskedEmail} (found ${existing.uniquePasswords.size} different passwords across ${existing.count} COI records, keeping first)`);
            existing.conflictLogged = true;
          }
        }
      }
    });
    
    // Migrate passwords to Broker table
    brokerPasswordMap.forEach((data, email) => {
      const broker = getOrCreateBroker(email);
      if (broker && !broker.password) {
        const brokerIndex = entities.Broker.findIndex(b => b.id === broker.id);
        if (brokerIndex !== -1) {
          entities.Broker[brokerIndex].password = data.password;
          migratedCount++;
          
          // Log if multiple passwords were found
          if (data.count > 1) {
            // Mask email for logging (keep first 3 chars and domain)
            // Handle malformed emails safely to prevent runtime errors
            let maskedEmail = email || 'unknown';
            if (email && email.includes('@')) {
              const parts = email.split('@');
              const localPart = parts[0] || '';
              const domain = parts[1] || 'unknown';
              maskedEmail = localPart.length > 3 
                ? `${localPart.substring(0, 3)}***@${domain}` 
                : `***@${domain}`;
            }
            console.log(`  ℹ️ Migrated password for ${maskedEmail} (consolidated from ${data.count} COI records)`);
          }
        }
      }
    });
    
    // Mark migration as successful before cleanup
    cleanupSuccessful = true;
    
  } catch (error) {
    console.error('❌ Error migrating broker passwords:', error.message);
    cleanupSuccessful = false;
  }
  
  // Only perform cleanup if migration was successful
  if (cleanupSuccessful) {
    try {
      // Remove broker_password fields from COI records (cleanup)
      entities.GeneratedCOI = (entities.GeneratedCOI || []).map(coi => {
        if (coi.broker_password) {
          // eslint-disable-next-line no-unused-vars
          const { broker_password, ...rest } = coi;
          return rest;
        }
        return coi;
      });
      
      if (migratedCount > 0) {
        console.log(`✅ Migrated ${migratedCount} broker password(s) to centralized Broker table`);
        debouncedSave();
      }
    } catch (cleanupError) {
      console.error('❌ Error during migration cleanup:', cleanupError.message);
      // Migration succeeded but cleanup failed - this is not critical
    }
  }
}

/**
 * Seed centralized Broker records from existing data
 * - Contractor.brokers[] entries
 * - GeneratedCOI.broker_email
 * Ensures brokers can authenticate even if records didn't exist previously.
 */
function seedBrokersFromData() {
  try {
    if (!entities.Broker) entities.Broker = [];

    const seenEmails = new Set((entities.Broker || []).map(b => (b.email || '').toLowerCase()));

    // Seed from contractor broker lists
    (entities.Contractor || []).forEach(c => {
      if (Array.isArray(c.brokers)) {
        c.brokers.forEach(b => {
          const email = (b.email || '').toLowerCase();
          if (!email || seenEmails.has(email)) return;
          const broker = getOrCreateBroker(email, {
            broker_name: b.name || b.company || email,
            company_name: b.company || b.name || 'Unknown',
            contact_person: b.name || b.company || email,
            phone: b.phone || '',
          });
          if (broker) {
            seenEmails.add(email);
          }
        });
      }
    });

    // Seed from COI records
    (entities.GeneratedCOI || []).forEach(coi => {
      const email = (coi.broker_email || '').toLowerCase();
      if (!email || seenEmails.has(email)) return;
      const broker = getOrCreateBroker(email, {
        broker_name: coi.broker_name || email,
        company_name: coi.broker_name || 'Unknown',
        contact_person: coi.broker_name || email,
      });
      if (broker) {
        seenEmails.add(email);
      }
    });

    if (seenEmails.size > 0) {
      console.log(`✅ Seeded ${seenEmails.size} broker record(s) from existing data`);
      debouncedSave();
    } else {
      console.log('ℹ️ No new broker records to seed');
    }
  } catch (err) {
    console.warn('⚠️ Broker seeding error:', err?.message || err);
  }
}

// Load data on startup
loadEntities();

// Ensure broker records exist for authentication
seedBrokersFromData();

// Remove sample placeholder GC once a real GC exists to avoid duplicate records
function cleanupPlaceholderGCs() {
  try {
    const contractors = entities.Contractor || [];
    const isPlaceholder = (c) =>
      c?.contractor_type === 'general_contractor' &&
      (c.company_name || '').toLowerCase().includes('your gc');

    const placeholders = contractors.filter(isPlaceholder);
    if (!placeholders.length) return;

    const realGCs = contractors.filter(c => c.contractor_type === 'general_contractor' && !isPlaceholder(c));
    // Keep the placeholder if it's the only GC available
    if (!realGCs.length) return;

    placeholders.forEach(ph => {
      // Remove contractor
      entities.Contractor = entities.Contractor.filter(c => c.id !== ph.id);
      // Remove associated GC user accounts
      if (entities.User) {
        entities.User = entities.User.filter(u => u.gc_id !== ph.id);
      }
      // Remove associated GC portals
      if (entities.Portal) {
        entities.Portal = entities.Portal.filter(p => p.user_id !== ph.id);
      }
      console.log('🧹 Removed placeholder GC record:', ph.company_name || ph.id);
    });

    debouncedSave();
  } catch (err) {
    console.warn('⚠️ Placeholder GC cleanup failed:', err?.message || err);
  }
}

cleanupPlaceholderGCs();

// Ensure there is at least one GC account for portal login in empty datasets
function ensureDefaultGC() {
  const contractors = entities.Contractor || [];
  const hasGC = contractors.some(c => c.contractor_type === 'general_contractor');
  if (hasGC) return;

  const defaultPassword = 'GCpassword123!';
  const hash = bcrypt.hashSync(defaultPassword, 10);
  const gcId = `Contractor-${Date.now()}`;

  const gc = {
    id: gcId,
    company_name: 'Default GC',
    contact_person: 'Default GC',
    email: 'gc@example.com',
    phone: '',
    mailing_address: '',
    mailing_city: '',
    mailing_state: '',
    mailing_zip_code: '',
    status: 'active',
    contractor_type: 'general_contractor',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    admin_id: 'system',
    admin_name: 'system',
    createdAt: new Date().toISOString(),
    createdBy: 'system',
    password: hash,
    gc_login_created: true
  };

  entities.Contractor.push(gc);
  debouncedSave();
  console.log('✅ Seeded default GC account for portal login:', gc.email, '(password:', defaultPassword, ')');
}

ensureDefaultGC();

// Run data migration after loading entities
migrateBrokerPasswords();

// Ensure default trades exist even if data file predates them
function ensureDefaultTradesPresent() {
  const defaults = [
    { trade_name: 'Plumbing', category: 'Mechanical' },
    { trade_name: 'Electrical', category: 'Electrical' },
    { trade_name: 'HVAC', category: 'Mechanical' },
    { trade_name: 'Concrete', category: 'Structural' },
    { trade_name: 'Carpentry', category: 'General' },
    { trade_name: 'Roofing', category: 'Exterior' },
    { trade_name: 'Siding', category: 'Exterior' },
    { trade_name: 'Masonry', category: 'Structural' },
    { trade_name: 'Steel Erection', category: 'Structural' },
    { trade_name: 'Drywall', category: 'Finishes' },
    { trade_name: 'Painting', category: 'Finishes' },
    { trade_name: 'Flooring', category: 'Finishes' },
    { trade_name: 'Glazing', category: 'Exterior' },
    { trade_name: 'Windows & Doors', category: 'Exterior' },
    { trade_name: 'Waterproofing', category: 'Exterior' },
    { trade_name: 'Excavation', category: 'Sitework' },
    { trade_name: 'Demolition', category: 'Sitework' },
    { trade_name: 'Crane Operator', category: 'High Risk' },
    { trade_name: 'Scaffold', category: 'High Risk' },
    { trade_name: 'Fire Protection', category: 'Mechanical' },
    { trade_name: 'Elevator', category: 'Specialty' },
    { trade_name: 'Insulation', category: 'Thermal' },
    { trade_name: 'Sheet Metal', category: 'Mechanical' },
    { trade_name: 'Tile', category: 'Finishes' },
    { trade_name: 'Millwork', category: 'Finishes' },
    { trade_name: 'Landscaping', category: 'Sitework' },
    { trade_name: 'Paving', category: 'Sitework' },
    { trade_name: 'Exterior Work (Above 2 Stories)', category: 'Scope' },
    { trade_name: 'Exterior Work (≤ 2 Stories)', category: 'Scope' },
  ];

  const existing = entities.Trade || (entities.Trade = []);
  const existingNames = new Set(existing.map(t => (t.trade_name || '').toLowerCase()));
  let added = 0;
  for (const d of defaults) {
    if (!existingNames.has(d.trade_name.toLowerCase())) {
      existing.push({
        id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        trade_name: d.trade_name,
        category: d.category,
        is_active: true,
        requires_professional_liability: false,
        requires_pollution_liability: false,
        created_date: new Date().toISOString(),
      });
      existingNames.add(d.trade_name.toLowerCase());
      added++;
    }
  }
  if (added > 0) {
    console.log(`🔧 Ensured default trades present: added ${added}`);
    debouncedSave();
  }
}

ensureDefaultTradesPresent();

function parseDollarAmounts(blockText) {
  const matches = [...(blockText || '').matchAll(/\$([0-9,]+)/g)].map(m => parseInt(m[1].replace(/,/g, ''), 10));
  return matches;
}

/**
 * Generate a unique requirement ID
 * @param {number} timestamp - Base timestamp for the ID
 * @param {number} counter - Counter to ensure uniqueness
 * @returns {string} Unique requirement ID
 */
function generateRequirementId(timestamp, counter) {
  return `req-${timestamp}-${counter}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Check if a table row is a header row
 * @param {string} tierName - The tier name to check
 * @param {string} tradeName - The trade name to check
 * @returns {boolean} True if this is a header row
 */
function isHeaderRow(tierName, tradeName) {
  const headerTerms = ['tier', 'trade', 'trades'];
  return tierName === 'tier' || headerTerms.includes(tradeName.toLowerCase());
}

/**
 * Parse tier-based requirements from PDF text
 * Handles various formats including tier-trade tables
 */
function parseTierBasedRequirements(text) {
  const requirements = [];
  const tiers = new Map();

  // Pattern 1: Look for tier/trade table structure
  // Matches table rows like: "standard | Plumbing | — | $1,000,000 / $2,000,000 / $2,000,000 | —"
  // Capture groups:
  //   1: Tier name (e.g., "standard", "high", "premium")
  //   2: Trade name (e.g., "Plumbing", "All Trades")
  //   3: Scope description (optional)
  //   4: Insurance limits (dollar amounts and separators)
  // Separators: Handles | (pipe), \t (tab), / (slash), - (dash), , (comma)
  const tierTradePattern = /(?:^|\n)\s*([a-z]+(?:\s+\d+)?)\s*[|\t]+\s*([^|\t\n]+?)\s*[|\t]+\s*([^|\t\n]*?)\s*[|\t]+\s*([^\n]+)/gim;
  
  let match;
  while ((match = tierTradePattern.exec(text)) !== null) {
    const tierName = match[1].trim().toLowerCase();
    const tradeName = match[2].trim();
    const scope = match[3]?.trim() || '—';
    const limitsText = match[4];
    
    // Skip header rows
    if (isHeaderRow(tierName, tradeName)) continue;
    
    const dollars = parseDollarAmounts(limitsText);
    
    if (dollars.length > 0) {
      // Safe array access with bounds checking
      // Expected order: [GL Each Occurrence, GL Aggregate, GL Products Ops, Umbrella Each, Umbrella Aggregate]
      // Note: PDF formats may vary, so this is a best-effort extraction
      const limits = {
        gl_each_occurrence: (dollars.length > 0 ? dollars[0] : null),
        gl_general_aggregate: (dollars.length > 1 ? dollars[1] : null),
        gl_products_completed_ops: (dollars.length > 2 ? dollars[2] : null),
        umbrella_each_occurrence: (dollars.length > 3 ? dollars[3] : null),
        umbrella_aggregate: (dollars.length > 4 ? dollars[4] : null),
      };
      
      if (!tiers.has(tierName)) {
        tiers.set(tierName, []);
      }
      tiers.get(tierName).push({ tradeName, scope, limits });
    }
  }

  // Pattern 2: Legacy format - Prime Subcontractor A/B/C/D
  // Matches text like: "Prime Subcontractor A" followed by dollar amounts
  // This pattern looks for the subcontractor label and extracts up to 200 characters after it
  // which should contain the insurance limit amounts
  if (tiers.size === 0) {
    const scopeMap = {
      A: 'Tower crane operations',
      B: 'All non-tower cranes',
      C: 'Concrete, masonry, steel, carpentry, HVAC, plumbing, electrical, excavation, demolition, foundation, scaffolding, elevator',
      D: 'All other trades'
    };

    ['A', 'B', 'C', 'D'].forEach((label) => {
      const tierPattern = new RegExp(`Prime\\s+Subcontractor\\s+${label}([\\s\\S]{0,200})`, 'i');
      const tierMatch = tierPattern.exec(text);
      if (tierMatch) {
        const dollars = parseDollarAmounts(tierMatch[1]);
        if (dollars.length > 0) {
          // Safe array access with bounds checking
          // Expected order: [GL Each Occurrence, Umbrella Each, GL Aggregate, Umbrella Aggregate, GL Products Ops]
          // But patterns vary, so use fallbacks with safe indexing
          
          // GL General Aggregate: prefer index 2, fallback to index 1, then null
          let glAggregate = null;
          if (dollars.length > 2) {
            glAggregate = dollars[2];
          } else if (dollars.length > 1) {
            glAggregate = dollars[1];
          }
          
          // GL Products/Completed Ops: prefer index 4, fallback to index 2, then null
          let glProductsOps = null;
          if (dollars.length > 4) {
            glProductsOps = dollars[4];
          } else if (dollars.length > 2) {
            glProductsOps = dollars[2];
          }
          
          // Umbrella Aggregate: prefer index 3, fallback to index 1, then null
          let umbrellaAggregate = null;
          if (dollars.length > 3) {
            umbrellaAggregate = dollars[3];
          } else if (dollars.length > 1) {
            umbrellaAggregate = dollars[1];
          }
          
          const limits = {
            gl_each_occurrence: (dollars.length > 0 ? dollars[0] : null),
            gl_general_aggregate: glAggregate,
            gl_products_completed_ops: glProductsOps,
            umbrella_each_occurrence: (dollars.length > 1 ? dollars[1] : null),
            umbrella_aggregate: umbrellaAggregate,
          };
          
          const tierName = label.toLowerCase();
          if (!tiers.has(tierName)) {
            tiers.set(tierName, []);
          }
          tiers.get(tierName).push({
            tradeName: `Prime Subcontractor ${label}`,
            scope: scopeMap[label],
            limits
          });
        }
      }
    });
  }

  // Pattern 3: General tier pattern matching
  // Fallback pattern for generic tier structures
  // Unlike Pattern 1 which extracts from separate table columns, this pattern looks for
  // tier and trade names in text and searches the surrounding context for dollar amounts.
  // This allows flexibility for various PDF formats where dollar amounts may not be
  // immediately adjacent to the trade name.
  // Example formats supported:
  //   - "tier: standard Plumbing $1,000,000"
  //   - "standard | Plumbing | $1,000,000" (table format)
  //   - "standard Plumbing\n$1,000,000" (newline separated)
  if (tiers.size === 0) {
    // Flexible pattern that captures tier and trade name, stopping before dollar signs or pipes
    // This allows the dollar amounts to be found via context search, matching Pattern 1's approach
    const generalTierPattern = /(?:tier[:\s]+)?([a-z]+(?:\s+\d+)?)\s*[:\s|]+\s*([^|\n$]+?)(?=\s*(?:\$|\||$|\n))/gi;
    while ((match = generalTierPattern.exec(text)) !== null) {
      const tierName = match[1].trim().toLowerCase();
      const tradeName = match[2].trim();
      
      // Skip if this looks like a header row
      if (isHeaderRow(tierName, tradeName)) continue;
      
      // Search broader context around the match for dollar amounts
      // This allows for formats where amounts are not immediately adjacent
      const contextText = text.substring(Math.max(0, match.index - 50), Math.min(text.length, match.index + 300));
      const dollars = parseDollarAmounts(contextText);
      
      if (dollars.length > 0) {
        // Safe array access with bounds checking
        const limits = {
          gl_each_occurrence: (dollars.length > 0 ? dollars[0] : null),
          gl_general_aggregate: (dollars.length > 1 ? dollars[1] : null),
          gl_products_completed_ops: (dollars.length > 2 ? dollars[2] : null),
          umbrella_each_occurrence: (dollars.length > 3 ? dollars[3] : null),
          umbrella_aggregate: (dollars.length > 4 ? dollars[4] : null),
        };
        
        if (!tiers.has(tierName)) {
          tiers.set(tierName, []);
        }
        tiers.get(tierName).push({ tradeName, scope: '—', limits });
      }
    }
  }

  // Convert tiers map to requirements array
  let idCounter = 0;
  const timestamp = Date.now();
  
  tiers.forEach((trades, tierName) => {
    trades.forEach(({ tradeName, scope, limits }) => {
      const common = {
        trade_name: tradeName,
        tier: tierName,
        is_required: true,
        scope: scope,
        created_date: new Date().toISOString(),
        notes: 'Parsed from program PDF; review and adjust as needed.'
      };

      // Create a single requirement with both GL and umbrella data
      if (limits.gl_each_occurrence || limits.gl_general_aggregate) {
        requirements.push({
          id: generateRequirementId(timestamp, idCounter++),
          insurance_type: 'general_liability',
          gl_each_occurrence: limits.gl_each_occurrence || 1000000,
          gl_general_aggregate: limits.gl_general_aggregate || 2000000,
          gl_products_completed_ops: limits.gl_products_completed_ops || limits.gl_general_aggregate || 2000000,
          umbrella_each_occurrence: limits.umbrella_each_occurrence,
          umbrella_aggregate: limits.umbrella_aggregate,
          ...common,
        });
      } else if (limits.umbrella_each_occurrence || limits.umbrella_aggregate) {
        // If there's only umbrella data without GL, create umbrella-only requirement
        requirements.push({
          id: generateRequirementId(timestamp, idCounter++),
          insurance_type: 'umbrella_policy',
          umbrella_each_occurrence: limits.umbrella_each_occurrence,
          umbrella_aggregate: limits.umbrella_aggregate,
          ...common,
        });
      }
    });
  });

  return requirements;
}

function buildProgramFromText(text, pdfName = 'Program') {
  // Try to parse tier-based requirements
  let requirements = parseTierBasedRequirements(text);

  // Generate unique IDs using timestamp and separate counter
  // Start counter at a high value to avoid collisions with parseTierBasedRequirements()
  const timestamp = Date.now();
  let idCounter = 1000;

  // If no requirements found, create default structure
  if (requirements.length === 0) {
    console.log('⚠️  No tier-based requirements found in PDF, creating default structure');
    requirements = [
      {
        id: generateRequirementId(timestamp, idCounter++),
        trade_name: 'All Trades',
        tier: 'standard',
        insurance_type: 'general_liability',
        is_required: true,
        gl_each_occurrence: 1000000,
        gl_general_aggregate: 2000000,
        gl_products_completed_ops: 2000000,
        scope: 'General construction trades',
        created_date: new Date().toISOString(),
        notes: 'Default requirement - PDF parsing did not find specific tiers. Please review and update.'
      }
    ];
  }

  // Add baseline WC and Auto requirements if not already present
  const hasWC = requirements.some(r => r.insurance_type === 'workers_compensation');
  const hasAuto = requirements.some(r => r.insurance_type === 'auto_liability');

  if (!hasWC) {
    requirements.push({
      id: generateRequirementId(timestamp, idCounter++),
      trade_name: 'All Trades',
      tier: 'standard',
      insurance_type: 'workers_compensation',
      is_required: true,
      wc_each_accident: 1000000,
      wc_disease_policy_limit: 1000000,
      wc_disease_each_employee: 1000000,
      created_date: new Date().toISOString(),
      notes: 'Baseline WC requirement; adjust as needed.'
    });
  }

  if (!hasAuto) {
    requirements.push({
      id: generateRequirementId(timestamp, idCounter++),
      trade_name: 'All Trades',
      tier: 'standard',
      insurance_type: 'auto_liability',
      is_required: true,
      auto_combined_single_limit: 1000000,
      created_date: new Date().toISOString(),
      notes: 'Baseline Auto requirement; adjust as needed.'
    });
  }

  return {
    program: {
      name: pdfName.replace(/\.[^/.]+$/, ''),
      description: 'Imported from program PDF (auto-parsed)',
      is_active: true,
    },
    requirements,
    rawText: text,
  };
}

// Passwords are hashed using bcrypt with salt rounds = 10
// Admin password loaded from environment variable for security
// IMPORTANT: Set ADMIN_PASSWORD_HASH environment variable in production for security
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$10$SdlYpKRtZWyeRtelxZazJ.E34HJK70pJCuAy4qXely62Z/LAvAzBO';

let users = [
  { id: '1', username: 'admin', password: ADMIN_PASSWORD_HASH, email: 'miriamsabel@insuretrack.onmicrosoft.com', name: 'Miriam Sabel', role: 'super_admin' }
];

// Password reset tokens storage (in production, use a database with TTL)
// Format: { email: { token, expiresAt, used } }
const passwordResetTokens = new Map();

// Email validation helper
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function generateTempPassword(length = 12) {
  // Use cryptographically secure random generation without modulo bias
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@$%*?';
  const charsLength = chars.length;
  
  // Use rejection sampling to avoid modulo bias
  const randomBytesNeeded = length * 2; // Get extra bytes for rejection sampling
  const randomBytes = crypto.randomBytes(randomBytesNeeded);
  
  let out = '';
  let byteIndex = 0;
  
  while (out.length < length && byteIndex < randomBytesNeeded) {
    const byte = randomBytes[byteIndex++];
    // Only use bytes that don't cause bias (rejection sampling)
    if (byte < 256 - (256 % charsLength)) {
      out += chars[byte % charsLength];
    }
  }
  
  // Fallback if we ran out of bytes (extremely unlikely)
  while (out.length < length) {
    const extraByte = crypto.randomBytes(1)[0];
    if (extraByte < 256 - (256 % charsLength)) {
      out += chars[extraByte % charsLength];
    }
  }
  
  return out;
}

async function ensureGcLogin(contractor, { forceCreate = false } = {}) {
  if (!contractor || contractor.contractor_type !== 'general_contractor') {
    console.log('🔴 ensureGcLogin early return 1: no contractor or wrong type');
    return null;
  }
  if (!forceCreate && !contractor.email) {
    console.log('🔴 ensureGcLogin early return 2: no forceCreate and no email');
    return null;
  }

  // Check if contractor already has a stored password - if so, don't regenerate it
  if (contractor.password && !forceCreate) {
    console.log('✅ ensureGcLogin: contractor already has password stored, skipping regeneration', {
      contractorId: contractor.id,
      email: contractor.email
    });
    return null;
  }

  // Check if this specific contractor already has a login
  const existingForThisContractor = users.find(u => u.gc_id === contractor.id);
  if (existingForThisContractor) {
    console.log('🔴 ensureGcLogin early return 3: contractor already has login', {
      contractorId: contractor.id,
      existingUserId: existingForThisContractor.id
    });
    return null;
  }

  // Don't block if email exists in other contractors - allow multiple GCs with same contact email
  // This is valid in multi-contractor scenarios
  console.log('✅ ensureGcLogin proceeding to create:', {
    contractorId: contractor.id,
    email: contractor.email,
    forceCreate
  });

  // Use email directly as username if available, otherwise generate from company name
  let username;
  let base;
  if (contractor.email) {
    username = contractor.email;
    // For email-based usernames, use the local part for suffix generation
    base = contractor.email.split('@')[0];
  } else {
    base = (contractor.company_name || contractor.entity_name || contractor.id || 'gc')
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'gc';
    username = base.startsWith('gc') ? base : `gc-${base}`;
  }
  
  // Handle username conflicts - always add suffix if username exists to ensure uniqueness
  let suffix = 1;
  const baseUsername = username;
  while (users.some(u => u.username === username)) {
    if (contractor.email) {
      // For emails, insert suffix before @ to maintain valid email format
      const [localPart, domain] = contractor.email.split('@');
      username = `${localPart}-${suffix}@${domain}`;
    } else {
      username = `${base}-${suffix}`;
    }
    suffix++;
  }

  const tempPassword = generateTempPassword();
  // Use async bcrypt.hash to avoid blocking the event loop
  const hashedPassword = await bcrypt.hash(tempPassword, 10);
  const userId = `gc-user-${contractor.id || Date.now()}`;
  const name = contractor.contact_person || contractor.company_name || contractor.entity_name || 'GC User';
  const email = contractor.email || '';

  const newUser = { id: userId, username, password: hashedPassword, email, name, role: 'gc', gc_id: contractor.id };
  users.push(newUser);
  entities.User.push({
    id: userId,
    username,
    email,
    name,
    role: 'gc',
    gc_id: contractor.id,
    created_date: new Date().toISOString()
  });

  // Also store password on the Contractor entity for login endpoint
  // Set it directly on the passed contractor object since it may not be in the array yet
  if (contractor) {
    contractor.password = hashedPassword;
  }

  // Also try to update in the array if it exists there (for later calls)
  if (contractor.id && entities.Contractor) {
    const contractorIndex = entities.Contractor.findIndex(c => c.id === contractor.id);
    if (contractorIndex !== -1) {
      entities.Contractor[contractorIndex].password = hashedPassword;
    }
  }

  // Return temporary password so frontend can send it in welcome email
  // The frontend is responsible for not storing it in localStorage
  const returnValue = { username, role: 'gc', userId, passwordSet: true, password: tempPassword };
  console.log('📦 ensureGcLogin returning:', {
    username: returnValue.username,
    hasPassword: !!returnValue.password,
    passwordLength: returnValue.password?.length || 0,
    allKeys: Object.keys(returnValue)
  });
  return returnValue;
}

// Ensure seeded GCs get logins (idempotent) - using async/await
(async () => {
  try {
    for (const c of entities.Contractor.filter(c => c.contractor_type === 'general_contractor')) {
      await ensureGcLogin(c);
    }
  } catch (err) {
    console.error('Error ensuring GC logins:', err);
  }
})();

// =======================
// MIDDLEWARE CONFIGURATION
// =======================

// =======================
// SECURITY MIDDLEWARE (Helmet first)
// =======================

// Helmet configuration for security headers
// TEMPORARILY DISABLED TO DEBUG CORS ISSUES
// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'"],
//       scriptSrc: ["'self'", "'unsafe-inline'"],
//       styleSrc: ["'self'", "'unsafe-inline'"],
//       imgSrc: ["'self'", 'data:', 'https:'],
//       connectSrc: ["'self'", 'https:'],
//       fontSrc: ["'self'"],
//       objectSrc: ["'none'"],
//       mediaSrc: ["'self'"],
//       frameSrc: ["'none'"]
//     }
//   },
//   crossOriginResourcePolicy: { policy: "cross-origin" },
//   hsts: {
//     maxAge: 31536000, // 1 year
//     includeSubDomains: true,
//     preload: true
//   },
//   noSniff: true,
//   xssFilter: true,
//   referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
// }));

// =======================
// CORS MIDDLEWARE (must come before body parser and routing)
// =======================

// Simple, manual CORS middleware that runs on ALL requests/responses
// This ensures CORS headers are set BEFORE any route handler or error handler
app.use((req, res, next) => {
  // Resolve the origin to echo back; prefer request origin, then configured frontend URL
  const requestOrigin = req.headers.origin;
  const envOrigin = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL;
  const allowOrigin = requestOrigin || envOrigin || '*';

  res.header('Access-Control-Allow-Origin', allowOrigin);
  if (allowOrigin !== '*') {
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
  }

  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  const requestedHeaders = req.headers['access-control-request-headers'];
  res.header(
    'Access-Control-Allow-Headers',
    requestedHeaders || 'Content-Type, Authorization, X-Requested-With, Accept'
  );
  res.header('Access-Control-Max-Age', '600');
  
  // Handle preflight requests immediately
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  // Continue to next middleware
  next();
});

// Also use the cors package as backup (with simpler options)
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Explicit OPTIONS handler for preflight
app.options('*', (req, res) => {
  res.status(204).send();
});

// Parse JSON AFTER CORS middleware
app.use(express.json({ limit: '10mb' }));

// =======================
// RATE LIMITING MIDDLEWARE
// =======================

// Rate limiting with different strategies
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => {
    // Skip rate limiting for development
    return process.env.NODE_ENV === 'development';
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful logins
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit file uploads to 50 per hour per IP
  message: { error: 'Too many file uploads, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit email sending to 5 per hour per IP to prevent spam/abuse
  message: { error: 'Too many email requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// General rate limiter for public API endpoints
const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit public API requests to 30 per 15 minutes per IP
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to routes
app.use('/api/', apiLimiter);
app.use('/entities/', apiLimiter);
app.use('/auth/login', authLimiter);

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));
console.log('✅ Serving uploads from:', UPLOADS_DIR);

// =======================
// UTILITY MIDDLEWARE
// =======================

// Standard error response formatter
const sendError = (res, statusCode, message, details = null) => {
  const response = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };
  if (details) response.details = details;
  return res.status(statusCode).json(response);
};

// Standard success response formatter
const sendSuccess = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  });
};

// Validation error handler middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, 'Validation failed', errors.array());
  }
  next();
};

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔐 Auth check:', {
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    path: req.path
  });

  if (!token) {
    console.log('❌ No token provided');
    return sendError(res, 401, 'Authentication token required');
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('❌ Token verification failed:', err.message);
      return sendError(res, 403, 'Invalid or expired token');
    }
    console.log('✅ Token verified for user:', user.username);
    req.user = user;
    next();
  });
}

// Admin-only middleware
function requireAdmin(req, res, next) {
  if (!req.user) {
    return sendError(res, 401, 'Authentication required');
  }
  
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return sendError(res, 403, 'Admin access required');
  }
  
  next();
}

// Health check
app.get('/health', (req, res) => {
  sendSuccess(res, { status: 'ok' });
});

// Auth endpoints with validation
app.post('/auth/login',
  authLimiter,
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = users.find(u => (u.username === username || u.email === username));
      
      // Always perform bcrypt comparison to prevent timing attacks
      const passwordToCheck = user ? user.password : DUMMY_PASSWORD_HASH;
      const isPasswordValid = await bcrypt.compare(password, passwordToCheck);
      
      if (!user || !isPasswordValid) {
        return sendError(res, 401, 'Invalid credentials');
      }

      const accessToken = jwt.sign(
        { id: user.id, username: user.username, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      const refreshToken = jwt.sign(
        { id: user.id, username: user.username, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      return sendError(res, 500, 'Authentication service error');
    }
});

app.post('/auth/refresh', 
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required')
  ],
  handleValidationErrors,
  (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return sendError(res, 401, 'Refresh token required');
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    const accessToken = jwt.sign(
      { id: decoded.id, username: decoded.username, email: decoded.email, role: decoded.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      accessToken, 
      refreshToken,
      success: true
    });
  } catch (err) {
    return sendError(res, 403, 'Invalid or expired refresh token');
  }
});

app.get('/auth/me', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return sendError(res, 404, 'User not found');
  
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role
  });
});

// Change password endpoint - users can only change their own password
// Apply rate limiting to prevent brute force attacks
app.post('/auth/change-password', authLimiter, authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return sendError(res, 400, 'Current password and new password are required');
  }
  
  try {
    // Only allow password change for authenticated user's own account
    const userIndex = users.findIndex(u => u.id === req.user.id);
    
    if (userIndex === -1) {
      return sendError(res, 404, 'User not found');
    }
    
    // Verify current password using bcrypt
    const isPasswordValid = await bcrypt.compare(currentPassword, users[userIndex].password);
    if (!isPasswordValid) {
      return sendError(res, 401, 'Current password is incorrect');
    }
    
    // Validate new password (12 characters minimum with complexity)
    const minLength = 12;
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
    
    if (newPassword.length < minLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      return sendError(res, 400, 'Password must be at least 12 characters and contain uppercase, lowercase, number, and special character');
    }
    
    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    users[userIndex].password = hashedPassword;
    users[userIndex].must_change_password = false;
    users[userIndex].password_changed_at = new Date().toISOString();
  
    console.log(`✅ Password changed for user: ${users[userIndex].email}`);
    
    sendSuccess(res, { 
      message: 'Password changed successfully',
      must_change_password: false
    });
  } catch (err) {
    console.error('Password change error:', err);
    return sendError(res, 500, 'Failed to change password');
  }
});

// Unified password reset request handler
async function handlePasswordResetRequest(email, userType, res) {
  try {
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailLower = email.toLowerCase();
    let user = null;

    // Find user by type
    if (userType === 'gc') {
      const contractor = (entities.Contractor || []).find(c => 
        c.contractor_type === 'general_contractor' && 
        c.email?.toLowerCase() === emailLower
      );
      if (contractor) {
        user = { email: contractor.email, name: contractor.contact_person || contractor.company_name, id: contractor.id };
      }
    } else if (userType === 'broker') {
      const broker = (entities.Broker || []).find(b => b.email?.toLowerCase() === emailLower);
      if (broker) {
        user = { email: broker.email, name: broker.name || broker.company_name || 'Broker', id: broker.id };
      }
    } else if (userType === 'subcontractor') {
      const contractor = (entities.Contractor || []).find(c => 
        c.contractor_type === 'subcontractor' && 
        c.email?.toLowerCase() === emailLower
      );
      if (contractor) {
        user = { email: contractor.email, name: contractor.company_name || contractor.contact_person, id: contractor.id };
      }
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour
    
    // Store token using email as key (unified system)
    passwordResetTokens.set(emailLower, {
      token: resetToken,
      expiresAt,
      used: false,
      userType
    });

    // Clean up expired tokens
    for (const [key, value] of passwordResetTokens.entries()) {
      if (value.expiresAt < Date.now()) {
        passwordResetTokens.delete(key);
      }
    }

    // Send email if user exists
    if (user) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
      const resetLink = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
      
      const mailOptions = {
        from: process.env.SMTP_USER || process.env.SMTP_FROM || 'noreply@insuretrack.com',
        to: email,
        subject: 'Password Reset Request - CompliantTeam',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>Hello ${user.name || 'User'},</p>
            <p>We received a request to reset your password for your CompliantTeam account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #4F46E5; word-break: break-all; font-size: 12px;">${resetLink}</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 11px;">
              This is an automated message from CompliantTeam. Please do not reply to this email.
            </p>
          </div>
        `
      };
      
      try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Password reset email sent to: ${email}`);
      } catch (emailErr) {
        console.error('Failed to send password reset email:', emailErr?.message);
      }
    }
    
    // Always return success to prevent email enumeration
    return res.json({ 
      success: true, 
      message: 'If an account exists with this email, a password reset link has been sent.' 
    });
  } catch (err) {
    console.error('handlePasswordResetRequest error:', err?.message || err);
    return res.status(500).json({ error: 'Request failed' });
  }
}

// Unified password reset handler
async function handlePasswordReset(req, res) {
  try {
    const { email, token, newPassword } = req.body || {};
    
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Email, token, and new password are required' });
    }

    const emailLower = email.toLowerCase();
    const storedTokenData = passwordResetTokens.get(emailLower);

    if (!storedTokenData) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    // Verify token matches and is not expired
    if (storedTokenData.token !== token || storedTokenData.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    if (storedTokenData.used) {
      return res.status(400).json({ error: 'This reset link has already been used' });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user based on type
    const userType = storedTokenData.userType;
    if (userType === 'gc') {
      const gcIndex = (entities.Contractor || []).findIndex(c => 
        c.contractor_type === 'general_contractor' && 
        c.email?.toLowerCase() === emailLower
      );
      if (gcIndex !== -1) {
        entities.Contractor[gcIndex].password = hashedPassword;
        saveEntities();
        console.log(`✅ GC password reset for: ${email}`);
      } else {
        return res.status(404).json({ error: 'GC not found' });
      }
    } else if (userType === 'broker') {
      const brokerIndex = (entities.Broker || []).findIndex(b => 
        b.email?.toLowerCase() === emailLower
      );
      if (brokerIndex !== -1) {
        entities.Broker[brokerIndex].password = hashedPassword;
        debouncedSave();
        console.log(`✅ Broker password reset for: ${email}`);
      } else {
        return res.status(404).json({ error: 'Broker not found' });
      }
    } else if (userType === 'subcontractor') {
      const subIndex = (entities.Contractor || []).findIndex(c => 
        c.contractor_type === 'subcontractor' && 
        c.email?.toLowerCase() === emailLower
      );
      if (subIndex !== -1) {
        entities.Contractor[subIndex].password = hashedPassword;
        saveEntities();
        console.log(`✅ Subcontractor password reset for: ${email}`);
      } else {
        return res.status(404).json({ error: 'Subcontractor not found' });
      }
    }

    // Mark token as used and remove after delay
    storedTokenData.used = true;
    setTimeout(() => {
      passwordResetTokens.delete(emailLower);
    }, 5000);

    return res.json({ 
      success: true, 
      message: 'Password has been reset successfully. You can now log in with your new password.' 
    });
  } catch (err) {
    console.error('handlePasswordReset error:', err?.message || err);
    return res.status(500).json({ error: 'Password reset failed' });
  }
}

// Password Reset Request - Generate and send reset token
app.post('/auth/request-password-reset',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    return handlePasswordResetRequest(req.body.email, 'user', res);
  }
);

// Password Reset - Verify token and reset password
app.post('/auth/reset-password',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword').notEmpty().withMessage('New password is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    return handlePasswordReset(req, res);
  }
);

// Entity endpoints (clean rebuild)
// Get archived entities (Admin only) - Must be before generic route
app.get('/entities/:entityName/archived', authenticateToken, requireAdmin, (req, res) => {
  const { entityName } = req.params;
  if (!entities[entityName]) {
    return sendError(res, 404, `Entity ${entityName} not found`);
  }
  const archivedItems = entities[entityName].filter(item => item.isArchived === true || item.status === 'archived');
  sendSuccess(res, archivedItems);
});

// List or read one
app.get('/entities/:entityName', authenticateToken, (req, res) => {
  const { entityName } = req.params;
  const { sort, id, includeArchived } = req.query;
  if (!entities[entityName]) {
    return res.status(404).json({ error: `Entity ${entityName} not found` });
  }
  let data = entities[entityName];
  if (id) {
    const item = data.find(item => item.id === id);
    if (!item || (includeArchived !== 'true' && (item.isArchived || item.status === 'archived'))) {
      return res.status(404).json({ error: `${entityName} with id '${id}' not found` });
    }
    return res.json(item);
  }
  if (includeArchived !== 'true') {
    data = data.filter(item => !item.isArchived && item.status !== 'archived');
  }
  if (sort) {
    const isDescending = sort.startsWith('-');
    const sortField = isDescending ? sort.substring(1) : sort;
    const allowedSortFields = ['id', 'email', 'created_date', 'name', 'company_name', 'status', 'createdAt', 'uploaded_for_review_date', 'uploaded_date'];
    if (!allowedSortFields.includes(sortField)) {
      return sendError(res, 400, `Invalid sort field. Allowed fields: ${allowedSortFields.join(', ')}`);
    }
    data = [...data].sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const cmp = aVal > bVal ? 1 : (aVal < bVal ? -1 : 0);
      return isDescending ? -cmp : cmp;
    });
  }
  res.json(data);
});

// Query via querystring
app.get('/entities/:entityName/query', authenticateToken, (req, res) => {
  const { entityName } = req.params;
  if (!entities[entityName]) {
    return res.status(404).json({ error: `Entity ${entityName} not found` });
  }
  let data = entities[entityName];
  const filters = Object.fromEntries(
    Object.entries(req.query).filter(([key]) => !['sort', 'includeArchived'].includes(key))
  );
  if (Object.keys(filters).length > 0) {
    data = data.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        return item[key] === value || item[key] === String(value);
      });
    });
  }
  if (req.query.includeArchived !== 'true') {
    data = data.filter(item => !item.isArchived && item.status !== 'archived');
  }
  const { sort } = req.query;
  if (sort) {
    const isDescending = sort.startsWith('-');
    const sortField = isDescending ? sort.substring(1) : sort;
    const allowedSortFields = ['id', 'email', 'created_date', 'name', 'company_name', 'status', 'createdAt', 'uploaded_for_review_date', 'uploaded_date'];
    if (!allowedSortFields.includes(sortField)) {
      return sendError(res, 400, `Invalid sort field. Allowed fields: ${allowedSortFields.join(', ')}`);
    }
    data = [...data].sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const cmp = aVal > bVal ? 1 : (aVal < bVal ? -1 : 0);
      return isDescending ? -cmp : cmp;
    });
  }
  return res.json({ success: true, data, timestamp: new Date().toISOString() });
});

// Create
app.post('/entities/:entityName', authenticateToken, async (req, res) => {
  const { entityName } = req.params;
  const data = req.body;
  if (!entities[entityName]) {
    return res.status(404).json({ error: `Entity ${entityName} not found` });
  }
  if (entityName === 'User') {
    if (!data.email) return res.status(400).json({ error: 'Email is required for User creation' });
    if (!data.name) return res.status(400).json({ error: 'Name is required for User creation' });
    if (!data.password) return res.status(400).json({ error: 'Password is required for User creation' });
    if (!validateEmail(data.email)) return res.status(400).json({ error: 'Invalid email format' });
    if (users.find(u => u.email === data.email)) return res.status(400).json({ error: 'Email already exists' });
    if (entities.User.find(u => u.email === data.email)) return res.status(400).json({ error: 'Email already exists' });
    const username = data.username || data.email.split('@')[0];
    if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Username already exists' });
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const userId = `user-${Date.now()}`;
    const newUser = { id: userId, username, password: hashedPassword, email: data.email, name: data.name, role: data.role || 'admin', is_active: data.is_active !== undefined ? data.is_active : true, createdAt: new Date().toISOString(), createdBy: req.user.id };
    users.push(newUser);
    const userEntity = { id: userId, username, email: data.email, name: data.name, role: data.role || 'admin', is_active: data.is_active !== undefined ? data.is_active : true, created_date: newUser.createdAt, createdBy: req.user.id };
    entities.User.push(userEntity);
    debouncedSave();
    return res.status(201).json(userEntity);
  }
  const newItem = { id: `${entityName}-${Date.now()}`, ...data, createdAt: new Date().toISOString(), createdBy: req.user.id };
  let gcLogin = null;
  if (entityName === 'Contractor' && data.contractor_type === 'general_contractor') {
    console.log('🔧 Creating GC - calling ensureGcLogin for contractor:', {
      contractorId: newItem.id,
      contractorType: data.contractor_type,
      email: data.email
    });
    gcLogin = await ensureGcLogin(newItem, { forceCreate: true });
    console.log('🔧 ensureGcLogin returned:', {
      gcLoginExists: !!gcLogin,
      gcLoginKeys: gcLogin ? Object.keys(gcLogin) : null,
      hasPassword: gcLogin?.password ? 'YES' : 'NO',
      passwordLength: gcLogin?.password?.length || 0
    });
    if (gcLogin) {
      newItem.gc_login_created = true;
      console.log('✅ GC Login created:', {
        username: gcLogin.username,
        hasPassword: !!gcLogin.password,
        passwordLength: gcLogin.password?.length || 0
      });
    } else {
      console.log('❌ ensureGcLogin returned null/falsy');
    }
  }
  entities[entityName].push(newItem);
  debouncedSave();
  const responsePayload = gcLogin ? { ...newItem, gcLogin } : newItem;
  console.log('📤 Contractor creation response payload:', {
    hasGcLogin: !!responsePayload.gcLogin,
    responseKeys: Object.keys(responsePayload).slice(0, 10)
  });
  res.status(201).json(responsePayload);
});

// Update
app.patch('/entities/:entityName/:id', authenticateToken, (req, res) => {
  const { entityName, id } = req.params;
  const updates = req.body || {};
  if (!entities[entityName]) {
    return res.status(404).json({ error: `Entity ${entityName} not found` });
  }
  const index = entities[entityName].findIndex(item => item.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  if (entityName === 'User') {
    const current = entities.User[index];
    const updatedUser = { ...current, ...updates, ...(updates.is_active !== undefined && { is_active: updates.is_active }), updatedAt: new Date().toISOString(), updatedBy: req.user.id };
    entities.User[index] = updatedUser;
    debouncedSave();
    return res.json(updatedUser);
  }
  entities[entityName][index] = { ...entities[entityName][index], ...updates, updatedAt: new Date().toISOString(), updatedBy: req.user.id };
  debouncedSave();
  res.json(entities[entityName][index]);
});

// Query via POST body
app.post('/entities/:entityName/query', authenticateToken, (req, res) => {
  const { entityName } = req.params;
  if (!entities[entityName]) {
    return res.status(404).json({ error: `Entity ${entityName} not found` });
  }
  let data = entities[entityName];
  const body = req.body || {};
  const { sort, includeArchived, ...rawFilters } = body;
  const filters = rawFilters || {};
  if (Object.keys(filters).length > 0) {
    data = data.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        return item[key] === value || item[key] === String(value);
      });
    });
  }
  if (includeArchived !== true && includeArchived !== 'true') {
    data = data.filter(item => !item.isArchived && item.status !== 'archived');
  }
  if (sort) {
    const isDescending = typeof sort === 'string' && sort.startsWith('-');
    const sortField = isDescending ? sort.substring(1) : sort;
    const allowedSortFields = ['id', 'email', 'created_date', 'name', 'company_name', 'status', 'createdAt', 'uploaded_for_review_date', 'uploaded_date'];
    if (!allowedSortFields.includes(sortField)) {
      return sendError(res, 400, `Invalid sort field. Allowed fields: ${allowedSortFields.join(', ')}`);
    }
    data = [...data].sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const cmp = aVal > bVal ? 1 : (aVal < bVal ? -1 : 0);
      return isDescending ? -cmp : cmp;
    });
  }
  res.json(data);
});

app.delete('/entities/:entityName/:id', authenticateToken, (req, res) => {
  const { entityName, id } = req.params;
  
  if (!entities[entityName]) {
    return res.status(404).json({ error: `Entity ${entityName} not found` });
  }

  const index = entities[entityName].findIndex(item => item.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  // Special handling for User entity deletion
  if (entityName === 'User') {
    // Also remove from users array
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex !== -1) {
      users.splice(userIndex, 1);
    }
  }

  const deleted = entities[entityName].splice(index, 1)[0];
  
  // Persist to disk
  debouncedSave();
  
  res.json(deleted);
});

// Archive/Unarchive endpoints (Admin only)
app.post('/entities/:entityName/:id/archive', authenticateToken, requireAdmin, (req, res) => {
  const { entityName, id } = req.params;
  const { reason } = req.body;
  
  if (!entities[entityName]) {
    return sendError(res, 404, `Entity ${entityName} not found`);
  }

  const index = entities[entityName].findIndex(item => item.id === id);
  if (index === -1) {
    return sendError(res, 404, 'Item not found');
  }

  const currentItem = entities[entityName][index];

  // Validate ProjectSubcontractor archiving
  if (entityName === 'ProjectSubcontractor') {
    const subcontractorId = currentItem.subcontractor_id;
    if (subcontractorId) {
      // Note: Subcontractors are stored in the Contractor entity array
      const subcontractor = entities.Contractor?.find(c => c.id === subcontractorId);
      if (!subcontractor) {
        return sendError(res, 400, 'Cannot archive ProjectSubcontractor: Referenced subcontractor does not exist');
      }
      if (!subcontractor.isArchived && subcontractor.status !== 'archived') {
        console.log(`⚠️ Warning: Archiving ProjectSubcontractor ${id} but referenced subcontractor ${subcontractorId} is not archived`);
      }
    }
  }

  // Archive the entity
  entities[entityName][index] = {
    ...currentItem,
    preArchiveStatus: currentItem.status, // Preserve original status
    status: 'archived',
    isArchived: true,
    archivedAt: new Date().toISOString(),
    archivedBy: req.user.id,
    archivedReason: reason || 'No reason provided',
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.id
  };

  // Persist to disk
  debouncedSave();

  console.log(`✅ Archived ${entityName} ${id} by ${req.user.username}`);
  sendSuccess(res, entities[entityName][index]);
});

app.post('/entities/:entityName/:id/unarchive', authenticateToken, requireAdmin, (req, res) => {
  const { entityName, id } = req.params;
  
  if (!entities[entityName]) {
    return sendError(res, 404, `Entity ${entityName} not found`);
  }

  const index = entities[entityName].findIndex(item => item.id === id);
  if (index === -1) {
    return sendError(res, 404, 'Item not found');
  }

  const currentItem = entities[entityName][index];
  const restoredStatus = currentItem.preArchiveStatus || 'active'; // Restore original status or default to 'active'

  // Unarchive the entity and clean up archive-related fields
  const { preArchiveStatus: _preArchiveStatus, archivedAt: _archivedAt, archivedBy: _archivedBy, archivedReason: _archivedReason, ...cleanedItem } = currentItem;
  
  entities[entityName][index] = {
    ...cleanedItem,
    status: restoredStatus,
    isArchived: false,
    unarchivedAt: new Date().toISOString(),
    unarchivedBy: req.user.id,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.id
  };

  // Persist to disk
  debouncedSave();

  console.log(`✅ Unarchived ${entityName} ${id} by ${req.user.username}`);
  sendSuccess(res, entities[entityName][index]);
});

// Notification endpoints
app.post('/notifications', authenticateToken, (req, res) => {
  const data = req.body;
  const newNotification = {
    id: `notif-${crypto.randomUUID()}`,
    ...data,
    is_read: false,
    created_at: new Date().toISOString(),
    created_by: req.user.id
  };
  entities.Notification.push(newNotification);
  res.status(201).json(newNotification);
});

app.get('/notifications', authenticateToken, (req, res) => {
  const { recipient_id, recipient_type, is_read } = req.query;
  let notifications = entities.Notification;
  
  if (recipient_id) {
    notifications = notifications.filter(n => n.recipient_id === recipient_id);
  }
  if (recipient_type) {
    notifications = notifications.filter(n => n.recipient_type === recipient_type);
  }
  if (is_read !== undefined) {
    const readStatus = is_read === 'true';
    notifications = notifications.filter(n => n.is_read === readStatus);
  }
  
  // Sort by created_at descending
  notifications = [...notifications].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );
  
  res.json(notifications);
});

app.patch('/notifications/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const index = entities.Notification.findIndex(n => n.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  
  entities.Notification[index] = {
    ...entities.Notification[index],
    ...updates,
    updated_at: new Date().toISOString()
  };
  
  res.json(entities.Notification[index]);
});

app.post('/notifications/:id/respond', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { response_text, response_type } = req.body;
  
  const notification = entities.Notification.find(n => n.id === id);
  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  
  // Create a message for the response
  const responseMessage = {
    id: `msg-${Date.now()}`,
    notification_id: id,
    sender_type: 'admin',
    sender_id: req.user.id,
    sender_name: req.user.name || 'Admin',
    sender_email: req.user.email,
    recipient_type: notification.sender_type,
    recipient_id: notification.sender_id,
    recipient_email: notification.sender_email,
    recipient_name: notification.sender_name,
    subject: `Re: ${notification.subject}`,
    body: response_text,
    response_type: response_type || 'comment',
    related_entity: notification.related_entity,
    related_entity_id: notification.related_entity_id,
    is_read: false,
    created_at: new Date().toISOString()
  };
  
  entities.Message.push(responseMessage);
  
  // Mark notification as responded - reuse the notification object we already found
  const index = entities.Notification.findIndex(n => n.id === id);
  if (index === -1) {
    return sendError(res, 404, 'Notification not found during update');
  }
  
  entities.Notification[index] = {
    ...entities.Notification[index],
    has_response: true,
    response_at: new Date().toISOString(),
    response_by: req.user.id,
    updated_at: new Date().toISOString()
  };
  
  res.json({
    notification: entities.Notification[index],
    message: responseMessage
  });
});

// Integration endpoints (stubs)
app.post('/integrations/invoke-llm', authenticateToken, (req, res) => {
  const { prompt, model } = req.body;
  res.json({
    text: `Mock LLM response to: "${prompt}"`,
    model: model || 'gpt-4',
    tokens: 42
  });
});

// NYC Property lookup endpoint (ACRIS + DOBNow via NYC Open Data / Geoclient)
app.post('/integrations/nyc/property', authenticateToken, async (req, res) => {
  try {
    const address = (req.body && req.body.address || '').trim();
    if (!address) return res.status(400).json({ error: 'Missing address' });

    const geoclientAppId = process.env.NYC_GEOCLIENT_APP_ID;
    const geoclientAppKey = process.env.NYC_GEOCLIENT_APP_KEY;
    const socrataToken = process.env.SOCRATA_APP_TOKEN;

    if (!geoclientAppId || !geoclientAppKey) {
      // Fallback: return a soft response so the UI can continue without hard failure
      return res.status(200).json({
        warning: 'NYC Geoclient not configured; returning stubbed response.',
        address,
        city: null,
        state: null,
        zip_code: null,
        block_number: null,
        lot_number: null,
        bin: null,
        height_stories: null,
        project_type: null,
        unit_count: null,
        structure_type: null,
        owner_entity: null,
        additional_insured_entities: []
      });
    }

    const u = new URL('https://api.cityofnewyork.us/geoclient/v2/search.json');
    u.searchParams.set('input', address);
    u.searchParams.set('app_id', geoclientAppId);
    u.searchParams.set('app_key', geoclientAppKey);

    const geoRes = await fetch(u.toString(), { headers: { 'Accept': 'application/json' } });
    if (!geoRes.ok) {
      const t = await geoRes.text().catch(()=> '');
      return res.status(502).json({ error: 'Geoclient lookup failed', details: t });
    }
    const geo = await geoRes.json();
    const best = Array.isArray(geo?.response?.results) ? geo.response.results[0]?.response : null;
    const boro = best?.boroughName || best?.borough;
    const block = best?.block && String(best.block).padStart(5, '0');
    const lot = best?.lot && String(best.lot).padStart(4, '0');
    const bin = best?.buildingIdentificationNumber || null;
    const zip = best?.zipCode || null;
    const city = (()=>{
      if (!boro) return null;
      const bb = String(boro).toLowerCase();
      if (bb.includes('manhattan')) return 'New York';
      if (bb.includes('brooklyn')) return 'Brooklyn';
      if (bb.includes('queens')) return 'Queens';
      if (bb.includes('bronx')) return 'Bronx';
      if (bb.includes('staten')) return 'Staten Island';
      return null;
    })();

    if (!block || !lot) {
      return res.status(404).json({ error: 'No BBL found for address' });
    }

    // Attempt ACRIS owner lookup via Socrata (dataset requires token for higher limits but can work without)
    let ownerEntity = null;
    if (socrataToken) {
      try {
        // Recorded Document Index (DEEDS) by BBL – get latest grantee
        const acrisUrl = new URL('https://data.cityofnewyork.us/resource/b8rk-rzvy.json');
        acrisUrl.searchParams.set('$limit', '1');
        acrisUrl.searchParams.set('$order', 'recorded_date DESC');
        acrisUrl.searchParams.set('document_type', 'DEED');
        // BBL in this dataset is borough, block, lot fields
        acrisUrl.searchParams.set('borough', boro?.toUpperCase() || '');
        acrisUrl.searchParams.set('block', String(Number(block)));
        acrisUrl.searchParams.set('lot', String(Number(lot)));
        const acrisRes = await fetch(acrisUrl.toString(), {
          headers: { 'X-App-Token': socrataToken, 'Accept': 'application/json' }
        });
        if (acrisRes.ok) {
          const rows = await acrisRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            ownerEntity = rows[0]?.grantee || rows[0]?.party2 || null;
          }
        }
      } catch(_){}
    }

    // Attempt DOB jobs/permits via Socrata (BIS/DOB jobs) – for height, units
    let unitCount = null, heightStories = null, projectType = null;
    if (socrataToken) {
      try {
        // DOB Job Application Filings – ic3t-wcy2 (fields: job_type, job_description, units, stories)
        const dobUrl = new URL('https://data.cityofnewyork.us/resource/ic3t-wcy2.json');
        dobUrl.searchParams.set('$limit', '1');
        dobUrl.searchParams.set('$order', 'filing_date DESC');
        dobUrl.searchParams.set('house_no', String(best?.houseNumber || ''));
        dobUrl.searchParams.set('street_name', String(best?.streetName || ''));
        dobUrl.searchParams.set('borough', String(boro || ''));
        const dobRes = await fetch(dobUrl.toString(), {
          headers: { 'X-App-Token': socrataToken, 'Accept': 'application/json' }
        });
        if (dobRes.ok) {
          const rows = await dobRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            const r = rows[0];
            unitCount = r?.dwelling_units || r?.units || null;
            heightStories = r?.stories || null;
            projectType = r?.job_type || null;
          }
        }
      } catch(_){}
    }

    const json = {
      address,
      city,
      state: 'NY',
      zip_code: zip || null,
      block_number: block,
      lot_number: lot,
      bin,
      height_stories: heightStories,
      project_type: projectType,
      unit_count: unitCount,
      structure_type: null,
      owner_entity: ownerEntity,
      additional_insured_entities: []
    };

    res.json(json);
  } catch (err) {
    console.error('NYC property lookup error:', err);
    res.status(500).json({ error: 'NYC property lookup failed' });
  }
});

// Public email endpoint - no authentication required (for broker portal)
app.post('/public/send-email', emailLimiter, async (req, res) => {
  const { to, subject, body, html, cc, bcc, from, replyTo, attachments: incomingAttachments, includeSampleCOI, sampleCOIData, recipientIsBroker, holdHarmlessTemplateUrl } = req.body || {};
  if (!to || !subject || (!body && !html)) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, body/html' });
  }

  // Env configuration
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpService = process.env.SMTP_SERVICE;
  const smtpSecureEnv = process.env.SMTP_SECURE;
  const requireTLSEnv = process.env.SMTP_REQUIRE_TLS;
  const rejectUnauthorizedEnv = process.env.SMTP_TLS_REJECT_UNAUTHORIZED;
  const defaultFrom = process.env.SMTP_FROM || process.env.FROM_EMAIL || 'no-reply@insuretrack.local';

  console.log('📧 Public email send request:', { to, subject, includeSampleCOI, hasSmtpHost: !!smtpHost, hasSmtpService: !!smtpService });

  const parseBool = (v, defaultVal) => {
    if (v === undefined) return defaultVal;
    const s = String(v).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  };

  const computedSecure = smtpPort === 465;
  const secure = parseBool(smtpSecureEnv, computedSecure);
  const requireTLS = parseBool(requireTLSEnv, false);
  const rejectUnauthorized = parseBool(rejectUnauthorizedEnv, true);

  try {
    // Helper: create an ACORD-style sample COI PDF buffer based on provided data
    const generateSampleCOIPDF = async (data = {}) => {
      return new Promise(async (resolve, reject) => {
        try {
          // Fetch program requirements if program is specified
          let programRequirements = null;
          if (data.program || data.program_id) {
            try {
              let programId = data.program_id;
              if (!programId && data.program) {
                const programs = entities.InsuranceProgram?.filter(p => p.name === data.program || p.program_name === data.program) || [];
                if (programs && programs.length > 0) {
                  programId = programs[0].id;
                }
              }
              if (programId) {
                // Check both SubInsuranceRequirement and ProgramRequirement
                programRequirements = [
                  ...(entities.SubInsuranceRequirement?.filter(req => req.program_id === programId) || []),
                  ...(entities.ProgramRequirement?.filter(req => req.program_id === programId) || [])
                ];
                console.log(`📋 Found ${programRequirements.length} program requirements for program ${programId}`);
              }
            } catch (err) {
              console.warn('Could not fetch program requirements:', err?.message);
            }
          }

          // Determine trade tier and requirements
          let tradeRequirements = null;
          if (data.trade && programRequirements && programRequirements.length > 0) {
            const tradesList = data.trade.split(',').map(t => t.trim().toLowerCase());
            tradeRequirements = programRequirements.filter(req => {
              const applicableTrades = req.applicable_trades || [];
              // Also check trade_name for direct match
              const tradeName = (req.trade_name || '').toLowerCase();
              const scope = (req.scope || '').toLowerCase();
              
              // Check if requirement applies to "All Trades"
              if (applicableTrades.some(t => t.toLowerCase() === 'all trades') || 
                  tradeName === 'all trades') {
                return true;
              }
              
              // Check if requirement is marked as "all other trades" or tier D fallback
              if (req.is_all_other_trades || 
                  tradeName.includes('all other') || 
                  scope.includes('all other')) {
                return true;
              }
              
              // Check for exact or partial trade match
              return applicableTrades.some(t => tradesList.includes(t.toLowerCase())) ||
                     tradesList.some(t => tradeName.includes(t) || t.includes(tradeName) || scope.includes(t));
            });
            console.log(`📋 Matched ${tradeRequirements.length} requirements for trade(s): ${data.trade}`);
          }

          // Determine if umbrella is required
          const hasUmbrellaRequirement = tradeRequirements && tradeRequirements.some(req => 
            req.insurance_type === 'umbrella_policy' || req.umbrella_each_occurrence
          );
          
          if (hasUmbrellaRequirement) {
            const umbReq = tradeRequirements.find(r => r.insurance_type === 'umbrella_policy' || r.umbrella_each_occurrence);
            console.log(`✅ Umbrella required: ${umbReq.umbrella_each_occurrence?.toLocaleString() || 'N/A'}`);
          }

          const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
          const chunks = [];
          doc.on('data', (c) => chunks.push(c));
          doc.on('end', () => resolve(Buffer.concat(chunks)));

          const pageWidth = 612; // Letter size width in points
          const pageHeight = 792; // Letter size height in points
          const margin = 40;
          const contentWidth = pageWidth - (margin * 2);
          
          // Helper to draw boxes
          const drawBox = (x, y, width, height) => {
            doc.rect(x, y, width, height).stroke();
          };

          // ACORD 25 FORM HEADER
          doc.fontSize(7).font('Helvetica').text('ACORD', margin, margin);
          doc.fontSize(6).text('CERTIFICATE OF LIABILITY INSURANCE', margin, margin + 8);
          doc.fontSize(6).text('DATE (MM/DD/YYYY)', pageWidth - margin - 100, margin);
          doc.fontSize(8).text(new Date().toLocaleDateString('en-US'), pageWidth - margin - 100, margin + 10);

          let yPos = margin + 30;

          // PRODUCER BOX (Left side)
          drawBox(margin, yPos, contentWidth * 0.6, 80);
          doc.fontSize(6).font('Helvetica-Bold').text('PRODUCER', margin + 3, yPos + 3);
          // Do NOT include broker info on sample COI; use generic placeholders
          doc.fontSize(8).font('Helvetica').text('(Broker/Producer Name and Contact)', margin + 3, yPos + 12);
          doc.fontSize(7).text('(Address, Phone, Email to be completed)', margin + 3, yPos + 25);

          // CONTACT INFO BOX (Right side)
          const contactBoxX = margin + (contentWidth * 0.6) + 2;
          drawBox(contactBoxX, yPos, contentWidth * 0.4 - 2, 40);
          doc.fontSize(6).font('Helvetica-Bold').text('CONTACT', contactBoxX + 3, yPos + 3);
          doc.fontSize(6).font('Helvetica').text('NAME:', contactBoxX + 3, yPos + 12);
          doc.fontSize(6).text('PHONE: ', contactBoxX + 3, yPos + 22);
          doc.fontSize(6).text('E-MAIL:', contactBoxX + 3, yPos + 32);

          // INSURER INFO BOX (Right side, bottom)
          drawBox(contactBoxX, yPos + 42, contentWidth * 0.4 - 2, 38);
          doc.fontSize(6).font('Helvetica-Bold').text('INSURER(S) AFFORDING COVERAGE', contactBoxX + 3, yPos + 44);
          doc.fontSize(6).font('Helvetica').text('INSURER A:', contactBoxX + 3, yPos + 54);
          doc.fontSize(6).text('INSURER B:', contactBoxX + 3, yPos + 64);
          doc.fontSize(6).text('INSURER C:', contactBoxX + 3, yPos + 74);

          yPos += 82;

          // INSURED BOX
          drawBox(margin, yPos, contentWidth * 0.6, 45);
          doc.fontSize(6).font('Helvetica-Bold').text('INSURED', margin + 3, yPos + 3);
          doc.fontSize(8).font('Helvetica').text('(Named Insured Name and Address)', margin + 3, yPos + 12);
          doc.fontSize(7).text('(To be completed by broker)', margin + 3, yPos + 25);

          yPos += 47;

          // COVERAGES SECTION
          doc.fontSize(7).font('Helvetica-Bold').text('COVERAGES', margin, yPos);
          doc.fontSize(6).font('Helvetica').text('THIS IS TO CERTIFY THAT THE POLICIES OF INSURANCE LISTED BELOW HAVE BEEN ISSUED TO THE INSURED NAMED ABOVE FOR THE POLICY PERIOD INDICATED.', margin, yPos + 10, { width: contentWidth, align: 'justify' });

          yPos += 30;

          // Coverage Table Header
          drawBox(margin, yPos, contentWidth, 20);
          doc.fontSize(6).font('Helvetica-Bold');
          doc.text('TYPE OF INSURANCE', margin + 3, yPos + 3);
          doc.text('INSR', margin + 3, yPos + 12);
          doc.text('LTR', margin + 3, yPos + 12);
          doc.text('POLICY NUMBER', margin + 180, yPos + 8);
          doc.text('POLICY EFF', margin + 300, yPos + 3);
          doc.text('(MM/DD/YYYY)', margin + 300, yPos + 11);
          doc.text('POLICY EXP', margin + 380, yPos + 3);
          doc.text('(MM/DD/YYYY)', margin + 380, yPos + 11);
          doc.text('LIMITS', margin + 460, yPos + 8);

          yPos += 22;

          // GENERAL LIABILITY ROW
          drawBox(margin, yPos, contentWidth, 60);
          doc.fontSize(7).font('Helvetica-Bold').text('COMMERCIAL GENERAL LIABILITY', margin + 25, yPos + 3);
          doc.fontSize(6).font('Helvetica').text('☐ CLAIMS-MADE  ☒ OCCUR', margin + 25, yPos + 12);
          doc.fontSize(6).text('☐ PER PROJECT  ☒ PER OCCURRENCE', margin + 25, yPos + 20);
          doc.fontSize(6).text('A', margin + 5, yPos + 3);
          doc.fontSize(6).text('(Policy #)', margin + 180, yPos + 8);
          doc.fontSize(6).text('MM/DD/YYYY', margin + 300, yPos + 8);
          doc.fontSize(6).text('MM/DD/YYYY', margin + 380, yPos + 8);
          
          // GL Limits
          doc.fontSize(6).font('Helvetica').text('EACH OCCURRENCE', margin + 460, yPos + 3);
          const glLimit = tradeRequirements?.find(r => r.gl_each_occurrence)?.gl_each_occurrence || 1000000;
          doc.text(`$ ${glLimit.toLocaleString()}`, margin + 460, yPos + 10);
          doc.text('GENERAL AGGREGATE', margin + 460, yPos + 22);
          const glAgg = tradeRequirements?.find(r => r.gl_general_aggregate)?.gl_general_aggregate || 2000000;
          doc.text(`$ ${glAgg.toLocaleString()}`, margin + 460, yPos + 29);
          doc.text('PRODUCTS - COMP/OP AGG', margin + 460, yPos + 41);
          doc.text(`$ ${glAgg.toLocaleString()}`, margin + 460, yPos + 48);

          yPos += 62;

          // AUTOMOBILE LIABILITY ROW
          drawBox(margin, yPos, contentWidth, 35);
          doc.fontSize(7).font('Helvetica-Bold').text('AUTOMOBILE LIABILITY', margin + 25, yPos + 3);
          doc.fontSize(6).font('Helvetica').text('☐ ANY AUTO  ☐ OWNED  ☐ SCHEDULED', margin + 25, yPos + 12);
          doc.fontSize(6).text('☐ HIRED  ☐ NON-OWNED', margin + 25, yPos + 20);
          doc.fontSize(6).text('B', margin + 5, yPos + 3);
          doc.fontSize(6).text('(Policy #)', margin + 180, yPos + 12);
          doc.fontSize(6).text('MM/DD/YYYY', margin + 300, yPos + 12);
          doc.fontSize(6).text('MM/DD/YYYY', margin + 380, yPos + 12);
          doc.text('COMBINED SINGLE LIMIT', margin + 460, yPos + 8);
          const autoLimit = tradeRequirements?.find(r => r.auto_combined_single_limit)?.auto_combined_single_limit || 1000000;
          doc.text(`$ ${autoLimit.toLocaleString()}`, margin + 460, yPos + 15);

          yPos += 37;

          // WORKERS COMPENSATION ROW
          drawBox(margin, yPos, contentWidth, 35);
          doc.fontSize(7).font('Helvetica-Bold').text('WORKERS COMPENSATION', margin + 25, yPos + 3);
          doc.fontSize(6).font('Helvetica').text('AND EMPLOYERS\' LIABILITY', margin + 25, yPos + 11);
          doc.fontSize(6).text('☒ STATUTORY LIMITS', margin + 25, yPos + 20);
          doc.fontSize(6).text('C', margin + 5, yPos + 3);
          doc.fontSize(6).text('(Policy #)', margin + 180, yPos + 12);
          doc.fontSize(6).text('MM/DD/YYYY', margin + 300, yPos + 12);
          doc.fontSize(6).text('MM/DD/YYYY', margin + 380, yPos + 12);
          doc.text('E.L. EACH ACCIDENT', margin + 460, yPos + 3);
          const wcLimit = tradeRequirements?.find(r => r.wc_each_accident)?.wc_each_accident || 1000000;
          doc.text(`$ ${wcLimit.toLocaleString()}`, margin + 460, yPos + 10);
          doc.text('E.L. DISEASE - EA EMPLOYEE', margin + 460, yPos + 18);
          doc.text(`$ ${wcLimit.toLocaleString()}`, margin + 460, yPos + 25);

          yPos += 37;

          // UMBRELLA ROW (if required)
          if (hasUmbrellaRequirement) {
            drawBox(margin, yPos, contentWidth, 35);
            doc.fontSize(7).font('Helvetica-Bold').text('UMBRELLA LIAB', margin + 25, yPos + 3);
            doc.fontSize(6).font('Helvetica').text('☐ OCCUR  ☐ CLAIMS-MADE', margin + 25, yPos + 12);
            doc.fontSize(6).text('☒ FOLLOW FORM', margin + 25, yPos + 20);
            doc.fontSize(6).text('D', margin + 5, yPos + 3);
            doc.fontSize(6).text('(Policy #)', margin + 180, yPos + 12);
            doc.fontSize(6).text('MM/DD/YYYY', margin + 300, yPos + 12);
            doc.fontSize(6).text('MM/DD/YYYY', margin + 380, yPos + 12);
            doc.text('EACH OCCURRENCE', margin + 460, yPos + 8);
            const umbLimit = tradeRequirements?.find(r => r.umbrella_each_occurrence)?.umbrella_each_occurrence || 2000000;
            doc.text(`$ ${umbLimit.toLocaleString()}`, margin + 460, yPos + 15);
            doc.text('AGGREGATE', margin + 460, yPos + 23);
            doc.text(`$ ${umbLimit.toLocaleString()}`, margin + 460, yPos + 30);
            yPos += 37;
          }

          // DESCRIPTION OF OPERATIONS BOX
          drawBox(margin, yPos, contentWidth * 0.6, 80);
          doc.fontSize(6).font('Helvetica-Bold').text('DESCRIPTION OF OPERATIONS / LOCATIONS / VEHICLES', margin + 3, yPos + 3);
          doc.fontSize(7).font('Helvetica');
          const umbrellaText = hasUmbrellaRequirement ? ' & Umbrella' : '';
          const jobLocationText = data.projectAddress ? `\n\nJob Location: ${data.projectAddress}` : '';
          doc.text(
            `Certificate holder and entities listed below are included in the GL${umbrellaText} policies as additional insureds for ongoing & completed operations on a primary & non-contributory basis, as required by written contract agreement, per policy terms & conditions. Waiver of subrogation is included in the GL${umbrellaText ? ', Umbrella' : ''} & Workers Compensation policies.${jobLocationText}`,
            margin + 3,
            yPos + 13,
            { width: contentWidth * 0.6 - 6, align: 'left' }
          );

          // Additional Insureds
          doc.fontSize(7).font('Helvetica-Bold').text('ADDITIONAL INSURED(S):', margin + 3, yPos + 50);
          doc.fontSize(7).font('Helvetica');
          const addlInsuredList = Array.isArray(data.additional_insureds) && data.additional_insureds.length > 0
            ? data.additional_insureds
            : (Array.isArray(data.additional_insured_entities) ? data.additional_insured_entities.map(e => e?.name || e).filter(Boolean) : []);
          if (addlInsuredList.length > 0) {
            addlInsuredList.slice(0, 3).forEach((ai, idx) => {
              doc.text(`• ${ai}`, margin + 3, yPos + 58 + (idx * 8), { width: contentWidth * 0.6 - 6 });
            });
          } else {
            doc.text('• (See certificate holder below)', margin + 3, yPos + 58);
          }

          // CERTIFICATE HOLDER BOX (Bottom right)
          const certHolderX = margin + (contentWidth * 0.6) + 2;
          drawBox(certHolderX, yPos, contentWidth * 0.4 - 2, 80);
          doc.fontSize(6).font('Helvetica-Bold').text('CERTIFICATE HOLDER', certHolderX + 3, yPos + 3);
          doc.fontSize(8).font('Helvetica');
          const certHolder = data.gc_name || 'General Contractor';
          doc.text(certHolder, certHolderX + 3, yPos + 15);
          if (data.gc_mailing_address) {
            doc.fontSize(7).text(data.gc_mailing_address, certHolderX + 3, yPos + 25, { width: contentWidth * 0.4 - 8 });
          }
          if (data.project_name) {
            doc.fontSize(7).text(`Re: ${data.project_name}`, certHolderX + 3, yPos + 40, { width: contentWidth * 0.4 - 8 });
          }

          yPos += 82;

          // CANCELLATION NOTICE
          doc.fontSize(6).font('Helvetica-Bold').text('CANCELLATION', margin, yPos);
          doc.fontSize(6).font('Helvetica').text('SHOULD ANY OF THE ABOVE DESCRIBED POLICIES BE CANCELLED BEFORE THE EXPIRATION DATE THEREOF, NOTICE WILL BE DELIVERED IN ACCORDANCE WITH THE POLICY PROVISIONS.', margin, yPos + 8, { width: contentWidth, align: 'justify' });

          yPos += 25;

          // AUTHORIZED REPRESENTATIVE
          doc.fontSize(6).font('Helvetica-Bold').text('AUTHORIZED REPRESENTATIVE', margin, yPos);
          doc.fontSize(7).font('Helvetica').text('(Signature)', margin, yPos + 15);

          // Footer
          doc.fontSize(5).font('Helvetica').text('© 1988-2015 ACORD CORPORATION. All rights reserved.', margin, pageHeight - margin - 15);
          doc.text('ACORD 25 (2016/03)', pageWidth - margin - 80, pageHeight - margin - 15);

          doc.end();
        } catch (e) {
          reject(e);
        }
      });
    };

    // Helper: Generate a regenerated COI PDF using stored data with updated job fields
    const generateGeneratedCOIPDF = async (coiRecord = {}) => {
      return new Promise(async (resolve, reject) => {
        try {
          const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
          const chunks = [];
          doc.on('data', (c) => chunks.push(c));
          doc.on('end', () => resolve(Buffer.concat(chunks)));

          const pageWidth = 612; // Letter size width in points
          const pageHeight = 792; // Letter size height in points
          const margin = 40;
          const contentWidth = pageWidth - (margin * 2);
          
          // Helper to draw boxes
          const drawBox = (x, y, width, height) => {
            doc.rect(x, y, width, height).stroke();
          };

          // ACORD 25 FORM HEADER
          doc.fontSize(7).font('Helvetica').text('ACORD', margin, margin);
          doc.fontSize(6).text('CERTIFICATE OF LIABILITY INSURANCE', margin, margin + 8);
          doc.fontSize(6).text('DATE (MM/DD/YYYY)', pageWidth - margin - 100, margin);
          doc.fontSize(8).text(new Date().toLocaleDateString('en-US'), pageWidth - margin - 100, margin + 10);

          let yPos = margin + 30;

          // PRODUCER BOX (Left side) - from original COI
          drawBox(margin, yPos, contentWidth * 0.6, 80);
          doc.fontSize(6).font('Helvetica-Bold').text('PRODUCER', margin + 3, yPos + 3);
          doc.fontSize(8).font('Helvetica').text(coiRecord.broker_name || '(Broker/Producer Name)', margin + 3, yPos + 12);
          if (coiRecord.broker_address) {
            doc.fontSize(7).text(coiRecord.broker_address, margin + 3, yPos + 25);
          }

          // CONTACT INFO BOX (Right side) - from original COI
          const contactBoxX = margin + (contentWidth * 0.6) + 2;
          drawBox(contactBoxX, yPos, contentWidth * 0.4 - 2, 40);
          doc.fontSize(6).font('Helvetica-Bold').text('CONTACT', contactBoxX + 3, yPos + 3);
          doc.fontSize(6).font('Helvetica').text('NAME:', contactBoxX + 3, yPos + 12);
          if (coiRecord.broker_contact) {
            doc.fontSize(6).text(coiRecord.broker_contact, contactBoxX + 50, yPos + 12);
          }
          doc.fontSize(6).text('PHONE: ', contactBoxX + 3, yPos + 22);
          if (coiRecord.broker_phone) {
            doc.fontSize(6).text(coiRecord.broker_phone, contactBoxX + 50, yPos + 22);
          }
          doc.fontSize(6).text('E-MAIL:', contactBoxX + 3, yPos + 32);
          if (coiRecord.broker_email) {
            doc.fontSize(6).text(coiRecord.broker_email, contactBoxX + 50, yPos + 32);
          }

          // INSURER INFO BOX (Right side, bottom)
          drawBox(contactBoxX, yPos + 42, contentWidth * 0.4 - 2, 38);
          doc.fontSize(6).font('Helvetica-Bold').text('INSURER(S) AFFORDING COVERAGE', contactBoxX + 3, yPos + 44);
          doc.fontSize(6).font('Helvetica').text('INSURER A:', contactBoxX + 3, yPos + 54);
          doc.fontSize(6).text(coiRecord.insurance_carrier_gl || '', contactBoxX + 50, yPos + 54);
          doc.fontSize(6).text('INSURER B:', contactBoxX + 3, yPos + 64);
          doc.fontSize(6).text(coiRecord.insurance_carrier_umbrella || '', contactBoxX + 50, yPos + 64);
          doc.fontSize(6).text('INSURER C:', contactBoxX + 3, yPos + 74);
          doc.fontSize(6).text(coiRecord.insurance_carrier_wc || '', contactBoxX + 50, yPos + 74);

          yPos += 82;

          // INSURED BOX - Named Insured from original COI
          drawBox(margin, yPos, contentWidth * 0.6, 45);
          doc.fontSize(6).font('Helvetica-Bold').text('INSURED', margin + 3, yPos + 3);
          doc.fontSize(8).font('Helvetica').text(coiRecord.subcontractor_name || coiRecord.named_insured || '(Named Insured)', margin + 3, yPos + 12);
          if (coiRecord.subcontractor_address) {
            doc.fontSize(7).text(coiRecord.subcontractor_address, margin + 3, yPos + 25);
          }

          yPos += 47;

          // COVERAGES SECTION
          doc.fontSize(7).font('Helvetica-Bold').text('COVERAGES', margin, yPos);
          doc.fontSize(6).font('Helvetica').text('THIS IS TO CERTIFY THAT THE POLICIES OF INSURANCE LISTED BELOW HAVE BEEN ISSUED TO THE INSURED NAMED ABOVE FOR THE POLICY PERIOD INDICATED.', margin, yPos + 10, { width: contentWidth, align: 'justify' });

          yPos += 30;

          // Coverage Table Header
          drawBox(margin, yPos, contentWidth, 20);
          doc.fontSize(6).font('Helvetica-Bold');
          doc.text('TYPE OF INSURANCE', margin + 3, yPos + 3);
          doc.text('INSR', margin + 3, yPos + 12);
          doc.text('LTR', margin + 3, yPos + 12);
          doc.text('POLICY NUMBER', margin + 180, yPos + 8);
          doc.text('POLICY EFF', margin + 300, yPos + 3);
          doc.text('(MM/DD/YYYY)', margin + 300, yPos + 11);
          doc.text('POLICY EXP', margin + 380, yPos + 3);
          doc.text('(MM/DD/YYYY)', margin + 380, yPos + 11);
          doc.text('LIMITS', margin + 460, yPos + 8);

          yPos += 22;

          // GENERAL LIABILITY ROW - use stored data from original
          drawBox(margin, yPos, contentWidth, 60);
          doc.fontSize(7).font('Helvetica-Bold').text('COMMERCIAL GENERAL LIABILITY', margin + 25, yPos + 3);
          
          // Use original form selections or default to OCCUR
          const glFormType = coiRecord.gl_form_type || 'OCCUR';
          const glBasis = coiRecord.gl_basis || 'PER OCCURRENCE';
          doc.fontSize(6).font('Helvetica').text(
            glFormType === 'CLAIMS-MADE' ? '☒ CLAIMS-MADE  ☐ OCCUR' : '☐ CLAIMS-MADE  ☒ OCCUR',
            margin + 25,
            yPos + 12
          );
          doc.fontSize(6).text(
            glBasis === 'PER PROJECT' ? '☒ PER PROJECT  ☐ PER OCCURRENCE' : '☐ PER PROJECT  ☒ PER OCCURRENCE',
            margin + 25,
            yPos + 20
          );
          
          doc.fontSize(6).text('A', margin + 5, yPos + 3);
          doc.fontSize(6).text(coiRecord.policy_number_gl || '(Policy #)', margin + 180, yPos + 8);
          doc.fontSize(6).text(coiRecord.gl_effective_date ? new Date(coiRecord.gl_effective_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 300, yPos + 8);
          doc.fontSize(6).text(coiRecord.gl_expiration_date ? new Date(coiRecord.gl_expiration_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 380, yPos + 8);
          
          // GL Limits - use stored values from original
          doc.fontSize(6).font('Helvetica').text('EACH OCCURRENCE', margin + 460, yPos + 3);
          doc.text(`$ ${(coiRecord.gl_each_occurrence || 1000000).toLocaleString()}`, margin + 460, yPos + 10);
          doc.text('GENERAL AGGREGATE', margin + 460, yPos + 22);
          doc.text(`$ ${(coiRecord.gl_general_aggregate || 2000000).toLocaleString()}`, margin + 460, yPos + 29);
          doc.text('PRODUCTS - COMP/OP AGG', margin + 460, yPos + 41);
          doc.text(`$ ${(coiRecord.gl_products_completed_ops || 2000000).toLocaleString()}`, margin + 460, yPos + 48);

          yPos += 62;

          // AUTOMOBILE LIABILITY ROW - if policy exists
          if (coiRecord.policy_number_auto || coiRecord.insurance_carrier_auto) {
            drawBox(margin, yPos, contentWidth, 35);
            doc.fontSize(7).font('Helvetica-Bold').text('AUTOMOBILE LIABILITY', margin + 25, yPos + 3);
            const autoFormType = coiRecord.auto_form_type || 'ANY AUTO';
            doc.fontSize(6).font('Helvetica').text(
              autoFormType === 'ANY AUTO' ? '☒ ANY AUTO  ☐ OWNED  ☐ SCHEDULED' : '☐ ANY AUTO  ☐ OWNED  ☐ SCHEDULED',
              margin + 25,
              yPos + 12
            );
            doc.fontSize(6).text('☐ HIRED  ☐ NON-OWNED', margin + 25, yPos + 20);
            doc.fontSize(6).text('B', margin + 5, yPos + 3);
            doc.fontSize(6).text(coiRecord.policy_number_auto || '(Policy #)', margin + 180, yPos + 12);
            doc.fontSize(6).text(coiRecord.auto_effective_date ? new Date(coiRecord.auto_effective_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 300, yPos + 12);
            doc.fontSize(6).text(coiRecord.auto_expiration_date ? new Date(coiRecord.auto_expiration_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 380, yPos + 12);
            doc.text('COMBINED SINGLE LIMIT', margin + 460, yPos + 8);
            doc.text(`$ ${(coiRecord.auto_combined_single_limit || 1000000).toLocaleString()}`, margin + 460, yPos + 15);

            yPos += 37;
          }

          // WORKERS COMPENSATION ROW - always shown
          drawBox(margin, yPos, contentWidth, 35);
          doc.fontSize(7).font('Helvetica-Bold').text('WORKERS COMPENSATION', margin + 25, yPos + 3);
          doc.fontSize(6).font('Helvetica').text('AND EMPLOYERS\' LIABILITY', margin + 25, yPos + 11);
          const wcType = coiRecord.wc_form_type || 'STATUTORY LIMITS';
          doc.fontSize(6).text(wcType === 'STATUTORY LIMITS' ? '☒ STATUTORY LIMITS' : '☐ STATUTORY LIMITS', margin + 25, yPos + 20);
          doc.fontSize(6).text('C', margin + 5, yPos + 3);
          doc.fontSize(6).text(coiRecord.policy_number_wc || '(Policy #)', margin + 180, yPos + 12);
          doc.fontSize(6).text(coiRecord.wc_effective_date ? new Date(coiRecord.wc_effective_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 300, yPos + 12);
          doc.fontSize(6).text(coiRecord.wc_expiration_date ? new Date(coiRecord.wc_expiration_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 380, yPos + 12);
          doc.text('E.L. EACH ACCIDENT', margin + 460, yPos + 3);
          doc.text(`$ ${(coiRecord.wc_each_accident || 1000000).toLocaleString()}`, margin + 460, yPos + 10);
          doc.text('E.L. DISEASE - EA EMPLOYEE', margin + 460, yPos + 18);
          doc.text(`$ ${(coiRecord.wc_disease_each_employee || 1000000).toLocaleString()}`, margin + 460, yPos + 25);

          yPos += 37;

          // UMBRELLA ROW - if policy exists
          if (coiRecord.policy_number_umbrella || coiRecord.insurance_carrier_umbrella) {
            drawBox(margin, yPos, contentWidth, 35);
            doc.fontSize(7).font('Helvetica-Bold').text('UMBRELLA LIAB', margin + 25, yPos + 3);
            const umbFormType = coiRecord.umbrella_form_type || 'OCCUR';
            doc.fontSize(6).font('Helvetica').text(
              umbFormType === 'CLAIMS-MADE' ? '☒ CLAIMS-MADE  ☐ OCCUR' : '☐ CLAIMS-MADE  ☒ OCCUR',
              margin + 25,
              yPos + 12
            );
            doc.fontSize(6).text('☒ FOLLOW FORM', margin + 25, yPos + 20);
            doc.fontSize(6).text('D', margin + 5, yPos + 3);
            doc.fontSize(6).text(coiRecord.policy_number_umbrella || '(Policy #)', margin + 180, yPos + 12);
            doc.fontSize(6).text(coiRecord.umbrella_effective_date ? new Date(coiRecord.umbrella_effective_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 300, yPos + 12);
            doc.fontSize(6).text(coiRecord.umbrella_expiration_date ? new Date(coiRecord.umbrella_expiration_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 380, yPos + 12);
            doc.text('EACH OCCURRENCE', margin + 460, yPos + 8);
            doc.text(`$ ${(coiRecord.umbrella_each_occurrence || 2000000).toLocaleString()}`, margin + 460, yPos + 15);
            doc.text('AGGREGATE', margin + 460, yPos + 23);
            doc.text(`$ ${(coiRecord.umbrella_aggregate || 2000000).toLocaleString()}`, margin + 460, yPos + 30);
            yPos += 37;
          }

          // DESCRIPTION OF OPERATIONS BOX - from original COI
          drawBox(margin, yPos, contentWidth * 0.6, 80);
          doc.fontSize(6).font('Helvetica-Bold').text('DESCRIPTION OF OPERATIONS / LOCATIONS / VEHICLES', margin + 3, yPos + 3);
          doc.fontSize(7).font('Helvetica');
          
          // Use stored description or default
          const umbrellaText = (coiRecord.policy_number_umbrella || coiRecord.insurance_carrier_umbrella) ? ' & Umbrella' : '';
          const descriptionText = coiRecord.description_of_operations || 
            `Certificate holder and entities listed below are included in the GL${umbrellaText} policies as additional insureds for ongoing & completed operations on a primary & non-contributory basis, as required by written contract agreement, per policy terms & conditions. Waiver of subrogation is included in the GL${umbrellaText ? ', Umbrella' : ''} & Workers Compensation policies.`;
          
          doc.text(descriptionText, margin + 3, yPos + 13, { width: contentWidth * 0.6 - 6, align: 'left' });

          // Additional Insureds - combine stored data with manually entered
          doc.fontSize(7).font('Helvetica-Bold').text('ADDITIONAL INSURED(S):', margin + 3, yPos + 50);
          doc.fontSize(7).font('Helvetica');
          
          // Merge stored additional insureds with any manually entered ones
          let allAddlInsured = [];
          if (Array.isArray(coiRecord.additional_insureds)) {
            allAddlInsured = [...coiRecord.additional_insureds];
          }
          if (Array.isArray(coiRecord.manually_entered_additional_insureds)) {
            allAddlInsured = [...allAddlInsured, ...coiRecord.manually_entered_additional_insureds];
          }
          // Remove duplicates
          allAddlInsured = [...new Set(allAddlInsured)];
          
          if (allAddlInsured.length > 0) {
            allAddlInsured.slice(0, 3).forEach((ai, idx) => {
              doc.text(`• ${ai}`, margin + 3, yPos + 58 + (idx * 8), { width: contentWidth * 0.6 - 6 });
            });
          } else {
            doc.text('• (See certificate holder below)', margin + 3, yPos + 58);
          }

          // CERTIFICATE HOLDER BOX (Bottom right) - UPDATED FIELD
          const certHolderX = margin + (contentWidth * 0.6) + 2;
          drawBox(certHolderX, yPos, contentWidth * 0.4 - 2, 80);
          doc.fontSize(6).font('Helvetica-Bold').text('CERTIFICATE HOLDER', certHolderX + 3, yPos + 3);
          doc.fontSize(8).font('Helvetica');
          const certHolder = coiRecord.certificate_holder_name || coiRecord.gc_name || 'General Contractor';
          doc.text(certHolder, certHolderX + 3, yPos + 15);
          
          // UPDATED: Project address from new job
          if (coiRecord.updated_project_address || coiRecord.project_address) {
            const projectAddr = coiRecord.updated_project_address || coiRecord.project_address;
            doc.fontSize(7).text(projectAddr, certHolderX + 3, yPos + 25, { width: contentWidth * 0.4 - 8 });
          }
          
          // UPDATED: Project name from new job
          if (coiRecord.updated_project_name || coiRecord.project_name) {
            const projName = coiRecord.updated_project_name || coiRecord.project_name;
            doc.fontSize(7).text(`Re: ${projName}`, certHolderX + 3, yPos + 40, { width: contentWidth * 0.4 - 8 });
          }

          yPos += 82;

          // CANCELLATION NOTICE
          doc.fontSize(6).font('Helvetica-Bold').text('CANCELLATION', margin, yPos);
          doc.fontSize(6).font('Helvetica').text('SHOULD ANY OF THE ABOVE DESCRIBED POLICIES BE CANCELLED BEFORE THE EXPIRATION DATE THEREOF, NOTICE WILL BE DELIVERED IN ACCORDANCE WITH THE POLICY PROVISIONS.', margin, yPos + 8, { width: contentWidth, align: 'justify' });

          yPos += 25;

          // AUTHORIZED REPRESENTATIVE
          doc.fontSize(6).font('Helvetica-Bold').text('AUTHORIZED REPRESENTATIVE', margin, yPos);
          doc.fontSize(7).font('Helvetica').text('(Signature)', margin, yPos + 15);

          // Footer
          doc.fontSize(5).font('Helvetica').text('© 1988-2015 ACORD CORPORATION. All rights reserved.', margin, pageHeight - margin - 15);
          doc.text('ACORD 25 (2016/03)', pageWidth - margin - 80, pageHeight - margin - 15);

          doc.end();
        } catch (e) {
          reject(e);
        }
      });
    };

    let transporter;
    let mockEmail = false;

    const hasPartialCredentials = smtpUser || smtpPass;
    const hasBothCredentials = smtpUser && smtpPass;
    const hasHostOrService = smtpHost || smtpService;
    const missingRequiredConfig = !hasBothCredentials || !hasHostOrService;
    
    if (hasPartialCredentials && missingRequiredConfig) {
      console.error('❌ INCOMPLETE SMTP CONFIG');
      return res.status(500).json({ 
        error: 'SMTP configuration incomplete',
        details: 'SMTP_HOST or SMTP_SERVICE must be configured along with both SMTP_USER and SMTP_PASS'
      });
    }

    if (!hasHostOrService || !hasBothCredentials) {
      // Dev fallback: Use mock email for public portal
      mockEmail = true;
      console.log('⚠️ SMTP not configured - using mock email for public portal');
      transporter = {
        sendMail: async (options) => {
          console.log('📧 MOCK EMAIL (public):', {
            from: options.from,
            to: options.to,
            subject: options.subject,
            html: options.html?.substring(0, 100) || 'N/A'
          });
          return { messageId: `mock-${Date.now()}` };
        }
      };
    } else {
      // Real SMTP configuration
      const config = {};
      if (smtpService) {
        config.service = smtpService;
      } else if (smtpHost) {
        config.host = smtpHost;
        config.port = smtpPort;
        config.secure = secure;
        config.requireTLS = requireTLS;
        config.tls = { rejectUnauthorized };
      }
      config.auth = { user: smtpUser, pass: smtpPass };

      transporter = nodemailer.createTransport(config);
      console.log('✅ SMTP transporter configured for public email');
    }

    // Build attachments (incoming + optionally sample COI)
    const mailAttachments = [];
    
    // Include any incoming attachments
    if (Array.isArray(incomingAttachments) && incomingAttachments.length > 0) {
      for (const a of incomingAttachments) {
        if (a && a.filename) {
          const att = { filename: a.filename };
          if (a.content && a.encoding === 'base64') {
            att.content = Buffer.from(a.content, 'base64');
          } else if (a.content && a.encoding === 'utf8') {
            att.content = Buffer.from(a.content, 'utf8');
          } else if (a.content) {
            att.content = a.content;
          }
          if (a.contentType) att.contentType = a.contentType;
          mailAttachments.push(att);
        }
      }
    }

    // Optionally generate and attach a sample COI PDF for broker emails
    if (includeSampleCOI) {
      try {
        console.log('🔄 Generating sample COI PDF with data:', Object.keys(sampleCOIData || {}));
        const pdfBuffer = await generateSampleCOIPDF(sampleCOIData || {});
        mailAttachments.push({ filename: 'sample_coi.pdf', content: pdfBuffer, contentType: 'application/pdf' });
        console.log('✅ Sample COI PDF generated and attached:', pdfBuffer.length, 'bytes');
      } catch (pdfErr) {
        console.error('❌ Could not generate sample COI PDF:', pdfErr?.message || pdfErr);
        console.error('Full error:', pdfErr);
      }
    }

    const mailOptions = {
      from: from || defaultFrom,
      to,
      subject,
      html: html || body
    };
    
    // Add optional fields if they exist
    if (cc) mailOptions.cc = cc;
    if (bcc) mailOptions.bcc = bcc;
    if (replyTo) mailOptions.replyTo = replyTo;
    if (mailAttachments.length > 0) mailOptions.attachments = mailAttachments;

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Public email sent:', { to, subject, messageId: info.messageId, mockEmail });

    res.status(200).json({
      success: true,
      messageId: info.messageId,
      mockEmail
    });
  } catch (err) {
    console.error('❌ Public SendEmail error:', err?.message || err);
    res.status(500).json({
      error: 'Failed to send email',
      details: err?.message || 'Unknown error',
      mockEmail: true
    });
  }
});

// Public users list (no auth) - useful for quick manual testing only
// Returns limited user info and should NOT be used in production.
app.get('/public/users', (req, res) => {
  try {
    const safeUsers = (users || []).map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      name: u.name,
      role: u.role
    }));
    res.json(safeUsers);
  } catch (err) {
    console.error('Public users error:', err?.message || err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/integrations/send-email', authenticateToken, async (req, res) => {
  // Align with public endpoint: support attachments and optional sample COI
  const { to, subject, body, html, cc, bcc, from, replyTo, attachments: incomingAttachments, includeSampleCOI, sampleCOIData } = req.body || {};
  if (!to || !subject || (!body && !html)) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, body/html' });
  }

  // Env configuration
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpService = process.env.SMTP_SERVICE; // e.g., 'gmail'
  const smtpSecureEnv = process.env.SMTP_SECURE; // 'true' | 'false'
  const requireTLSEnv = process.env.SMTP_REQUIRE_TLS; // 'true' | 'false'
  const rejectUnauthorizedEnv = process.env.SMTP_TLS_REJECT_UNAUTHORIZED; // 'true' | 'false'
  const defaultFrom = process.env.SMTP_FROM || process.env.FROM_EMAIL || 'no-reply@compliant.team';

  console.log('📧 Email send request:', {
    to,
    subject,
    hasSmtpHost: !!smtpHost,
    hasSmtpService: !!smtpService,
    hasSmtpUser: !!smtpUser,
    hasSmtpPass: !!smtpPass,
    smtpService
  });

  const parseBool = (v, defaultVal) => {
    if (v === undefined) return defaultVal;
    const s = String(v).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  };

  const computedSecure = smtpPort === 465;
  const secure = parseBool(smtpSecureEnv, computedSecure);
  const requireTLS = parseBool(requireTLSEnv, false);
  const rejectUnauthorized = parseBool(rejectUnauthorizedEnv, true);

  try {
    let transporter;
    let transportLabel = 'smtp';
    let mockEmail = false;
    const MOCK_EMAIL_BODY_LOG_LIMIT = 200;

    // Check for incomplete SMTP configuration
    const hasPartialCredentials = smtpUser || smtpPass;
    const hasBothCredentials = smtpUser && smtpPass;
    const hasHostOrService = smtpHost || smtpService;
    const missingRequiredConfig = !hasBothCredentials || !hasHostOrService;
    
    if (hasPartialCredentials && missingRequiredConfig) {
      console.error('❌ INCOMPLETE SMTP CONFIG: SMTP credentials are partially configured');
      if (!hasBothCredentials) {
        console.error('   Both SMTP_USER and SMTP_PASS must be set');
      }
      if (!hasHostOrService) {
        console.error('   Please set either SMTP_HOST (e.g., smtp.office365.com) or SMTP_SERVICE (e.g., gmail)');
      }
      return res.status(500).json({ 
        error: 'SMTP configuration incomplete', 
        details: 'SMTP_HOST or SMTP_SERVICE must be configured along with both SMTP_USER and SMTP_PASS. Check backend/.env.example for configuration examples.' 
      });
    }

    if (!hasHostOrService || !hasBothCredentials) {
      // Dev fallback: Try Ethereal, but use mock if unavailable
      console.log('⚠️ No SMTP configured - attempting Ethereal test email (dev mode)');
      try {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        transportLabel = 'ethereal';
      } catch (_etherealError) {
        console.warn('⚠️ Ethereal email unavailable (network restricted), using mock email service');
        // Create a mock transporter that logs emails instead of sending them
        mockEmail = true;
        transportLabel = 'mock';
      }
    } else {
      console.log(`✅ Using real SMTP: ${smtpService || smtpHost}`);
      const transportOptions = smtpHost
        ? { host: smtpHost, port: smtpPort, secure }
        : { service: smtpService };

      transporter = nodemailer.createTransport({
        ...transportOptions,
        auth: { user: smtpUser, pass: smtpPass },
        requireTLS,
        tls: { rejectUnauthorized },
      });
    }

    let info;
    let previewUrl;

    if (mockEmail) {
      // Mock email - just log it and return success
      const messageId = `mock-${Date.now()}@insuretrack.local`;
      console.log('📧 MOCK EMAIL (would be sent to):', to);
      console.log('📧 Subject:', subject);
      console.log('📧 Body:', (body || html || '').substring(0, MOCK_EMAIL_BODY_LOG_LIMIT) + '...');
      
      info = { messageId, accepted: [to], rejected: [] };
      previewUrl = null;
    } else {
      // Verify transport before sending to catch configuration issues early
      await transporter.verify();

      // Prepare attachments array for nodemailer
      const mailAttachments = [];
      if (Array.isArray(incomingAttachments) && incomingAttachments.length > 0) {
        for (const a of incomingAttachments) {
          // Expecting { filename, content, contentType } with content as base64 or text
          if (a && a.filename) {
            const att = { filename: a.filename };
            if (a.content && a.encoding === 'base64') {
              att.content = Buffer.from(a.content, 'base64');
            } else if (a.content && a.encoding === 'utf8') {
              att.content = Buffer.from(a.content, 'utf8');
            } else if (a.content) {
              att.content = a.content;
            }
            if (a.contentType) att.contentType = a.contentType;
            mailAttachments.push(att);
          }
        }
      }

      // Optionally generate and attach a sample COI PDF — only attach when recipient is a broker
      if (includeSampleCOI) {
        let shouldAttachSample = false;
        try {
          if (recipientIsBroker === true || String(recipientIsBroker).toLowerCase() === 'true') {
            shouldAttachSample = true;
          } else if (typeof to === 'string') {
            const brokerRecord = getBroker(to);
            if (brokerRecord) shouldAttachSample = true;
          }
        } catch (detErr) {
          console.warn('Could not determine broker status for sample COI attachment:', detErr?.message || detErr);
        }

        if (shouldAttachSample) {
          try {
            console.log('🔄 Generating sample COI PDF with data (broker detected):', Object.keys(sampleCOIData || {}));
            const pdfBuffer = await generateSampleCOIPDF(sampleCOIData || {});
            mailAttachments.push({ filename: 'sample_coi.pdf', content: pdfBuffer, contentType: 'application/pdf' });
            console.log('✅ Sample COI PDF generated and attached:', pdfBuffer.length, 'bytes');
          } catch (pdfErr) {
            console.error('❌ Could not generate sample COI PDF for broker:', pdfErr?.message || pdfErr);
          }
        } else {
          console.log('ℹ️ includeSampleCOI requested but recipient is not a broker — skipping sample attachment');
        }
      }

      // Optionally attach a Hold Harmless template if a URL is provided — include as PDF attachment
      if (holdHarmlessTemplateUrl) {
        try {
          console.log('🔗 Attaching Hold Harmless template from URL:', holdHarmlessTemplateUrl);
          const fetchRes = await fetch(holdHarmlessTemplateUrl);
          if (fetchRes.ok) {
            const arrayBuf = await fetchRes.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            mailAttachments.push({ filename: 'hold_harmless.pdf', content: buf, contentType: 'application/pdf' });
            console.log('✅ Hold Harmless attached, size:', buf.length);
          } else {
            console.warn('⚠️ Could not fetch hold harmless template, status:', fetchRes.status);
          }
        } catch (hhErr) {
          console.warn('❌ Failed to attach hold-harmless template:', hhErr?.message || hhErr);
        }
      }

      info = await transporter.sendMail({
        from: from || defaultFrom,
        to,
        cc,
        bcc,
        replyTo,
        subject,
        text: body || undefined,
        html: html || undefined,
        attachments: mailAttachments.length > 0 ? mailAttachments : undefined,
      });

      previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : undefined;
    }
    
    if (transportLabel === 'ethereal' && previewUrl) {
      console.log('📧 TEST EMAIL PREVIEW:', previewUrl);
      console.log('⚠️ This is a test email - view it at the URL above, it was NOT sent to a real inbox');
    } else if (transportLabel === 'mock') {
      console.log('✅ Mock email logged (not actually sent) - recipient:', to);
    } else {
      console.log('✅ Email sent successfully to:', to);
    }
    
    return res.json({ ok: true, messageId: info.messageId, transport: transportLabel, previewUrl, mock: mockEmail });
  } catch (err) {
    console.error('❌ SendEmail error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to send email', details: err?.message });
  }
});

// Verify email transport configuration without sending an email
app.get('/integrations/email-verify', authenticateToken, async (req, res) => {
  try {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpService = process.env.SMTP_SERVICE;
    const smtpSecureEnv = process.env.SMTP_SECURE;

    const parseBool = (v, d) => {
      if (v === undefined) return d;
      const s = String(v).toLowerCase();
      return s === 'true' || s === '1' || s === 'yes';
    };
    const secure = parseBool(smtpSecureEnv, smtpPort === 465);

    let transporter;
    let transportLabel = 'smtp';

    if ((!smtpHost && !smtpService) || !smtpUser || !smtpPass) {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      transportLabel = 'ethereal';
    } else {
      const transportOptions = smtpHost
        ? { host: smtpHost, port: smtpPort, secure }
        : { service: smtpService };
      transporter = nodemailer.createTransport({ ...transportOptions, auth: { user: smtpUser, pass: smtpPass } });
    }

    await transporter.verify();
    return res.json({ ok: true, transport: transportLabel });
  } catch (err) {
    console.error('Email verify error:', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

// ---------- Public (unauthenticated) broker endpoints for portals ----------
// Returns GeneratedCOI items for a broker by email or name
app.get('/public/broker-requests', (req, res) => {
  try {
    const { email, name } = req.query || {};
    if (!email && !name) {
      return res.status(400).json({ error: 'email or name is required' });
    }

    const lowerEmail = email ? String(email).toLowerCase().trim() : null;
    const lowerName = name ? String(name).toLowerCase().trim() : null;

    const cois = (entities.GeneratedCOI || []).filter(c => {
      // Prefer exact email matching; name becomes optional filter
      if (lowerEmail) {
        const emailMatch = (
          c.broker_email?.toLowerCase().trim() === lowerEmail ||
          c.broker_gl_email?.toLowerCase().trim() === lowerEmail ||
          c.broker_auto_email?.toLowerCase().trim() === lowerEmail ||
          c.broker_umbrella_email?.toLowerCase().trim() === lowerEmail ||
          c.broker_wc_email?.toLowerCase().trim() === lowerEmail
        );
        if (!emailMatch) return false;
        // If name provided, use it as a soft filter (contains match) but do not block results when names differ
        if (lowerName) {
          return (
            c.broker_name?.toLowerCase().includes(lowerName) ||
            c.broker_gl_name?.toLowerCase().includes(lowerName) ||
            c.broker_auto_name?.toLowerCase().includes(lowerName) ||
            c.broker_umbrella_name?.toLowerCase().includes(lowerName) ||
            c.broker_wc_name?.toLowerCase().includes(lowerName) ||
            true // allow when name mismatch to avoid missing requests
          );
        }
        return true;
      }
      
      // Fallback to name-only matching when email not provided
      if (lowerName) {
        return (
          c.broker_name?.toLowerCase().includes(lowerName) ||
          c.broker_gl_name?.toLowerCase().includes(lowerName) ||
          c.broker_auto_name?.toLowerCase().includes(lowerName) ||
          c.broker_umbrella_name?.toLowerCase().includes(lowerName) ||
          c.broker_wc_name?.toLowerCase().includes(lowerName)
        );
      }
      return false;
    });

    // Also include BrokerUploadRequest records for this broker (email match)
    const uploadRequests = (entities.BrokerUploadRequest || [])
      .filter(r => lowerEmail && (r.broker_email || '').toLowerCase().trim() === lowerEmail)
      .map(r => ({
        id: r.id,
        broker_email: r.broker_email,
        broker_name: r.broker_name,
        broker_company: r.broker_company,
        subcontractor_id: r.subcontractor_id,
        subcontractor_name: r.subcontractor_name,
        project_id: r.project_id,
        project_name: r.project_name,
        coi_token: r.upload_token, // align with broker-upload portal
        upload_token: r.upload_token,
        // Normalize status to portal-friendly values
        status: r.status === 'uploaded' ? 'awaiting_admin_review' : 'awaiting_broker_upload',
        created_date: r.sent_date || r.created_at || r.created_date,
      }));

    // Deduplicate: if a GeneratedCOI and BrokerUploadRequest have the same subcontractor_id and coi_token, 
    // prefer the GeneratedCOI (it's more complete) and exclude the BrokerUploadRequest
    const seenKeys = new Set();
    const dedupedList = [...cois, ...uploadRequests]
      .sort((a, b) => new Date(b.created_date || b.created_at || 0) - new Date(a.created_date || a.created_at || 0))
      .filter(item => {
        const key = `${item.subcontractor_id}-${item.coi_token}`;
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });

    return res.json(dedupedList);
  } catch (err) {
    console.error('Public broker-requests error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to load broker requests' });
  }
});

// Returns all projects (public read for portal context)
app.get('/public/projects', (req, res) => {
  try {
    return res.json(entities.Project || []);
  } catch (err) {
    console.error('Public projects error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to load projects' });
  }
});

// Returns broker-related messages by email (optional)
app.get('/public/messages', (req, res) => {
  try {
    const { email } = req.query || {};
    const lowerEmail = email ? String(email).toLowerCase() : null;
    let list = entities.Message || [];
    if (lowerEmail) {
      list = list.filter(m => (
        m.sender_email?.toLowerCase() === lowerEmail ||
        m.recipient_email?.toLowerCase() === lowerEmail
      ));
    }
    // newest first
    list = list.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    return res.json(list);
  } catch (err) {
    console.error('Public messages error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to load messages' });
  }
});

// Public: Lookup a GeneratedCOI by token (no auth required)
app.get('/public/coi-by-token', (req, res) => {
  try {
    const { token } = req.query || {};
    if (!token) return res.status(400).json({ error: 'token is required' });
    const coi = (entities.GeneratedCOI || []).find(c => timingSafeEqual(c.coi_token, String(token)));
    if (!coi) return res.status(404).json({ error: 'COI not found' });
    return res.json(coi);
  } catch (err) {
    console.error('Public coi-by-token error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to load COI' });
  }
});

// Public: Get Contractor by ID (for broker assignment portal)
app.get('/public/contractor/:id', (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ error: 'Contractor ID is required' });
    const contractor = (entities.Contractor || []).find(c => c.id === id);
    if (!contractor) {
      console.warn('⚠️ Contractor not found:', id);
      return res.status(404).json({ error: 'Contractor not found' });
    }
    console.log('✅ Retrieved contractor:', id);
    return res.json(contractor);
  } catch (err) {
    console.error('❌ Public contractor fetch error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to load contractor' });
  }
});

// Public: Update Contractor by ID (for broker assignment portal - limited updates only)
app.patch('/public/contractor/:id', publicApiLimiter, (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ error: 'Contractor ID is required' });
    
    const idx = (entities.Contractor || []).findIndex(c => c.id === id);
    if (idx === -1) {
      console.warn('⚠️ Contractor not found for update:', id);
      return res.status(404).json({ error: 'Contractor not found' });
    }

    const updates = req.body || {};
    
    // Only allow certain fields to be updated via public endpoint
    const allowedFields = [
      'broker_name',
      'broker_email',
      'broker_phone',
      'broker_company',
      'broker_type',
      'broker_gl_name',
      'broker_gl_email',
      'broker_gl_phone',
      'broker_auto_name',
      'broker_auto_email',
      'broker_auto_phone',
      'broker_umbrella_name',
      'broker_umbrella_email',
      'broker_umbrella_phone',
      'broker_wc_name',
      'broker_wc_email',
      'broker_wc_phone'
    ];

    const safeUpdates = {};
    for (const field of allowedFields) {
      if (field in updates) {
        safeUpdates[field] = updates[field];
      }
    }

    entities.Contractor[idx] = {
      ...entities.Contractor[idx],
      ...safeUpdates,
      updatedAt: new Date().toISOString(),
      updatedBy: 'public-portal'
    };

    console.log('✅ Updated contractor via public portal:', id, Object.keys(safeUpdates));
    debouncedSave();
    return res.json(entities.Contractor[idx]);
  } catch (err) {
    console.error('❌ Public contractor update error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to update contractor' });
  }
});

// Public: Contractor/Subcontractor login with password verification
app.post('/public/contractor-login', publicApiLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const contractor = (entities.Contractor || []).find(c => 
      (c.email?.toLowerCase() === email.toLowerCase()) && 
      (c.role === 'subcontractor' || c.contractor_type === 'subcontractor')
    );

    if (!contractor) {
      // Don't reveal if email exists to prevent user enumeration
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password using bcrypt
    if (!contractor.password) {
      console.warn('⚠️ Contractor missing password hash:', contractor.id);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, contractor.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Return contractor data (without password hash)
    const { password: _, ...contractorSafe } = contractor;
    
    console.log('✅ Contractor login successful:', contractor.id, contractor.email);
    
    return res.json({
      success: true,
      contractor: contractorSafe
    });
  } catch (err) {
    console.error('❌ Contractor login error:', err?.message || err);
    return res.status(500).json({ error: 'Authentication service error' });
  }
});

// Public: Create a new contractor (subcontractor) - for GC portal
app.post('/public/create-contractor', publicApiLimiter, (req, res) => {
  try {
    const { company_name, contact_person, email, contractor_type, trade_types, status } = req.body || {};
    
    if (!company_name || !email) {
      return res.status(400).json({ error: 'Company name and email are required' });
    }

    const normalizedEmail = (email || '').toLowerCase();
    
    // Check if contractor with this email already exists
    const existingContractor = (entities.Contractor || []).find(c => 
      c.email === normalizedEmail && 
      c.contractor_type === (contractor_type || 'subcontractor')
    );
    
    if (existingContractor) {
      console.log('✅ Contractor already exists:', existingContractor.id);
      // Return existing contractor WITHOUT generating a new password
      return res.json({
        ...existingContractor,
        contractor_password: null, // Signal that no new password was generated
        isExisting: true
      });
    }

    // Generate temporary password only for new contractors
    const tempPassword = generateTempPassword(12);
    const hashedPassword = bcrypt.hashSync(tempPassword, 10);

    const newContractor = {
      id: `Contractor-${Date.now()}`,
      company_name,
      contact_person: contact_person || company_name,
      email: normalizedEmail,
      contractor_type: contractor_type || 'subcontractor',
      trade_types: Array.isArray(trade_types) ? trade_types : [trade_types].filter(Boolean),
      status: status || 'active',
      password: hashedPassword,
      role: 'subcontractor',
      portal_login: true,
      created_date: new Date().toISOString(),
      created_by: 'gc-portal'
    };

    if (!entities.Contractor) entities.Contractor = [];
    entities.Contractor.push(newContractor);
    debouncedSave();
    
    console.log('✅ Created new contractor via GC portal:', newContractor.id);
    
    // Return contractor with generated password
    return res.json({
      ...newContractor,
      contractor_password: tempPassword,
      isNew: true
    });
  } catch (err) {
    console.error('❌ Public contractor create error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to create contractor' });
  }
});

// Public: Create ProjectSubcontractor - for GC portal
app.post('/public/create-project-subcontractor', publicApiLimiter, (req, res) => {
  try {
    const { project_id, subcontractor_id, subcontractor_name, trade_type, contact_email, gc_id } = req.body || {};
    
    if (!project_id || !subcontractor_id) {
      return res.status(400).json({ error: 'Project ID and Subcontractor ID are required' });
    }

    // Verify project belongs to this GC
    const project = (entities.Project || []).find(p => p.id === project_id);
    if (!project || (gc_id && project.gc_id !== gc_id)) {
      return res.status(403).json({ error: 'Unauthorized: Project does not belong to this GC' });
    }

    // Ensure Contractor record exists for this subcontractor
    let contractor = (entities.Contractor || []).find(c => c.id === subcontractor_id);
    let tempPassword = '';
    if (!contractor) {
      // Generate temporary password
      tempPassword = generateTempPassword(12);
      const hashedPassword = bcrypt.hashSync(tempPassword, 10);
      
      contractor = {
        id: subcontractor_id,
        company_name: subcontractor_name,
        contact_person: subcontractor_name,
        email: (contact_email || '').toLowerCase(),
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        password: hashedPassword,
        role: 'subcontractor',
        portal_login: true,
        created_date: new Date().toISOString(),
        created_by: 'gc-portal'
      };
      
      if (!entities.Contractor) entities.Contractor = [];
      entities.Contractor.push(contractor);
      debouncedSave();
      console.log('✅ Created Contractor for subcontractor via GC portal:', contractor.id);
    }

    const newProjectSub = {
      id: `ProjectSub-${Date.now()}`,
      project_id,
      project_name: project.project_name,
      gc_id: project.gc_id,
      subcontractor_id,
      subcontractor_name,
      trade_type,
      contact_email: (contact_email || '').toLowerCase(),
      status: 'active',
      compliance_status: 'pending_broker',
      created_date: new Date().toISOString(),
      created_by: 'gc-portal'
    };

    if (!entities.ProjectSubcontractor) entities.ProjectSubcontractor = [];
    entities.ProjectSubcontractor.push(newProjectSub);
    debouncedSave();
    
    console.log('✅ Created ProjectSubcontractor via GC portal:', newProjectSub.id);
    
    // Return with contractor credentials info
    const response = {
      ...newProjectSub,
      contractor_username: contractor.email || contractor.id
    };
    
    // Only include password if it was just generated
    if (tempPassword) {
      response.contractor_password = tempPassword;
    }
    
    return res.json(response);
  } catch (err) {
    console.error('❌ Public ProjectSubcontractor create error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to create project subcontractor' });
  }
});

// Public: Get All ProjectSubcontractors
app.get('/public/all-project-subcontractors', (req, res) => {
  try {
    return res.json(entities.ProjectSubcontractor || []);
  } catch (err) {
    console.error('Error fetching project subcontractors:', err);
    return res.status(500).json({ error: 'Failed to load project subcontractors' });
  }
});

// Public: Create Portal for subcontractor/broker/GC
app.post('/public/create-portal', publicApiLimiter, (req, res) => {
  try {
    const { user_type, user_id, user_email, user_name, dashboard_url, access_token } = req.body || {};
    
    if (!user_type || !user_id || !user_email) {
      return res.status(400).json({ error: 'user_type, user_id, and user_email are required' });
    }

    // Check if portal already exists
    const existing = (entities.Portal || []).find(p => p.user_id === user_id && p.user_type === user_type);
    if (existing) {
      console.log('✅ Portal already exists:', existing.id);
      return res.json(existing);
    }

    const newPortal = {
      id: `Portal-${Date.now()}`,
      user_type,
      user_id,
      user_email,
      user_name: user_name || user_email,
      dashboard_url: dashboard_url || `${process.env.FRONTEND_URL}/${user_type}-dashboard?id=${user_id}`,
      status: 'active',
      access_token: access_token || crypto.randomBytes(24).toString('hex'),
      created_date: new Date().toISOString(),
      created_by: 'public-portal'
    };

    if (!entities.Portal) entities.Portal = [];
    entities.Portal.push(newPortal);
    debouncedSave();
    
    console.log('✅ Created Portal:', newPortal.id, user_type, user_email);
    return res.json(newPortal);
  } catch (err) {
    console.error('❌ Public Portal create error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to create portal' });
  }
});

// Public: Create GeneratedCOI (certificate request)
app.post('/public/create-coi-request', publicApiLimiter, async (req, res) => {
  try {
    const { 
      project_id, project_name, gc_id, gc_name,
      subcontractor_id, subcontractor_name, trade_type,
      project_sub_id, broker_email, broker_name,
      contact_email, coi_token,
      certificate_holder, certificate_holder_address,
      additional_insureds, project_location
    } = req.body || {};
    
    if (!project_id || !subcontractor_id) {
      return res.status(400).json({ error: 'project_id and subcontractor_id are required' });
    }

    // Check if COI already exists for this project/sub combo
    // Allow multiple COI requests for the same project/subcontractor.
    // Compute sequence number of COIs for this combination.
    const priorCOIs = (entities.GeneratedCOI || []).filter(c => 
      c.project_id === project_id && c.subcontractor_id === subcontractor_id
    );
    const sequence = priorCOIs.length + 1;

    // Derive broker info; prefer stored broker on subcontractor over contact email
    const contractor = (entities.Contractor || []).find(c => c.id === subcontractor_id);
    const primaryBroker = contractor && Array.isArray(contractor.brokers) && contractor.brokers.length > 0
      ? contractor.brokers.find(b => b.email) || contractor.brokers[0]
      : null;
    const contactEmailNormalized = contact_email || undefined;
    let resolvedBrokerEmail = broker_email || primaryBroker?.email || contactEmailNormalized;
    let resolvedBrokerName = broker_name || primaryBroker?.name || primaryBroker?.company || undefined;

    // Fill certificate holder and additional insureds from Project if missing
    let holder = certificate_holder;
    let holderAddress = certificate_holder_address;
    let insureds = Array.isArray(additional_insureds) ? additional_insureds.slice() : [];
    try {
      const proj = (entities.Project || []).find(p => p.id === project_id);
      if (proj) {
        holder = holder || proj.gc_name || gc_name;
        const addrParts = [proj.gc_address, proj.gc_city, proj.gc_state, proj.gc_zip].filter(Boolean);
        holderAddress = holderAddress || (addrParts.length ? addrParts.join(', ') : undefined);
        if (proj.owner_entity && !insureds.includes(proj.owner_entity)) insureds.push(proj.owner_entity);
        if (Array.isArray(proj.additional_insured_entities)) {
          for (const ai of proj.additional_insured_entities) {
            if (!insureds.includes(ai)) insureds.push(ai);
          }
        }
      }
    } catch(_) {}

    const newCOI = {
      id: `COI-${Date.now()}`,
      project_id,
      project_name,
      gc_id,
      gc_name,
      subcontractor_id,
      subcontractor_name,
      trade_type,
      project_sub_id,
      status: 'awaiting_broker_upload',
      broker_email: resolvedBrokerEmail,
      broker_name: resolvedBrokerName,
      contact_email: contact_email || broker_email || resolvedBrokerEmail,
      created_date: new Date().toISOString(),
      first_coi_uploaded: false,
      first_coi_url: null,
      coi_token: coi_token || `coi-${Date.now()}-${crypto.randomBytes(12).toString('hex')}`,
      certificate_holder: holder,
      certificate_holder_address: holderAddress,
      additional_insureds: insureds,
      project_location,
      created_by: 'public-portal',
      sequence
    };

    if (!entities.GeneratedCOI) entities.GeneratedCOI = [];
    entities.GeneratedCOI.push(newCOI);
    debouncedSave();

    // Proactively notify broker if we have their email
    try {
      if (newCOI.broker_email) {
        const host = req.get('host') || '';
        const frontendHost = host.replace(/:3001$/, ':5175');
        const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${frontendHost}` || 'http://localhost:5175';
        const uploadLink = `${frontendUrl}/broker-upload-coi?token=${newCOI.coi_token}&action=upload&step=1`;
        const signLink = `${frontendUrl}/broker-upload-coi?token=${newCOI.coi_token}&action=sign&step=3`;
        const brokerDashboardLink = `${frontendUrl}/broker-dashboard?name=${encodeURIComponent(newCOI.broker_name || '')}&coiId=${newCOI.id}`;
        const internalUrl = `${req.protocol}://${req.get('host')}/public/send-email`;
        const ccRecipients = contactEmailNormalized && contactEmailNormalized !== newCOI.broker_email ? contactEmailNormalized : undefined;
        
        // Fetch program info and GC mailing address from project for sample COI
        let programName = undefined;
        let programId = undefined;
        let programHoldHarmlessUrl = null;
        let gcMailingAddress = undefined;
        try {
          const proj = (entities.Project || []).find(p => p.id === project_id);
          if (proj?.program_id) {
            programId = proj.program_id;
            const prog = (entities.InsuranceProgram || []).find(p => p.id === programId);
            programName = prog?.name || prog?.program_name || undefined;
            programHoldHarmlessUrl = prog?.hold_harmless_template_url || prog?.hold_harmless_template || null;
          }
          if (proj?.gc_id) {
            const gc = (entities.Contractor || []).find(c => c.id === proj.gc_id);
            if (gc) {
              const addrParts = [gc.mailing_address || gc.address, gc.mailing_city || gc.city, gc.mailing_state || gc.state, gc.mailing_zip_code || gc.zip_code].filter(Boolean);
              gcMailingAddress = addrParts.length ? addrParts.join(', ') : undefined;
            }
          }
        } catch (_) {}
        
        // Build Sample COI data with project details for template
        const sampleCOIData = {
          project_name,
          gc_name,
          gc_mailing_address: gcMailingAddress,
          projectAddress: project_location || `${req.body.project_location || 'Project Address'}`,
          trade: trade_type,
          program: programName,
          program_id: programId,
          additional_insureds: insureds || [],
          additional_insured_entities: insureds || [],
          hold_harmless_template_url: programHoldHarmlessUrl
        };
        
        await fetch(internalUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: newCOI.broker_email,
            cc: ccRecipients,
            includeSampleCOI: true,
            sampleCOIData,
            holdHarmlessTemplateUrl: programHoldHarmlessUrl || null,
            subject: `📋 Certificate Ready for Upload & Signature: ${subcontractor_name}`,
            body: `A Certificate of Insurance request has been created for your client. Please upload policies first, then sign the prefilled COI.\n\nCLIENT:\n• Company: ${subcontractor_name}\n\nPROJECT:\n• Project: ${project_name}\n• Location: ${sampleCOIData.projectAddress}\n• General Contractor: ${gc_name}\n\nSTATUS:\n• Trade(s): ${trade_type || 'N/A'}\n• Status: Awaiting Upload & Signature\n• Created: ${new Date().toLocaleDateString()}\n\n📤 Upload Required Documents (Step 1):\n${uploadLink}\n\n✍️ Review & Sign COI (Step 3):\n${signLink}\n\n📊 Broker Dashboard:\n${brokerDashboardLink}\n\nOnce you upload and approve, the certificate will be submitted to the General Contractor.\n\nBest regards,\nInsureTrack System`
          })
        });
      }
    } catch (notifyErr) {
      console.error('⚠️ Broker notification error (create-coi-request):', notifyErr?.message || notifyErr);
    }
    
    console.log('✅ Created COI request:', newCOI.id, subcontractor_name, 'sequence:', sequence);
    return res.json(newCOI);
  } catch (err) {
    console.error('❌ Public COI create error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to create COI request' });
  }
});

// Public: Get ProjectSubcontractors for a subcontractor
app.get('/public/project-subcontractors/:subId', (req, res) => {
  try {
    const { subId } = req.params;
    const projectSubs = (entities.ProjectSubcontractor || []).filter(ps => ps.subcontractor_id === subId);
    return res.json(projectSubs);
  } catch (err) {
    console.error('Error fetching project subcontractors:', err);
    return res.status(500).json({ error: 'Failed to load project subcontractors' });
  }
});

// Public: Get Projects for a subcontractor
app.get('/public/projects-for-sub/:subId', (req, res) => {
  try {
    const { subId } = req.params;
    const projectSubs = (entities.ProjectSubcontractor || []).filter(ps => ps.subcontractor_id === subId);
    const projectIds = projectSubs.map(ps => ps.project_id);
    const projects = (entities.Project || []).filter(p => projectIds.includes(p.id));
    return res.json(projects);
  } catch (err) {
    console.error('Error fetching projects for sub:', err);
    return res.status(500).json({ error: 'Failed to load projects' });
  }
});

// Public: Get COIs for a subcontractor
app.get('/public/cois-for-sub/:subId', (req, res) => {
  try {
    const { subId } = req.params;
    const cois = (entities.GeneratedCOI || []).filter(c => c.subcontractor_id === subId);
    return res.json(cois);
  } catch (err) {
    console.error('Error fetching COIs for sub:', err);
    return res.status(500).json({ error: 'Failed to load COIs' });
  }
});

// Public: Get all COIs (for GC dashboard status)
app.get('/public/all-cois', (req, res) => {
  try {
    const cois = entities.GeneratedCOI || [];
    return res.json(cois);
  } catch (err) {
    console.error('Error fetching all COIs:', err);
    return res.status(500).json({ error: 'Failed to load COIs' });
  }
});

// Public: Update all COI records for a contractor (for broker assignment propagation)
app.post('/public/update-cois-for-contractor', publicApiLimiter, (req, res) => {
  try {
    const { contractorId, updates } = req.body || {};
    if (!contractorId) return res.status(400).json({ error: 'contractorId is required' });
    if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'updates object is required' });
    
    // Find contractor to get company name
    const contractor = (entities.Contractor || []).find(c => c.id === contractorId);
    if (!contractor) {
      console.warn('⚠️ Contractor not found for COI update:', contractorId);
      return res.status(404).json({ error: 'Contractor not found' });
    }
    
    // Find all COIs for this contractor
    const subCOIs = (entities.GeneratedCOI || []).filter(c => 
      c.subcontractor_name === contractor.company_name ||
      c.subcontractor_id === contractorId
    );
    
    // Only allow broker-related field updates
    const allowedFields = [
      'broker_name',
      'broker_email',
      'broker_phone',
      'broker_company',
      'broker_type',
      'broker_gl_name',
      'broker_gl_email',
      'broker_gl_phone',
      'broker_auto_name',
      'broker_auto_email',
      'broker_auto_phone',
      'broker_umbrella_name',
      'broker_umbrella_email',
      'broker_umbrella_phone',
      'broker_wc_name',
      'broker_wc_email',
      'broker_wc_phone'
    ];
    
    const safeUpdates = {};
    for (const field of allowedFields) {
      if (field in updates) {
        safeUpdates[field] = updates[field];
      }
    }
    
    // Update all matching COIs
    let updatedCount = 0;
    for (const coi of subCOIs) {
      const idx = entities.GeneratedCOI.findIndex(c => c.id === coi.id);
      if (idx !== -1) {
        entities.GeneratedCOI[idx] = {
          ...entities.GeneratedCOI[idx],
          ...safeUpdates,
          updatedAt: new Date().toISOString(),
          updatedBy: 'public-portal'
        };
        updatedCount++;
      }
    }
    
    console.log(`✅ Updated ${updatedCount} COI records with broker info for contractor:`, contractorId);
    debouncedSave();
    return res.json({ success: true, count: updatedCount });
  } catch (err) {
    console.error('❌ Public COI update error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to update COI records' });
  }
});

// Public: Update a GeneratedCOI by token (limited use for broker upload portal)
app.patch('/public/coi-by-token', publicApiLimiter, (req, res) => {
  try {
    const { token } = req.query || {};
    if (!token) return res.status(400).json({ error: 'token is required' });
    const idx = (entities.GeneratedCOI || []).findIndex(c => timingSafeEqual(c.coi_token, String(token)));
    if (idx === -1) return res.status(404).json({ error: 'COI not found' });

    const updates = req.body || {};
    // Apply updates and track timestamp
    entities.GeneratedCOI[idx] = {
      ...entities.GeneratedCOI[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: 'public-portal'
    };

    // If this update represents an admin approval (COI activated), ensure a Hold Harmless
    // document exists for the COI. If the COI doesn't already have a hold_harmless_template_url
    // and the related program defines a template, generate a populated Hold Harmless file
    // including project and subcontractor info and persist it to uploads.
    try {
      const applied = entities.GeneratedCOI[idx];
      const becameActive = (updates.status === 'active') || (updates.admin_approved === true);
      if (becameActive) {
        // Only generate if no template URL present
        if (!applied.hold_harmless_template_url) {
          // Try to locate program-level template
          const proj = (entities.Project || []).find(p => p.id === applied.project_id || p.project_name === applied.project_name);
          const program = proj && proj.program_id ? (entities.InsuranceProgram || []).find(p => p.id === proj.program_id) : null;
          const templateUrl = program?.hold_harmless_template_url || program?.hold_harmless_template || null;
          if (templateUrl) {
            try {
              // Fetch template (could be HTML with placeholders like {{project_name}})
              const fetchRes = await fetch(templateUrl);
              if (fetchRes.ok) {
                let templateText = await fetchRes.text();
                // Replace common placeholders with COI/project/subcontractor values
                const projectName = proj?.project_name || applied.project_name || '';
                const projectAddress = proj?.project_address || proj?.address || applied.project_address || '';
                const gcName = proj?.gc_name || applied.gc_name || '';
                const subName = applied.subcontractor_name || '';
                const trade = applied.trade_type || '';
                templateText = templateText.replace(/{{\s*project_name\s*}}/gi, projectName)
                  .replace(/{{\s*project_address\s*}}/gi, projectAddress)
                  .replace(/{{\s*gc_name\s*}}/gi, gcName)
                  .replace(/{{\s*subcontractor_name\s*}}/gi, subName)
                  .replace(/{{\s*trade\s*}}/gi, trade)
                  .replace(/{{\s*date\s*}}/gi, new Date().toLocaleDateString());

                // Persist as an HTML file in uploads
                const filename = `hold-harmless-${applied.id}-${Date.now()}.html`;
                const filepath = path.join(UPLOADS_DIR, filename);
                fs.writeFileSync(filepath, templateText, 'utf8');
                const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;

                entities.GeneratedCOI[idx] = {
                  ...entities.GeneratedCOI[idx],
                  hold_harmless_template_url: fileUrl,
                  hold_harmless_template_filename: filename,
                  hold_harmless_generated_at: new Date().toISOString()
                };
                console.log('✅ Generated Hold Harmless from program template for COI:', applied.id, fileUrl);
              } else {
                console.warn('Could not fetch program hold-harmless template, status:', fetchRes.status);
              }
            } catch (genErr) {
              console.warn('Failed to generate Hold Harmless from template:', genErr?.message || genErr);
            }
          }
        }
      }
    } catch (hhErr) {
      console.warn('Error during hold-harmless generation on COI update:', hhErr?.message || hhErr);
    }

    debouncedSave();
    return res.json(entities.GeneratedCOI[idx]);
  } catch (err) {
    console.error('Public coi-by-token update error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to update COI' });
  }
});

app.post('/integrations/upload-file', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded');
    }

    // Validate file exists and is readable
    if (!fs.existsSync(req.file.path)) {
      return sendError(res, 500, 'File storage error: file not persisted');
    }

    // Generate the full URL to access the file
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    
    console.log('✅ File uploaded successfully (authenticated):', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: fileUrl
    });

    res.json({
      success: true,
      url: fileUrl,
      file_url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('❌ File upload error (authenticated):', error);
    return sendError(res, 500, 'File upload failed', { error: error.message });
  }
});

// Public: File upload for broker portal (no auth required) with validation
app.post('/public/upload-file', uploadLimiter, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded');
    }

    // Validate file exists and is readable
    if (!fs.existsSync(req.file.path)) {
      return sendError(res, 500, 'File storage error: file not persisted');
    }

    // Generate the full URL to access the file
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    
    console.log('✅ File uploaded successfully:', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: fileUrl
    });

    res.json({
      success: true,
      url: fileUrl,
      file_url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('❌ File upload error:', error);
    return sendError(res, 500, 'File upload failed', { error: error.message });
  }
});

// Public: Upload ACORD COI, extract fields, update COI record, and notify admins
app.post('/public/upload-coi', uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    const { coi_token } = req.query || req.body || {};
    if (!req.file) return sendError(res, 400, 'No file uploaded');
    if (!coi_token) return sendError(res, 400, 'coi_token is required');

    // Build file URL
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    console.log('✅ COI uploaded:', { filename: req.file.filename, url: fileUrl, coi_token });

    // Extract COI fields using existing performExtraction helper (regex/AI)
    const schema = {
      named_insured: 'string',
      insurance_carrier_gl: 'string',
      policy_number_gl: 'string',
      gl_each_occurrence: 'number',
      gl_general_aggregate: 'number',
      gl_products_completed_ops: 'number',
      gl_personal_adv_injury: 'number',
      gl_damage_rented_premises: 'number',
      gl_med_exp: 'number',
      gl_effective_date: 'Date',
      gl_expiration_date: 'Date',
      gl_additional_insured: 'boolean',
      gl_waiver_of_subrogation: 'boolean',
      insurance_carrier_umbrella: 'string',
      policy_number_umbrella: 'string',
      umbrella_each_occurrence: 'number',
      umbrella_aggregate: 'number',
      umbrella_effective_date: 'Date',
      umbrella_expiration_date: 'Date',
      insurance_carrier_wc: 'string',
      policy_number_wc: 'string',
      wc_each_accident: 'number',
      wc_disease_policy_limit: 'number',
      wc_disease_each_employee: 'number',
      wc_effective_date: 'Date',
      wc_expiration_date: 'Date',
      insurance_carrier_auto: 'string',
      policy_number_auto: 'string',
      auto_combined_single_limit: 'number',
      auto_effective_date: 'Date',
      auto_expiration_date: 'Date'
    };

    let extractionResult = { status: 'success', output: {} };
    try {
      extractionResult = await performExtraction({ file_url: fileUrl, json_schema: schema });
    } catch (exErr) {
      console.warn('COI extraction failed, continuing with minimal metadata:', exErr?.message || exErr);
    }

    // Find COI by token
    const coiIdx = (entities.GeneratedCOI || []).findIndex(c => timingSafeEqual(c.coi_token, String(coi_token)));
    if (coiIdx === -1) return sendError(res, 404, 'COI not found for token');
    const coi = entities.GeneratedCOI[coiIdx];

    // Get project and program requirements for dynamic comparison
    const project = (entities.Project || []).find(p => p.id === coi.project_id);
    const programId = project?.program_id || null;
    const programRequirements = programId 
      ? (entities.SubInsuranceRequirement || []).filter(r => r.program_id === programId)
      : [];

    // Minimal rule-based compliance check
    const d = extractionResult.output || {};
    const deficiencies = [];
    let defCounter = 1;
    const pushDef = (severity, field, title, description, currentValue, requiredValue) => {
      deficiencies.push({
        id: `def-${coi.id}-${defCounter++}`,
        severity,
        category: 'coverage',
        field,
        title,
        description,
        required_action: `Adjust ${field} to ${requiredValue}`,
        current_value: currentValue,
        required_value: requiredValue
      });
    };

    // Get requirements for this subcontractor's trade from the program
    const tradeReqs = coi.trade_type 
      ? programRequirements.filter(r => 
          r.applicable_trades && Array.isArray(r.applicable_trades) && 
          r.applicable_trades.includes(coi.trade_type)
        )
      : programRequirements;

    // Determine the highest tier requirement (if multiple tiers apply)
    const tierPriority = { 'a': 4, 'b': 3, 'c': 2, 'd': 1, 'standard': 0 };
    let highestTier = null;
    let highestPriority = -1;
    for (const req of tradeReqs) {
      const priority = tierPriority[String(req.tier || '').toLowerCase()] || 0;
      if (priority > highestPriority) {
        highestPriority = priority;
        highestTier = req.tier;
      }
    }

    // Get all requirements for the highest tier
    const tierRequirements = highestTier 
      ? tradeReqs.filter(r => String(r.tier) === String(highestTier))
      : tradeReqs;

    // Validate GL coverage against program requirements
    const glReq = tierRequirements.find(r => r.insurance_type === 'general_liability');
    if (glReq) {
      if (glReq.gl_general_aggregate && d.gl_general_aggregate && d.gl_general_aggregate < glReq.gl_general_aggregate) {
        pushDef('high', 'gl_general_aggregate', 'GL Aggregate Below Program Minimum', 
          `GL Aggregate is $${d.gl_general_aggregate.toLocaleString()}, requires ≥ $${glReq.gl_general_aggregate.toLocaleString()} (Program Tier ${highestTier})`, 
          d.gl_general_aggregate, glReq.gl_general_aggregate);
      }
      if (glReq.gl_each_occurrence && d.gl_each_occurrence && d.gl_each_occurrence < glReq.gl_each_occurrence) {
        pushDef('high', 'gl_each_occurrence', 'GL Per Occurrence Below Program Minimum', 
          `GL Each Occurrence is $${d.gl_each_occurrence.toLocaleString()}, requires ≥ $${glReq.gl_each_occurrence.toLocaleString()} (Program Tier ${highestTier})`, 
          d.gl_each_occurrence, glReq.gl_each_occurrence);
      }
      if (glReq.gl_products_completed_ops && d.gl_products_completed_ops && d.gl_products_completed_ops < glReq.gl_products_completed_ops) {
        pushDef('medium', 'gl_products_completed_ops', 'GL Products/Completed Ops Below Program Minimum', 
          `GL Products/Completed Ops is $${d.gl_products_completed_ops.toLocaleString()}, requires ≥ $${glReq.gl_products_completed_ops.toLocaleString()}`, 
          d.gl_products_completed_ops, glReq.gl_products_completed_ops);
      }
    }

    // Validate Auto coverage against program requirements
    const autoReq = tierRequirements.find(r => r.insurance_type === 'auto_liability');
    if (autoReq) {
      if (autoReq.auto_combined_single_limit && d.auto_combined_single_limit && d.auto_combined_single_limit < autoReq.auto_combined_single_limit) {
        pushDef('medium', 'auto_combined_single_limit', 'Auto CSL Below Program Minimum', 
          `Auto Combined Single Limit is $${d.auto_combined_single_limit.toLocaleString()}, requires ≥ $${autoReq.auto_combined_single_limit.toLocaleString()}`, 
          d.auto_combined_single_limit, autoReq.auto_combined_single_limit);
      }
    }

    // Validate WC coverage against program requirements
    const wcReq = tierRequirements.find(r => r.insurance_type === 'workers_compensation');
    if (wcReq) {
      if (wcReq.wc_each_accident && d.wc_each_accident && d.wc_each_accident < wcReq.wc_each_accident) {
        pushDef('medium', 'wc_each_accident', 'WC Each Accident Below Program Minimum', 
          `WC Each Accident is $${d.wc_each_accident.toLocaleString()}, requires ≥ $${wcReq.wc_each_accident.toLocaleString()}`, 
          d.wc_each_accident, wcReq.wc_each_accident);
      }
    }

    // Validate Umbrella coverage against program requirements
    const umbReq = tierRequirements.find(r => r.insurance_type === 'umbrella_policy');
    if (umbReq) {
      if (umbReq.umbrella_each_occurrence && d.umbrella_each_occurrence && d.umbrella_each_occurrence < umbReq.umbrella_each_occurrence) {
        pushDef('medium', 'umbrella_each_occurrence', 'Umbrella Each Occurrence Below Program Minimum', 
          `Umbrella Each Occurrence is $${d.umbrella_each_occurrence.toLocaleString()}, requires ≥ $${umbReq.umbrella_each_occurrence.toLocaleString()}`, 
          d.umbrella_each_occurrence, umbReq.umbrella_each_occurrence);
      }
    }

    // Check for required endorsements based on program
    if (glReq && d.gl_additional_insured === false) {
      deficiencies.push({
        id: `def-${coi.id}-${defCounter++}`,
        severity: 'high',
        category: 'additional_insured',
        field: 'gl_additional_insured',
        title: 'Additional Insured Not Confirmed',
        description: 'Program requires Additional Insured endorsement on GL but certificate does not confirm it',
        required_action: 'Add Additional Insured endorsement naming the GC',
        current_value: false,
        required_value: true
      });
    }
    if (glReq && d.gl_waiver_of_subrogation === false) {
      deficiencies.push({
        id: `def-${coi.id}-${defCounter++}`,
        severity: 'medium',
        category: 'waiver',
        field: 'gl_waiver_of_subrogation',
        title: 'Waiver of Subrogation Not Confirmed',
        description: 'Program requires Waiver of Subrogation but certificate does not confirm it',
        required_action: 'Add Waiver of Subrogation in favor of the GC',
        current_value: false,
        required_value: true
      });
    }

    const policyAnalysis = {
      coi_id: coi.id,
      analyzed_at: new Date().toISOString(),
      total_deficiencies: deficiencies.length,
      critical_count: deficiencies.filter(d => d.severity === 'critical').length,
      high_count: deficiencies.filter(d => d.severity === 'high').length,
      medium_count: deficiencies.filter(d => d.severity === 'medium').length,
      status: deficiencies.length === 0 ? 'approved' : 'deficient',
      deficiencies,
      analysis_method: 'rules_minimums'
    };

    // Enhance extracted data with form selections and checkbox states
    // These will be preserved when regenerating the COI for new jobs
    const enhancedCOIData = {
      ...d,
      // Preserve form type selections for GL
      gl_form_type: d.gl_form_type || 'OCCUR',
      gl_basis: d.gl_basis || 'PER OCCURRENCE',
      
      // Preserve form type for Auto
      auto_form_type: d.auto_form_type || 'ANY AUTO',
      
      // Preserve form type for WC
      wc_form_type: d.wc_form_type || 'STATUTORY LIMITS',
      
      // Preserve form type for Umbrella
      umbrella_form_type: d.umbrella_form_type || 'OCCUR',
      
      // Store original broker info for regeneration
      broker_name: d.broker_name || coi.broker_name || '',
      broker_email: d.broker_email || coi.broker_email || '',
      broker_phone: d.broker_phone || coi.broker_phone || '',
      broker_address: d.broker_address || coi.broker_address || '',
      broker_contact: d.broker_contact || '',
      
      // Store original description of operations
      description_of_operations: d.description_of_operations || '',
      
      // Store original certificate holder if provided
      certificate_holder_name: d.certificate_holder_name || '',
      
      // Store additional insureds for regeneration
      additional_insureds: Array.isArray(d.additional_insureds) ? d.additional_insureds : [],
      
      // Will be used to store manually entered policies
      manually_entered_policies: [],
      manually_entered_additional_insureds: []
    };

    // Update COI record with enhanced data for regeneration
    entities.GeneratedCOI[coiIdx] = {
      ...coi,
      first_coi_url: fileUrl,
      first_coi_uploaded: true,
      first_coi_upload_date: new Date().toISOString(),
      status: 'awaiting_admin_review',
      uploaded_for_review_date: new Date().toISOString(),
      ...enhancedCOIData,
      policy_analysis: policyAnalysis
    };

    // Create InsuranceDocument record for admin portal
    const insuranceDoc = {
      id: `doc-${Date.now()}`,
      document_type: 'COI',
      insurance_type: 'general_liability',
      file_url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      subcontractor_name: coi.subcontractor_name,
      subcontractor_id: coi.subcontractor_id,
      project_id: coi.project_id,
      project_name: coi.project_name,
      approval_status: 'pending',
      status: 'pending_review',
      extracted: d,
      created_date: new Date().toISOString()
    };
    if (!entities.InsuranceDocument) entities.InsuranceDocument = [];
    entities.InsuranceDocument.push(insuranceDoc);

    // Notify admins via email (best-effort)
    const adminEmails = DEFAULT_ADMIN_EMAILS.length > 0 ? DEFAULT_ADMIN_EMAILS : [];
    for (const adminEmail of adminEmails) {
      try {
        const emailPayload = {
          to: adminEmail,
          subject: `🔍 COI Uploaded - ${coi.subcontractor_name}`,
          body: `A Certificate of Insurance has been uploaded and is ready for review.\n\nSubcontractor: ${coi.subcontractor_name}\nProject: ${coi.project_name}\nTrade: ${coi.trade_type || 'N/A'}\n\nCOI URL: ${fileUrl}\n\nStatus: Awaiting Admin Review\n\nBest regards,\nInsureTrack System`
        };
        // Use internal public email endpoint
        const internalUrl = `${req.protocol}://${req.get('host')}/public/send-email`;
        await fetch(internalUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailPayload)
        }).catch(() => {});
      } catch (emailErr) {
        console.warn('Could not send admin email:', emailErr?.message || emailErr);
      }
    }

    debouncedSave();
    return res.json({ ok: true, coi: entities.GeneratedCOI[coiIdx], document: insuranceDoc });
  } catch (error) {
    console.error('public upload-coi error:', error?.message || error);
    return sendError(res, 500, 'COI upload failed', { error: error.message });
  }
});

// Public: Regenerate COI for a new job using stored data with updated job fields
app.post('/public/regenerate-coi', uploadLimiter, async (req, res) => {
  try {
    const { coi_token, certificate_holder_name, project_address, project_name, additional_insureds } = req.body || {};
    
    if (!coi_token) return sendError(res, 400, 'coi_token is required');
    
    // Find the COI record
    const coiIdx = (entities.GeneratedCOI || []).findIndex(c => timingSafeEqual(c.coi_token, String(coi_token)));
    if (coiIdx === -1) return sendError(res, 404, 'COI not found for token');
    
    const coi = entities.GeneratedCOI[coiIdx];
    // If program-level hold-harmless exists on the related project, ensure COI has it
    try {
      if (!coi.hold_harmless_template_url) {
        const proj = (entities.Project || []).find(p => p.id === coi.project_id || p.project_name === coi.project_name);
        if (proj && proj.program_id) {
          const prog = (entities.InsuranceProgram || []).find(p => p.id === proj.program_id);
          if (prog && (prog.hold_harmless_template_url || prog.hold_harmless_template)) {
            coi.hold_harmless_template_url = prog.hold_harmless_template_url || prog.hold_harmless_template;
          }
        }
      }
    } catch (hhErr) {
      console.warn('Could not populate COI hold_harmless_template_url from program:', hhErr?.message || hhErr);
    }
    
    // Verify we have original COI data to work with
    if (!coi.first_coi_uploaded) {
      return sendError(res, 400, 'Original COI must be uploaded before regeneration');
    }
    
    // Build regeneration data using original stored data but with updated job fields
    const regenData = {
      // Original policy data (preserved from upload)
      broker_name: coi.broker_name || '',
      broker_email: coi.broker_email || '',
      broker_phone: coi.broker_phone || '',
      broker_address: coi.broker_address || '',
      broker_contact: coi.broker_contact || '',
      
      subcontractor_name: coi.subcontractor_name || '',
      subcontractor_address: coi.subcontractor_address || '',
      named_insured: coi.named_insured || coi.subcontractor_name || '',
      
      // All original policy data
      insurance_carrier_gl: coi.insurance_carrier_gl || '',
      policy_number_gl: coi.policy_number_gl || '',
      gl_each_occurrence: coi.gl_each_occurrence,
      gl_general_aggregate: coi.gl_general_aggregate,
      gl_products_completed_ops: coi.gl_products_completed_ops,
      gl_effective_date: coi.gl_effective_date,
      gl_expiration_date: coi.gl_expiration_date,
      gl_form_type: coi.gl_form_type || 'OCCUR',
      gl_basis: coi.gl_basis || 'PER OCCURRENCE',
      
      // Auto coverage if present
      insurance_carrier_auto: coi.insurance_carrier_auto || '',
      policy_number_auto: coi.policy_number_auto || '',
      auto_combined_single_limit: coi.auto_combined_single_limit,
      auto_effective_date: coi.auto_effective_date,
      auto_expiration_date: coi.auto_expiration_date,
      auto_form_type: coi.auto_form_type || 'ANY AUTO',
      
      // WC coverage
      insurance_carrier_wc: coi.insurance_carrier_wc || '',
      policy_number_wc: coi.policy_number_wc || '',
      wc_each_accident: coi.wc_each_accident,
      wc_disease_each_employee: coi.wc_disease_each_employee,
      wc_effective_date: coi.wc_effective_date,
      wc_expiration_date: coi.wc_expiration_date,
      wc_form_type: coi.wc_form_type || 'STATUTORY LIMITS',
      
      // Umbrella coverage if present
      insurance_carrier_umbrella: coi.insurance_carrier_umbrella || '',
      policy_number_umbrella: coi.policy_number_umbrella || '',
      umbrella_each_occurrence: coi.umbrella_each_occurrence,
      umbrella_aggregate: coi.umbrella_aggregate,
      umbrella_effective_date: coi.umbrella_effective_date,
      umbrella_expiration_date: coi.umbrella_expiration_date,
      umbrella_form_type: coi.umbrella_form_type || 'OCCUR',
      
      // Original description and additional insureds
      description_of_operations: coi.description_of_operations || '',
      additional_insureds: coi.additional_insureds || [],
      
      // UPDATED FIELDS for new job
      updated_project_address: project_address || '',
      updated_project_name: project_name || '',
      certificate_holder_name: certificate_holder_name || coi.certificate_holder_name || coi.gc_name || '',
      manually_entered_additional_insureds: Array.isArray(additional_insureds) ? additional_insureds : []
    };
    
    // Generate new PDF with updated job fields
    try {
      const pdfBuffer = await generateGeneratedCOIPDF(regenData);
      const filename = `gen-coi-${coi.id}-${Date.now()}.pdf`;
      const filepath = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(filepath, pdfBuffer);
      
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
      
      // Update COI record with regenerated PDF and updated job info
      const brokerSignLink = `${req.protocol}://${req.get('host').replace(/:3001$/, ':5175')}/broker-upload-coi?token=${coi.coi_token}&action=sign&step=3`;

      entities.GeneratedCOI[coiIdx] = {
        ...coi,
        regenerated_coi_url: fileUrl,
        regenerated_coi_filename: filename,
        regenerated_at: new Date().toISOString(),

        // Update job-specific fields
        certificate_holder_name: certificate_holder_name || coi.certificate_holder_name || coi.gc_name || '',
        updated_project_address: project_address || coi.project_address || '',
        updated_project_name: project_name || coi.project_name || '',

        // Add manually entered additional insureds to list
        additional_insureds: regenData.additional_insureds,
        manually_entered_additional_insureds: regenData.manually_entered_additional_insureds || [],

        // Mark as awaiting broker signature and provide sign link for online signing
        status: 'pending_broker_signature',
        broker_sign_url: brokerSignLink
      };
      
      debouncedSave();
      
      console.log('✅ COI regenerated successfully:', { coi_token, filename, url: fileUrl });
      
      return res.json({
        ok: true,
        regenerated_coi_url: fileUrl,
        filename: filename,
        coi: entities.GeneratedCOI[coiIdx]
      });
      
    } catch (pdfErr) {
      console.error('Failed to generate regenerated COI PDF:', pdfErr?.message || pdfErr);
      return sendError(res, 500, 'Failed to regenerate COI PDF', { error: pdfErr.message });
    }
    
  } catch (error) {
    console.error('public regenerate-coi error:', error?.message || error);
    return sendError(res, 500, 'COI regeneration failed', { error: error.message });
  }
});

// Public: Upload endorsement and optionally regenerate COI
app.post('/public/upload-endorsement', uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    const { coi_token } = req.query || req.body || {};
    const regenFlag = String((req.query && req.query.regen_coi) || (req.body && req.body.regen_coi) || '').toLowerCase() === 'true' || (req.query && req.query.regen_coi === '1');

    if (!req.file) return sendError(res, 400, 'No file uploaded');
    if (!coi_token) return sendError(res, 400, 'coi_token is required');

    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    console.log('✅ Endorsement uploaded:', { filename: req.file.filename, url: fileUrl });

    // Extract endorsement fields using existing performExtraction helper
    const schema = {
      endorsement_code: 'string',
      endorsement_name: 'string',
      effective_date: 'Date',
      expiration_date: 'Date',
      endorsement_text: 'string'
    };

    let extractionResult = { status: 'success', output: {} };
    try {
      extractionResult = await performExtraction({ file_url: fileUrl, json_schema: schema });
    } catch (exErr) {
      console.warn('Endorsement extraction failed, continuing with minimal metadata:', exErr?.message || exErr);
    }

    // Find COI by token and attach endorsement metadata
    const coi = (entities.GeneratedCOI || []).find(c => c.coi_token === coi_token);
    if (!coi) {
      console.warn('No GeneratedCOI found for token:', coi_token);
    }

    const endorsementRecord = {
      id: `endorsement-${Date.now()}`,
      file_url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      extracted: extractionResult.output || {},
      extraction_meta: { method: extractionResult.extraction_method || 'ai_or_regex', info: extractionResult.message || '' },
      uploaded_at: new Date().toISOString()
    };

    if (coi) {
      coi.gl_endorsements = coi.gl_endorsements || [];
      coi.gl_endorsements.push(endorsementRecord);

      // Compare endorsement and exclusions against program & project info
      try {
        const project = (entities.Project || []).find(p => p.id === coi.project_id);
        const programId = project?.program_id || null;
        const requirements = (entities.SubInsuranceRequirement || []).filter(r => r.program_id === programId);
        const text = (endorsementRecord.extracted?.endorsement_text || '').toLowerCase();

        const updatedDeficiencies = Array.isArray(coi.policy_analysis?.deficiencies) ? [...coi.policy_analysis.deficiencies] : [];
        let defCounter = updatedDeficiencies.length + 1;
        const pushDef = (severity, category, field, title, description) => {
          updatedDeficiencies.push({
            id: `def-${coi.id}-${Date.now()}-${defCounter++}`,
            severity,
            category,
            field,
            title,
            description,
            required_action: 'Provide compliant endorsement or remove conflicting exclusion'
          });
        };

        // Required endorsements based on program requirements
        const requiresUmbrella = requirements.some(r => r.insurance_type === 'umbrella_policy');
        const requiresGL = requirements.some(r => r.insurance_type === 'general_liability');
        const requiresAuto = requirements.some(r => r.insurance_type === 'auto_liability');
        const requiresWC = requirements.some(r => r.insurance_type === 'workers_compensation');

        const hasAI = /additional\s+insured/i.test(endorsementRecord.extracted?.endorsement_name || '') || /additional\s+insured/i.test(text);
        const hasWaiver = /waiver\s+of\s+subrogation/i.test(endorsementRecord.extracted?.endorsement_name || '') || /waiver\s+of\s+subrogation/i.test(text);
        const hasPNC = /primary\s+and\s+non\s*-?\s*contributory/i.test(text);

        if (requiresGL && !hasAI) {
          pushDef('high', 'endorsement', 'gl_additional_insured', 'Additional Insured Endorsement Missing', 'Program requires Additional Insured endorsement on GL but endorsement text/name does not confirm it');
        }
        if (requiresGL && !hasWaiver) {
          pushDef('medium', 'endorsement', 'gl_waiver_of_subrogation', 'Waiver of Subrogation Missing', 'Program requires Waiver of Subrogation on GL but endorsement text does not confirm it');
        }
        if (requiresGL && !hasPNC) {
          pushDef('medium', 'endorsement', 'primary_non_contributory', 'Primary & Non-Contributory Not Confirmed', 'GL endorsement should confirm Primary & Non-Contributory status');
        }

        // Exclusions conflicting with project info
        const isResidential = (project?.project_type || '').toLowerCase().includes('residential');
        if (isResidential && /residential\s+exclusion|habitational\s+exclusion/i.test(text)) {
          pushDef('critical', 'exclusion', 'residential_exclusion', 'Residential/Habitational Exclusion Present', 'Endorsement indicates Residential/Habitational exclusion which conflicts with project type');
        }
        const isNY = (project?.state || '').toUpperCase() === 'NY';
        if (isNY && /labor\s+law/i.test(text) && /exclusion/i.test(text)) {
          pushDef('high', 'exclusion', 'ny_labor_law', 'NY Labor Law Exclusion Present', 'Endorsement references Labor Law exclusion which may conflict with NY project requirements');
        }

        // Umbrella required but endorsement reduces limits below program
        const umbReq = requirements.find(r => r.insurance_type === 'umbrella_policy' && r.umbrella_each_occurrence);
        const umbLimitProgram = umbReq?.umbrella_each_occurrence || null;
        if (requiresUmbrella && umbLimitProgram && coi.umbrella_each_occurrence && coi.umbrella_each_occurrence < umbLimitProgram) {
          pushDef('high', 'coverage', 'umbrella_each_occurrence', 'Umbrella Limit Below Program Minimum', `Umbrella Each Occurrence is $${(coi.umbrella_each_occurrence || 0).toLocaleString()}, requires ≥ $${umbLimitProgram.toLocaleString()}`);
        }

        // Persist analysis on COI and mark for admin review
        coi.policy_analysis = {
          ...(coi.policy_analysis || {}),
          analyzed_at: new Date().toISOString(),
          analysis_method: 'program_project_comparison',
          total_deficiencies: updatedDeficiencies.length,
          deficiencies: updatedDeficiencies
        };
        coi.status = 'awaiting_admin_review';
        coi.uploaded_for_review_date = new Date().toISOString();
      } catch (cmpErr) {
        console.warn('Endorsement comparison warning:', cmpErr?.message || cmpErr);
      }

      // If regen flag is set, attempt to regenerate COI PDF using AdobePDFService
      if (regenFlag) {
        try {
          // Find project info if available
          let projectInfo = null;
          if (coi.project_id || coi.project_name) {
            projectInfo = (entities.Project || []).find(p => p.id === coi.project_id || p.project_name === coi.project_name || p.project_name === coi.project_name);
          }

          const coiData = {
            coiId: coi.id || coi.coi_token || Date.now(),
            subcontractorName: coi.subcontractor_name || coi.subcontractor || 'Subcontractor',
            subcontractorAddress: coi.subcontractor_address || '',
            broker: { name: coi.broker_name, email: coi.broker_email },
            coverages: coi.coverages || [],
            additional_insureds: coi.gl_additional_insured || coi.gl_additional_insureds || [],
            projectName: projectInfo?.project_name || coi.project_name || '',
            projectAddress: projectInfo?.address || projectInfo?.project_address || coi.project_address || ''
          };

          const filename = await adobePDF.generateCOIPDF(coiData, UPLOADS_DIR);
          const generatedUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
          coi.pdf_url = generatedUrl;
          coi.generated_pdf = filename;
          coi.status = 'pending_broker';
          coi.uploaded_for_review_date = new Date().toISOString();

          // Notify broker to review/sign the regenerated COI and attach the PDF
          try {
            if (coi.broker_email) {
              // Build sign link to front-end broker upload/sign route
              // Note: regenerated COI PDF is stored in-system at coi.pdf_url and will NOT be attached to the email by default
              const frontendHost = req.get('host').replace(/:3001$/, ':5175');
              const signLink = `${req.protocol}://${frontendHost}/broker-upload-coi?token=${coi.coi_token}&action=sign&step=3`;

              const emailPayload = {
                to: coi.broker_email,
                subject: `🔔 COI Regenerated - Please Review & Sign: ${coi.subcontractor_name || 'Subcontractor'}`,
                body: `A Certificate of Insurance has been regenerated with the uploaded endorsement changes. The regenerated certificate is available in your broker portal and stored in-system.
\nView the regenerated certificate: ${coi.pdf_url || coi.regenerated_coi_url || '(not available)'}\n\nSign here: ${signLink}\n\nIf the link does not work, visit your broker dashboard and review pending COIs.`,
                includeSampleCOI: false
              };

              // Send internal POST to our public send-email endpoint
              try {
                const internalUrl = `${req.protocol}://${req.get('host')}/public/send-email`;
                await fetch(internalUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(emailPayload)
                });
                // Create an in-system message record for broker notification
                try {
                  if (entities.Message && Array.isArray(entities.Message)) {
                    entities.Message.push({
                      id: `msg-${Date.now()}`,
                      message_type: 'coi_regenerated',
                      sender_id: 'system',
                      recipient: coi.broker_email || coi.broker_name || null,
                      recipient_id: coi.broker_id || null,
                      subject: emailPayload.subject,
                      body: emailPayload.body,
                      related_entity: 'GeneratedCOI',
                      related_entity_id: coi.id,
                      is_read: false,
                      created_at: new Date().toISOString()
                    });
                  }
                } catch (msgErr) {
                  console.warn('Could not create in-system message for broker notification:', msgErr?.message || msgErr);
                }
              } catch (emailErr) {
                console.error('Failed to send internal notification email to broker:', emailErr?.message || emailErr);
              }
            }
          } catch (notifyErr) {
            console.error('Error notifying broker after COI regen:', notifyErr?.message || notifyErr);
          }
        } catch (regenErr) {
          console.error('Failed to regenerate COI PDF:', regenErr?.message || regenErr);
        }
      }
    }

    // Persist (in-memory) and respond
    // In production this would save to DB
    return res.json({ ok: true, endorsement: endorsementRecord, coi: coi || null });
  } catch (error) {
    console.error('public upload-endorsement error:', error?.message || error);
    return sendError(res, 500, 'Endorsement upload failed', { error: error.message });
  }
});

app.post('/integrations/generate-image', authenticateToken, (req, res) => {
  const { prompt } = req.body;
  res.json({ url: `https://images.example.com/img-${Date.now()}.png`, prompt });
});

// Helper function to extract text from PDF file
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text || '';
    console.log(`📄 Extracted ${extractedText.length} characters from PDF`);
    return extractedText;
  } catch (pdfErr) {
    console.error('PDF parsing error:', pdfErr);
    throw new Error('Failed to parse PDF file');
  }
}

// Helper function to extract common fields using regex patterns (fallback when AI is not configured)
function extractFieldsWithRegex(text, schema) {
  const extracted = {};
  const upper = (text || '').toUpperCase();
  
  // Extract policy numbers (various formats)
  const policyPatterns = [
    /(?:policy|pol)[\s#:]*([A-Z0-9-]{5,20})/gi,
    /\b([A-Z]{2,4}[-]?\d{4,12})\b/g
  ];
  
  // Extract dates (MM/DD/YYYY or MM-DD-YYYY or YYYY-MM-DD)
  const datePattern = /\b(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g;
  
  // Extract dollar amounts
  const amountPattern = /\$[\d,]+(?:,\d{3})*(?:\.\d{2})?/g;
  
  // Extract email addresses
  const emailPattern = /[\w.-]+@[\w.-]+\.\w+/g;
  
  // Extract phone numbers
  const phonePattern = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  
  // Map schema fields to extraction patterns
  for (const [fieldName, fieldType] of Object.entries(schema)) {
    const lowerField = fieldName.toLowerCase();
    
    // Policy number fields
    if (lowerField.includes('policy') && lowerField.includes('number')) {
      const matches = [];
      for (const pattern of policyPatterns) {
        const found = text.match(pattern);
        if (found) matches.push(...found);
      }
      if (matches.length > 0) {
        extracted[fieldName] = matches[0].replace(/^(policy|pol)[\s#:]*/i, '').trim();
      }
    }
    
    // Date fields (effective, expiration)
    else if (lowerField.includes('date') && fieldType.toLowerCase().includes('date')) {
      const matches = text.match(datePattern);
      if (matches && matches.length > 0) {
        // Try to find the most relevant date based on field name
        if (lowerField.includes('effective') || lowerField.includes('start')) {
          extracted[fieldName] = matches[0];
        } else if (lowerField.includes('expir') || lowerField.includes('end')) {
          extracted[fieldName] = matches.length > 1 ? matches[1] : matches[0];
        } else {
          extracted[fieldName] = matches[0];
        }
      }
    }
    
    // Dollar amount fields (aggregate, occurrence, limit)
    else if (fieldType.toLowerCase().includes('number') && 
             (lowerField.includes('aggregate') || lowerField.includes('occurrence') || 
              lowerField.includes('limit') || lowerField.includes('amount'))) {
      const matches = text.match(amountPattern);
      if (matches && matches.length > 0) {
        // Convert to number (remove $ and commas)
        const numStr = matches[0].replace(/[$,]/g, '');
        extracted[fieldName] = parseFloat(numStr);
      }
    }
    
    // Email fields
    else if (lowerField.includes('email')) {
      const matches = text.match(emailPattern);
      if (matches && matches.length > 0) {
        extracted[fieldName] = matches[0];
      }
    }
    
    // Phone fields
    else if (lowerField.includes('phone')) {
      const matches = text.match(phonePattern);
      if (matches && matches.length > 0) {
        extracted[fieldName] = matches[0];
      }
    }
    
    // Name fields - extract first substantial text block
    else if (lowerField.includes('name') && fieldType.toLowerCase().includes('string')) {
      // Prefer ACORD INSURED block if present
      const insuredBlock = upper.match(/INSURED\s+([A-Z0-9 &.,'\-]{2,100})/);
      if (insuredBlock && insuredBlock[1]) {
        extracted[fieldName] = insuredBlock[1].trim();
      } else {
        // Fallback generic name pattern
        const namePattern = /([A-Z][a-zA-Z\s&,.']+(?:LLC|Inc|Corp|Company|Corporation|Ltd)?)/;
        const matches = text.match(namePattern);
        if (matches && matches.length > 0) {
          extracted[fieldName] = matches[0].trim();
        }
      }
    }
  }
  
  // ACORD 25 specific label-driven extraction for GL and common fields
  const getAmountAfter = (label) => {
    const re = new RegExp(label + "[\\\s:]*\\$?([\\d,]+(?:\\.\\d{2})?)", 'i');
    const m = text.match(re);
    return m && m[1] ? parseFloat(m[1].replace(/[$,]/g, '')) : null;
  };

  const getValueAfter = (label) => {
    const re = new RegExp(label + "[\\\s:]*([A-Za-z0-9 &.,'\-]{2,100})", 'i');
    const m = text.match(re);
    return m && m[1] ? m[1].trim() : null;
  };

  if ('gl_each_occurrence' in schema && extracted.gl_each_occurrence == null) {
    const v = getAmountAfter('EACH\\s+OCCURRENCE');
    if (v) extracted.gl_each_occurrence = v;
  }
  if ('gl_general_aggregate' in schema && extracted.gl_general_aggregate == null) {
    const v = getAmountAfter('GENERAL\\s+AGGREGATE');
    if (v) extracted.gl_general_aggregate = v;
  }
  if ('gl_products_completed_ops' in schema && extracted.gl_products_completed_ops == null) {
    const v = getAmountAfter('PRODUCTS\\s*-\\s*COMP/OP\\s*AGG');
    if (v) extracted.gl_products_completed_ops = v;
  }
  if ('gl_personal_adv_injury' in schema && extracted.gl_personal_adv_injury == null) {
    const v = getAmountAfter('PERSONAL\\s*&\\s*ADV\\s*INJURY');
    if (v) extracted.gl_personal_adv_injury = v;
  }
  if ('gl_damage_rented_premises' in schema && extracted.gl_damage_rented_premises == null) {
    const v = getAmountAfter('DAMAGE\\s+TO\\s+RENTED\\s+PREMISES');
    if (v) extracted.gl_damage_rented_premises = v;
  }
  if ('gl_med_exp' in schema && extracted.gl_med_exp == null) {
    const v = getAmountAfter('MED\\s+EXP');
    if (v) extracted.gl_med_exp = v;
  }

  if ('gl_effective_date' in schema && !extracted.gl_effective_date) {
    const v = getValueAfter('POLICY\\s+EFF');
    if (v) extracted.gl_effective_date = v;
  }
  if ('gl_expiration_date' in schema && !extracted.gl_expiration_date) {
    const v = getValueAfter('POLICY\\s+EXP');
    if (v) extracted.gl_expiration_date = v;
  }

  if ('named_insured' in schema && !extracted.named_insured) {
    const v = getValueAfter('INSURED');
    if (v) extracted.named_insured = v;
  }

  if ('policy_number_gl' in schema && !extracted.policy_number_gl) {
    const v = getValueAfter('POLICY\\s+NUMBER');
    if (v) extracted.policy_number_gl = v.replace(/^(POLICY\s+NUMBER\s*[:#]\s*)/i, '').trim();
  }

  return extracted;
}

// Helper function to build extraction prompt
function buildExtractionPrompt(schema, extractedText) {
  const schemaDescription = Object.entries(schema)
    .map(([key, type]) => `  - ${key}: ${type}`)
    .join('\n');
  
  return `Extract the following information from this insurance document. Return ONLY valid JSON with these fields:\n${schemaDescription}\n\nDocument text:\n${extractedText.substring(0, 6000)}\n\nReturn JSON object:`;
}

// Helper function for extraction logic
async function performExtraction({ file_url, json_schema, prompt, response_json_schema }) {
  // Extract file path from URL
  const urlParts = file_url.split('/uploads/');
  if (urlParts.length < 2) {
    throw new Error('Invalid file_url format');
  }
  
  // Validate and sanitize filename to prevent path traversal
  const sanitizedFilename = validateAndSanitizeFilename(urlParts[1]);
  const filePath = path.join(UPLOADS_DIR, sanitizedFilename);
  
  // Verify the resolved path is still within UPLOADS_DIR
  verifyPathWithinDirectory(filePath, UPLOADS_DIR);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found on server');
  }

  // Extract text from PDF
  let extractedText = '';
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.pdf') {
    extractedText = await extractTextFromPDF(filePath);
  } else {
    extractedText = 'Image OCR not yet implemented. Please upload PDF files for automatic extraction.';
  }

  // If we have a prompt and response schema, use AI to extract structured data
  if (prompt && response_json_schema) {
    try {
      const fullPrompt = `${prompt}\n\nEXTRACTED TEXT FROM DOCUMENT:\n${extractedText.substring(0, 8000)}`;
      const analysis = await aiAnalysis.callAI(fullPrompt);
      const parsedResult = aiAnalysis.parseJSON(analysis);
      
      return parsedResult || {
        status: 'success',
        output: {},
        message: 'AI analysis completed'
      };
    } catch (aiErr) {
      console.error('AI extraction error:', aiErr);
      // Fall through to schema-based extraction
    }
  }

  // If we have a json_schema, try to extract specific fields
  if (json_schema && extractedText) {
    try {
      const schema = typeof json_schema === 'string' ? JSON.parse(json_schema) : json_schema;
      
      // First try AI extraction if available
      if (aiAnalysis.enabled) {
        const extractionPrompt = buildExtractionPrompt(schema, extractedText);
        
        const aiResult = await aiAnalysis.callAI(extractionPrompt);
        const extracted = aiAnalysis.parseJSON(aiResult);
        
        if (extracted && Object.keys(extracted).length > 0) {
          return {
            status: 'success',
            output: extracted,
            raw_text: extractedText.substring(0, 500)
          };
        }
      }
      
      // Fallback to regex-based extraction when AI is not configured
      console.log('⚠️  Using regex-based extraction (AI service not configured)');
      const regexExtracted = extractFieldsWithRegex(extractedText, schema);
      
      if (Object.keys(regexExtracted).length > 0) {
        return {
          status: 'success',
          output: regexExtracted,
          raw_text: extractedText.substring(0, 500),
          extraction_method: 'regex',
          message: 'Extracted using pattern matching. AI service not configured for better accuracy.'
        };
      }
    } catch (extractErr) {
      console.error('Schema-based extraction error:', extractErr);
    }
  }

  // Return empty output if no extraction was successful
  return {
    status: 'success',
    output: {},
    data: { extracted: extractedText.substring(0, 1000) },
    raw_text: extractedText.substring(0, 500),
    message: 'Text extracted but structured data extraction failed. Configure AI service for better results.'
  };
}

// Extract text from uploaded file and return structured data
app.post('/integrations/extract-file', authenticateToken, async (req, res) => {
  try {
    const { file_url, json_schema, prompt, response_json_schema } = req.body || {};
    
    if (!file_url) {
      return sendError(res, 400, 'file_url is required');
    }

    const result = await performExtraction({ file_url, json_schema, prompt, response_json_schema });
    return res.json(result);
  } catch (err) {
    console.error('extract-file error:', err?.message || err);
    return sendError(res, 500, 'Extraction failed', { error: err.message });
  }
});

// AI-style structured extraction (authenticated version)
app.post('/integrations/extract-data', authenticateToken, async (req, res) => {
  try {
    const { file_url, json_schema, prompt, response_json_schema } = req.body || {};
    
    if (!file_url) {
      return sendError(res, 400, 'file_url is required');
    }

    const result = await performExtraction({ file_url, json_schema, prompt, response_json_schema });
    return res.json(result);
  } catch (err) {
    console.error('extract-data error:', err?.message || err);
    return sendError(res, 500, 'Extraction failed', { error: err.message });
  }
});

// Public extraction endpoint for broker portal (no auth)
app.post('/public/extract-data', publicApiLimiter, async (req, res) => {
  try {
    const { file_url, json_schema, prompt, response_json_schema } = req.body || {};
    
    if (!file_url) {
      return sendError(res, 400, 'file_url is required');
    }

    const result = await performExtraction({ file_url, json_schema, prompt, response_json_schema });
    return res.json(result);
  } catch (err) {
    console.error('public extract-data error:', err?.message || err);
    return sendError(res, 500, 'Extraction failed', { error: err.message });
  }
});

// AI Policy Analysis - Analyze COI/Policy for deficiencies
app.post('/integrations/analyze-policy', authenticateToken, async (req, res) => {
  try {
    const { coi_id, policy_documents: _policy_documents = [], project_requirements = {} } = req.body;
    
    if (!coi_id) {
      return res.status(400).json({ error: 'coi_id is required' });
    }

    // Find the COI
    const coi = entities.GeneratedCOI.find(c => c.id === coi_id);
    if (!coi) {
      return res.status(404).json({ error: 'COI not found' });
    }

    // Simulate AI analysis - In production, this would call an actual LLM
    const deficiencies = [];
    let deficiencyCounter = 1;
    
    // Check coverage amounts
    if (coi.gl_aggregate && coi.gl_aggregate < 2000000) {
      deficiencies.push({
        id: `def-${coi_id}-${deficiencyCounter++}`,
        severity: 'high',
        category: 'coverage',
        field: 'gl_aggregate',
        title: 'General Liability Aggregate Below Minimum',
        description: `GL Aggregate is $${coi.gl_aggregate.toLocaleString()}, but project requires minimum $2,000,000`,
        required_action: 'Increase GL Aggregate coverage to at least $2,000,000',
        current_value: coi.gl_aggregate,
        required_value: 2000000
      });
    }

    if (coi.gl_each_occurrence && coi.gl_each_occurrence < 1000000) {
      deficiencies.push({
        id: `def-${coi_id}-${deficiencyCounter++}`,
        severity: 'high',
        category: 'coverage',
        field: 'gl_each_occurrence',
        title: 'General Liability Per Occurrence Below Minimum',
        description: `GL Each Occurrence is $${coi.gl_each_occurrence.toLocaleString()}, but project requires minimum $1,000,000`,
        required_action: 'Increase GL Each Occurrence coverage to at least $1,000,000',
        current_value: coi.gl_each_occurrence,
        required_value: 1000000
      });
    }

    // Check expiration dates
    const glExpiryDate = coi.gl_expiration_date ? new Date(coi.gl_expiration_date) : null;
    if (glExpiryDate && glExpiryDate < new Date()) {
      deficiencies.push({
        id: `def-${coi_id}-${deficiencyCounter++}`,
        severity: 'critical',
        category: 'expiration',
        field: 'gl_expiration_date',
        title: 'General Liability Policy Expired',
        description: `GL policy expired on ${glExpiryDate.toLocaleDateString()}`,
        required_action: 'Provide current, non-expired GL policy',
        current_value: coi.gl_expiration_date,
        required_value: 'Future date'
      });
    }

    const wcExpiryDate = coi.wc_expiration_date ? new Date(coi.wc_expiration_date) : null;
    if (wcExpiryDate && wcExpiryDate < new Date()) {
      deficiencies.push({
        id: `def-${coi_id}-${deficiencyCounter++}`,
        severity: 'critical',
        category: 'expiration',
        field: 'wc_expiration_date',
        title: 'Workers Compensation Policy Expired',
        description: `WC policy expired on ${wcExpiryDate.toLocaleDateString()}`,
        required_action: 'Provide current, non-expired WC policy',
        current_value: coi.wc_expiration_date,
        required_value: 'Future date'
      });
    }

    // Check for missing required coverages
    if (!coi.wc_policy_number) {
      deficiencies.push({
        id: `def-${coi_id}-${deficiencyCounter++}`,
        severity: 'critical',
        category: 'missing_coverage',
        field: 'wc_policy_number',
        title: 'Workers Compensation Coverage Missing',
        description: 'No Workers Compensation policy information provided',
        required_action: 'Provide Workers Compensation policy details',
        current_value: null,
        required_value: 'Policy number required'
      });
    }

    // Check additional insured status (if project requirements specified)
    if (project_requirements.requires_additional_insured && !coi.additional_insured_included) {
      deficiencies.push({
        id: `def-${coi_id}-${deficiencyCounter++}`,
        severity: 'high',
        category: 'additional_insured',
        field: 'additional_insured_included',
        title: 'Additional Insured Status Not Confirmed',
        description: 'Project requires Additional Insured endorsement but status not confirmed on certificate',
        required_action: 'Add Additional Insured endorsement naming the General Contractor',
        current_value: false,
        required_value: true
      });
    }

    // Check waiver of subrogation
    if (project_requirements.requires_waiver_subrogation && !coi.waiver_of_subrogation) {
      deficiencies.push({
        id: `def-${coi_id}-${deficiencyCounter++}`,
        severity: 'medium',
        category: 'waiver',
        field: 'waiver_of_subrogation',
        title: 'Waiver of Subrogation Not Confirmed',
        description: 'Project requires Waiver of Subrogation but not confirmed on certificate',
        required_action: 'Add Waiver of Subrogation in favor of the General Contractor',
        current_value: false,
        required_value: true
      });
    }

    const analysis = {
      coi_id,
      analyzed_at: new Date().toISOString(),
      total_deficiencies: deficiencies.length,
      critical_count: deficiencies.filter(d => d.severity === 'critical').length,
      high_count: deficiencies.filter(d => d.severity === 'high').length,
      medium_count: deficiencies.filter(d => d.severity === 'medium').length,
      status: deficiencies.length === 0 ? 'approved' : 'deficient',
      deficiencies,
      ai_confidence: 0.92, // Simulated confidence score
      analysis_method: 'ai_rules_based'
    };

    console.log(`✅ Policy analysis complete: ${deficiencies.length} deficiencies found`);
    res.json(analysis);

  } catch (err) {
    console.error('Policy analysis error:', err);
    res.status(500).json({ error: 'Failed to analyze policy', details: err.message });
  }
});

// Public: Extract COI fields from a PDF (no auth)
app.post('/public/extract-coi-fields', publicApiLimiter, async (req, res) => {
  try {
    const { file_url } = req.body || {};
    if (!file_url) return res.status(400).json({ error: 'file_url is required' });

    const data = await adobePDF.extractCOIFields(file_url);
    return res.json({ status: 'success', data });
  } catch (err) {
    console.error('public extract-coi-fields error:', err?.message || err);
    return res.status(500).json({ error: 'Extraction failed' });
  }
});



// Public: List pending COIs (limited fields)
app.get('/public/pending-cois', (req, res) => {
  try {
    const list = (entities.GeneratedCOI || [])
      .filter(c => c.status === 'pending' || c.status === 'awaiting_admin_review')
      .map(c => ({
        id: c.id,
        status: c.status,
        subcontractor_id: c.subcontractor_id,
        project_id: c.project_id,
        trade_types: c.trade_types,
        created_at: c.created_at,
        first_coi_url: c.first_coi_url,
        gl_each_occurrence: c.gl_each_occurrence,
        wc_each_accident: c.wc_each_accident
      }));
    return res.json(list);
  } catch (err) {
    console.error('public pending-cois error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to list pending COIs' });
  }
});

// Public: Return default admin emails for notifications
app.get('/public/admin-emails', (req, res) => {
  try {
    const emails = DEFAULT_ADMIN_EMAILS.length > 0 ? DEFAULT_ADMIN_EMAILS : ['admin@example.com'];
    return res.json({ emails });
  } catch (err) {
    console.error('public admin-emails error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to load admin emails' });
  }
});

// Public: Broker quick sign (no upload) using token
app.post('/public/broker-sign-coi', publicApiLimiter, (req, res) => {
  try {
    const token = String(req.query.token || req.body?.token || '');
    if (!token) return res.status(400).json({ error: 'token is required' });
    const idx = (entities.GeneratedCOI || []).findIndex(c => timingSafeEqual(c.coi_token, token));
    if (idx === -1) return res.status(404).json({ error: 'COI not found for token' });

    const mockSigUrl = `https://storage.example.com/broker-signature-${Date.now()}.png`;
    entities.GeneratedCOI[idx] = {
      ...entities.GeneratedCOI[idx],
      broker_signature_url: mockSigUrl,
      broker_signature_date: new Date().toISOString(),
      status: 'awaiting_admin_review',
      uploaded_for_review_date: new Date().toISOString()
    };
    debouncedSave();
    return res.json(entities.GeneratedCOI[idx]);
  } catch (err) {
    console.error('public broker-sign-coi error:', err?.message || err);
    return res.status(500).json({ error: 'Broker quick sign failed' });
  }
});

// Public: Broker login with email and password
app.post('/public/broker-login', publicApiLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get broker from centralized Broker table (read-only, does NOT create)
    let broker = getBroker(email);
    
    // If broker exists but has no password yet, treat this as first-time setup: set the provided password now
    if (broker && !broker.password) {
      try {
        const hashed = await bcrypt.hash(password, 10);
        const idx = (entities.Broker || []).findIndex(b => b.email?.toLowerCase() === email.toLowerCase());
        if (idx !== -1) {
          entities.Broker[idx] = { ...entities.Broker[idx], password: hashed };
          debouncedSave();
          broker = entities.Broker[idx];
        }
      } catch (hashErr) {
        console.error('broker-login hash error:', hashErr?.message || hashErr);
      }
    }

    // Always perform bcrypt comparison to prevent timing attacks
    const passwordToCheck = (broker && broker.password) ? broker.password : DUMMY_PASSWORD_HASH;
    const isPasswordValid = await bcrypt.compare(password, passwordToCheck);
    
    // Generic error message to prevent account enumeration
    if (!broker || !isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Return broker data
    return res.json({
      email: broker.email,
      name: broker.contact_person || broker.company_name || email,
      authenticated: true
    });
  } catch (err) {
    console.error('broker-login error:', err?.message || err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Public: GC login with email and password
app.post('/public/gc-login', publicApiLimiter, async (req, res) => {
  try {
    const { email, password, gcId } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find all GC contractors by email
    const matchingGCs = (entities.Contractor || []).filter(c => 
      c.contractor_type === 'general_contractor' && 
      c.email && 
      c.email.toLowerCase() === email.toLowerCase()
    );

    // If gcId is specified, use that specific GC; otherwise if only one GC, use it; else ask user to choose
    let gc;
    if (gcId && matchingGCs.length > 0) {
      gc = matchingGCs.find(c => c.id === gcId);
    } else if (matchingGCs.length === 1) {
      gc = matchingGCs[0];
    } else if (matchingGCs.length > 1) {
      // Multiple GCs with same email - return list for user to choose
      return res.status(200).json({
        requiresSelection: true,
        gcs: matchingGCs.map(c => ({
          id: c.id,
          company_name: c.company_name,
          address: c.address
        }))
      });
    }

    console.log('🔐 GC Login attempt:', {
      emailSearched: email,
      gcFound: !!gc,
      matchingGCCount: matchingGCs.length,
      gcHasPassword: !!gc?.password,
      passwordFieldExists: 'password' in (gc || {})
    });

    // Always perform bcrypt comparison to prevent timing attacks
    const passwordToCheck = (gc && gc.password) ? gc.password : DUMMY_PASSWORD_HASH;
    const isPasswordValid = await bcrypt.compare(password, passwordToCheck);
    
    console.log('🔑 Password comparison:', {
      matchResult: isPasswordValid,
      usingDummy: !gc?.password
    });
    
    // Generic error message to prevent account enumeration
    if (!gc || !gc.password || !isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Return GC data
    return res.json({
      id: gc.id,
      email: gc.email,
      name: gc.company_name || gc.contact_name,
      authenticated: true
    });
  } catch (err) {
    console.error('gc-login error:', err?.message || err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Public: Request password reset for GC
// Public: Request password reset for GC - Proxy to unified handler
app.post('/public/gc-forgot-password', publicApiLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    return handlePasswordResetRequest(email, 'gc', res);
  } catch (err) {
    console.error('gc-forgot-password error:', err?.message || err);
    return res.status(500).json({ error: 'Request failed' });
  }
});

// Public: Reset GC password - Proxy to unified handler
app.post('/public/gc-reset-password', publicApiLimiter, async (req, res) => {
  return handlePasswordReset(req, res);
});

// Public: Request password reset for Broker - Proxy to unified handler
app.post('/public/broker-forgot-password', publicApiLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    return handlePasswordResetRequest(email, 'broker', res);
  } catch (err) {
    console.error('broker-forgot-password error:', err?.message || err);
    return res.status(500).json({ error: 'Request failed' });
  }
});

// Public: Request password reset for Subcontractor
app.post('/public/subcontractor-forgot-password', publicApiLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const sub = (entities.Contractor || []).find(c => 
      c.contractor_type === 'subcontractor' && 
      c.email?.toLowerCase() === email.toLowerCase()
    );

    if (!sub) {
      return res.json({ success: true, message: 'If email exists, reset link will be sent' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (60 * 60 * 1000);
    
    if (!passwordResetTokens.has('subcontractor')) {
      passwordResetTokens.set('subcontractor', new Map());
    }
    passwordResetTokens.get('subcontractor').set(email.toLowerCase(), { token: resetToken, expiresAt });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5175'}/subcontractor-reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@insuretrack.com',
      to: email,
      subject: 'Password Reset Request - CompliantTeam',
      html: `
        <p>You requested a password reset for your subcontractor account.</p>
        <p>Click the link below to reset your password (link expires in 1 hour):</p>
        <p><a href="${resetLink}">Reset Password</a></p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('📧 Subcontractor password reset email sent to:', email);
    } catch (emailErr) {
      console.error('Error sending subcontractor password reset email:', emailErr?.message);
    }

    return res.json({ success: true, message: 'If email exists, reset link will be sent' });
  } catch (err) {
    console.error('subcontractor-forgot-password error:', err?.message || err);
    return res.status(500).json({ error: 'Request failed' });
  }
});

// Public: Reset Subcontractor password with token
app.post('/public/subcontractor-reset-password', publicApiLimiter, async (req, res) => {
  try {
    const { email, token, newPassword } = req.body || {};
    
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Email, token, and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const subTokens = passwordResetTokens.get('subcontractor');
    const storedToken = subTokens?.get(email.toLowerCase());

    if (!storedToken || storedToken.token !== token || storedToken.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const subIndex = (entities.Contractor || []).findIndex(c => 
      c.contractor_type === 'subcontractor' && 
      c.email?.toLowerCase() === email.toLowerCase()
    );

    if (subIndex === -1) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    entities.Contractor[subIndex].password = hashedPassword;

    subTokens.delete(email.toLowerCase());
    saveEntities();

    console.log('🔑 Subcontractor password reset successfully for:', email);
    return res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    console.error('subcontractor-reset-password error:', err?.message || err);
    return res.status(500).json({ error: 'Password reset failed' });
  }
});

// Admin: Set password for a broker (by email)
app.post('/admin/set-broker-password', authLimiter, authenticateToken, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate password strength (minimum 12 characters with complexity requirements)
    if (password.length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters long' });
    }
    
    // Validate password complexity
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({ 
        error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' 
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get or create broker record and update password in centralized Broker table
    const broker = getOrCreateBroker(email);
    
    if (!broker) {
      return res.status(404).json({ error: 'Failed to create/find broker record' });
    }

    // Update broker password in centralized table
    const brokerIndex = entities.Broker.findIndex(b => b.id === broker.id);
    if (brokerIndex !== -1) {
      entities.Broker[brokerIndex].password = hashedPassword;
      entities.Broker[brokerIndex].password_changed_at = new Date().toISOString();
    }

    debouncedSave();
    return res.json({ 
      success: true, 
      message: `Password set for broker: ${email}`,
      email: email 
    });
  } catch (err) {
    console.error('set-broker-password error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to set password' });
  }
});

// Admin: Set password for a GC contractor (by email)
app.post('/admin/set-gc-password', authLimiter, authenticateToken, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate password strength (minimum 12 characters with complexity requirements)
    if (password.length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters long' });
    }
    
    // Validate password complexity
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({ 
        error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' 
      });
    }

    // Find GC contractor by email
    const gcIndex = (entities.Contractor || []).findIndex(c => 
      c.contractor_type === 'general_contractor' && 
      c.email && 
      c.email.toLowerCase() === email.toLowerCase()
    );

    if (gcIndex === -1) {
      return res.status(404).json({ error: 'GC not found with this email' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the GC's password
    entities.Contractor[gcIndex].password = hashedPassword;

    debouncedSave();
    return res.json({ 
      success: true, 
      message: 'Password set successfully',
      email: email,
      gc_id: entities.Contractor[gcIndex].id
    });
  } catch (err) {
    console.error('set-gc-password error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to set password' });
  }
});

// Admin: Generate a COI PDF from existing data
// Admin: Generate COI PDF
app.post('/admin/generate-coi', apiLimiter, authenticateToken, async (req, res) => {
  try {
    const { coi_id } = req.body || {};
    if (!coi_id) return res.status(400).json({ error: 'coi_id is required' });

    const coiIdx = (entities.GeneratedCOI || []).findIndex(c => c.id === String(coi_id));
    if (coiIdx === -1) return res.status(404).json({ error: 'COI not found' });

    const coi = entities.GeneratedCOI[coiIdx];
    
    // Gather data for PDF generation
    const projectSub = entities.ProjectSubcontractor.find(ps => ps.id === coi.project_sub_id);
    const project = projectSub ? entities.Project.find(p => p.id === projectSub.project_id) : null;
    const subcontractor = projectSub ? entities.Contractor.find(c => c.id === projectSub.subcontractor_id) : null;
    
    // Check for master insurance data (uploaded ACORD 25 and policies)
    let masterData = null;
    if (subcontractor?.master_insurance_data) {
      try {
        masterData = typeof subcontractor.master_insurance_data === 'string' 
          ? JSON.parse(subcontractor.master_insurance_data) 
          : subcontractor.master_insurance_data;
      } catch (parseErr) {
        console.warn('Could not parse master_insurance_data:', parseErr?.message);
      }
    }
    
    // Get insurance program requirements
    let programRequirements = null;
    if (project?.program_id) {
      programRequirements = entities.ProgramRequirement?.filter(req => req.program_id === project.program_id) || null;
    }
    
    // Prepare COI data using ACORD 25 format with uploaded data
    const coiData = {
      coiId: coi_id,
      
      // Producer/Broker information (from uploaded ACORD 25 or broker record)
      producer: masterData?.producer || {
        name: subcontractor?.broker_name || coi.broker_name || 'Insurance Broker',
        email: subcontractor?.broker_email || coi.broker_email || '',
        phone: subcontractor?.broker_phone || coi.broker_phone || '',
        address: masterData?.producer?.address || ''
      },
      
      // Insured (Subcontractor) information
      insured: masterData?.insured || {
        name: subcontractor?.company_name || 'Subcontractor',
        address: subcontractor?.address || '',
        city: subcontractor?.city || '',
        state: subcontractor?.state || '',
        zip: subcontractor?.zip_code || ''
      },
      
      // Certificate Holder (GC)
      certificateHolder: {
        name: project?.gc_name || '',
        address: project?.project_address || project?.address || '',
        projectName: project?.project_name || ''
      },
      
      // Additional Insureds
      additionalInsureds: (() => {
        const insureds = [];
        if (project?.gc_name) insureds.push(project.gc_name);
        if (project?.owner_entity) insureds.push(project.owner_entity);
        if (project?.additional_insured_entities) {
          const extras = Array.isArray(project.additional_insured_entities) 
            ? project.additional_insured_entities 
            : project.additional_insured_entities.split(',').map(s => s.trim());
          insureds.push(...extras);
        }
        return insureds;
      })(),
      
      // Description of operations with endorsement language
      descriptionOfOperations: (() => {
        const hasUmbrella = programRequirements?.some(req => 
          req.insurance_type === 'umbrella_policy' || req.umbrella_each_occurrence
        );
        const umbrellaText = hasUmbrella ? ' & Umbrella' : '';
        return `Certificate holder and entities listed below are included in the GL${umbrellaText} policies as additional insureds for ongoing & completed operations on a primary & non-contributory basis, as required by written contract agreement, per policy terms & conditions. Waiver of subrogation is included in the GL${umbrellaText ? ', Umbrella' : ''} & Workers Compensation policies.`;
      })(),
      
      // Coverage information from uploaded policies/ACORD 25 or master data
      coverages: {
        generalLiability: masterData?.coverages?.generalLiability || {
          insurer: coi.gl_insurer || 'Insurer A',
          insurerLetter: 'A',
          policyNumber: coi.gl_policy_number || 'GL-XXXXXX',
          effectiveDate: coi.gl_effective_date || masterData?.effectiveDate,
          expirationDate: coi.gl_expiration_date || masterData?.expirationDate,
          eachOccurrence: coi.gl_each_occurrence || masterData?.gl_each_occurrence || 1000000,
          damageToRentedPremises: coi.gl_damage_rented_premises || 300000,
          medicalExpense: coi.gl_med_exp || 10000,
          personalAdvInjury: coi.gl_personal_adv_injury || 1000000,
          generalAggregate: coi.gl_general_aggregate || masterData?.gl_general_aggregate || 2000000,
          productsCompletedOps: coi.gl_products_completed_ops || masterData?.gl_products_completed_ops || 2000000,
          claimsOccurrence: 'OCCUR',
          additionalInsured: true,
          primaryNonContributory: true,
          waiverOfSubrogation: true
        },
        
        automobile: masterData?.coverages?.automobile || {
          insurer: coi.auto_insurer || 'Insurer B',
          insurerLetter: 'B',
          policyNumber: coi.auto_policy_number || 'AUTO-XXXXXX',
          effectiveDate: coi.auto_effective_date || masterData?.effectiveDate,
          expirationDate: coi.auto_expiration_date || masterData?.expirationDate,
          combinedSingleLimit: coi.auto_combined_single_limit || masterData?.auto_combined_single_limit || 1000000,
          anyAuto: true,
          hiredAuto: true,
          nonOwnedAuto: true
        },
        
        workersCompensation: masterData?.coverages?.workersCompensation || {
          insurer: coi.wc_insurer || 'Insurer C',
          insurerLetter: 'C',
          policyNumber: coi.wc_policy_number || 'WC-XXXXXX',
          effectiveDate: coi.wc_effective_date || masterData?.effectiveDate,
          expirationDate: coi.wc_expiration_date || masterData?.expirationDate,
          eachAccident: coi.wc_each_accident || masterData?.wc_each_accident || 1000000,
          diseasePerEmployee: coi.wc_disease_each_employee || 1000000,
          diseasePolicyLimit: coi.wc_disease_policy_limit || 1000000,
          statutoryLimits: true,
          waiverOfSubrogation: true
        },
        
        umbrella: (masterData?.coverages?.umbrella || coi.umbrella_policy_number) ? {
          insurer: coi.umbrella_insurer || 'Insurer D',
          insurerLetter: 'D',
          policyNumber: coi.umbrella_policy_number || 'UMB-XXXXXX',
          effectiveDate: coi.umbrella_effective_date || masterData?.effectiveDate,
          expirationDate: coi.umbrella_expiration_date || masterData?.expirationDate,
          eachOccurrence: coi.umbrella_each_occurrence || masterData?.umbrella_each_occurrence || 2000000,
          aggregate: coi.umbrella_aggregate || masterData?.umbrella_aggregate || 2000000,
          followForm: true,
          additionalInsured: true,
          primaryNonContributory: true,
          waiverOfSubrogation: true
        } : null
      },
      
      // Insurers list
      insurers: masterData?.insurers || {
        A: { name: coi.gl_insurer || 'General Liability Insurance Co.', naic: masterData?.insurers?.A?.naic || '' },
        B: { name: coi.auto_insurer || 'Auto Insurance Co.', naic: masterData?.insurers?.B?.naic || '' },
        C: { name: coi.wc_insurer || 'Workers Comp Insurance Co.', naic: masterData?.insurers?.C?.naic || '' },
        D: coi.umbrella_insurer ? { name: coi.umbrella_insurer, naic: masterData?.insurers?.D?.naic || '' } : null
      },
      
      // Project location
      projectLocation: project?.project_address || project?.address || '',
      
      // Cancellation notice
      cancellationNotice: 'SHOULD ANY OF THE ABOVE DESCRIBED POLICIES BE CANCELLED BEFORE THE EXPIRATION DATE THEREOF, NOTICE WILL BE DELIVERED IN ACCORDANCE WITH THE POLICY PROVISIONS.',
      
      // Additional remarks
      remarks: coi.notes || masterData?.remarks || ''
    };
    
    // Generate ACORD 25 PDF using the proper format
    const filename = await adobePDF.generateCOIPDF(coiData, UPLOADS_DIR);
    const generatedUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    
    // Update COI record with generated PDF
    entities.GeneratedCOI[coiIdx] = {
      ...entities.GeneratedCOI[coiIdx],
      first_coi_url: generatedUrl,
      first_coi_uploaded: true,
      uploaded_for_review_date: new Date().toISOString(),
      status: 'pending_broker_signature',
      coi_source: 'system_generated',
      generated_from_master_data: !!masterData
    };
    
    debouncedSave();
    return res.json(entities.GeneratedCOI[coiIdx]);
  } catch (err) {
    console.error('admin generate-coi error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to generate COI', details: err?.message });
  }
});

// Admin: Generate policy PDF for insurance document
app.post('/admin/generate-policy-pdf', apiLimiter, authenticateToken, async (req, res) => {
  try {
    const { document_id } = req.body || {};
    if (!document_id) return res.status(400).json({ error: 'document_id is required' });

    const docIdx = (entities.InsuranceDocument || []).findIndex(d => d.id === String(document_id));
    if (docIdx === -1) return res.status(404).json({ error: 'Insurance document not found' });

    const doc = entities.InsuranceDocument[docIdx];
    const contractor = entities.Contractor.find(c => c.id === doc.contractor_id);
    
    const policyData = {
      policyId: document_id,
      policyNumber: doc.policy_number || 'N/A',
      policyType: doc.document_type || 'General Liability',
      effectiveDate: doc.effective_date || 'N/A',
      expirationDate: doc.expiration_date || 'N/A',
      insuredName: contractor?.company_name || 'N/A',
      insuredAddress: contractor?.address || 'N/A',
      carrier: doc.insurance_carrier || 'N/A',
      coverageAmount: doc.coverage_amount ? `$${doc.coverage_amount.toLocaleString()}` : 'N/A',
      additionalInfo: doc.notes || ''
    };
    
    // Generate actual PDF
    const filename = await adobePDF.generatePolicyPDF(policyData, UPLOADS_DIR);
    const generatedUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    
    // Update document with generated PDF URL
    entities.InsuranceDocument[docIdx] = {
      ...entities.InsuranceDocument[docIdx],
      file_url: generatedUrl,
      uploaded_at: new Date().toISOString()
    };
    debouncedSave();
    return res.json(entities.InsuranceDocument[docIdx]);
  } catch (err) {
    console.error('admin generate-policy-pdf error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to generate policy PDF' });
  }
});

// Admin: Apply admin signature to COI PDF
app.post('/admin/sign-coi', authenticateToken, async (req, res) => {
  try {
    const { coi_id, signature_url } = req.body || {};
    if (!coi_id) return res.status(400).json({ error: 'coi_id is required' });

    const coiIdx = (entities.GeneratedCOI || []).findIndex(c => c.id === String(coi_id));
    if (coiIdx === -1) return res.status(404).json({ error: 'COI not found' });

    const coi = entities.GeneratedCOI[coiIdx];
    if (!coi.first_coi_url) return res.status(400).json({ error: 'No COI PDF to sign' });

    const signedUrl = await adobePDF.signPDF(coi.first_coi_url, { signature_url });
    // Mark COI active now that admin has signed the final certificate
    entities.GeneratedCOI[coiIdx] = {
      ...coi,
      admin_signature_url: signature_url || `https://storage.example.com/admin-signature-${Date.now()}.png`,
      final_coi_url: signedUrl,
      status: 'active',
      signed_at: new Date().toISOString()
    };

    // Notify stakeholders that COI is now active
    try {
      const project = (entities.Project || []).find(p => p.id === coi.project_id || p.project_name === coi.project_name);
      const subcontractor = (entities.Contractor || []).find(c => c.id === coi.subcontractor_id);
      const adminUrl = `${req.protocol}://${req.get('host')}`;
      const internalUrl = `${req.protocol}://${req.get('host')}/public/send-email`;

      // Notify subcontractor
      if (coi.contact_email) {
        await fetch(internalUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: coi.contact_email,
            subject: `✅ Your Certificate is Approved - ${project?.project_name || coi.project_name}`,
            body: `Your Certificate of Insurance for ${project?.project_name || coi.project_name} has been approved and is now active.\n\nView certificate: ${entities.GeneratedCOI[coiIdx].final_coi_url || entities.GeneratedCOI[coiIdx].first_coi_url || '(not available)'}`
          })
        }).catch(() => {});
      }

      // Notify GC
      if (project && project.gc_email) {
        await fetch(internalUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: project.gc_email,
            subject: `✅ Insurance Approved - ${coi.subcontractor_name} on ${project.project_name}`,
            body: `A Certificate of Insurance has been approved for ${coi.subcontractor_name} on ${project.project_name}.\n\nView certificate: ${entities.GeneratedCOI[coiIdx].final_coi_url || entities.GeneratedCOI[coiIdx].first_coi_url || '(not available)'}`
          })
        }).catch(() => {});
      }

      // Notify broker
      if (coi.broker_email) {
        await fetch(internalUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: coi.broker_email,
            subject: `✅ COI Approved - ${coi.subcontractor_name} - ${project?.project_name || coi.project_name}`,
            body: `The Certificate of Insurance you generated has been approved and is now active.\n\nView certificate: ${entities.GeneratedCOI[coiIdx].final_coi_url || entities.GeneratedCOI[coiIdx].first_coi_url || '(not available)'}`
          })
        }).catch(() => {});
      }
    } catch (notifyErr) {
      console.warn('Could not send activation notifications after admin sign:', notifyErr?.message || notifyErr);
    }

    debouncedSave();
    return res.json(entities.GeneratedCOI[coiIdx]);
  } catch (err) {
    console.error('admin sign-coi error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to sign COI' });
  }
});

// Explicit preflight handler for program PDF parsing (needed for Codespaces origins)
app.options('/integrations/parse-program-pdf', (req, res) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res.status(204).send();
});

// Parse insurance program PDF -> structured program + requirements
app.post('/integrations/parse-program-pdf', authenticateToken, async (req, res) => {
  // Ensure CORS headers are present even on auth or validation failures
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { pdf_base64, pdf_name = 'Program.pdf', pdf_type = 'application/pdf' } = req.body || {};
    if (!pdf_base64) {
      return res.status(400).json({ error: 'pdf_base64 is required' });
    }

    const buffer = Buffer.from(pdf_base64, 'base64');
    const parsed = await pdfParse(buffer);
    const text = parsed?.text || '';

    const result = buildProgramFromText(text, pdf_name);
    result.program.pdf_name = pdf_name;
    result.program.pdf_data = pdf_base64;
    result.program.pdf_type = pdf_type;

    res.json(result);
  } catch (err) {
    console.error('parse-program-pdf failed', err);
    return res.status(500).json({ error: 'Failed to parse PDF' });
  }
});

app.post('/integrations/create-signed-url', authenticateToken, (req, res) => {
  const { fileName } = req.body;
  res.json({ url: `https://storage.example.com/signed/${fileName}?token=${Date.now()}` });
});

app.post('/integrations/upload-private-file', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No file uploaded');
    }

    // Validate file exists and is readable
    if (!fs.existsSync(req.file.path)) {
      return sendError(res, 500, 'File storage error: file not persisted');
    }

    // Generate the full URL to access the file (private)
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    
    console.log('✅ Private file uploaded successfully:', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: fileUrl
    });

    res.json({
      success: true,
      url: fileUrl,
      file_url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('❌ Private file upload error:', error);
    return sendError(res, 500, 'File upload failed', { error: error.message });
  }
});

// =======================
// DOCUMENT REPLACEMENT ENDPOINT
// =======================
// Replace an already-approved document and reset status to pending review
app.post('/api/documents/:documentId/replace', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { 
      // SECURITY NOTE: These parameters from request body are NOT used for authorization
      // Authorization is based solely on the document's own fields (originalDoc)
      // These are kept for optional metadata/notification purposes only
      upload_request_id: _upload_request_id, 
      compliance_check_id, 
      project_id: _project_id,
      subcontractor_id: _subcontractor_id,
      broker_email: _broker_email,
      broker_name: _broker_name,
      reason 
    } = req.body;

    // Validate required fields
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason for replacement is required' });
    }

    // Find the original document
    const docIndex = entities.InsuranceDocument.findIndex(d => d.id === documentId);
    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const originalDoc = entities.InsuranceDocument[docIndex];

    // Security: Validate that the document is actually approved before allowing replacement
    if (originalDoc.approval_status !== 'approved' && originalDoc.status !== 'approved') {
      return res.status(400).json({ 
        error: 'Only approved documents can be replaced',
        current_status: originalDoc.approval_status || originalDoc.status
      });
    }

    // Security: Verify broker ownership - check if the authenticated user is authorized
    // Users can replace documents if they are:
    // 1. An admin/super_admin (full access)
    // 2. The broker who owns the document (via BrokerUploadRequest or GeneratedCOI)
    let isAuthorized = false;
    
    // SECURITY FIX: Derive subcontractor information from the document itself (originalDoc)
    // rather than trusting client-provided subcontractor_id from request body
    let actualSubcontractorId = null;
    let actualUploadRequestId = null;
    
    // Find the actual subcontractor associated with this document
    // Documents store subcontractor_name and project_id, use these to find the subcontractor
    if (originalDoc.subcontractor_name) {
      const normalizedDocSubName = (originalDoc.subcontractor_name || '').toLowerCase().trim();
      const subcontractor = entities.Contractor.find(c => 
        (c.company_name || '').toLowerCase().trim() === normalizedDocSubName &&
        c.contractor_type === 'subcontractor'
      );
      if (subcontractor) {
        actualSubcontractorId = subcontractor.id;
      }
    }
    
    // Find the actual upload request associated with this document
    // BrokerUploadRequests may reference documents via project/subcontractor relationships
    // Since documents don't directly store upload_request_id, we need to look it up
    // by matching the document's project and subcontractor
    if (originalDoc.project_id && actualSubcontractorId) {
      // Find ProjectSubcontractor that links this project and subcontractor
      // Note: ProjectSubcontractor may be empty array if not initialized
      if (entities.ProjectSubcontractor && Array.isArray(entities.ProjectSubcontractor)) {
        const projectSub = entities.ProjectSubcontractor.find(ps => 
          ps.project_id === originalDoc.project_id && 
          ps.subcontractor_id === actualSubcontractorId
        );
        
        if (projectSub) {
          // Find upload request for this project-subcontractor combination
          const uploadRequest = entities.BrokerUploadRequest.find(r => 
            r.project_sub_id === projectSub.id
          );
          if (uploadRequest) {
            actualUploadRequestId = uploadRequest.id;
          }
        }
      }
      
      // Fallback: Try to find upload request by direct project/subcontractor fields
      // Some BrokerUploadRequest records may have these fields for backward compatibility
      if (!actualUploadRequestId) {
        const uploadRequest = entities.BrokerUploadRequest.find(r => 
          r.project_id === originalDoc.project_id && r.subcontractor_id === actualSubcontractorId
        );
        if (uploadRequest) {
          actualUploadRequestId = uploadRequest.id;
        }
      }
    }
    
    // Check if user is admin
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      isAuthorized = true;
    } else {
      const userEmail = (req.user.email || req.user.username || '').toLowerCase().trim();
      
      // Check if user owns this document through BrokerUploadRequest
      // SECURITY: Use actualUploadRequestId derived from document, not client input
      if (actualUploadRequestId) {
        const uploadRequest = entities.BrokerUploadRequest.find(r => r.id === actualUploadRequestId);
        if (uploadRequest) {
          // Check if the authenticated user's email matches the broker email from the upload request
          const requestBrokerEmail = (uploadRequest.broker_email || '').toLowerCase().trim();
          if (userEmail === requestBrokerEmail) {
            isAuthorized = true;
          }
        }
      }
      
      // Fallback: Check ownership through GeneratedCOI (server-side lookup)
      // SECURITY: Use actualSubcontractorId derived from document, not client input
      if (!isAuthorized && actualSubcontractorId) {
        const subcontractor = entities.Contractor.find(c => c.id === actualSubcontractorId);
        if (subcontractor) {
          // Match by both ID and name for backward compatibility with existing COI records
          // Some older records may only have subcontractor_name populated
          const cois = entities.GeneratedCOI.filter(c => 
            c.subcontractor_name === subcontractor.company_name ||
            c.subcontractor_id === actualSubcontractorId
          );
          
          // Check if the authenticated user matches any broker email in the COI records
          // A broker may have multiple COI records for the same subcontractor
          for (const coi of cois) {
            const brokerEmails = [
              coi.broker_email,
              coi.broker_gl_email,
              coi.broker_auto_email,
              coi.broker_umbrella_email,
              coi.broker_wc_email
            ].map(email => (email || '').toLowerCase().trim()).filter(email => email);
            
            if (brokerEmails.includes(userEmail)) {
              isAuthorized = true;
              break;
            }
          }
        }
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ 
        error: 'Unauthorized: You can only replace documents that you own',
        details: 'Only the broker who uploaded the document or an administrator can replace it'
      });
    }

    // Update the document status to pending
    entities.InsuranceDocument[docIndex] = {
      ...originalDoc,
      approval_status: 'pending',
      status: 'pending_review',
      replacement_reason: reason,
      replaced_at: new Date().toISOString(),
      replaced_by: req.user.email || req.user.username,
      previous_approval_status: originalDoc.approval_status,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };

    // Update BrokerUploadRequest status if we found one associated with this document
    // SECURITY: Use actualUploadRequestId derived from document, not client input
    if (actualUploadRequestId) {
      const requestIndex = entities.BrokerUploadRequest.findIndex(r => r.id === actualUploadRequestId);
      if (requestIndex !== -1) {
        entities.BrokerUploadRequest[requestIndex] = {
          ...entities.BrokerUploadRequest[requestIndex],
          status: 'under_review',
          replaced_at: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    }

    // Update ComplianceCheck status if provided
    if (compliance_check_id) {
      const checkIndex = entities.ComplianceCheck.findIndex(c => c.id === compliance_check_id);
      if (checkIndex !== -1) {
        entities.ComplianceCheck[checkIndex] = {
          ...entities.ComplianceCheck[checkIndex],
          check_status: 'pending',
          replaced_at: new Date().toISOString(),
          replacement_reason: reason,
          updatedAt: new Date().toISOString()
        };
      }
    }

    // Get GC information from project
    // SECURITY: Use project_id from document itself, not client input
    let gcEmails = [];
    const documentProjectId = originalDoc.project_id;
    if (documentProjectId) {
      const project = entities.Project.find(p => p.id === documentProjectId);
      if (project) {
        // Find GC associated with this project
        const gc = entities.Contractor.find(c => c.id === project.gc_id);
        if (gc && gc.email) {
          gcEmails.push(gc.email);
        }

        // Also get project admin/creator if different
        if (project.created_by && project.created_by !== gc?.email) {
          gcEmails.push(project.created_by);
        }
      }
    }

    // Get subcontractor information
    // SECURITY: Use actualSubcontractorId derived from document, not client input
    let subcontractorName = 'Unknown Subcontractor';
    if (actualSubcontractorId) {
      const sub = entities.Contractor.find(c => c.id === actualSubcontractorId);
      if (sub) {
        subcontractorName = sub.company_name || sub.entity_name || subcontractorName;
      }
    } else if (originalDoc.subcontractor_name) {
      // Fallback to document's stored name if we couldn't find the ID
      subcontractorName = originalDoc.subcontractor_name;
    }

    // Send notifications to all GCs
    // SECURITY: Use authenticated user's email for broker information in notifications
    const authenticatedBrokerEmail = req.user.email || req.user.username || 'unknown';
    const authenticatedBrokerName = req.user.name || req.user.username || authenticatedBrokerEmail;
    
    const notificationPromises = gcEmails.map(async (gcEmail) => {
      try {
        // Create a notification record
        const notification = {
          id: `notif-doc-replace-${crypto.randomUUID()}`,
          type: 'document_replaced',
          recipient_email: gcEmail,
          subject: `Document Re-Review Required: ${subcontractorName}`,
          message: `A broker has replaced a previously approved insurance document for ${subcontractorName}. The subcontractor status has been changed from compliant to pending review.`,
          document_id: documentId,
          project_id: documentProjectId,
          subcontractor_id: actualSubcontractorId,
          broker_email: authenticatedBrokerEmail,
          broker_name: authenticatedBrokerName,
          reason: reason,
          created_date: new Date().toISOString(),
          read: false,
          status: 'unread'
        };

        // Store notification
        if (!entities.Notification) {
          entities.Notification = [];
        }
        entities.Notification.push(notification);

        // Send email notification
        const smtpHost = process.env.SMTP_HOST;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;

        // Only send email if SMTP is configured
        if (smtpHost && smtpUser && smtpPass) {
          const mailOptions = {
            from: process.env.SMTP_FROM || 'no-reply@insuretrack.com',
            to: gcEmail,
            subject: notification.subject,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #f97316;">⚠️ Document Re-Review Required</h2>
                <p>A broker has replaced a previously approved insurance document. The subcontractor status has been updated to <strong>Pending Review</strong>.</p>
                
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">Details:</h3>
                  <ul style="list-style: none; padding: 0;">
                    <li><strong>Subcontractor:</strong> ${subcontractorName}</li>
                    <li><strong>Broker:</strong> ${authenticatedBrokerName} (${authenticatedBrokerEmail})</li>
                    <li><strong>Document Type:</strong> ${originalDoc.document_type || originalDoc.insurance_type || 'Insurance Document'}</li>
                    ${reason ? `<li><strong>Reason for Replacement:</strong> ${reason}</li>` : ''}
                  </ul>
                </div>

                <p><strong>Action Required:</strong> Please review the new document and update the compliance status.</p>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
                  <p>This is an automated notification from INsureTrack. Please do not reply to this email.</p>
                </div>
              </div>
            `
          };

          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
              user: smtpUser,
              pass: smtpPass
            }
          });

          await transporter.sendMail(mailOptions);
          console.log(`✅ Document replacement notification sent to GC: ${gcEmail}`);
        } else {
          console.log(`📧 MOCK: Would send document replacement notification to GC: ${gcEmail}`);
        }
      } catch (emailError) {
        console.error(`❌ Failed to send notification to ${gcEmail}:`, emailError);
      }
    });

    await Promise.all(notificationPromises);

    // Persist to disk
    debouncedSave();

    res.json({
      success: true,
      message: 'Document replacement processed successfully',
      document: entities.InsuranceDocument[docIndex],
      notifications_sent: gcEmails.length
    });

  } catch (error) {
    console.error('❌ Document replacement error:', error);
    res.status(500).json({ 
      error: 'Failed to process document replacement',
      details: error.message 
    });
  }
});

// Adobe integration endpoints
app.post('/integrations/adobe/transientDocument', authenticateToken, (req, res) => {
  res.json({ transientDocumentId: `transient-${Date.now()}` });
});

app.post('/integrations/adobe/agreement', authenticateToken, (req, res) => {
  const { name, transientDocumentId } = req.body;
  res.json({
    agreementId: `agr-${Date.now()}`,
    name,
    status: 'DRAFT',
    transientDocumentId
  });
});

app.get('/integrations/adobe/agreement/:agreementId/url', authenticateToken, (req, res) => {
  const { agreementId } = req.params;
  res.json({ url: `https://secure.adobesign.com/sign/${agreementId}` });
});

// Public: Generate Hold Harmless sign link (no download)
app.post('/public/hold-harmless-sign-link', publicApiLimiter, async (req, res) => {
  try {
    const token = String(req.query.token || req.body?.token || req.body?.coi_token || '');
    if (!token) return sendError(res, 400, 'token (coi_token) is required');

    const coiIdx = (entities.GeneratedCOI || []).findIndex(c => timingSafeEqual(c.coi_token, token));
    if (coiIdx === -1) return sendError(res, 404, 'COI not found for token');
    const coi = entities.GeneratedCOI[coiIdx];

    const project = (entities.Project || []).find(p => p.id === coi.project_id);
    const agreementId = `agr-${Date.now()}`;
    const signUrl = `https://secure.adobesign.com/sign/${agreementId}`;

    entities.GeneratedCOI[coiIdx] = {
      ...coi,
      hold_harmless_status: coi.hold_harmless_status && coi.hold_harmless_status.startsWith('signed') ? coi.hold_harmless_status : 'pending_signature',
      hold_harmless_sign_url: signUrl,
      // Preserve any existing hold_harmless_template_url (do not clear it)
      hold_harmless_template_url: coi.hold_harmless_template_url || null,
      hold_harmless_requested_date: new Date().toISOString()
    };

    debouncedSave();

    return res.json({ ok: true, coi_id: coi.id, project_id: project?.id || null, sign_url: signUrl });
  } catch (err) {
    console.error('hold-harmless-sign-link error:', err?.message || err);
    return sendError(res, 500, 'Failed to create sign link');
  }
});

// Public: Complete Hold Harmless signature callback (record signed URL)
app.post('/public/complete-hold-harmless-signature', publicApiLimiter, async (req, res) => {
  try {
    const { token, signer, signed_url, signed_date } = req.body || {};
    if (!token || !signer || !signed_url) return sendError(res, 400, 'token, signer, and signed_url are required');

    const idx = (entities.GeneratedCOI || []).findIndex(c => timingSafeEqual(c.coi_token, String(token)));
    if (idx === -1) return sendError(res, 404, 'COI not found for token');

    const coi = entities.GeneratedCOI[idx];
    const now = signed_date || new Date().toISOString();

    if (signer === 'sub' || signer === 'subcontractor') {
      entities.GeneratedCOI[idx] = {
        ...coi,
        hold_harmless_sub_signed_url: signed_url,
        hold_harmless_sub_signed_date: now,
        hold_harmless_status: coi.hold_harmless_status && coi.hold_harmless_status.startsWith('signed') ? coi.hold_harmless_status : 'signed_by_sub'
      };
    } else if (signer === 'gc' || signer === 'general_contractor') {
      entities.GeneratedCOI[idx] = {
        ...coi,
        hold_harmless_gc_signed_url: signed_url,
        hold_harmless_gc_signed_date: now,
        hold_harmless_status: coi.hold_harmless_status && coi.hold_harmless_status.startsWith('signed') ? coi.hold_harmless_status : 'signed_by_gc'
      };
    } else {
      return sendError(res, 400, 'Unknown signer type');
    }

    // If both sub and gc have signed, mark hold_harmless_status as fully signed
    const updated = entities.GeneratedCOI[idx];
    if (updated.hold_harmless_sub_signed_url && updated.hold_harmless_gc_signed_url) {
      entities.GeneratedCOI[idx].hold_harmless_status = 'signed';
    }

    debouncedSave();
    return res.json(entities.GeneratedCOI[idx]);
  } catch (err) {
    console.error('complete-hold-harmless-signature error:', err?.message || err);
    return sendError(res, 500, 'Failed to record hold harmless signature');
  }
});

// =======================
// ERROR HANDLING
// =======================

// 404 handler for undefined routes
app.use((req, res) => {
  sendError(res, 404, `Route ${req.method} ${req.path} not found`);
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('❌ Global error handler:', err);
  
  // Multer file upload errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 400, 'File too large. Maximum size is 10MB');
    }
    return sendError(res, 400, err.message);
  }
  
  // Other known errors
  if (err.message) {
    return sendError(res, err.statusCode || 500, err.message);
  }
  
  // Unknown errors
  sendError(res, 500, 'Internal server error');
});

// Start server (skip if running in serverless environment like Vercel)
if (!process.env.VERCEL) {
  // Debug endpoint to help diagnose routing/CORS issues
  app.get('/_debug/routes', (req, res) => {
    return res.json({
      ok: true,
      frontend_url: process.env.FRONTEND_URL || null,
      sample_endpoints: [
        '/entities/User',
        '/auth/login',
        '/public/send-email',
        '/integrations/email-verify'
      ]
    });
  });

  // Attempt to bind to configured PORT, but if it's in use try the next ports
  const configuredPort = Number(process.env.PORT || PORT || 3001);
  const MAX_PORT_TRIES = 10;

  const tryListen = (port) => new Promise((resolve, reject) => {
    const s = app.listen(port, '0.0.0.0');
    const onError = (err) => {
      s.removeAllListeners();
      reject(err);
    };
    s.once('listening', () => {
      s.removeListener('error', onError);
      resolve(s);
    });
    s.once('error', onError);
  });

  (async () => {
    for (let i = 0; i <= MAX_PORT_TRIES; i++) {
      const p = configuredPort + i;
      try {
        const server = await tryListen(p);
        console.log(`compliant.team Backend running on http://localhost:${p}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`CORS allowed: ${process.env.FRONTEND_URL || '*'}`);
        console.log(`✅ Security: Helmet enabled, Rate limiting active`);

        const hasSmtpConfig = (process.env.SMTP_HOST || process.env.SMTP_SERVICE) && 
                              process.env.SMTP_USER && 
                              process.env.SMTP_PASS;
        if (hasSmtpConfig) {
          console.log(`✅ Email service: CONFIGURED (${process.env.SMTP_SERVICE || process.env.SMTP_HOST})`);
          console.log(`   From: ${process.env.SMTP_FROM || process.env.SMTP_USER}`);
        } else {
          console.log(`⚠️  Email service: TEST MODE (not configured for real emails)`);
          console.log(`   Configure SMTP in backend/.env to send real emails`);
          console.log(`   See EMAIL_QUICKSTART.md for quick setup`);
        }

        // Expose chosen port to environment for downstream processes
        process.env.PORT = String(p);

        server.on('error', (err) => {
          console.error('Server error:', err);
        });

        return;
      } catch (err) {
        if (err && err.code === 'EADDRINUSE') {
          console.warn(`Port ${p} in use — trying next port`);
          continue;
        }
        console.error('Failed to start server:', err);
        break;
      }
    }

    console.error(`Unable to bind to any port in range ${configuredPort}-${configuredPort + MAX_PORT_TRIES}. Please free a port or set PORT to an available port.`);
  })();
}

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - attempt to continue running
});


// Export for Vercel serverless
export default app;
