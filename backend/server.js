import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import pdfParse from 'pdf-parse';
import nodemailer from 'nodemailer';
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

// Load environment variables from .env
dotenv.config();
// Import AI and PDF integration services
import AdobePDFService from './integrations/adobe-pdf-service.js';
import AIAnalysisService from './integrations/ai-analysis-service.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// JWT_SECRET is required in production - fail fast if not set
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  console.warn('⚠️  WARNING: Using default JWT_SECRET for development only. Set JWT_SECRET in production!');
  return 'compliant-dev-secret-change-in-production';
})();

// Dummy bcrypt hash for constant-time comparison when user doesn't exist
// This prevents timing attacks by ensuring bcrypt.compare() is always called
const DUMMY_PASSWORD_HASH = '$2b$10$9X4HmyiIQHx45BHBqyw2nupLpYmTy620G.MD74lV4lriXkp.oAXUW';

// Initialize integrations
const adobePDF = new AdobePDFService();
const aiAnalysis = new AIAnalysisService();
// Default admin emails (configure via env: ADMIN_EMAILS="admin1@example.com,admin2@example.com")
const DEFAULT_ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.DEFAULT_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim())
  .filter(e => !!e);

// Persistent storage configuration
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'entities.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log('✅ Created uploads directory:', UPLOADS_DIR);
}

// =======================
// FILE VALIDATION UTILITIES
// =======================
const ALLOWED_MIMETYPES = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg'
};

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpeg', '.jpg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Validate file upload
const validateFile = (file) => {
  if (!file) return { valid: false, error: 'No file provided' };
  
  // Check extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Invalid file extension: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` };
  }
  
  // Check MIME type
  const mimeValues = Object.values(ALLOWED_MIMETYPES);
  if (!mimeValues.includes(file.mimetype)) {
    return { valid: false, error: `Invalid MIME type: ${file.mimetype}. Allowed: ${mimeValues.join(', ')}` };
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
  }
  
  // Check for suspicious filename patterns
  // eslint-disable-next-line no-control-regex
  if (/[<>:"|?*\x00-\x1F]/.test(file.originalname)) {
    return { valid: false, error: 'Filename contains invalid characters' };
  }
  
  return { valid: true };
};

// =======================
// TIMING-SAFE TOKEN COMPARISON
// =======================
/**
 * Timing-safe string comparison to prevent timing attacks
 * This implementation prevents information leakage about token length by
 * always performing comparison operations even when lengths differ.
 * 
 * The function pads both strings to the same length and performs a constant-time
 * comparison, then verifies the original lengths match. This ensures an attacker
 * cannot distinguish between "wrong length" and "wrong content" via timing analysis.
 * 
 * @param {string} a - First string to compare
 * @param {string} b - Second string to compare
 * @returns {boolean} - True if strings match exactly (content and length), false otherwise
 */
const timingSafeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  
  // Store original lengths for final verification
  const lenA = a.length;
  const lenB = b.length;
  
  // Use a fixed maximum length for padding to avoid timing leaks from Math.max()
  // 256 bytes should be sufficient for most use cases (tokens, passwords, etc.)
  const FIXED_MAX_LENGTH = 256;
  
  // Pad both strings to the fixed length
  const paddedA = a.padEnd(FIXED_MAX_LENGTH, '\0');
  const paddedB = b.padEnd(FIXED_MAX_LENGTH, '\0');
  
  // Convert strings to buffers for crypto.timingSafeEqual
  const bufA = Buffer.from(paddedA, 'utf8');
  const bufB = Buffer.from(paddedB, 'utf8');
  
  // Perform constant-time comparison on padded strings
  const contentMatch = crypto.timingSafeEqual(bufA, bufB);
  
  // Check if original lengths match using constant-time comparison
  // We use bitwise XOR to avoid timing leaks from short-circuit evaluation
  // XOR returns 0 if values are equal, non-zero otherwise
  const lengthMatch = (lenA ^ lenB) === 0;
  
  // Return true only if both content and length match
  // Using bitwise AND to combine results in constant time
  return !!(contentMatch & lengthMatch);
};

// =======================
// FILE PATH VALIDATION UTILITIES
// =======================
/**
 * Validates and sanitizes a filename to prevent path traversal attacks
 * @param {string} filename - The filename to validate
 * @returns {string} - The sanitized filename
 * @throws {Error} - If the filename contains path traversal patterns
 */
function validateAndSanitizeFilename(filename) {
  // Explicit type and value validation
  if (typeof filename !== 'string' || filename.length === 0) {
    throw new Error('Filename must be a non-empty string');
  }
  
  // Security: Prevent path traversal attacks by removing any directory separators
  const sanitizedFilename = path.basename(filename);
  
  // Check for suspicious patterns that path.basename might not catch
  if (sanitizedFilename !== filename || 
      filename.includes('..') || 
      filename.includes('/') || 
      filename.includes('\\')) {
    throw new Error('Invalid filename: path traversal detected');
  }
  
  return sanitizedFilename;
}

/**
 * Verifies that a file path is within the allowed directory
 * @param {string} filePath - The file path to verify
 * @param {string} allowedDir - The allowed base directory
 * @throws {Error} - If the path is outside the allowed directory
 */
function verifyPathWithinDirectory(filePath, allowedDir) {
  const resolvedPath = path.resolve(filePath);
  const resolvedAllowedDir = path.resolve(allowedDir);
  
  // Ensure trailing separator to prevent prefix-matching vulnerabilities
  // (e.g., /uploads vs /uploads-backup)
  // Allow exact directory match or paths that start with directory + separator
  if (resolvedPath !== resolvedAllowedDir && !resolvedPath.startsWith(resolvedAllowedDir + path.sep)) {
    throw new Error('Invalid file path: access denied');
  }
}

// Configure multer for file uploads with enhanced validation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Use crypto for secure random filename generation
    const randomBytes = crypto.randomBytes(8);
    const uniqueSuffix = `${Date.now()}-${randomBytes.toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      return cb(new Error(validation.error), false);
    }
    cb(null, true);
  }
});

// In-memory storage (replace with database in production)
const entities = {
  InsuranceDocument: [
    {
      id: 'doc-001',
      subcontractor_name: 'ABC Plumbing LLC',
      contractor_id: 'gc-001',
      project_id: 'proj-001',
      gc_id: 'gc-001',
      document_type: 'Certificate of Insurance',
      insurance_type: 'general_liability',
      policy_number: 'POL-2024-001',
      coverage_amount: 2000000,
      effective_date: '2024-01-01',
      expiry_date: '2025-12-31',
      approval_status: 'approved',
      status: 'active',
      created_by: 'admin@insuretrack.com',
      created_date: '2024-01-15T10:00:00Z',
      document_url: 'https://storage.example.com/documents/doc-001.pdf'
    }
  ],
  Project: [
    {
      id: 'proj-001',
      project_name: 'Hudson Yards Tower B',
      gc_id: 'gc-001',
      gc_name: 'BuildCorp Construction',
      gc_address: '100 Wall Street, New York, NY 10005',
      address: '500 W 33rd St',
      city: 'New York',
      state: 'NY',
      zip_code: '10001',
      project_type: 'Commercial High-Rise',
      start_date: '2024-01-01',
      estimated_completion: '2025-12-31',
      budget: 50000000,
      status: 'active',
      program_id: 'program-001',
      owner_entity: 'Hudson Yards Development LLC',
      additional_insured_entities: ['Hudson Yards Property LLC', 'Related Companies'],
      needs_admin_setup: false,
      created_date: '2023-11-01T10:00:00Z'
    },
    {
      id: 'proj-002',
      project_name: 'Downtown Office Complex',
      gc_id: 'gc-001',
      gc_name: 'BuildCorp Construction',
      gc_address: '100 Wall Street, New York, NY 10005',
      address: '123 Business Ave',
      city: 'New York',
      state: 'NY',
      zip_code: '10002',
      project_type: 'Commercial',
      start_date: '2024-03-01',
      estimated_completion: '2025-09-30',
      budget: 25000000,
      status: 'active',
      program_id: 'program-001',
      owner_entity: 'Downtown Properties LLC',
      additional_insured_entities: ['City Bank', 'Metro Management'],
      needs_admin_setup: false,
      created_date: '2024-02-01T10:00:00Z'
    }
  ],
  Contractor: [
    // General Contractors
    {
      id: 'gc-001',
      company_name: 'BuildCorp Construction',
      contractor_type: 'general_contractor',
      license_number: 'NYC-GC-12345',
      address: '100 Wall Street',
      city: 'New York',
      state: 'NY',
      zip_code: '10005',
      phone: '212-555-0100',
      email: 'contact@buildcorp.com',
      contact_person: 'John Smith',
      status: 'active',
      admin_id: '1',
      created_date: '2020-01-15T10:00:00Z'
    },
    {
      id: 'gc-002',
      company_name: 'Empire State Builders',
      contractor_type: 'general_contractor',
      license_number: 'NYC-GC-23456',
      address: '350 5th Avenue',
      city: 'New York',
      state: 'NY',
      zip_code: '10118',
      phone: '212-555-0200',
      email: 'info@empirebuilders.com',
      contact_person: 'Sarah Williams',
      status: 'active',
      admin_id: '1',
      created_date: '2018-05-20T10:00:00Z'
    },
    {
      id: 'gc-003',
      company_name: 'Skyline Developers',
      contractor_type: 'general_contractor',
      license_number: 'NYC-GC-34567',
      address: '200 Park Avenue',
      city: 'New York',
      state: 'NY',
      zip_code: '10166',
      phone: '212-555-0300',
      email: 'projects@skylinedev.com',
      contact_person: 'David Chen',
      status: 'active',
      admin_id: '1',
      created_date: '2019-03-10T10:00:00Z'
    },
    // Subcontractors
    {
      id: 'sub-001',
      company_name: 'ABC Plumbing LLC',
      contractor_type: 'subcontractor',
      license_number: 'NYC-PL-45678',
      address: '45 Water St',
      city: 'Brooklyn',
      state: 'NY',
      zip_code: '11201',
      phone: '718-555-0100',
      email: 'service@abcplumbing.com',
      contact_person: 'Mike Johnson',
      status: 'active',
      created_date: '2021-06-01T10:00:00Z'
    },
    {
      id: 'sub-002',
      company_name: 'XYZ Electrical Services',
      contractor_type: 'subcontractor',
      license_number: 'NYC-EL-56789',
      address: '78 Electric Ave',
      city: 'Queens',
      state: 'NY',
      zip_code: '11375',
      phone: '718-555-0200',
      email: 'info@xyzelectrical.com',
      contact_person: 'Tom Rodriguez',
      status: 'active',
      created_date: '2020-09-15T10:00:00Z'
    },
    {
      id: 'sub-003',
      company_name: 'Superior HVAC Inc',
      contractor_type: 'subcontractor',
      license_number: 'NYC-HV-67890',
      address: '123 Cool St',
      city: 'Bronx',
      state: 'NY',
      zip_code: '10451',
      phone: '718-555-0300',
      email: 'contact@superiorhvac.com',
      contact_person: 'Lisa Anderson',
      status: 'active',
      created_date: '2019-11-20T10:00:00Z'
    },
    {
      id: 'sub-004',
      company_name: 'Metro Concrete Works',
      contractor_type: 'subcontractor',
      license_number: 'NYC-CN-78901',
      address: '456 Foundation Blvd',
      city: 'Staten Island',
      state: 'NY',
      zip_code: '10301',
      phone: '718-555-0400',
      email: 'projects@metroconcrete.com',
      contact_person: 'James Wilson',
      status: 'active',
      created_date: '2018-04-10T10:00:00Z'
    },
    {
      id: 'sub-005',
      company_name: 'Precision Drywall & Painting',
      contractor_type: 'subcontractor',
      license_number: 'NYC-DW-89012',
      address: '789 Wall Board Ave',
      city: 'Brooklyn',
      state: 'NY',
      zip_code: '11215',
      phone: '718-555-0500',
      email: 'info@precisiondrywall.com',
      contact_person: 'Maria Garcia',
      status: 'active',
      created_date: '2020-02-14T10:00:00Z'
    },
    {
      id: 'sub-006',
      company_name: 'Apex Roofing Solutions',
      contractor_type: 'subcontractor',
      license_number: 'NYC-RF-90123',
      address: '321 Shingle Road',
      city: 'Queens',
      state: 'NY',
      zip_code: '11420',
      phone: '718-555-0600',
      email: 'service@apexroofing.com',
      contact_person: 'Robert Lee',
      status: 'active',
      created_date: '2019-08-05T10:00:00Z'
    }
  ],
  User: [
    { 
      id: '1', 
      username: 'admin', 
      email: 'miriamsabel@insuretrack.onmicrosoft.com', 
      name: 'Miriam Sabel', 
      role: 'super_admin',
      created_date: '2023-01-01T10:00:00Z'
    },
    // Example admin assistant with assigned GC
    // { 
    //   id: '3', 
    //   username: 'assistant1', 
    //   email: 'assistant1@insuretrack.com', 
    //   name: 'Admin Assistant', 
    //   role: 'admin_assistant',
    //   assigned_gc_ids: ['gc-001'], // Can see everything related to these GCs
    //   created_date: '2023-01-01T10:00:00Z'
    // }
  ],
  ProjectSubcontractor: [],
  SubInsuranceRequirement: [
    {
      id: 'req-001',
      program_id: 'program-001',
      trade_name: 'Plumbing',
      insurance_type: 'general_liability',
      tier: 'standard',
      is_required: true,
      gl_each_occurrence: 1000000,
      gl_general_aggregate: 2000000,
      gl_products_completed_ops: 2000000,
      gl_personal_adv_injury: 1000000,
      gl_damage_rented_premises: 300000,
      gl_med_exp: 10000,
      created_date: '2023-01-01T10:00:00Z'
    },
    {
      id: 'req-002',
      program_id: 'program-001',
      trade_name: 'Plumbing',
      insurance_type: 'workers_compensation',
      tier: 'standard',
      is_required: true,
      wc_each_accident: 1000000,
      wc_disease_policy_limit: 1000000,
      wc_disease_each_employee: 1000000,
      created_date: '2023-01-01T10:00:00Z'
    },
    {
      id: 'req-003',
      program_id: 'program-001',
      trade_name: 'Plumbing',
      insurance_type: 'auto_liability',
      tier: 'standard',
      is_required: true,
      auto_combined_single_limit: 1000000,
      created_date: '2023-01-01T10:00:00Z'
    }
  ],
  StateRequirement: [
    {
      id: 'state-req-001',
      state: 'NY',
      insurance_type: 'workers_compensation',
      minimum_coverage: 1000000,
      is_required: true,
      notes: 'New York State requires statutory workers compensation',
      created_date: '2023-01-01T10:00:00Z'
    }
  ],
  GeneratedCOI: [],
  Trade: [
    {
      id: 'trade-001',
      trade_name: 'Plumbing',
      category: 'Mechanical',
      is_active: true,
      requires_professional_liability: false,
      requires_pollution_liability: false,
      created_date: '2023-01-01T10:00:00Z'
    },
    {
      id: 'trade-002',
      trade_name: 'Electrical',
      category: 'Electrical',
      is_active: true,
      requires_professional_liability: false,
      requires_pollution_liability: false,
      created_date: '2023-01-01T10:00:00Z'
    },
    {
      id: 'trade-003',
      trade_name: 'HVAC',
      category: 'Mechanical',
      is_active: true,
      requires_professional_liability: false,
      requires_pollution_liability: false,
      created_date: '2023-01-01T10:00:00Z'
    },
    {
      id: 'trade-004',
      trade_name: 'Concrete',
      category: 'Structural',
      is_active: true,
      requires_professional_liability: false,
      requires_pollution_liability: false,
      created_date: '2023-01-01T10:00:00Z'
    }
  ],
  InsuranceProgram: [
    {
      id: 'program-001',
      name: 'Standard Commercial Program',
      description: 'Standard insurance requirements for commercial projects',
      is_active: true,
      created_date: '2023-01-01T10:00:00Z'
    }
  ],
  Broker: [
    {
      id: 'broker-001',
      company_name: 'NYC Insurance Brokers',
      contact_person: 'Sarah Williams',
      email: 'sarah@nycbrokers.com',
      phone: '212-555-9000',
      status: 'active',
      password: null, // Hashed password will be set when broker sets/resets password
      created_date: '2023-01-01T10:00:00Z'
    }
  ],
  BrokerUploadRequest: [],
  PolicyDocument: [],
  COIDocument: [],
  ComplianceCheck: [],
  Subscription: [],
  ProgramTemplate: [],
  Portal: [],
  Message: [],
  Notification: []
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
      console.log('ℹ️ No existing data file, starting with default sample data');
      // Save initial default data
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

// Load data on startup
loadEntities();

// Run data migration after loading entities
migrateBrokerPasswords();

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
  if (!contractor || contractor.contractor_type !== 'general_contractor') return null;
  if (!forceCreate && !contractor.email) return null;

  const existing = users.find(u =>
    u.gc_id === contractor.id ||
    (contractor.email && (u.email === contractor.email || u.username === contractor.email))
  );

  if (existing) return null;

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
  
  // Handle username conflicts
  let suffix = 1;
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

  // Note: Temporary password should be sent via email, not returned in response
  // Returning userId and username only for confirmation
  return { username, role: 'gc', userId, passwordSet: true };
}

// Ensure seeded GCs get logins (idempotent) - using async/await
(async () => {
  for (const c of entities.Contractor.filter(c => c.contractor_type === 'general_contractor')) {
    await ensureGcLogin(c);
  }
})();

// =======================
// MIDDLEWARE CONFIGURATION
// =======================

// =======================
// SECURITY MIDDLEWARE
// =======================

// Helmet configuration for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

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

// CORS configuration with environment-aware origin validation
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  // Only include localhost URLs in explicit development mode
  ...(process.env.NODE_ENV === 'development' ? [
    'http://localhost:5173',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5175'
  ] : [])
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    console.log('🔍 CORS Request from origin:', origin);
    
    // Allow requests with no origin (mobile apps, curl requests)
    if (!origin) {
      console.log('✅ CORS Allowed (no origin)');
      return callback(null, true);
    }
    
    // Defense-in-depth: Parse URL first to validate format and extract hostname
    // This catches malformed URLs early before any validation logic
    let parsedUrl;
    try {
      parsedUrl = new URL(origin);
    } catch (e) {
      // Invalid URL format - reject immediately
      // Note: Generic log message to avoid leaking validation details
      console.log('❌ CORS Blocked');
      return callback(new Error('CORS not allowed'));
    }
    
    // Check whitelist (exact match)
    const isWhitelisted = ALLOWED_ORIGINS.some(allowed => origin === allowed);
    if (isWhitelisted) {
      console.log('✅ CORS Allowed (whitelisted)');
      return callback(null, true);
    }
    
    // Check if it's a valid GitHub Codespace hostname
    // Using parsed URL hostname prevents bypass attacks via domains like
    // malicious.app.github.dev.attacker.com or attacker.com/.app.github.dev
    const isCodespace = parsedUrl.hostname.endsWith('.app.github.dev');
    if (isCodespace) {
      console.log('✅ CORS Allowed (GitHub Codespace)');
      return callback(null, true);
    }
    
    // Allow in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ CORS Allowed (development mode)');
      return callback(null, true);
    }
    
    console.log('❌ CORS Blocked');
    return callback(new Error('CORS not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600 // 1 hour
}));

app.use(express.json({ limit: '10mb' }));

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
        { expiresIn: '1h' }
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
      { expiresIn: '1h' }
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
    const hasSpecial = /[!@#$%^&*]/.test(newPassword);
    
    if (newPassword.length < minLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      return sendError(res, 400, 'Password must be at least 12 characters and contain uppercase, lowercase, number, and special character (!@#$%^&*)');
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

// Password Reset Request - Generate and send reset token
app.post('/auth/request-password-reset',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email } = req.body;
      
      // Find user by email (check both users array and contractors)
      let user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
      let userType = 'user';
      
      // If not found in users, check contractors (GCs)
      if (!user) {
        const contractor = (entities.Contractor || []).find(c => 
          c.contractor_type === 'general_contractor' && 
          c.email && 
          c.email.toLowerCase() === email.toLowerCase()
        );
        
        if (contractor) {
          user = { email: contractor.email, name: contractor.contact_person || contractor.company_name, id: contractor.id };
          userType = 'gc';
        }
      }
      
      // If not found in contractors, check COIs for broker emails
      if (!user) {
        const coi = (entities.GeneratedCOI || []).find(c => 
          c.broker_email && 
          c.broker_email.toLowerCase() === email.toLowerCase()
        );
        
        if (coi) {
          user = { email: coi.broker_email, name: coi.broker_name || 'Broker', id: coi.id };
          userType = 'broker';
        }
      }
      
      // Always return success to prevent email enumeration
      // But only actually send email if user exists
      if (user) {
        // Generate secure random token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        
        // Store token
        passwordResetTokens.set(email.toLowerCase(), {
          token: resetToken,
          expiresAt,
          used: false,
          userType
        });
        
        // Clean up expired tokens (simple cleanup)
        for (const [key, value] of passwordResetTokens.entries()) {
          if (value.expiresAt < new Date()) {
            passwordResetTokens.delete(key);
          }
        }
        
        // Get frontend URL for reset link
        const getFrontendUrl = (await import('./utils/getFrontendUrl.js')).default;
        const frontendUrl = getFrontendUrl();
        const resetLink = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
        
        // Send password reset email
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.office365.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        
        const mailOptions = {
          from: process.env.SMTP_USER,
          to: email,
          subject: 'Password Reset Request - compliant.team',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Password Reset Request</h2>
              <p>Hello ${user.name || 'User'},</p>
              <p>We received a request to reset your password for your compliant.team account.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" 
                   style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
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
                This is an automated message from compliant.team. Please do not reply to this email.
              </p>
            </div>
          `
        };
        
        try {
          await transporter.sendMail(mailOptions);
          console.log(`✅ Password reset email sent to: ${email}`);
        } catch (emailErr) {
          console.error('Failed to send password reset email:', emailErr);
          // Don't reveal email sending failure to prevent information disclosure
        }
      }
      
      // Always return success (even if email doesn't exist)
      res.json({ 
        success: true, 
        message: 'If an account exists with this email, a password reset link has been sent.' 
      });
      
    } catch (err) {
      console.error('Password reset request error:', err);
      return sendError(res, 500, 'Failed to process password reset request');
    }
});

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
    try {
      const { email, token, newPassword } = req.body;
      
      // Explicit type validation for token parameter
      if (typeof token !== 'string' || token.length === 0) {
        return sendError(res, 400, 'Reset token must be a non-empty string');
      }
      
      // Get stored token
      const storedTokenData = passwordResetTokens.get(email.toLowerCase());
      
      if (!storedTokenData) {
        return sendError(res, 400, 'Invalid or expired reset token');
      }
      
      // Verify token using timing-safe comparison to prevent timing attacks
      if (!timingSafeEqual(storedTokenData.token, token)) {
        return sendError(res, 400, 'Invalid reset token');
      }
      
      // Check if token is expired
      if (storedTokenData.expiresAt < new Date()) {
        passwordResetTokens.delete(email.toLowerCase());
        return sendError(res, 400, 'Reset token has expired');
      }
      
      // Check if token has been used
      if (storedTokenData.used) {
        return sendError(res, 400, 'Reset token has already been used');
      }
      
      // Validate new password (12 characters minimum with complexity)
      const minLength = 12;
      const hasUppercase = /[A-Z]/.test(newPassword);
      const hasLowercase = /[a-z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      const hasSpecial = /[!@#$%^&*]/.test(newPassword);
      
      if (newPassword.length < minLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
        return sendError(res, 400, 'Password must be at least 12 characters and contain uppercase, lowercase, number, and special character (!@#$%^&*)');
      }
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password based on user type
      if (storedTokenData.userType === 'user') {
        const userIndex = users.findIndex(u => u.email && u.email.toLowerCase() === email.toLowerCase());
        if (userIndex !== -1) {
          users[userIndex].password = hashedPassword;
          users[userIndex].password_changed_at = new Date().toISOString();
          console.log(`✅ Password reset for user: ${email}`);
        }
      } else if (storedTokenData.userType === 'gc') {
        const gcIndex = (entities.Contractor || []).findIndex(c => 
          c.contractor_type === 'general_contractor' && 
          c.email && 
          c.email.toLowerCase() === email.toLowerCase()
        );
        if (gcIndex !== -1) {
          entities.Contractor[gcIndex].password = hashedPassword;
          debouncedSave();
          console.log(`✅ Password reset for GC: ${email}`);
        }
      } else if (storedTokenData.userType === 'broker') {
        // Update broker password in centralized Broker table (read-only, does NOT create)
        const broker = getBroker(email);
        if (broker) {
          const brokerIndex = entities.Broker.findIndex(b => b.id === broker.id);
          if (brokerIndex !== -1) {
            entities.Broker[brokerIndex].password = hashedPassword;
            entities.Broker[brokerIndex].password_changed_at = new Date().toISOString();
            debouncedSave();
            console.log(`✅ Password reset for broker: ${email}`);
          }
        } else {
          return sendError(res, 404, 'Broker account not found');
        }
      }
      
      // Mark token as used
      storedTokenData.used = true;
      
      // Remove token after successful reset
      setTimeout(() => {
        passwordResetTokens.delete(email.toLowerCase());
      }, 5000);
      
      res.json({ 
        success: true, 
        message: 'Password has been reset successfully. You can now log in with your new password.' 
      });
      
    } catch (err) {
      console.error('Password reset error:', err);
      return sendError(res, 500, 'Failed to reset password');
    }
  });

// Entity endpoints
// Get archived entities (Admin only) - Must be before generic route
app.get('/entities/:entityName/archived', authenticateToken, requireAdmin, (req, res) => {
  const { entityName } = req.params;
  
  if (!entities[entityName]) {
    return sendError(res, 404, `Entity ${entityName} not found`);
  }

  const archivedItems = entities[entityName].filter(item => item.isArchived === true || item.status === 'archived');
  
  sendSuccess(res, archivedItems);
});

app.get('/entities/:entityName', authenticateToken, (req, res) => {
  const { entityName } = req.params;
  const { sort, id, includeArchived } = req.query;
  
  if (!entities[entityName]) {
    return res.status(404).json({ error: `Entity ${entityName} not found` });
  }

  let data = entities[entityName];
  
  // If id is provided, return single entity
  if (id) {
    const item = data.find(item => item.id === id);
    // Filter archived items unless explicitly requested
    if (!item || (includeArchived !== 'true' && (item.isArchived || item.status === 'archived'))) {
      return res.status(404).json({ error: `${entityName} with id '${id}' not found` });
    }
    return res.json(item);
  }
  
  // Filter out archived items by default (unless includeArchived=true)
  if (includeArchived !== 'true') {
    data = data.filter(item => !item.isArchived && item.status !== 'archived');
  }
  
  // Simple sorting with whitelist validation
  if (sort) {
    // Whitelist of allowed sort fields to prevent property pollution
    const allowedSortFields = ['id', 'email', 'created_date', 'name', 'company_name', 'status', 'createdAt'];
    
    if (!allowedSortFields.includes(sort)) {
      return sendError(res, 400, `Invalid sort field. Allowed fields: ${allowedSortFields.join(', ')}`);
    }
    
    data = [...data].sort((a, b) => {
      const aVal = a[sort] || '';
      const bVal = b[sort] || '';
      return aVal > bVal ? 1 : -1;
    });
  }

  res.json(data);
});

app.post('/entities/:entityName/query', authenticateToken, (req, res) => {
  const { entityName } = req.params;
  const filters = req.body;
  
  if (!entities[entityName]) {
    return res.status(404).json({ error: `Entity ${entityName} not found` });
  }

  let data = entities[entityName];
  
  // Simple filtering
  if (filters && Object.keys(filters).length > 0) {
    data = data.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        return item[key] === value;
      });
    });
  }

  res.json(data);
});

app.post('/entities/:entityName', apiLimiter, authenticateToken, async (req, res) => {
  const { entityName } = req.params;
  const data = req.body;
  
  if (!entities[entityName]) {
    return res.status(404).json({ error: `Entity ${entityName} not found` });
  }

  const newItem = {
    id: `${entityName}-${Date.now()}`,
    ...data,
    createdAt: new Date().toISOString(),
    createdBy: req.user.id
  };

  let gcLogin = null;
  if (entityName === 'Contractor' && data.contractor_type === 'general_contractor') {
    gcLogin = await ensureGcLogin(newItem, { forceCreate: true });
    if (gcLogin) {
      newItem.gc_login_created = true;
    }
  }

  entities[entityName].push(newItem);
  
  // Persist to disk
  debouncedSave();
  
  const responsePayload = gcLogin ? { ...newItem, gcLogin } : newItem;
  res.status(201).json(responsePayload);
});

app.patch('/entities/:entityName/:id', authenticateToken, (req, res) => {
  const { entityName, id } = req.params;
  const updates = req.body;
  
  if (!entities[entityName]) {
    return res.status(404).json({ error: `Entity ${entityName} not found` });
  }

  const index = entities[entityName].findIndex(item => item.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  entities[entityName][index] = {
    ...entities[entityName][index],
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.id
  };

  // Persist to disk
  debouncedSave();

  res.json(entities[entityName][index]);
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

// Public email endpoint - no authentication required (for broker portal)
app.post('/public/send-email', emailLimiter, async (req, res) => {
  const { to, subject, body, html, cc, bcc, from, replyTo } = req.body || {};
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

  console.log('📧 Public email send request:', { to, subject, hasSmtpHost: !!smtpHost, hasSmtpService: !!smtpService });

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

    const mailOptions = {
      from: from || defaultFrom,
      to,
      subject,
      html: html || body
    };
    
    // Only add optional fields if they exist
    if (cc) mailOptions.cc = cc;
    if (bcc) mailOptions.bcc = bcc;
    if (replyTo) mailOptions.replyTo = replyTo;

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

app.post('/integrations/send-email', authenticateToken, async (req, res) => {
  const { to, subject, body, html, cc, bcc, from, replyTo } = req.body || {};
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

      info = await transporter.sendMail({
        from: from || defaultFrom,
        to,
        cc,
        bcc,
        replyTo,
        subject,
        text: body || undefined,
        html: html || undefined,
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

    const list = (entities.GeneratedCOI || []).filter(c => {
      // If both name and email provided, BOTH must match
      if (lowerName && lowerEmail) {
        const matchesGlobal = 
          c.broker_email?.toLowerCase().trim() === lowerEmail &&
          c.broker_name?.toLowerCase().trim() === lowerName;
        
        const matchesGL = 
          c.broker_gl_email?.toLowerCase().trim() === lowerEmail &&
          c.broker_gl_name?.toLowerCase().trim() === lowerName;
        
        const matchesAuto = 
          c.broker_auto_email?.toLowerCase().trim() === lowerEmail &&
          c.broker_auto_name?.toLowerCase().trim() === lowerName;
        
        const matchesUmbrella = 
          c.broker_umbrella_email?.toLowerCase().trim() === lowerEmail &&
          c.broker_umbrella_name?.toLowerCase().trim() === lowerName;
        
        const matchesWC = 
          c.broker_wc_email?.toLowerCase().trim() === lowerEmail &&
          c.broker_wc_name?.toLowerCase().trim() === lowerName;
        
        return matchesGlobal || matchesGL || matchesAuto || matchesUmbrella || matchesWC;
      }
      
      // Fallback to name-only matching
      if (lowerName && !lowerEmail) {
        return (
          c.broker_name?.toLowerCase().includes(lowerName) ||
          c.broker_gl_name?.toLowerCase().includes(lowerName) ||
          c.broker_auto_name?.toLowerCase().includes(lowerName) ||
          c.broker_umbrella_name?.toLowerCase().includes(lowerName) ||
          c.broker_wc_name?.toLowerCase().includes(lowerName)
        );
      }
      
      // Fallback to email-only matching
      if (lowerEmail && !lowerName) {
        return (
          c.broker_email?.toLowerCase().trim() === lowerEmail ||
          c.broker_gl_email?.toLowerCase().trim() === lowerEmail ||
          c.broker_auto_email?.toLowerCase().trim() === lowerEmail ||
          c.broker_umbrella_email?.toLowerCase().trim() === lowerEmail ||
          c.broker_wc_email?.toLowerCase().trim() === lowerEmail
        );
      }
      return false;
    }).sort((a, b) => new Date(b.created_date || b.created_at || 0) - new Date(a.created_date || a.created_at || 0));

    return res.json(list);
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
      // Try to find company/person name patterns
      const namePattern = /([A-Z][a-zA-Z\s&,.']+(?:LLC|Inc|Corp|Company|Corporation|Ltd)?)/;
      const matches = text.match(namePattern);
      if (matches && matches.length > 0) {
        extracted[fieldName] = matches[0].trim();
      }
    }
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

// Public: Program review for insurance requirements (no auth)
app.post('/public/program-review', publicApiLimiter, async (req, res) => {
  try {
    const { file_url, requirements = {} } = req.body || {};
    if (!file_url) return res.status(400).json({ error: 'file_url is required' });

    // Extract text from program PDF (Adobe PDF Services mock in dev)
    const extracted = await adobePDF.extractText(file_url);

    // Basic heuristics to collect known data points
    const programData = {
      source: file_url,
      pages: extracted.pages,
      metadata: extracted.metadata,
      text_preview: (extracted.text || '').substring(0, 1000),
    };

    // AI compliance review based on extracted text
    const policyData = await aiAnalysis.extractPolicyData(extracted.text || '', 'program');
    const compliance = await aiAnalysis.analyzeCOICompliance(policyData, requirements);
    const recommendations = await aiAnalysis.generateRecommendations(policyData, compliance.deficiencies);
    const risk = await aiAnalysis.assessRisk(policyData, requirements);

    return res.json({
      status: 'success',
      programData,
      policyData,
      compliance,
      recommendations,
      risk
    });
  } catch (err) {
    console.error('public program-review error:', err?.message || err);
    return res.status(500).json({ error: 'Program review failed' });
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
    const broker = getBroker(email);
    
    // Always perform bcrypt comparison to prevent timing attacks
    const passwordToCheck = (broker && broker.password) ? broker.password : DUMMY_PASSWORD_HASH;
    const isPasswordValid = await bcrypt.compare(password, passwordToCheck);
    
    // Generic error message to prevent account enumeration
    if (!broker || !broker.password || !isPasswordValid) {
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
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find GC contractor by email
    const gc = (entities.Contractor || []).find(c => 
      c.contractor_type === 'general_contractor' && 
      c.email && 
      c.email.toLowerCase() === email.toLowerCase()
    );

    // Always perform bcrypt comparison to prevent timing attacks
    const passwordToCheck = (gc && gc.password) ? gc.password : DUMMY_PASSWORD_HASH;
    const isPasswordValid = await bcrypt.compare(password, passwordToCheck);
    
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
    const hasSpecial = /[!@#$%^&*]/.test(password);
    
    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({ 
        error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)' 
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
    const hasSpecial = /[!@#$%^&*]/.test(password);
    
    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({ 
        error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)' 
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
app.post('/admin/generate-coi', authenticateToken, (req, res) => {
  try {
    const { coi_id } = req.body || {};
    if (!coi_id) return res.status(400).json({ error: 'coi_id is required' });

    const coiIdx = (entities.GeneratedCOI || []).findIndex(c => c.id === String(coi_id));
    if (coiIdx === -1) return res.status(404).json({ error: 'COI not found' });

    const generatedUrl = `https://storage.example.com/coi-${coi_id}-${Date.now()}.pdf`;
    entities.GeneratedCOI[coiIdx] = {
      ...entities.GeneratedCOI[coiIdx],
      first_coi_url: generatedUrl,
      first_coi_uploaded: true,
      uploaded_for_review_date: new Date().toISOString(),
      status: 'pending',
      coi_source: 'system_generated'
    };
    debouncedSave();
    return res.json(entities.GeneratedCOI[coiIdx]);
  } catch (err) {
    console.error('admin generate-coi error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to generate COI' });
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
    entities.GeneratedCOI[coiIdx] = {
      ...coi,
      admin_signature_url: signature_url || `https://storage.example.com/admin-signature-${Date.now()}.png`,
      final_coi_url: signedUrl,
      status: coi.status === 'pending' ? 'pending' : coi.status,
      signed_at: new Date().toISOString()
    };
    debouncedSave();
    return res.json(entities.GeneratedCOI[coiIdx]);
  } catch (err) {
    console.error('admin sign-coi error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to sign COI' });
  }
});

// Parse insurance program PDF -> structured program + requirements
app.post('/integrations/parse-program-pdf', authenticateToken, async (req, res) => {
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
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`compliant.team Backend running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`CORS allowed: ${process.env.FRONTEND_URL || '*'}`);
    console.log(`✅ Security: Helmet enabled, Rate limiting active`);
    
    // Email service status
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
  });
  
  server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });
}

// Export for Vercel serverless
export default app;
