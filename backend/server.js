import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import pdfParse from 'pdf-parse';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import multer from 'multer';

// Import configuration
import { getJWTSecret, initializeJWTSecret, PORT, DEFAULT_ADMIN_EMAILS, RENEWAL_LOOKAHEAD_DAYS, BINDER_WINDOW_DAYS } from './config/env.js';
import { entities, loadEntities, saveEntities, debouncedSave, findValidCOIForSub, UPLOADS_DIR } from './config/database.js';
import { upload } from './config/upload.js';

// Import middleware
import { apiLimiter, authLimiter, uploadLimiter, emailLimiter, publicApiLimiter } from './middleware/rateLimiting.js';
import { sendError, sendSuccess, handleValidationErrors } from './middleware/validation.js';
import { authenticateToken, requireAdmin, initializeAuthMiddleware, optionalAuthentication, blockInternalEntities } from './middleware/auth.js';
import logger from './config/logger.js';
import { correlationId, requestLogger, errorLogger } from './middleware/requestLogger.js';
import { logAuth, AuditEventType } from './middleware/auditLogger.js';
import { healthCheckHandler, readinessCheckHandler, livenessCheckHandler } from './middleware/healthCheck.js';
import { trackConnection, setupGracefulShutdown } from './middleware/gracefulShutdown.js';
import { sanitizeInput, escapeHtml } from './middleware/inputSanitization.js';
import { validateEnvironment } from './middleware/envValidation.js';
import { errorHandler, notFoundHandler, ValidationError } from './middleware/errorHandler.js';
import { metricsMiddleware, metricsHandler } from './middleware/metrics.js';
import idempotency from './middleware/idempotency.js';
import cacheControl from './middleware/cacheControl.js';
import compression from 'compression';

// Import Swagger documentation
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';

// Import services
import { timingSafeEqual, DUMMY_PASSWORD_HASH } from './services/authService.js';

// Import utilities
import { validateAndSanitizeFilename, verifyPathWithinDirectory, validateEmail, maskEmail } from './utils/helpers.js';
import { getBroker, getOrCreateBroker } from './utils/brokerHelpers.js';
import { users, passwordResetTokens } from './utils/users.js';
import { getPasswordResetEmail, getDocumentReplacementNotificationEmail, createEmailTemplate } from './utils/emailTemplates.js';

// Import integration services
import AdobePDFService from './integrations/adobe-pdf-service.js';
import AIAnalysisService from './integrations/ai-analysis-service.js';

// Initialize Adobe PDF Service with error handling
let adobePDF;
try {
  adobePDF = new AdobePDFService({
    apiKey: process.env.ADOBE_API_KEY,
    clientId: process.env.ADOBE_CLIENT_ID
  });
  logger.info('Adobe PDF Service initialized successfully');
} catch (error) {
  logger.warn('Failed to initialize Adobe PDF Service, running in fallback mode', {
    error: error.message,
    stack: error.stack
  });
  adobePDF = new AdobePDFService(); // Initialize with defaults
}

// Initialize AI Analysis Service with error handling
let aiAnalysis;
try {
  aiAnalysis = new AIAnalysisService({
    provider: process.env.AI_PROVIDER || 'openai',
    apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY,
    model: process.env.AI_MODEL || 'gpt-4-turbo-preview'
  });
  logger.info('AI Analysis Service initialized successfully', {
    provider: process.env.AI_PROVIDER || 'openai',
    model: process.env.AI_MODEL || 'gpt-4-turbo-preview'
  });
} catch (error) {
  logger.warn('Failed to initialize AI Analysis Service, running in fallback mode', {
    error: error.message,
    stack: error.stack
  });
  aiAnalysis = new AIAnalysisService(); // Initialize with defaults
}

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Auth middleware will be initialized after JWT_SECRET is loaded

// Trust proxy for rate limiting with X-Forwarded-For header
app.set('trust proxy', 1);

// =======================
// DATA MIGRATION AND SEEDING
// =======================

/**
 * Data migration: Move broker passwords from COI records to centralized Broker table
 * This migration is idempotent and can be run multiple times safely
 * 
 * Migration state is tracked to prevent redundant processing:
 * - Check if migration has already been completed
 * - Only process brokers that haven't been migrated yet
 * - Mark migration as complete when finished
 */
function migrateBrokerPasswords() {
  // Check if migration has already been completed
  if (!entities._migrations) {
    entities._migrations = {};
  }

  // Skip if already migrated
  if (entities._migrations.brokerPasswordsMigrated) {
    logger.debug('Broker password migration already completed, skipping');
    return;
  }

  let migratedCount = 0;
  let cleanupSuccessful = false;

  try {
    const brokerPasswordMap = new Map();
    (entities.GeneratedCOI || []).forEach((coi, index) => {
      if (coi.broker_email && coi.broker_password) {
        const email = String(coi.broker_email).toLowerCase();
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

          if (existing.uniquePasswords.size > 1 && !existing.conflictLogged) {
            const maskedEmail = maskEmail(email);
            logger.warn('Password conflict detected for broker', {
              maskedEmail,
              uniquePasswordsCount: existing.uniquePasswords.size,
              recordCount: existing.count,
              action: 'keeping first password'
            });
            existing.conflictLogged = true;
          }
        }
      }
    });

    brokerPasswordMap.forEach((data, email) => {
      const broker = getOrCreateBroker(email);
      if (broker && !broker.password) {
        const brokerIndex = entities.Broker.findIndex(b => b.id === broker.id);
        if (brokerIndex !== -1) {
          entities.Broker[brokerIndex].password = data.password;
          migratedCount++;

          if (data.count > 1) {
            const maskedEmail = maskEmail(email);
            logger.info('Migrated broker password', {
              maskedEmail,
              recordCount: data.count,
              action: 'consolidated from multiple COI records'
            });
          }
        }
      }
    });

    cleanupSuccessful = true;
  } catch (error) {
    logger.error('Error migrating broker passwords', {
      error: error.message,
      stack: error.stack
    });
    cleanupSuccessful = false;
  }

  if (cleanupSuccessful) {
    try {
      entities.GeneratedCOI = (entities.GeneratedCOI || []).map(coi => {
        if (coi.broker_password) {
          // eslint-disable-next-line no-unused-vars
          const { broker_password, ...rest } = coi;
          return rest;
        }
        return coi;
      });

      // Mark migration as complete
      entities._migrations.brokerPasswordsMigrated = true;
      entities._migrations.brokerPasswordsMigratedAt = new Date().toISOString();

      if (migratedCount > 0) {
        logger.info('Broker password migration completed', {
          migratedCount,
          action: 'migrated to centralized Broker table'
        });
        debouncedSave();
      } else {
        logger.debug('Broker password migration completed with no new migrations');
      }
    } catch (cleanupError) {
      logger.error('Error during migration cleanup', {
        error: cleanupError.message,
        stack: cleanupError.stack
      });
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
          if (broker) seenEmails.add(email);
        });
      }
    });

    (entities.GeneratedCOI || []).forEach(coi => {
      const email = (coi.broker_email || '').toLowerCase();
      if (!email || seenEmails.has(email)) return;
      const broker = getOrCreateBroker(email, {
        broker_name: coi.broker_name || email,
        company_name: coi.broker_name || 'Unknown',
        contact_person: coi.broker_name || email,
      });
      if (broker) seenEmails.add(email);
    });

    if (seenEmails.size > 0) {
      logger.info('Broker seeding completed', {
        seededCount: seenEmails.size,
        action: 'seeded from existing data'
      });
      debouncedSave();
    } else {
      logger.debug('No new broker records to seed');
    }
  } catch (err) {
    logger.warn('Broker seeding error', {
      error: err?.message || err,
      stack: err?.stack
    });
  }
}

// Load data on startup - will be awaited in server initialization
// Temporary for module-level, but properly awaited during server startup
let dataLoaded = false;
async function initializeData() {
  if (!dataLoaded) {
    await loadEntities();
    dataLoaded = true;
    // Ensure broker records exist for authentication
    seedBrokersFromData();
  }
}

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
    if (!realGCs.length) return;

    placeholders.forEach(ph => {
      entities.Contractor = entities.Contractor.filter(c => c.id !== ph.id);
      if (entities.User) {
        entities.User = entities.User.filter(u => u.gc_id !== ph.id);
      }
      if (entities.Portal) {
        entities.Portal = entities.Portal.filter(p => p.user_id !== ph.id);
      }
      logger.info('Removed placeholder GC record', {
        companyName: ph.company_name,
        gcId: ph.id
      });
    });

    debouncedSave();
  } catch (err) {
    logger.warn('Placeholder GC cleanup failed', {
      error: err?.message || err,
      stack: err?.stack
    });
  }
}

cleanupPlaceholderGCs();

// Remove invalid program references and normalize program names
function cleanupInvalidPrograms() {
  try {
    const programs = entities.InsuranceProgram || [];
    const validProgramIds = new Set(programs.map(p => p.id));
    if (validProgramIds.size === 0) return;

    let changed = false;

    if (Array.isArray(entities.SubInsuranceRequirement)) {
      const before = entities.SubInsuranceRequirement.length;
      entities.SubInsuranceRequirement = entities.SubInsuranceRequirement.filter(req =>
        !req?.program_id || validProgramIds.has(req.program_id)
      );
      if (entities.SubInsuranceRequirement.length !== before) changed = true;
    }

    if (Array.isArray(entities.Project)) {
      entities.Project = entities.Project.map(project => {
        if (!project?.program_id) return project;
        if (!validProgramIds.has(project.program_id)) {
          changed = true;
          return {
            ...project,
            program_id: '',
            program_name: '',
            needs_admin_setup: true
          };
        }
        const program = programs.find(p => p.id === project.program_id);
        const normalizedName = program?.name || program?.program_name || '';
        if (normalizedName && project.program_name !== normalizedName) {
          changed = true;
          return { ...project, program_name: normalizedName };
        }
        return project;
      });
    }

    if (changed) {
      debouncedSave();
      logger.info('Cleaned invalid program references');
    }
  } catch (err) {
    logger.warn('Program cleanup failed', { error: err?.message || err });
  }
}

cleanupInvalidPrograms();

// Ensure there is at least one GC account for portal login in empty datasets
function ensureDefaultGC() {
  const contractors = entities.Contractor || [];
  const hasGC = contractors.some(c => c.contractor_type === 'general_contractor');
  if (hasGC) return;

  // Use environment variable for default password
  const defaultPassword = process.env.DEFAULT_GC_PASSWORD || 'GCpassword123!';
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
  // SECURITY FIX: Don't log passwords in plaintext
  logger.info('Seeded default GC account for portal login', { email: gc.email });
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
    logger.info('Ensured default trades present', { added });
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
    logger.info('No tier-based requirements found in PDF, creating default structure');
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
// (Password hashing and authentication functions now in services/authService.js and utils/users.js)

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
    logger.debug('ensureGcLogin early return 1: no contractor or wrong type');
    return null;
  }
  if (!forceCreate && !contractor.email) {
    logger.debug('ensureGcLogin early return 2: no forceCreate and no email');
    return null;
  }

  // Check if contractor already has a stored password - if so, don't regenerate it
  if (contractor.password && !forceCreate) {
    logger.info('ensureGcLogin: contractor already has password stored, skipping regeneration', {
      contractorId: contractor.id,
      email: contractor.email
    });
    return null;
  }

  // Check if this specific contractor already has a login
  const existingForThisContractor = users.find(u => u.gc_id === contractor.id);
  if (existingForThisContractor) {
    logger.debug('ensureGcLogin early return 3: contractor already has login', {
      contractorId: contractor.id,
      existingUserId: existingForThisContractor.id
    });
    return null;
  }

  // Don't block if email exists in other contractors - allow multiple GCs with same contact email
  // This is valid in multi-contractor scenarios
  logger.info('ensureGcLogin proceeding to create', {
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
  const _baseUsername = username;
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
  logger.debug('ensureGcLogin returning', {
    username: returnValue.username,
    hasPassword: !!returnValue.password,
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
    logger.error('Error ensuring GC logins', { error: err?.message, stack: err?.stack });
  }
})();

// =======================
// MIDDLEWARE CONFIGURATION
// =======================

// =======================
// SECURITY MIDDLEWARE (Helmet first)
// =======================

// Helmet configuration for security headers
// SECURITY FIX: Re-enabled Helmet for production security
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

// =======================
// CORS MIDDLEWARE (must come before body parser and routing)
// =======================

// Simple, manual CORS middleware that runs on ALL requests/responses
// This ensures CORS headers are set BEFORE any route handler or error handler
app.use((req, res, next) => {
  // SECURITY FIX: Use explicit origin whitelist instead of echoing any origin
  const requestOrigin = req.headers.origin;
  const envOrigin = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL;
  
  // Define allowed origins (whitelist approach)
  const allowedOrigins = [
    envOrigin,
    'http://localhost:5175',
    'http://localhost:3000',
    'http://127.0.0.1:5175',
    'http://127.0.0.1:3000'
  ].filter(Boolean); // Remove undefined/null values

  const isGithubDevOrigin = typeof requestOrigin === 'string' &&
    (requestOrigin.startsWith('https://') || requestOrigin.startsWith('http://')) &&
    requestOrigin.endsWith('.app.github.dev');

  // SECURITY: Only allow whitelisted origins, fallback to first allowed origin or localhost
  let allowOrigin;
  if (allowedOrigins.includes(requestOrigin) || isGithubDevOrigin) {
    allowOrigin = requestOrigin;
  } else {
    // Fallback to configured origin or localhost for development
    allowOrigin = allowedOrigins[0] || 'http://localhost:5175';
  }

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

// Also use the cors package as backup (with explicit origin whitelist)
// SECURITY FIX: Changed from 'origin: true' to explicit whitelist
app.use(cors({
  origin: function (origin, callback) {
    const envOrigin = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL;
    const allowedOrigins = [
      envOrigin,
      'http://localhost:5175',
      'http://localhost:3000',
      'http://127.0.0.1:5175',
      'http://127.0.0.1:3000'
    ].filter(Boolean);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const isGithubDevOrigin = typeof origin === 'string' &&
      (origin.startsWith('https://') || origin.startsWith('http://')) &&
      origin.endsWith('.app.github.dev');

    if (allowedOrigins.includes(origin) || isGithubDevOrigin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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
// ENTERPRISE MIDDLEWARE
// =======================

// Response compression (gzip) for bandwidth optimization
app.use(compression({
  filter: (req, res) => {
    // Don't compress responses with Cache-Control: no-transform
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Compression level (0-9, 6 is default balance)
}));

// Add correlation ID to all requests for tracing
app.use(correlationId);

// Track active connections for graceful shutdown
app.use(trackConnection);

// Prometheus metrics collection
app.use(metricsMiddleware);

// Request logging (morgan + winston)
app.use(requestLogger);

// Input sanitization middleware
app.use(sanitizeInput());

// Cache control headers
app.use(cacheControl());

// =======================
// RATE LIMITING MIDDLEWARE
// =======================

// =======================
// RATE LIMITING AND MIDDLEWARE
// =======================
// (Rate limiters now imported from middleware/rateLimiting.js)

// Apply rate limiting to routes
app.use('/api/', apiLimiter);
app.use('/entities/', apiLimiter);
app.use('/auth/login', authLimiter);

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));
logger.info('Serving uploads from', { directory: UPLOADS_DIR });

// =======================
// UTILITY MIDDLEWARE
// =======================
// (Response formatters and validation now imported from middleware/validation.js)
// (Auth middleware now imported from middleware/auth.js)

// =======================
// API DOCUMENTATION
// =======================
/**
 * @swagger
 * /:
 *   get:
 *     summary: API Information
 *     description: Returns basic API information and links to documentation
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API information
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Compliant4 API',
    version: '1.0.0',
    description: 'Insurance tracking application for General Contractors',
    documentation: '/api-docs',
    health: '/health',
    timestamp: new Date().toISOString(),
  });
});

// Swagger UI - Enterprise API Documentation
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Compliant4 API Documentation',
  customfavIcon: '/favicon.ico',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
}));

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

logger.info('API documentation available at /api-docs');

// Enhanced health check endpoints
// Health endpoint with optional authentication for detailed metrics
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health Check
 *     description: Returns the health status of the API. Use ?detailed=true with authentication for detailed metrics
 *     tags: [Health]
 *     parameters:
 *       - in: query
 *         name: detailed
 *         schema:
 *           type: boolean
 *         description: Include detailed system metrics (requires authentication)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
app.get('/health', optionalAuthentication, healthCheckHandler);

/**
 * @swagger
 * /health/readiness:
 *   get:
 *     summary: Readiness Probe
 *     description: Kubernetes readiness probe - checks if service is ready to accept traffic
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
app.get('/health/readiness', readinessCheckHandler);

/**
 * @swagger
 * /health/liveness:
 *   get:
 *     summary: Liveness Probe
 *     description: Kubernetes liveness probe - checks if service is alive
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 */
app.get('/health/liveness', livenessCheckHandler);

/**
 * @swagger
 * /debug/health:
 *   get:
 *     summary: Debug Health Check
 *     description: Extended health check endpoint for debugging with detailed server status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 */
app.get('/debug/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Prometheus Metrics
 *     description: Returns metrics in Prometheus format for monitoring and alerting
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics in Prometheus format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
app.get('/metrics', authenticateToken, metricsHandler);

// Auth endpoints with validation
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login
 *     description: Authenticate user and receive JWT tokens
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username or email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: JWT access token (24h expiry)
 *                 refreshToken:
 *                   type: string
 *                   description: JWT refresh token (7d expiry)
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         description: Too many login attempts
 */
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
        // Audit failed login attempt
        logAuth(AuditEventType.LOGIN_FAILURE, username, false, {
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          correlationId: req.correlationId,
        });
        return sendError(res, 401, 'Invalid credentials');
      }

      const accessToken = jwt.sign(
        { id: user.id, username: user.username, email: user.email, role: user.role },
        getJWTSecret(),
        { expiresIn: '24h' }
      );
      
      const refreshToken = jwt.sign(
        { id: user.id, username: user.username, email: user.email, role: user.role },
        getJWTSecret(),
        { expiresIn: '7d' }
      );

      // Audit successful login
      logAuth(AuditEventType.LOGIN_SUCCESS, username, true, {
        userId: user.id,
        role: user.role,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        correlationId: req.correlationId,
      });

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
      logger.error('Login error', { error: err.message, stack: err.stack, correlationId: req.correlationId });
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
    const decoded = jwt.verify(refreshToken, getJWTSecret());
    
    const accessToken = jwt.sign(
      { id: decoded.id, username: decoded.username, email: decoded.email, role: decoded.role },
      getJWTSecret(),
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
    const hasSpecial = /[!@#$%^&*()_+=[\]{};':"\\|,.<>/?-]/.test(newPassword);
    
    if (newPassword.length < minLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      return sendError(res, 400, 'Password must be at least 12 characters and contain uppercase, lowercase, number, and special character');
    }
    
    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    users[userIndex].password = hashedPassword;
    users[userIndex].must_change_password = false;
    users[userIndex].password_changed_at = new Date().toISOString();
  
    logger.info('Password changed for user', { email: users[userIndex].email });
    
    sendSuccess(res, { 
      message: 'Password changed successfully',
      must_change_password: false
    });
  } catch (err) {
    logger.error('Password change error', { error: err?.message, stack: err?.stack });
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
      
      // Create transporter
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpService = process.env.SMTP_SERVICE;
      
      let transporter;
      if (!smtpHost && !smtpService) {
        // Mock transporter for development
        transporter = {
          sendMail: async (options) => {
            logger.info('MOCK EMAIL', {
              from: options.from,
              to: options.to,
              subject: options.subject
            });
            return { messageId: `mock-${Date.now()}` };
          }
        };
      } else {
        const config = {};
        if (smtpService) {
          config.service = smtpService;
        } else if (smtpHost) {
          config.host = smtpHost;
          config.port = smtpPort;
          config.secure = smtpPort === 465;
        }
        if (smtpUser && smtpPass) {
          config.auth = { user: smtpUser, pass: smtpPass };
        }
        transporter = nodemailer.createTransport(config);
      }
      
      const mailOptions = {
        from: process.env.SMTP_USER || process.env.SMTP_FROM || 'noreply@insuretrack.com',
        to: email,
        subject: 'Password Reset Request - compliant.team',
        html: getPasswordResetEmail(user.name || 'User', resetLink, userType)
      };
      
      try {
        await transporter.sendMail(mailOptions);
        logger.info('Password reset email sent', { email });
      } catch (emailErr) {
        logger.error('Failed to send password reset email', { error: emailErr?.message });
      }
    }
    
    // Always return success to prevent email enumeration
    return res.json({ 
      success: true, 
      message: 'If an account exists with this email, a password reset link has been sent.' 
    });
  } catch (err) {
    logger.error('handlePasswordResetRequest error', { error: err?.message || err });
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
    // SECURITY FIX: Use timing-safe comparison for token validation
    // timingSafeEqual handles different lengths safely by returning false
    const tokenMatches = storedTokenData.token && token && 
                        timingSafeEqual(storedTokenData.token, token);
    
    if (!tokenMatches || storedTokenData.expiresAt < Date.now()) {
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
        logger.info('GC password reset', { email });
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
        logger.info('Broker password reset', { email });
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
        logger.info('Subcontractor password reset', { email });
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
    logger.error('handlePasswordReset error', { error: err?.message || err });
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
app.get('/entities/:entityName/archived', authenticateToken, blockInternalEntities, requireAdmin, (req, res) => {
  const { entityName } = req.params;
  if (!entities[entityName]) {
    return sendError(res, 404, `Entity ${entityName} not found`);
  }
  const archivedItems = entities[entityName].filter(item => item.isArchived === true || item.status === 'archived');
  sendSuccess(res, archivedItems);
});

// List or read one
app.get('/entities/:entityName', authenticateToken, blockInternalEntities, (req, res) => {
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
app.get('/entities/:entityName/query', authenticateToken, blockInternalEntities, (req, res) => {
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
app.post('/entities/:entityName', authenticateToken, blockInternalEntities, idempotency(), async (req, res) => {
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
    
    // Optimize email/username checks with Set for O(1) lookup instead of repeated O(n) .find() calls
    const existingEmails = new Set([...users.map(u => u.email), ...entities.User.map(u => u.email)]);
    const existingUsernames = new Set(users.map(u => u.username));
    
    if (existingEmails.has(data.email)) return res.status(400).json({ error: 'Email already exists' });
    const username = data.username || data.email.split('@')[0];
    if (existingUsernames.has(username)) return res.status(400).json({ error: 'Username already exists' });
    
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
    logger.info('Creating GC - calling ensureGcLogin for contractor', {
      contractorId: newItem.id,
      contractorType: data.contractor_type,
      email: data.email
    });
    gcLogin = await ensureGcLogin(newItem, { forceCreate: true });
    logger.info('ensureGcLogin returned', {
      gcLoginExists: !!gcLogin,
      gcLoginKeys: gcLogin ? Object.keys(gcLogin) : null,
      hasPassword: gcLogin?.password ? 'YES' : 'NO',
      passwordLength: gcLogin?.password?.length || 0
    });
    if (gcLogin) {
      newItem.gc_login_created = true;
      logger.info('GC Login created', {
        username: gcLogin.username,
        hasPassword: !!gcLogin.password,
        passwordLength: gcLogin.password?.length || 0
      });
    } else {
      logger.warn('ensureGcLogin returned null/falsy');
    }
  }
  entities[entityName].push(newItem);
  debouncedSave();
  const responsePayload = gcLogin ? { ...newItem, gcLogin } : newItem;
  logger.info('Contractor creation response payload', {
    hasGcLogin: !!responsePayload.gcLogin,
    responseKeys: Object.keys(responsePayload).slice(0, 10)
  });
  res.status(201).json(responsePayload);
});

// Get single entity by ID
app.get('/entities/:entityName/:id', authenticateToken, blockInternalEntities, (req, res) => {
  const { entityName, id } = req.params;
  const { includeArchived } = req.query;
  
  if (!entities[entityName]) {
    return res.status(404).json({ error: `Entity ${entityName} not found` });
  }
  
  const item = entities[entityName].find(item => item.id === id);
  if (!item || (includeArchived !== 'true' && (item.isArchived || item.status === 'archived'))) {
    return res.status(404).json({ error: `${entityName} with id '${id}' not found` });
  }
  
  res.json(item);
});

// Update (PATCH - partial update)
app.patch('/entities/:entityName/:id', authenticateToken, blockInternalEntities, (req, res) => {
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

// Update (PUT - full replacement, same implementation as PATCH for compatibility)
app.put('/entities/:entityName/:id', authenticateToken, blockInternalEntities, (req, res) => {
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
app.post('/entities/:entityName/query', authenticateToken, blockInternalEntities, (req, res) => {
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

app.delete('/entities/:entityName/:id', authenticateToken, blockInternalEntities, (req, res) => {
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
app.post('/entities/:entityName/:id/archive', authenticateToken, blockInternalEntities, requireAdmin, (req, res) => {
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
        logger.warn('Archiving ProjectSubcontractor but referenced subcontractor is not archived', { id, subcontractorId });
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

  logger.info('Archived entity', { entityName, id, username: req.user.username });
  sendSuccess(res, entities[entityName][index]);
});

app.post('/entities/:entityName/:id/unarchive', authenticateToken, blockInternalEntities, requireAdmin, (req, res) => {
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

  logger.info('Unarchived entity', { entityName, id, username: req.user.username });
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
    logger.error('NYC property lookup error', { error: err?.message, stack: err?.stack });
    res.status(500).json({ error: 'NYC property lookup failed' });
  }
});

// Helper: create an ACORD-style sample COI PDF buffer based on provided data
async function generateSampleCOIPDF(data = {}) {
  return new Promise((resolve, reject) => {
    try {
      // Normalize project-derived fields if missing
      try {
        const projectId = data.project_id || data.projectId;
        const projectName = data.project_name || data.projectName;
        const proj = (entities.Project || []).find(p => p.id === projectId || p.project_name === projectName);
        if (proj) {
          if (!data.gc_name) data.gc_name = proj.gc_name;
          if (!data.projectAddress && (proj.address || proj.city || proj.state || proj.zip_code)) {
            data.projectAddress = `${proj.address || ''}, ${proj.city || ''}, ${proj.state || ''} ${proj.zip_code || ''}`
              .replace(/\s+,/g, ',')
              .replace(/,\s*,/g, ',')
              .trim();
          }
          if (!data.gc_mailing_address) {
            const addrLine = proj.gc_address || proj.gc_mailing_address || proj.gc_address_line || '';
            const city = proj.gc_city || '';
            const state = proj.gc_state || '';
            const zip = proj.gc_zip || '';
            const assembled = `${addrLine}${addrLine && (city || state || zip) ? ', ' : ''}${city}${city && (state || zip) ? ', ' : ''}${state}${state && zip ? ' ' : ''}${zip}`.trim();
            data.gc_mailing_address = assembled || null;
          }
        }
      } catch (_) {}

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
            const programLevel = [
              ...(entities.SubInsuranceRequirement?.filter(req => req.program_id === programId) || []),
              ...(entities.ProgramRequirement?.filter(req => req.program_id === programId) || [])
            ];
            programRequirements = programLevel;
            logger.info('Found program requirements', { count: programRequirements.length, programId });
          }
        } catch (err) {
          logger.warn('Could not fetch program requirements', { error: err?.message });
        }
      }

      // Determine trade tier and requirements
      let tradeRequirements = null;
      if (programRequirements && programRequirements.length > 0) {
        const normalizeTrades = (list) => (Array.isArray(list) ? list : [])
          .map(t => String(t).trim().toLowerCase())
          .filter(Boolean);
        const tradesList = data.trade ? data.trade.split(',').map(t => t.trim().toLowerCase()) : [];

        tradeRequirements = programRequirements.filter(req => {
          const applicableTrades = normalizeTrades(req.applicable_trades || req.trade_types || req.trades);
          const tradeName = String(req.trade_name || '').toLowerCase();
          const scope = String(req.scope || '').toLowerCase();

          if (applicableTrades.some(t => t === 'all trades') || tradeName === 'all trades') {
            return true;
          }

          if (req.is_all_other_trades || tradeName.includes('all other') || scope.includes('all other')) {
            return true;
          }

          if (tradesList.length === 0) {
            return true;
          }

          return applicableTrades.some(t => tradesList.includes(t)) ||
                 tradesList.some(t => tradeName.includes(t) || t.includes(tradeName) || scope.includes(t));
        });

        logger.info('Matched requirements for trades', { count: tradeRequirements.length, trade: data.trade || 'all' });
      }

      // If no trade requirements matched, fall back to "all other trades" tier or program-wide requirements
      if (!tradeRequirements || tradeRequirements.length === 0) {
        const allOtherReqs = Array.isArray(programRequirements)
          ? programRequirements.filter(req => {
              const tradeName = String(req.trade_name || '').toLowerCase();
              const scope = String(req.scope || '').toLowerCase();
              const applicableTrades = Array.isArray(req.applicable_trades) ? req.applicable_trades : [];
              return (
                req.is_all_other_trades === true ||
                tradeName.includes('all other') ||
                scope.includes('all other') ||
                applicableTrades.some(t => String(t).toLowerCase().includes('all other'))
              );
            })
          : [];

        if (allOtherReqs.length > 0) {
          tradeRequirements = allOtherReqs;
          logger.warn('No trade match; using all other trades requirements');
        } else {
          tradeRequirements = Array.isArray(programRequirements) ? programRequirements.slice() : [];
          logger.warn('No trade match; using program defaults');
        }
      }

      const tierPriority = { a: 4, b: 3, c: 2, d: 1, standard: 0 };
      const reqsForTiering = Array.isArray(tradeRequirements) ? tradeRequirements : [];

      const normalizedTradesForTier = String(data.trade || '')
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);
      const isAllTradesSelection = normalizedTradesForTier.length === 0 ||
        normalizedTradesForTier.some(t => t.includes('all trades') || t.includes('all other'));

      let selectedTier = null;
      let selectedPriority = isAllTradesSelection ? Number.POSITIVE_INFINITY : -1;

      for (const req of reqsForTiering) {
        const priority = tierPriority[String(req.tier || '').toLowerCase()] || 0;
        if (isAllTradesSelection) {
          if (priority < selectedPriority) {
            selectedPriority = priority;
            selectedTier = req.tier;
          }
        } else if (priority > selectedPriority) {
          selectedPriority = priority;
          selectedTier = req.tier;
        }
      }

      const tierRequirements = selectedTier
        ? reqsForTiering.filter(r => String(r.tier) === String(selectedTier))
        : reqsForTiering;

      // Cache tier requirements by insurance type for efficient lookup (avoid repeated .find() calls)
      const tierReqByType = {};
      for (const req of tierRequirements) {
        if (req.insurance_type) {
          tierReqByType[req.insurance_type] = req;
        }
      }
      // Fallback: use first requirement with the field if type-specific not found
      const getFieldValue = (field, insuranceType) => {
        if (tierReqByType[insuranceType]?.[field]) {
          return tierReqByType[insuranceType][field];
        }
        // Fallback to any requirement that has this field
        for (const req of tierRequirements) {
          if (req[field]) return req[field];
        }
        return null;
      };

      // Determine if umbrella is required
      const hasUmbrellaRequirement = tierRequirements.length > 0 && tierRequirements.some(req => 
        req.insurance_type === 'umbrella_policy' || req.umbrella_each_occurrence
      );
      
      if (hasUmbrellaRequirement) {
        const umbReq = tradeRequirements.find(r => r.insurance_type === 'umbrella_policy' || r.umbrella_each_occurrence);
        logger.info('Umbrella required', { amount: umbReq.umbrella_each_occurrence?.toLocaleString() || 'N/A' });
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
      doc.fontSize(5).text('ACORD 25 (2016/03)', margin, margin + 14);
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
      drawBox(contactBoxX, yPos + 42, contentWidth * 0.4 - 2, 48);
      doc.fontSize(6).font('Helvetica-Bold').text('INSURER(S) AFFORDING COVERAGE', contactBoxX + 3, yPos + 44);
      doc.fontSize(6).font('Helvetica-Bold').text('NAIC #', contactBoxX + 3, yPos + 52);
      doc.fontSize(6).font('Helvetica').text('INSURER A:', contactBoxX + 3, yPos + 62);
      doc.fontSize(6).text('INSURER B:', contactBoxX + 3, yPos + 72);
      doc.fontSize(6).text('INSURER C:', contactBoxX + 3, yPos + 82);

      yPos += 92;

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

      // DISCLAIMER TEXT
      doc.fontSize(5).font('Helvetica').text(
        'NOTWITHSTANDING ANY REQUIREMENT, TERM OR CONDITION OF ANY CONTRACT OR OTHER DOCUMENT WITH RESPECT TO WHICH THIS CERTIFICATE MAY BE ISSUED OR MAY PERTAIN, THE INSURANCE AFFORDED BY THE POLICIES DESCRIBED HEREIN IS SUBJECT TO ALL THE TERMS, EXCLUSIONS AND CONDITIONS OF SUCH POLICIES. LIMITS SHOWN MAY HAVE BEEN REDUCED BY PAID CLAIMS.',
        margin,
        yPos,
        { width: contentWidth, align: 'justify' }
      );

      yPos += 18;

      // Coverage Table Header with new columns
      drawBox(margin, yPos, contentWidth, 20);
      doc.fontSize(6).font('Helvetica-Bold');
      doc.text('TYPE OF INSURANCE', margin + 3, yPos + 8);
      doc.text('INSR LTR', margin + 115, yPos + 8);
      doc.text('ADDL INSD', margin + 145, yPos + 5);
      doc.text('SUBR WVD', margin + 175, yPos + 5);
      doc.text('POLICY NUMBER', margin + 210, yPos + 8);
      doc.text('POLICY EFF', margin + 310, yPos + 3);
      doc.text('(MM/DD/YYYY)', margin + 310, yPos + 11);
      doc.text('POLICY EXP', margin + 390, yPos + 3);
      doc.text('(MM/DD/YYYY)', margin + 390, yPos + 11);
      doc.text('LIMITS', margin + 470, yPos + 8);

      yPos += 22;

      // GENERAL LIABILITY ROW
      drawBox(margin, yPos, contentWidth, 60);
      doc.fontSize(7).font('Helvetica-Bold').text('COMMERCIAL GENERAL LIABILITY', margin + 3, yPos + 3);
      doc.fontSize(6).font('Helvetica').text('☐ CLAIMS-MADE  ☒ OCCUR', margin + 3, yPos + 12);
      doc.fontSize(6).text('☐ PER PROJECT  ☒ PER OCCURRENCE', margin + 3, yPos + 20);
      doc.fontSize(6).text('A', margin + 122, yPos + 8);
      doc.fontSize(6).text('☐', margin + 151, yPos + 8);
      doc.fontSize(6).text('☐', margin + 181, yPos + 8);
      doc.fontSize(6).text('(Policy #)', margin + 210, yPos + 8);
      doc.fontSize(6).text('MM/DD/YYYY', margin + 310, yPos + 8);
      doc.fontSize(6).text('MM/DD/YYYY', margin + 390, yPos + 8);
      
      // GL Limits
      doc.fontSize(6).font('Helvetica').text('EACH OCCURRENCE', margin + 470, yPos + 3);
      const glLimit = tierReqByType['general_liability']?.gl_each_occurrence || 
        getFieldValue('gl_each_occurrence') || 1000000;
      doc.text(`$ ${glLimit.toLocaleString()}`, margin + 470, yPos + 10);
      doc.text('GENERAL AGGREGATE', margin + 470, yPos + 22);
      const glAgg = tierReqByType['general_liability']?.gl_general_aggregate || 
        getFieldValue('gl_general_aggregate') || 2000000;
      doc.text(`$ ${glAgg.toLocaleString()}`, margin + 470, yPos + 29);
      doc.text('PRODUCTS - COMP/OP AGG', margin + 470, yPos + 41);
      doc.text(`$ ${glAgg.toLocaleString()}`, margin + 470, yPos + 48);

      yPos += 62;

      // AUTOMOBILE LIABILITY ROW
      drawBox(margin, yPos, contentWidth, 35);
      doc.fontSize(7).font('Helvetica-Bold').text('AUTOMOBILE LIABILITY', margin + 3, yPos + 3);
      doc.fontSize(6).font('Helvetica').text('☐ ANY AUTO  ☐ OWNED  ☐ SCHEDULED', margin + 3, yPos + 12);
      doc.fontSize(6).text('☐ HIRED  ☐ NON-OWNED', margin + 3, yPos + 20);
      doc.fontSize(6).text('B', margin + 122, yPos + 12);
      doc.fontSize(6).text('☐', margin + 151, yPos + 12);
      doc.fontSize(6).text('☐', margin + 181, yPos + 12);
      doc.fontSize(6).text('(Policy #)', margin + 210, yPos + 12);
      doc.fontSize(6).text('MM/DD/YYYY', margin + 310, yPos + 12);
      doc.fontSize(6).text('MM/DD/YYYY', margin + 390, yPos + 12);
      doc.text('COMBINED SINGLE LIMIT', margin + 470, yPos + 8);
      const autoLimit = tierReqByType['auto_liability']?.auto_combined_single_limit || 
        getFieldValue('auto_combined_single_limit') || 1000000;
      doc.text(`$ ${autoLimit.toLocaleString()}`, margin + 470, yPos + 15);

      yPos += 37;

      // WORKERS COMPENSATION ROW
      drawBox(margin, yPos, contentWidth, 35);
      doc.fontSize(7).font('Helvetica-Bold').text('WORKERS COMPENSATION', margin + 3, yPos + 3);
      doc.fontSize(6).font('Helvetica').text('AND EMPLOYERS\' LIABILITY', margin + 3, yPos + 11);
      doc.fontSize(6).text('☒ STATUTORY LIMITS', margin + 3, yPos + 20);
      doc.fontSize(6).text('C', margin + 122, yPos + 12);
      doc.fontSize(6).text('☐', margin + 151, yPos + 12);
      doc.fontSize(6).text('☐', margin + 181, yPos + 12);
      doc.fontSize(6).text('(Policy #)', margin + 210, yPos + 12);
      doc.fontSize(6).text('MM/DD/YYYY', margin + 310, yPos + 12);
      doc.fontSize(6).text('MM/DD/YYYY', margin + 390, yPos + 12);
      doc.text('E.L. EACH ACCIDENT', margin + 470, yPos + 3);
      const wcLimit = tierReqByType['workers_compensation']?.wc_each_accident || 
        getFieldValue('wc_each_accident') || 1000000;
      doc.text(`$ ${wcLimit.toLocaleString()}`, margin + 470, yPos + 10);
      doc.text('E.L. DISEASE - EA EMPLOYEE', margin + 470, yPos + 18);
      doc.text(`$ ${wcLimit.toLocaleString()}`, margin + 470, yPos + 25);

      yPos += 37;

      // UMBRELLA ROW (if required)
      if (hasUmbrellaRequirement) {
        drawBox(margin, yPos, contentWidth, 35);
        doc.fontSize(7).font('Helvetica-Bold').text('UMBRELLA LIAB', margin + 3, yPos + 3);
        doc.fontSize(6).font('Helvetica').text('☐ OCCUR  ☐ CLAIMS-MADE', margin + 3, yPos + 12);
        doc.fontSize(6).text('☒ FOLLOW FORM', margin + 3, yPos + 20);
        doc.fontSize(6).text('D', margin + 122, yPos + 12);
        doc.fontSize(6).text('☐', margin + 151, yPos + 12);
        doc.fontSize(6).text('☐', margin + 181, yPos + 12);
        doc.fontSize(6).text('(Policy #)', margin + 210, yPos + 12);
        doc.fontSize(6).text('MM/DD/YYYY', margin + 310, yPos + 12);
        doc.fontSize(6).text('MM/DD/YYYY', margin + 390, yPos + 12);
        doc.text('EACH OCCURRENCE', margin + 470, yPos + 8);
        const umbLimit = tierReqByType['umbrella_policy']?.umbrella_each_occurrence || 
          getFieldValue('umbrella_each_occurrence') || 2000000;
        doc.text(`$ ${umbLimit.toLocaleString()}`, margin + 470, yPos + 15);
        doc.text('AGGREGATE', margin + 470, yPos + 23);
        doc.text(`$ ${umbLimit.toLocaleString()}`, margin + 470, yPos + 30);
        yPos += 37;
      }

      // DESCRIPTION OF OPERATIONS BOX
      drawBox(margin, yPos, contentWidth * 0.6, 80);
      doc.fontSize(6).font('Helvetica-Bold').text('DESCRIPTION OF OPERATIONS / LOCATIONS / VEHICLES', margin + 3, yPos + 3);
      doc.fontSize(7).font('Helvetica');
      const umbrellaText = hasUmbrellaRequirement ? ' & Umbrella' : '';
      const jobLocationText = data.projectAddress ? `\n\nJob Location: ${data.projectAddress}` : '';
      const ownerEntity = data.owner_entity || data.ownerEntity || data.owner_entity_name;
      const rawAdditionalInsureds = Array.isArray(data.additional_insureds) ? data.additional_insureds : [];
      const rawAdditionalEntities = Array.isArray(data.additional_insured_entities)
        ? data.additional_insured_entities.map(e => e?.name || e).filter(Boolean)
        : [];
      const addlInsuredList = Array.from(new Set([
        ownerEntity,
        ...rawAdditionalInsureds,
        ...rawAdditionalEntities
      ].filter(Boolean)));
      const additionalInsuredText = addlInsuredList.length > 0
        ? `\nAdditional Insureds: ${addlInsuredList.join(', ')}`
        : '';
      doc.text(
        `Certificate holder and entities listed below are included in the GL${umbrellaText} policies as additional insureds for ongoing & completed operations on a primary & non-contributory basis, as required by written contract agreement, per policy terms & conditions. Waiver of subrogation is included in the GL${umbrellaText ? ', Umbrella' : ''} & Workers Compensation policies.${jobLocationText}${additionalInsuredText}`,
        margin + 3,
        yPos + 13,
        { width: contentWidth * 0.6 - 6, align: 'left' }
      );

      // Additional Insureds
      doc.fontSize(7).font('Helvetica-Bold').text('ADDITIONAL INSURED(S):', margin + 3, yPos + 50);
      doc.fontSize(7).font('Helvetica');
      const addlInsuredListToRender = addlInsuredList;
      if (addlInsuredListToRender.length > 0) {
        addlInsuredListToRender.slice(0, 3).forEach((ai, idx) => {
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
}

// Helper: generate a COI PDF using stored policy data and updated job fields
async function generateGeneratedCOIPDF(coiRecord = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const pageWidth = 612; // Letter size width in points
      const pageHeight = 792; // Letter size height in points
      const margin = 40;
      const contentWidth = pageWidth - (margin * 2);

      const drawBox = (x, y, width, height) => {
        doc.rect(x, y, width, height).stroke();
      };

      // ACORD 25 FORM HEADER
      doc.fontSize(7).font('Helvetica').text('ACORD', margin, margin);
      doc.fontSize(6).text('CERTIFICATE OF LIABILITY INSURANCE', margin, margin + 8);
      doc.fontSize(5).text('ACORD 25 (2016/03)', margin, margin + 14);
      doc.fontSize(6).text('DATE (MM/DD/YYYY)', pageWidth - margin - 100, margin);
      doc.fontSize(8).text(new Date().toLocaleDateString('en-US'), pageWidth - margin - 100, margin + 10);

      let yPos = margin + 30;

      // PRODUCER BOX (Left side)
      drawBox(margin, yPos, contentWidth * 0.6, 80);
      doc.fontSize(6).font('Helvetica-Bold').text('PRODUCER', margin + 3, yPos + 3);
      doc.fontSize(8).font('Helvetica').text(coiRecord.broker_name || '(Broker/Producer Name)', margin + 3, yPos + 12);
      if (coiRecord.broker_address) {
        doc.fontSize(7).text(coiRecord.broker_address, margin + 3, yPos + 25);
      }

      // CONTACT INFO BOX (Right side)
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

      // INSURER INFO BOX (Right side, bottom) - DYNAMIC INSURER DISPLAY
      // Display all insurers that were extracted, up to 6 (A-F)
      const allInsurers = coiRecord.all_insurers || {};
      const insurerEntries = Object.entries(allInsurers).sort((a, b) => a[0].localeCompare(b[0]));
      const insurerBoxHeight = Math.max(58, 10 + (insurerEntries.length * 10));
      
      drawBox(contactBoxX, yPos + 42, contentWidth * 0.4 - 2, insurerBoxHeight);
      doc.fontSize(6).font('Helvetica-Bold').text('INSURER(S) AFFORDING COVERAGE', contactBoxX + 3, yPos + 44);
      doc.fontSize(6).font('Helvetica-Bold').text('NAIC #', contactBoxX + 3, yPos + 52);
      
      let insurerYPos = yPos + 62;
      for (const [letter, carrier] of insurerEntries) {
        doc.fontSize(6).font('Helvetica').text(`INSURER ${letter}:`, contactBoxX + 3, insurerYPos);
        doc.fontSize(6).text(carrier || '', contactBoxX + 50, insurerYPos, { width: contentWidth * 0.4 - 55 });
        insurerYPos += 10;
      }
      
      // If no insurers extracted, show the specific carriers we have
      if (insurerEntries.length === 0) {
        if (coiRecord.insurance_carrier_gl) {
          doc.fontSize(6).font('Helvetica').text('INSURER A:', contactBoxX + 3, insurerYPos);
          doc.fontSize(6).text(coiRecord.insurance_carrier_gl, contactBoxX + 50, insurerYPos);
          insurerYPos += 10;
        }
        if (coiRecord.insurance_carrier_auto) {
          doc.fontSize(6).font('Helvetica').text('INSURER B:', contactBoxX + 3, insurerYPos);
          doc.fontSize(6).text(coiRecord.insurance_carrier_auto, contactBoxX + 50, insurerYPos);
          insurerYPos += 10;
        }
        if (coiRecord.insurance_carrier_wc) {
          doc.fontSize(6).font('Helvetica').text('INSURER C:', contactBoxX + 3, insurerYPos);
          doc.fontSize(6).text(coiRecord.insurance_carrier_wc, contactBoxX + 50, insurerYPos);
          insurerYPos += 10;
        }
        if (coiRecord.insurance_carrier_umbrella) {
          doc.fontSize(6).font('Helvetica').text('INSURER D:', contactBoxX + 3, insurerYPos);
          doc.fontSize(6).text(coiRecord.insurance_carrier_umbrella, contactBoxX + 50, insurerYPos);
          insurerYPos += 10;
        }
      }

      yPos += insurerBoxHeight + 10;

      // INSURED BOX
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

      // DISCLAIMER TEXT
      doc.fontSize(5).font('Helvetica').text(
        'NOTWITHSTANDING ANY REQUIREMENT, TERM OR CONDITION OF ANY CONTRACT OR OTHER DOCUMENT WITH RESPECT TO WHICH THIS CERTIFICATE MAY BE ISSUED OR MAY PERTAIN, THE INSURANCE AFFORDED BY THE POLICIES DESCRIBED HEREIN IS SUBJECT TO ALL THE TERMS, EXCLUSIONS AND CONDITIONS OF SUCH POLICIES. LIMITS SHOWN MAY HAVE BEEN REDUCED BY PAID CLAIMS.',
        margin,
        yPos,
        { width: contentWidth, align: 'justify' }
      );

      yPos += 18;

      // Coverage Table Header with new columns
      drawBox(margin, yPos, contentWidth, 20);
      doc.fontSize(6).font('Helvetica-Bold');
      doc.text('TYPE OF INSURANCE', margin + 3, yPos + 8);
      doc.text('INSR LTR', margin + 115, yPos + 8);
      doc.text('ADDL INSD', margin + 145, yPos + 5);
      doc.text('SUBR WVD', margin + 175, yPos + 5);
      doc.text('POLICY NUMBER', margin + 210, yPos + 8);
      doc.text('POLICY EFF', margin + 310, yPos + 3);
      doc.text('(MM/DD/YYYY)', margin + 310, yPos + 11);
      doc.text('POLICY EXP', margin + 390, yPos + 3);
      doc.text('(MM/DD/YYYY)', margin + 390, yPos + 11);
      doc.text('LIMITS', margin + 470, yPos + 8);

      yPos += 22;

      // GENERAL LIABILITY ROW
      drawBox(margin, yPos, contentWidth, 60);
      doc.fontSize(7).font('Helvetica-Bold').text('COMMERCIAL GENERAL LIABILITY', margin + 3, yPos + 3);
      const glFormType = coiRecord.gl_form_type || 'OCCUR';
      const glBasis = coiRecord.gl_basis || 'PER OCCURRENCE';
      doc.fontSize(6).font('Helvetica').text(
        glFormType === 'CLAIMS-MADE' ? '☒ CLAIMS-MADE  ☐ OCCUR' : '☐ CLAIMS-MADE  ☒ OCCUR',
        margin + 3,
        yPos + 12
      );
      doc.fontSize(6).text(
        glBasis === 'PER PROJECT' ? '☒ PER PROJECT  ☐ PER OCCURRENCE' : '☐ PER PROJECT  ☒ PER OCCURRENCE',
        margin + 3,
        yPos + 20
      );
      // Use dynamic insurer letter if available
      const glInsurerLetter = coiRecord.gl_insurer_letter || 'A';
      doc.fontSize(6).text(glInsurerLetter, margin + 122, yPos + 8);
      doc.fontSize(6).text('☐', margin + 151, yPos + 8);
      doc.fontSize(6).text('☐', margin + 181, yPos + 8);
      doc.fontSize(6).text(coiRecord.policy_number_gl || '(Policy #)', margin + 210, yPos + 8);
      doc.fontSize(6).text(coiRecord.gl_effective_date ? new Date(coiRecord.gl_effective_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 310, yPos + 8);
      doc.fontSize(6).text(coiRecord.gl_expiration_date ? new Date(coiRecord.gl_expiration_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 390, yPos + 8);
      doc.fontSize(6).font('Helvetica').text('EACH OCCURRENCE', margin + 470, yPos + 3);
      doc.text(`$ ${(coiRecord.gl_each_occurrence || 1000000).toLocaleString()}`, margin + 470, yPos + 10);
      doc.text('GENERAL AGGREGATE', margin + 470, yPos + 22);
      doc.text(`$ ${(coiRecord.gl_general_aggregate || 2000000).toLocaleString()}`, margin + 470, yPos + 29);
      doc.text('PRODUCTS - COMP/OP AGG', margin + 470, yPos + 41);
      doc.text(`$ ${(coiRecord.gl_products_completed_ops || 2000000).toLocaleString()}`, margin + 470, yPos + 48);

      yPos += 62;

      // AUTOMOBILE LIABILITY ROW
      if (coiRecord.policy_number_auto || coiRecord.insurance_carrier_auto) {
        drawBox(margin, yPos, contentWidth, 35);
        doc.fontSize(7).font('Helvetica-Bold').text('AUTOMOBILE LIABILITY', margin + 3, yPos + 3);
        const autoFormType = coiRecord.auto_form_type || 'ANY AUTO';
        doc.fontSize(6).font('Helvetica').text(
          autoFormType === 'ANY AUTO' ? '☒ ANY AUTO  ☐ OWNED  ☐ SCHEDULED' : '☐ ANY AUTO  ☐ OWNED  ☐ SCHEDULED',
          margin + 3,
          yPos + 12
        );
        doc.fontSize(6).text('☐ HIRED  ☐ NON-OWNED', margin + 3, yPos + 20);
        // Use dynamic insurer letter if available
        const autoInsurerLetter = coiRecord.auto_insurer_letter || 'B';
        doc.fontSize(6).text(autoInsurerLetter, margin + 122, yPos + 12);
        doc.fontSize(6).text('☐', margin + 151, yPos + 12);
        doc.fontSize(6).text('☐', margin + 181, yPos + 12);
        doc.fontSize(6).text(coiRecord.policy_number_auto || '(Policy #)', margin + 210, yPos + 12);
        doc.fontSize(6).text(coiRecord.auto_effective_date ? new Date(coiRecord.auto_effective_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 310, yPos + 12);
        doc.fontSize(6).text(coiRecord.auto_expiration_date ? new Date(coiRecord.auto_expiration_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 390, yPos + 12);
        doc.text('COMBINED SINGLE LIMIT', margin + 470, yPos + 8);
        doc.text(`$ ${(coiRecord.auto_combined_single_limit || 1000000).toLocaleString()}`, margin + 470, yPos + 15);
        yPos += 37;
      }

      // WORKERS COMPENSATION ROW
      drawBox(margin, yPos, contentWidth, 35);
      doc.fontSize(7).font('Helvetica-Bold').text('WORKERS COMPENSATION', margin + 3, yPos + 3);
      doc.fontSize(6).font('Helvetica').text('AND EMPLOYERS\' LIABILITY', margin + 3, yPos + 11);
      const wcType = coiRecord.wc_form_type || 'STATUTORY LIMITS';
      doc.fontSize(6).text(wcType === 'STATUTORY LIMITS' ? '☒ STATUTORY LIMITS' : '☐ STATUTORY LIMITS', margin + 3, yPos + 20);
      // Use dynamic insurer letter if available
      const wcInsurerLetter = coiRecord.wc_insurer_letter || 'C';
      doc.fontSize(6).text(wcInsurerLetter, margin + 122, yPos + 12);
      doc.fontSize(6).text('☐', margin + 151, yPos + 12);
      doc.fontSize(6).text('☐', margin + 181, yPos + 12);
      doc.fontSize(6).text(coiRecord.policy_number_wc || '(Policy #)', margin + 210, yPos + 12);
      doc.fontSize(6).text(coiRecord.wc_effective_date ? new Date(coiRecord.wc_effective_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 310, yPos + 12);
      doc.fontSize(6).text(coiRecord.wc_expiration_date ? new Date(coiRecord.wc_expiration_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 390, yPos + 12);
      doc.text('E.L. EACH ACCIDENT', margin + 470, yPos + 3);
      doc.text(`$ ${(coiRecord.wc_each_accident || 1000000).toLocaleString()}`, margin + 470, yPos + 10);
      doc.text('E.L. DISEASE - EA EMPLOYEE', margin + 470, yPos + 18);
      doc.text(`$ ${(coiRecord.wc_disease_each_employee || 1000000).toLocaleString()}`, margin + 470, yPos + 25);

      yPos += 37;

      // UMBRELLA ROW
      if (coiRecord.policy_number_umbrella || coiRecord.insurance_carrier_umbrella) {
        drawBox(margin, yPos, contentWidth, 35);
        doc.fontSize(7).font('Helvetica-Bold').text('UMBRELLA LIAB', margin + 3, yPos + 3);
        const umbFormType = coiRecord.umbrella_form_type || 'OCCUR';
        doc.fontSize(6).font('Helvetica').text(
          umbFormType === 'CLAIMS-MADE' ? '☒ CLAIMS-MADE  ☐ OCCUR' : '☐ CLAIMS-MADE  ☒ OCCUR',
          margin + 3,
          yPos + 12
        );
        doc.fontSize(6).text('☒ FOLLOW FORM', margin + 3, yPos + 20);
        // Use dynamic insurer letter if available
        const umbrellaInsurerLetter = coiRecord.umbrella_insurer_letter || 'D';
        doc.fontSize(6).text(umbrellaInsurerLetter, margin + 122, yPos + 12);
        doc.fontSize(6).text('☐', margin + 151, yPos + 12);
        doc.fontSize(6).text('☐', margin + 181, yPos + 12);
        doc.fontSize(6).text(coiRecord.policy_number_umbrella || '(Policy #)', margin + 210, yPos + 12);
        doc.fontSize(6).text(coiRecord.umbrella_effective_date ? new Date(coiRecord.umbrella_effective_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 310, yPos + 12);
        doc.fontSize(6).text(coiRecord.umbrella_expiration_date ? new Date(coiRecord.umbrella_expiration_date).toLocaleDateString() : 'MM/DD/YYYY', margin + 390, yPos + 12);
        doc.text('EACH OCCURRENCE', margin + 470, yPos + 8);
        doc.text(`$ ${(coiRecord.umbrella_each_occurrence || 2000000).toLocaleString()}`, margin + 470, yPos + 15);
        doc.text('AGGREGATE', margin + 470, yPos + 23);
        doc.text(`$ ${(coiRecord.umbrella_aggregate || 2000000).toLocaleString()}`, margin + 470, yPos + 30);
        yPos += 37;
      }

      // DESCRIPTION OF OPERATIONS BOX
      drawBox(margin, yPos, contentWidth * 0.6, 80);
      doc.fontSize(6).font('Helvetica-Bold').text('DESCRIPTION OF OPERATIONS / LOCATIONS / VEHICLES', margin + 3, yPos + 3);
      doc.fontSize(7).font('Helvetica');
      const umbrellaText = (coiRecord.policy_number_umbrella || coiRecord.insurance_carrier_umbrella) ? ' & Umbrella' : '';
      
      // Build description with current project location
      let descriptionText = coiRecord.description_of_operations ||
        `Certificate holder and entities listed below are included in the GL${umbrellaText} policies as additional insureds for ongoing & completed operations on a primary & non-contributory basis, as required by written contract agreement, per policy terms & conditions. Waiver of subrogation is included in the GL${umbrellaText ? ', Umbrella' : ''} & Workers Compensation policies.`;
      
      // Add job location if available - with validation to avoid empty or punctuation-only addresses
      const jobLocation = coiRecord.updated_project_address || coiRecord.project_address;
      if (jobLocation && jobLocation.trim() && jobLocation.replace(/[,\s]/g, '')) {
        descriptionText += `\n\nJob Location: ${jobLocation}`;
      }
      
      doc.text(descriptionText, margin + 3, yPos + 13, { width: contentWidth * 0.6 - 6, align: 'left' });

      // Additional Insureds
      doc.fontSize(7).font('Helvetica-Bold').text('ADDITIONAL INSURED(S):', margin + 3, yPos + 50);
      doc.fontSize(7).font('Helvetica');
      let allAddlInsured = [];
      if (Array.isArray(coiRecord.additional_insureds)) {
        allAddlInsured = [...coiRecord.additional_insureds];
      }
      if (Array.isArray(coiRecord.manually_entered_additional_insureds)) {
        allAddlInsured = [...allAddlInsured, ...coiRecord.manually_entered_additional_insureds];
      }
      allAddlInsured = [...new Set(allAddlInsured)];
      if (allAddlInsured.length > 0) {
        allAddlInsured.slice(0, 3).forEach((ai, idx) => {
          doc.text(`• ${ai}`, margin + 3, yPos + 58 + (idx * 8), { width: contentWidth * 0.6 - 6 });
        });
      } else {
        doc.text('• (See certificate holder below)', margin + 3, yPos + 58);
      }

      // CERTIFICATE HOLDER BOX
      const certHolderX = margin + (contentWidth * 0.6) + 2;
      drawBox(certHolderX, yPos, contentWidth * 0.4 - 2, 80);
      doc.fontSize(6).font('Helvetica-Bold').text('CERTIFICATE HOLDER', certHolderX + 3, yPos + 3);
      doc.fontSize(8).font('Helvetica');
      const certHolder = coiRecord.certificate_holder_name || coiRecord.gc_name || 'General Contractor';
      doc.text(certHolder, certHolderX + 3, yPos + 15);
      if (coiRecord.updated_project_address || coiRecord.project_address) {
        const projectAddr = coiRecord.updated_project_address || coiRecord.project_address;
        doc.fontSize(7).text(projectAddr, certHolderX + 3, yPos + 25, { width: contentWidth * 0.4 - 8 });
      }
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
}

// Helper function to process email attachments (avoid code duplication)
function processIncomingAttachments(incomingAttachments) {
  const mailAttachments = [];
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
  return mailAttachments;
}

// Public email endpoint - no authentication required (for broker portal)
app.post('/public/send-email', emailLimiter, async (req, res) => {
  /* eslint-disable no-unused-vars */
  const { to, subject, body, html, cc, bcc, from, replyTo, attachments: incomingAttachments, includeSampleCOI, sampleCOIData, recipientIsBroker, holdHarmlessTemplateUrl } = req.body || {};
  /* eslint-enable no-unused-vars */
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

  logger.info('Public email send request', { to, subject, includeSampleCOI, hasSmtpHost: !!smtpHost, hasSmtpService: !!smtpService });

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
    // Helper: Generate a regenerated COI PDF using stored data with updated job fields
    // eslint-disable-next-line no-unused-vars
    const generateGeneratedCOIPDF = async (coiRecord = {}) => {
      return new Promise((resolve, reject) => {
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
          let descriptionText = coiRecord.description_of_operations || 
            `Certificate holder and entities listed below are included in the GL${umbrellaText} policies as additional insureds for ongoing & completed operations on a primary & non-contributory basis, as required by written contract agreement, per policy terms & conditions. Waiver of subrogation is included in the GL${umbrellaText ? ', Umbrella' : ''} & Workers Compensation policies.`;
          
          // Add job location if available - with validation to avoid empty or punctuation-only addresses
          const jobLocation = coiRecord.updated_project_address || coiRecord.project_address;
          if (jobLocation && jobLocation.trim() && jobLocation.replace(/[,\s]/g, '')) {
            descriptionText += `\n\nJob Location: ${jobLocation}`;
          }
          
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
      logger.error('INCOMPLETE SMTP CONFIG');
      return res.status(500).json({ 
        error: 'SMTP configuration incomplete',
        details: 'SMTP_HOST or SMTP_SERVICE must be configured along with both SMTP_USER and SMTP_PASS'
      });
    }

    if (!hasHostOrService || !hasBothCredentials) {
      // Dev fallback: Use mock email for public portal
      mockEmail = true;
      logger.warn('SMTP not configured - using mock email for public portal');
      transporter = {
        sendMail: async (options) => {
          logger.info('MOCK EMAIL (public)', {
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
      logger.info('SMTP transporter configured for public email');
    }

    // Build attachments (incoming + optionally sample COI)
    const mailAttachments = processIncomingAttachments(incomingAttachments);

    // Optionally generate and attach a sample COI PDF for broker emails
    if (includeSampleCOI) {
      try {
        logger.info('Generating sample COI PDF with data', { keys: Object.keys(sampleCOIData || {}) });
        const pdfBuffer = await generateSampleCOIPDF(sampleCOIData || {});
        mailAttachments.push({ filename: 'sample_coi.pdf', content: pdfBuffer, contentType: 'application/pdf' });
        logger.info('Sample COI PDF generated and attached', { bytes: pdfBuffer.length });
      } catch (pdfErr) {
        logger.error('Could not generate sample COI PDF', { error: pdfErr?.message || pdfErr, stack: pdfErr?.stack });
      }
    }

    const escapeHtml = (value) => String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const formatBodyAsHtml = (text, title) => {
      const safe = escapeHtml(text || '').replace(/\r\n/g, '\n');
      // Optimized: single pass instead of split -> map -> map -> join
      const paragraphs = safe
        .split(/\n\s*\n/)
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
      return createEmailTemplate(title || 'Notification', '', paragraphs);
    };

    const finalHtml = html || (body ? formatBodyAsHtml(body, subject) : undefined);

    const mailOptions = {
      from: from || defaultFrom,
      to,
      subject,
      html: finalHtml
    };
    
    // Add optional fields if they exist
    if (cc) mailOptions.cc = cc;
    if (bcc) mailOptions.bcc = bcc;
    if (replyTo) mailOptions.replyTo = replyTo;
    if (mailAttachments.length > 0) mailOptions.attachments = mailAttachments;

    const info = await transporter.sendMail(mailOptions);
    logger.info('Public email sent', { to, subject, messageId: info.messageId, mockEmail });

    res.status(200).json({
      success: true,
      messageId: info.messageId,
      mockEmail
    });
  } catch (err) {
    logger.error('Public SendEmail error', { error: err?.message || err });
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
    logger.error('Public users error', { error: err?.message || err });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/integrations/send-email', authenticateToken, async (req, res) => {
  // Align with public endpoint: support attachments and optional sample COI
  const { to, subject, body, html, cc, bcc, from, replyTo, attachments: incomingAttachments, includeSampleCOI, sampleCOIData: _sampleCOIData } = req.body || {};
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
  const defaultFrom = process.env.SMTP_FROM || process.env.FROM_EMAIL || 'no-reply@insuretrack.local';

  logger.info('Email send request', {
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
      logger.error('INCOMPLETE SMTP CONFIG: SMTP credentials are partially configured');
      if (!hasBothCredentials) {
        logger.error('Both SMTP_USER and SMTP_PASS must be set');
      }
      if (!hasHostOrService) {
        logger.error('Please set either SMTP_HOST (e.g., smtp.office365.com) or SMTP_SERVICE (e.g., gmail)');
      }
      return res.status(500).json({ 
        error: 'SMTP configuration incomplete', 
        details: 'SMTP_HOST or SMTP_SERVICE must be configured along with both SMTP_USER and SMTP_PASS. Check backend/.env.example for configuration examples.' 
      });
    }

    if (!hasHostOrService || !hasBothCredentials) {
      // Dev fallback: Try Ethereal, but use mock if unavailable
      logger.warn('No SMTP configured - attempting Ethereal test email (dev mode)');
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
        logger.warn('Ethereal email unavailable (network restricted), using mock email service');
        // Create a mock transporter that logs emails instead of sending them
        mockEmail = true;
        transportLabel = 'mock';
      }
    } else {
      logger.info('Using real SMTP', { service: smtpService || smtpHost });
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
      logger.info('MOCK EMAIL (would be sent to)', { to });
      logger.info('MOCK EMAIL Subject', { subject });
      logger.info('MOCK EMAIL Body', { body: (body || html || '').substring(0, MOCK_EMAIL_BODY_LOG_LIMIT) + '...' });
      
      info = { messageId, accepted: [to], rejected: [] };
      previewUrl = null;
    } else {
      // Verify transport before sending to catch configuration issues early
      await transporter.verify();

      // Prepare attachments array for nodemailer
      const mailAttachments = processIncomingAttachments(incomingAttachments);

      // Optionally generate and attach a sample COI PDF
      if (includeSampleCOI) {
        try {
          const pdfBuffer = await generateSampleCOIPDF(_sampleCOIData || {});
          mailAttachments.push({ filename: 'sample_coi.pdf', content: pdfBuffer, contentType: 'application/pdf' });
          logger.info('Sample COI PDF generated and attached (auth handler)', { bytes: pdfBuffer.length });
        } catch (pdfErr) {
          logger.error('Could not generate sample COI PDF', { error: pdfErr?.message || pdfErr });
        }
      }

      const escapeHtml = (value) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

      const formatBodyAsHtml = (text, title) => {
        const safe = escapeHtml(text || '').replace(/\r\n/g, '\n');
        // Optimized: single pass instead of split -> map -> map -> join
        const paragraphs = safe
          .split(/\n\s*\n/)
          .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('');
        return createEmailTemplate(title || 'Notification', '', paragraphs);
      };

      const finalHtml = html || (body ? formatBodyAsHtml(body, subject) : undefined);

      info = await transporter.sendMail({
        from: from || defaultFrom,
        to,
        cc,
        bcc,
        replyTo,
        subject,
        text: body || undefined,
        html: finalHtml,
        attachments: mailAttachments.length > 0 ? mailAttachments : undefined,
      });

      previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : undefined;
    }
    
    if (transportLabel === 'ethereal' && previewUrl) {
      logger.info('TEST EMAIL PREVIEW', { previewUrl });
      logger.warn('This is a test email - view it at the URL above, it was NOT sent to a real inbox');
    } else if (transportLabel === 'mock') {
      logger.info('Mock email logged (not actually sent)', { to });
    } else {
      logger.info('Email sent successfully', { to });
    }
    
    return res.json({ ok: true, messageId: info.messageId, transport: transportLabel, previewUrl, mock: mockEmail });
  } catch (err) {
    logger.error('SendEmail error', { error: err?.message || err });
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
    logger.error('Email verify error', { error: err?.message || err });
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
      .filter(r => {
        const hasGenerated = (entities.GeneratedCOI || []).some(c => {
          const sameSub = c.subcontractor_id === r.subcontractor_id;
          const sameProject = c.project_id === r.project_id;
          const sameBroker = lowerEmail && (c.broker_email || '').toLowerCase().trim() === lowerEmail;
          return sameSub && sameProject && sameBroker;
        });
        return !hasGenerated;
      })
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
    logger.error('Public broker-requests error', { error: err?.message || err });
    return res.status(500).json({ error: 'Failed to load broker requests' });
  }
});

// Returns all projects (public read for portal context)
app.get('/public/projects', (req, res) => {
  try {
    return res.json(entities.Project || []);
  } catch (err) {
    logger.error('Public projects error', { error: err?.message || err });
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
    logger.error('Public messages error', { error: err?.message || err });
    return res.status(500).json({ error: 'Failed to load messages' });
  }
});

// Public: Lookup a GeneratedCOI by token (no auth required)
app.get('/public/coi-by-token', (req, res) => {
  try {
    const { token } = req.query || {};
    if (!token) return res.status(400).json({ error: 'token is required' });
    const tokenStr = String(token);
    let coi = (entities.GeneratedCOI || []).find(c => timingSafeEqual(c.coi_token, tokenStr));
    if (!coi) {
      const reqRecord = (entities.BrokerUploadRequest || []).find(r => String(r.upload_token || '') === tokenStr);
      if (reqRecord) {
        const proj = reqRecord.project_id
          ? (entities.Project || []).find(p => p.id === reqRecord.project_id)
          : null;
        const newCoi = {
          id: `COI-${Date.now()}`,
          coi_token: tokenStr,
          status: 'awaiting_broker_upload',
          broker_email: reqRecord.broker_email,
          broker_name: reqRecord.broker_name,
          broker_company: reqRecord.broker_company,
          subcontractor_id: reqRecord.subcontractor_id,
          subcontractor_name: reqRecord.subcontractor_name,
          project_id: reqRecord.project_id || proj?.id || null,
          project_name: reqRecord.project_name || proj?.project_name || null,
          project_location: proj ? `${proj.address || ''}, ${proj.city || ''}, ${proj.state || ''} ${proj.zip_code || ''}`.replace(/\s+,/g, ',').replace(/,\s*,/g, ',').trim() : null,
          gc_name: proj?.gc_name || null,
          certificate_holder: proj?.gc_name || null,
          certificate_holder_address: proj?.gc_address || null,
          created_date: new Date().toISOString(),
          created_by: 'broker-upload-request'
        };
        if (!entities.GeneratedCOI) entities.GeneratedCOI = [];
        entities.GeneratedCOI.push(newCoi);
        debouncedSave();
        coi = newCoi;
      }
    }
    if (!coi) return res.status(404).json({ error: 'COI not found' });

    const backendBase = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    const frontendBase = process.env.FRONTEND_URL || backendBase.replace(/:3001$/, ':5175');
    const normalizeUrl = (value) => {
      if (!value || typeof value !== 'string') return value;
      if (value.startsWith('/uploads/')) return `${backendBase}${value}`;
      return value
        .replace(/^https?:\/\/(localhost|127\.0\.0\.1):3001/i, backendBase)
        .replace(/^https?:\/\/(localhost|127\.0\.0\.1):5175/i, frontendBase);
    };

    const normalized = {
      ...coi,
      pdf_url: normalizeUrl(coi.pdf_url),
      regenerated_coi_url: normalizeUrl(coi.regenerated_coi_url),
      broker_sign_url: normalizeUrl(coi.broker_sign_url),
      hold_harmless_template_url: normalizeUrl(coi.hold_harmless_template_url)
    };

    return res.json(normalized);
  } catch (err) {
    logger.error('Public coi-by-token error', { error: err?.message || err });
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
      logger.warn('Contractor not found', { id });
      return res.status(404).json({ error: 'Contractor not found' });
    }
    logger.info('Retrieved contractor', { id });
    return res.json(contractor);
  } catch (err) {
    logger.error('Public contractor fetch error', { error: err?.message || err });
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
      logger.warn('Contractor not found for update', { id });
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

    logger.info('Updated contractor via public portal', { id, fields: Object.keys(safeUpdates) });
    debouncedSave();
    return res.json(entities.Contractor[idx]);
  } catch (err) {
    logger.error('Public contractor update error', { error: err?.message || err });
    return res.status(500).json({ error: 'Failed to update contractor' });
  }
});

// Public: Contractor/Subcontractor login with password verification
app.post('/public/contractor-login', publicApiLimiter, async (req, res) => {
  try {
    const { email, password, subId } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find all subcontractors by email
    const matchingSubs = (entities.Contractor || []).filter(c => 
      (c.email?.toLowerCase() === email.toLowerCase()) && 
      (c.role === 'subcontractor' || c.contractor_type === 'subcontractor')
    );

    // If subId is specified, use that specific sub; otherwise if only one sub, use it; else ask user to choose
    let contractor;
    if (subId && matchingSubs.length > 0) {
      contractor = matchingSubs.find(c => c.id === subId);
    } else if (matchingSubs.length === 1) {
      contractor = matchingSubs[0];
    } else if (matchingSubs.length > 1) {
      // When multiple subs exist, validate that at least one has a valid password
      // This prevents revealing multiple accounts exist without valid credentials
      let hasValidPassword = false;
      
      for (const sub of matchingSubs) {
        if (sub.password) {
          const isValid = await bcrypt.compare(password, sub.password);
          if (isValid) {
            hasValidPassword = true;
            break;
          }
        }
      }
      
      if (!hasValidPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Multiple subs with same email - return list for user to choose
      return res.status(200).json({
        requiresSelection: true,
        contractors: matchingSubs.map(c => ({
          id: c.id,
          company_name: c.company_name,
          address: c.address
        }))
      });
    }

    if (!contractor) {
      // Don't reveal if email exists to prevent user enumeration
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password using bcrypt
    if (!contractor.password) {
      logger.warn('Contractor missing password hash', { id: contractor.id });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, contractor.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Return contractor data (without password hash)
    const { password: _, ...contractorSafe } = contractor;
    
    logger.info('Contractor login successful', { id: contractor.id, email: contractor.email });
    
    return res.json({
      success: true,
      contractor: contractorSafe
    });
  } catch (err) {
    logger.error('Contractor login error', { error: err?.message || err });
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
      logger.info('Contractor already exists', { id: existingContractor.id });
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
    
    logger.info('Created new contractor via GC portal', { id: newContractor.id });
    
    // Return contractor with generated password
    return res.json({
      ...newContractor,
      contractor_password: tempPassword,
      isNew: true
    });
  } catch (err) {
    logger.error('Public contractor create error', { error: err?.message || err });
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
      logger.info('Created Contractor for subcontractor via GC portal', { id: contractor.id });
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
    
    logger.info('Created ProjectSubcontractor via GC portal', { id: newProjectSub.id });
    
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
    logger.error('Public ProjectSubcontractor create error', { error: err?.message || err });
    return res.status(500).json({ error: 'Failed to create project subcontractor' });
  }
});

// Public: Get All ProjectSubcontractors
app.get('/public/all-project-subcontractors', (req, res) => {
  try {
    return res.json(entities.ProjectSubcontractor || []);
  } catch (err) {
    logger.error('Error fetching all project subcontractors', { error: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Failed to load project subcontractors' });
  }
});

app.post('/public/create-portal', publicApiLimiter, (req, res) => {
  try {
    const { user_type, user_id, user_email, user_name, dashboard_url, access_token } = req.body || {};
    
    if (!user_type || !user_id || !user_email) {
      return res.status(400).json({ error: 'user_type, user_id, and user_email are required' });
    }

    // Check if portal already exists
    const existing = (entities.Portal || []).find(p => p.user_id === user_id && p.user_type === user_type);
    if (existing) {
      logger.info('Portal already exists', { id: existing.id });
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
    
    logger.info('Created Portal', { id: newPortal.id, user_type, user_email });
    return res.json(newPortal);
  } catch (err) {
    logger.error('Public Portal create error', { error: err?.message || err });
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

    // If caller explicitly requests a new COI, set forceNew
    const forceNew = !!req.body.force_new || !!req.body.forceNew;

    // Attempt to find an existing valid COI for this subcontractor to reuse
    if (!forceNew) {
      const reusable = findValidCOIForSub(subcontractor_id);
      if (reusable) {
        const now = new Date().toISOString();
        const sourceProject = (entities.Project || []).find(p => p.id === project_id) || null;
        const projectAddress = sourceProject
          ? `${sourceProject.address || ''}, ${sourceProject.city || ''}, ${sourceProject.state || ''} ${sourceProject.zip_code || ''}`.replace(/\s+,/g, ',').replace(/,\s*,/g, ',').trim()
          : project_location;

        const regenData = {
          broker_name: reusable.broker_name || '',
          broker_email: reusable.broker_email || '',
          broker_phone: reusable.broker_phone || '',
          broker_address: reusable.broker_address || '',
          broker_contact: reusable.broker_contact || '',
          subcontractor_name: reusable.subcontractor_name || subcontractor_name || '',
          subcontractor_address: reusable.subcontractor_address || '',
          named_insured: reusable.named_insured || reusable.subcontractor_name || subcontractor_name || '',
          insurance_carrier_gl: reusable.insurance_carrier_gl || '',
          policy_number_gl: reusable.policy_number_gl || '',
          gl_each_occurrence: reusable.gl_each_occurrence,
          gl_general_aggregate: reusable.gl_general_aggregate,
          gl_products_completed_ops: reusable.gl_products_completed_ops,
          gl_effective_date: reusable.gl_effective_date,
          gl_expiration_date: reusable.gl_expiration_date,
          gl_form_type: reusable.gl_form_type || 'OCCUR',
          gl_basis: reusable.gl_basis || 'PER OCCURRENCE',
          insurance_carrier_auto: reusable.insurance_carrier_auto || '',
          policy_number_auto: reusable.policy_number_auto || '',
          auto_combined_single_limit: reusable.auto_combined_single_limit,
          auto_effective_date: reusable.auto_effective_date,
          auto_expiration_date: reusable.auto_expiration_date,
          auto_form_type: reusable.auto_form_type || 'ANY AUTO',
          insurance_carrier_wc: reusable.insurance_carrier_wc || '',
          policy_number_wc: reusable.policy_number_wc || '',
          wc_each_accident: reusable.wc_each_accident,
          wc_disease_each_employee: reusable.wc_disease_each_employee,
          wc_effective_date: reusable.wc_effective_date,
          wc_expiration_date: reusable.wc_expiration_date,
          wc_form_type: reusable.wc_form_type || 'STATUTORY LIMITS',
          insurance_carrier_umbrella: reusable.insurance_carrier_umbrella || '',
          policy_number_umbrella: reusable.policy_number_umbrella || '',
          umbrella_each_occurrence: reusable.umbrella_each_occurrence,
          umbrella_aggregate: reusable.umbrella_aggregate,
          umbrella_effective_date: reusable.umbrella_effective_date,
          umbrella_expiration_date: reusable.umbrella_expiration_date,
          umbrella_form_type: reusable.umbrella_form_type || 'OCCUR',
          // Clear old description_of_operations when reusing for a new project
          // This allows the default description + current job location to be used
          description_of_operations: '',
          additional_insureds: additional_insureds || reusable.additional_insureds || [],
          updated_project_address: projectAddress || '',
          updated_project_name: project_name || '',
          certificate_holder_name: certificate_holder || reusable.certificate_holder_name || reusable.gc_name || gc_name || '',
          certificate_holder_address: certificate_holder_address || reusable.certificate_holder_address || '',
          manually_entered_additional_insureds: []
        };

        let regeneratedUrl = null;
        let pdfGenerationSuccess = false;
        try {
          logger.info('Generating COI PDF for reused subcontractor', { subcontractor_id });
          const pdfBuffer = await generateGeneratedCOIPDF(regenData);
          if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new Error('PDF buffer is empty');
          }
          const filename = `gen-coi-${reusable.id}-${Date.now()}.pdf`;
          const filepath = path.join(UPLOADS_DIR, filename);
          await fsPromises.writeFile(filepath, pdfBuffer);
          const backendBase = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
          regeneratedUrl = `${backendBase}/uploads/${filename}`;
          pdfGenerationSuccess = true;
          logger.info('COI PDF generated successfully for reuse', { filename });
        } catch (pdfErr) {
          logger.error('COI reuse PDF generation failed', {
            error: pdfErr?.message || pdfErr,
            stack: pdfErr?.stack,
            reuse: {
              hasBrokerName: !!regenData.broker_name,
              hasSubName: !!regenData.subcontractor_name,
              hasGLData: !!regenData.policy_number_gl,
              hasWCData: !!regenData.policy_number_wc,
              hasGLLimits: !!regenData.gl_each_occurrence,
              hasWCLimits: !!regenData.wc_each_accident
            }
          });
          // Continue with COI creation but mark that PDF generation failed
          // The broker can still sign and the PDF can be regenerated later
          regeneratedUrl = null;
        }

        const frontendBase = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host').replace(/:3001$/, ':5175')}`;
        const newToken = `coi-${Date.now()}-${crypto.randomBytes(12).toString('hex')}`;
        const brokerSignUrl = `${frontendBase}/broker-upload-coi?token=${newToken}&action=sign&step=3`;
        
        // Add warning note if PDF generation failed
        const pdfGenerationNote = pdfGenerationSuccess 
          ? null 
          : 'Note: COI PDF generation failed during reuse. The PDF will be regenerated when the broker uploads the COI or when policies are updated.';
        
        const newCOI = {
          ...reusable,
          id: `COI-${Date.now()}`,
          coi_token: newToken,
          project_id,
          project_name,
          project_sub_id,
          project_location,
          project_address: projectAddress || reusable.project_address || '',
          gc_id,
          gc_name,
          certificate_holder: gc_name || reusable.certificate_holder,
          certificate_holder_address: certificate_holder_address || reusable.certificate_holder_address || '',
          trade_type,
          status: 'pending_broker_signature',
          admin_approved: true,
          review_date: now,
          uploaded_for_review_date: now,
          first_coi_uploaded: true,
          first_coi_url: reusable.first_coi_url || null,
          regenerated_coi_url: regeneratedUrl || reusable.regenerated_coi_url || null,
          regenerated_at: regeneratedUrl ? now : reusable.regenerated_at || null,
          broker_sign_url: brokerSignUrl,
          is_reused: true,
          reused_for_project_id: project_id,
          linked_projects: Array.from(new Set([...(reusable.linked_projects || []), project_id])),
          pdf_generation_note: pdfGenerationNote,
          // Clear old project-specific fields when reusing for new project
          description_of_operations: '',
          updated_project_address: projectAddress || '',
          updated_project_name: project_name || '',
          additional_insureds: additional_insureds || reusable.additional_insureds || []
        };

        if (!entities.GeneratedCOI) entities.GeneratedCOI = [];
        entities.GeneratedCOI.push(newCOI);

        if (Array.isArray(entities.BrokerUploadRequest) && entities.BrokerUploadRequest.length > 0) {
          const beforeCount = entities.BrokerUploadRequest.length;
          entities.BrokerUploadRequest = entities.BrokerUploadRequest.filter(r => {
            if (!r) return false;
            const sameSub = r.subcontractor_id === subcontractor_id;
            const sameProject = r.project_id === project_id;
            const sameBroker = newCOI.broker_email && (r.broker_email || '').toLowerCase().trim() === String(newCOI.broker_email).toLowerCase().trim();
            return !(sameSub && sameProject && sameBroker);
          });
          if (entities.BrokerUploadRequest.length !== beforeCount) {
            logger.info('Removed broker upload request(s) for reused COI', { subcontractor_id, project_id });
          }
        }

        debouncedSave();
        logger.info('Auto-generated reused COI for subcontractor', { subcontractor_id, coi_id: newCOI.id });

        // Generate hold harmless agreement for reused COI if program has a template
        try {
          const programId = sourceProject?.program_id || null;
          const program = programId
            ? (entities.InsuranceProgram || []).find(p => p.id === programId)
            : null;
          const templateUrl = program?.hold_harmless_template_url || program?.hold_harmless_template || null;
          
          if (templateUrl && !newCOI.hold_harmless_template_url) {
            logger.info('Generating hold harmless agreement for reused COI', { coi_id: newCOI.id });
            try {
              const fetchRes = await fetch(templateUrl);
              if (fetchRes.ok) {
                let templateText = await fetchRes.text();
                // Replace common placeholders with COI/project/subcontractor values
                const projectName = sourceProject?.project_name || project_name || '';
                const projectAddressForHH = sourceProject?.project_address || sourceProject?.address || projectAddress || '';
                const gcNameForHH = sourceProject?.gc_name || gc_name || '';
                const subName = subcontractor_name || newCOI.subcontractor_name || '';
                const trade = trade_type || newCOI.trade_type || '';
                
                // Build list of indemnified parties
                const indemnifiedParties = [];
                if (gcNameForHH) indemnifiedParties.push(gcNameForHH);
                if (Array.isArray(newCOI.additional_insureds)) {
                  indemnifiedParties.push(...newCOI.additional_insureds.filter(Boolean));
                }
                if (Array.isArray(newCOI.manually_entered_additional_insureds)) {
                  indemnifiedParties.push(...newCOI.manually_entered_additional_insureds.filter(Boolean));
                }
                const indemnifiedPartiesList = indemnifiedParties.length > 0 
                  ? indemnifiedParties.join(', ')
                  : '[List of Indemnified Parties]';
                
                // Replace placeholders
                templateText = templateText
                  .replace(/{{\s*project_name\s*}}/gi, projectName)
                  .replace(/{{\s*project_address\s*}}/gi, projectAddressForHH)
                  .replace(/{{\s*job_location\s*}}/gi, projectAddressForHH || '[Job Location]')
                  .replace(/{{\s*project_location\s*}}/gi, projectAddressForHH || '[Project Location]')
                  .replace(/{{\s*gc_name\s*}}/gi, gcNameForHH)
                  .replace(/{{\s*subcontractor_name\s*}}/gi, subName)
                  .replace(/{{\s*trade\s*}}/gi, trade)
                  .replace(/{{\s*date\s*}}/gi, new Date().toLocaleDateString())
                  .replace(/{{\s*indemnified_parties\s*}}/gi, indemnifiedPartiesList)
                  .replace(/{{\s*certificate_holder\s*}}/gi, gcNameForHH || '[Certificate Holder]');
                
                // Add signature field markers if not present
                if (!templateText.includes('{{sub_signature}}') && !templateText.includes('data-signature="sub"')) {
                  const subSignatureMarker = '\n\n<div style="margin-top: 40px; border-top: 1px solid #000; width: 300px;">' +
                    '<p style="margin: 5px 0 0 0; font-size: 10px;" data-signature="sub">Subcontractor Signature & Date</p></div>';
                  const gcSignatureMarker = '\n\n<div style="margin-top: 40px; border-top: 1px solid #000; width: 300px;">' +
                    '<p style="margin: 5px 0 0 0; font-size: 10px;" data-signature="gc">General Contractor/Owner Signature & Date</p></div>';
                  
                  if (templateText.includes('</body>')) {
                    templateText = templateText.replace('</body>', subSignatureMarker + gcSignatureMarker + '</body>');
                  } else {
                    templateText += subSignatureMarker + gcSignatureMarker;
                  }
                }
                
                // Replace signature placeholders
                templateText = templateText
                  .replace(/{{\s*sub_signature\s*}}/gi, '<span data-signature="sub">[Subcontractor Signature]</span>')
                  .replace(/{{\s*gc_signature\s*}}/gi, '<span data-signature="gc">[GC/Owner Signature]</span>')
                  .replace(/{{\s*subcontractor_signature\s*}}/gi, '<span data-signature="sub">[Subcontractor Signature]</span>')
                  .replace(/{{\s*owner_signature\s*}}/gi, '<span data-signature="gc">[Owner/GC Signature]</span>');

                // Persist as an HTML file in uploads
                const hhFilename = `hold-harmless-${newCOI.id}-${Date.now()}.html`;
                const hhFilepath = path.join(UPLOADS_DIR, hhFilename);
                await fsPromises.writeFile(hhFilepath, templateText, 'utf8');
                const hhFileUrl = `${req.protocol}://${req.get('host')}/uploads/${hhFilename}`;

                // Update the COI in the array
                const coiIdx = entities.GeneratedCOI.findIndex(c => c.id === newCOI.id);
                if (coiIdx !== -1) {
                  entities.GeneratedCOI[coiIdx] = {
                    ...entities.GeneratedCOI[coiIdx],
                    hold_harmless_template_url: hhFileUrl,
                    hold_harmless_template_filename: hhFilename,
                    hold_harmless_generated_at: now,
                    hold_harmless_status: 'pending_signature'
                  };
                  // Update newCOI reference for email
                  newCOI.hold_harmless_template_url = hhFileUrl;
                }
                logger.info('Generated hold harmless for reused COI', { coi_id: newCOI.id, url: hhFileUrl });
                debouncedSave();
              } else {
                logger.warn('Could not fetch program hold-harmless template for reuse', { status: fetchRes.status });
              }
            } catch (hhGenErr) {
              logger.warn('Failed to generate hold harmless for reused COI', { error: hhGenErr?.message || hhGenErr });
            }
          }
        } catch (hhErr) {
          logger.warn('Error during hold-harmless generation for reused COI', { error: hhErr?.message || hhErr });
        }

        try {
          if (newCOI.broker_email) {
            const internalUrl = `${req.protocol}://${req.get('host')}/public/send-email`;
            const programId = sourceProject?.program_id || null;
            const program = programId
              ? (entities.InsuranceProgram || []).find(p => p.id === programId)
              : null;
            const projectInsureds = [];
            if (sourceProject?.owner_entity) projectInsureds.push(sourceProject.owner_entity);
            if (Array.isArray(sourceProject?.additional_insured_entities)) {
              sourceProject.additional_insured_entities.forEach(ai => projectInsureds.push(ai));
            }

            const sampleCOIData = {
              project_id: project_id,
              project_name,
              gc_name,
              gc_mailing_address: sourceProject
                ? `${sourceProject.gc_address || ''}, ${sourceProject.gc_city || ''}, ${sourceProject.gc_state || ''} ${sourceProject.gc_zip || ''}`.replace(/\s+,/g, ',').replace(/,\s*,/g, ',').trim()
                : undefined,
              projectAddress: projectAddress || project_location,
              trade: trade_type || reusable.trade_type,
              program: program?.name || program?.program_name,
              program_id: programId,
              additional_insureds: Array.from(new Set([...(reusable.additional_insureds || []), ...projectInsureds].filter(Boolean))),
              additional_insured_entities: Array.from(new Set([...(reusable.additional_insureds || []), ...projectInsureds].filter(Boolean))),
              owner_entity: sourceProject?.owner_entity || null,
              hold_harmless_template_url: program?.hold_harmless_template_url || program?.hold_harmless_template || null
            };

            const previewUrl = regeneratedUrl || newCOI.regenerated_coi_url || newCOI.first_coi_url || null;

            await fetch(internalUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: newCOI.broker_email,
                includeSampleCOI: true,
                sampleCOIData,
                subject: `📋 COI Ready for Signature (Reuse) - ${subcontractor_name}`,
                body: `A reused COI has been generated based on the previously approved coverage for ${subcontractor_name}.

Project: ${project_name}
Trade: ${trade_type || 'N/A'}

Generated COI (review):
${previewUrl || 'Available in broker portal'}

Please review and sign:
${brokerSignUrl}

Best regards,
InsureTrack System`
              })
            });
          }
        } catch (notifyErr) {
          logger.warn('Reuse broker notification failed', { error: notifyErr?.message || notifyErr });
        }

        return res.json({ 
          reused: true, 
          generated: true, 
          coi: newCOI,
          pdf_generated: pdfGenerationSuccess,
          warning: pdfGenerationSuccess ? null : 'COI PDF generation failed but COI record created. PDF can be regenerated later.'
        });
      }
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
    const contactEmailNormalized = contact_email || contractor?.email || undefined;
    let resolvedBrokerEmail = broker_email || primaryBroker?.email || undefined;
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
      contact_email: contactEmailNormalized,
      created_date: new Date().toISOString(),
      first_coi_uploaded: false,
      first_coi_url: null,
      coi_token: coi_token || `coi-${Date.now()}-${crypto.randomBytes(12).toString('hex')}`,
      certificate_holder: holder,
      certificate_holder_address: holderAddress,
      additional_insureds: insureds,
      project_location,
      created_by: 'public-portal',
      sequence,
      // Policy metadata for reuse logic
      policy_expiration_date: null,
      renewal_date: null,
      is_reused: false,
      linked_projects: []
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
        let proj = null;
        try {
          proj = (entities.Project || []).find(p => p.id === project_id) || null;
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
          project_id: project_id,
          project_name,
          gc_name,
          gc_mailing_address: gcMailingAddress,
          projectAddress: project_location || `${req.body.project_location || 'Project Address'}`,
          trade: trade_type,
          program: programName,
          program_id: programId,
          additional_insureds: insureds || [],
          additional_insured_entities: insureds || [],
          owner_entity: proj?.owner_entity || null,
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
      logger.error('Broker notification error (create-coi-request)', { error: notifyErr?.message || notifyErr });
    }
    
    logger.info('Created COI request', { id: newCOI.id, subcontractor_name, sequence });
    return res.json(newCOI);
  } catch (err) {
    logger.error('Public COI create error', { error: err?.message || err });
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
    logger.error('Error fetching project subcontractors for subcontractor', { subId, error: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Failed to load project subcontractors' });
  }
});
app.get('/public/projects-for-sub/:subId', (req, res) => {
  try {
    const { subId } = req.params;
    const projectSubs = (entities.ProjectSubcontractor || []).filter(ps => ps.subcontractor_id === subId);
    const projectIds = projectSubs.map(ps => ps.project_id);
    const projects = (entities.Project || []).filter(p => projectIds.includes(p.id));
    return res.json(projects);
  } catch (err) {
    logger.error('Error fetching projects for sub', { error: err?.message, stack: err?.stack });
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
    logger.error('Error fetching COIs for sub', { error: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Failed to load COIs' });
  }
});

// Public: Get all COIs (for GC dashboard status)
app.get('/public/all-cois', (req, res) => {
  try {
    const cois = entities.GeneratedCOI || [];
    return res.json(cois);
  } catch (err) {
    logger.error('Error fetching all COIs', { error: err?.message, stack: err?.stack });
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
      logger.warn('Contractor not found for COI update', { contractorId });
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
    
    logger.info('Updated COI records with broker info for contractor', { updatedCount, contractorId });
    debouncedSave();
    return res.json({ success: true, count: updatedCount });
  } catch (err) {
    logger.error('Public COI update error', { error: err?.message || err });
    return res.status(500).json({ error: 'Failed to update COI records' });
  }
});

// Public: Update a GeneratedCOI by token (limited use for broker upload portal)
app.patch('/public/coi-by-token', publicApiLimiter, async (req, res) => {
  try {
    const { token } = req.query || {};
    if (!token) return res.status(400).json({ error: 'token is required' });
    const idx = (entities.GeneratedCOI || []).findIndex(c => timingSafeEqual(c.coi_token, String(token)));
    if (idx === -1) return res.status(404).json({ error: 'COI not found' });

    const updates = req.body || {};
    const policySchemas = {
      gl_policy: {
        insurance_carrier_gl: 'string',
        policy_number_gl: 'string',
        gl_each_occurrence: 'number',
        gl_general_aggregate: 'number',
        gl_products_completed_ops: 'number',
        gl_effective_date: 'Date',
        gl_expiration_date: 'Date'
      },
      wc_policy: {
        insurance_carrier_wc: 'string',
        policy_number_wc: 'string',
        wc_each_accident: 'number',
        wc_disease_policy_limit: 'number',
        wc_disease_each_employee: 'number',
        wc_effective_date: 'Date',
        wc_expiration_date: 'Date'
      },
      auto_policy: {
        insurance_carrier_auto: 'string',
        policy_number_auto: 'string',
        auto_combined_single_limit: 'number',
        auto_effective_date: 'Date',
        auto_expiration_date: 'Date'
      },
      umbrella_policy: {
        insurance_carrier_umbrella: 'string',
        policy_number_umbrella: 'string',
        umbrella_each_occurrence: 'number',
        umbrella_aggregate: 'number',
        umbrella_effective_date: 'Date',
        umbrella_expiration_date: 'Date'
      }
    };

    const extractIfNeeded = async (policyType, url) => {
      if (!url || !policySchemas[policyType]) return {};
      try {
        const result = await performExtraction({ file_url: url, json_schema: policySchemas[policyType] });
        if (result?.status === 'success' && result.output) return result.output;
      } catch (err) {
        logger.warn('Policy extraction failed', { policyType, error: err?.message || err });
      }
      return {};
    };

    const extracted = {};
    const policyUrlFields = {
      gl_policy: updates.gl_policy_url,
      wc_policy: updates.wc_policy_url,
      auto_policy: updates.auto_policy_url,
      umbrella_policy: updates.umbrella_policy_url
    };

    for (const [policyType, url] of Object.entries(policyUrlFields)) {
      if (url) {
        Object.assign(extracted, await extractIfNeeded(policyType, url));
      }
    }

    // Apply updates and track timestamp
    entities.GeneratedCOI[idx] = {
      ...entities.GeneratedCOI[idx],
      ...updates,
      ...extracted,
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
                
                // Build list of indemnified parties (Certificate Holder + Additional Insureds)
                const indemnifiedParties = [];
                if (gcName) indemnifiedParties.push(gcName);
                if (Array.isArray(applied.additional_insureds)) {
                  indemnifiedParties.push(...applied.additional_insureds.filter(Boolean));
                }
                if (Array.isArray(applied.manually_entered_additional_insureds)) {
                  indemnifiedParties.push(...applied.manually_entered_additional_insureds.filter(Boolean));
                }
                const indemnifiedPartiesList = indemnifiedParties.length > 0 
                  ? indemnifiedParties.join(', ')
                  : '[List of Indemnified Parties]';
                
                // Replace placeholders with actual values
                templateText = templateText
                  .replace(/{{\s*project_name\s*}}/gi, projectName)
                  .replace(/{{\s*project_address\s*}}/gi, projectAddress)
                  .replace(/{{\s*job_location\s*}}/gi, projectAddress || '[Job Location]')
                  .replace(/{{\s*project_location\s*}}/gi, projectAddress || '[Project Location]')
                  .replace(/{{\s*gc_name\s*}}/gi, gcName)
                  .replace(/{{\s*subcontractor_name\s*}}/gi, subName)
                  .replace(/{{\s*trade\s*}}/gi, trade)
                  .replace(/{{\s*date\s*}}/gi, new Date().toLocaleDateString())
                  .replace(/{{\s*indemnified_parties\s*}}/gi, indemnifiedPartiesList)
                  .replace(/{{\s*certificate_holder\s*}}/gi, gcName || '[Certificate Holder]');
                
                // Add signature field markers if not already present
                if (!templateText.includes('{{sub_signature}}') && !templateText.includes('data-signature="sub"')) {
                  // Add HTML markers for signature locations at the end of document
                  const subSignatureMarker = '\n\n<div style="margin-top: 40px; border-top: 1px solid #000; width: 300px;">' +
                    '<p style="margin: 5px 0 0 0; font-size: 10px;" data-signature="sub">Subcontractor Signature & Date</p></div>';
                  const gcSignatureMarker = '\n\n<div style="margin-top: 40px; border-top: 1px solid #000; width: 300px;">' +
                    '<p style="margin: 5px 0 0 0; font-size: 10px;" data-signature="gc">General Contractor/Owner Signature & Date</p></div>';
                  
                  // Insert before closing body tag if present, otherwise append
                  if (templateText.includes('</body>')) {
                    templateText = templateText.replace('</body>', subSignatureMarker + gcSignatureMarker + '</body>');
                  } else {
                    templateText += subSignatureMarker + gcSignatureMarker;
                  }
                }
                
                // Replace signature placeholders if they exist in template
                templateText = templateText
                  .replace(/{{\s*sub_signature\s*}}/gi, '<span data-signature="sub">[Subcontractor Signature]</span>')
                  .replace(/{{\s*gc_signature\s*}}/gi, '<span data-signature="gc">[GC/Owner Signature]</span>')
                  .replace(/{{\s*subcontractor_signature\s*}}/gi, '<span data-signature="sub">[Subcontractor Signature]</span>')
                  .replace(/{{\s*owner_signature\s*}}/gi, '<span data-signature="gc">[Owner/GC Signature]</span>');

                // Persist as an HTML file in uploads
                const filename = `hold-harmless-${applied.id}-${Date.now()}.html`;
                const filepath = path.join(UPLOADS_DIR, filename);
                await fsPromises.writeFile(filepath, templateText, 'utf8');
                const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;

                entities.GeneratedCOI[idx] = {
                  ...entities.GeneratedCOI[idx],
                  hold_harmless_template_url: fileUrl,
                  hold_harmless_template_filename: filename,
                  hold_harmless_generated_at: new Date().toISOString()
                };
                logger.info('Generated Hold Harmless from program template for COI', { coi_id: applied.id, url: fileUrl });
              } else {
                logger.warn('Could not fetch program hold-harmless template', { status: fetchRes.status });
              }
            } catch (genErr) {
              logger.warn('Failed to generate Hold Harmless from template', { error: genErr?.message || genErr });
            }
          }
        }
      }
    } catch (hhErr) {
      logger.warn('Error during hold-harmless generation on COI update', { error: hhErr?.message || hhErr });
    }

    // Extract policy data and compare to COI if policy URLs are provided
    if (updates.gl_policy_url || updates.wc_policy_url || updates.auto_policy_url || updates.umbrella_policy_url) {
      const coiRecord = entities.GeneratedCOI[idx];
      const policyComparisons = [];
      const allExclusions = [];
      
      // Extract and compare each policy type
      for (const [policyType, url] of Object.entries(policyUrlFields)) {
        if (url) {
          try {
            // Extract policy data
            const policyExtraction = await extractIfNeeded(policyType, url);
            
            // Extract exclusions from policy
            const policyText = policyExtraction.raw_text || policyExtraction.full_text || '';
            if (policyText) {
              const exclusions = extractExclusions(policyText);
              allExclusions.push(...exclusions.map(e => ({ ...e, source: policyType })));
            }
            
            // Compare policy to COI
            if (Object.keys(policyExtraction).length > 0) {
              const coverageType = policyType.replace('_policy', '');
              const discrepancies = comparePolicyToCOI(policyExtraction, coiRecord, coverageType);
              if (discrepancies.length > 0) {
                policyComparisons.push({
                  policy_type: policyType,
                  discrepancies
                });
              }
            }
          } catch (err) {
            logger.warn('Policy analysis failed', { policyType, error: err?.message || err });
          }
        }
      }
      
      // Compare exclusions to requirements and project data
      if (allExclusions.length > 0) {
        try {
          const project = (entities.Project || []).find(p => p.id === coiRecord.project_id);
          const programId = project?.program_id || null;
          const requirements = (entities.SubInsuranceRequirement || []).filter(r => r.program_id === programId);
          
          const exclusionConflicts = compareExclusionsToRequirements(allExclusions, requirements, project);
          
          // Store analysis results
          entities.GeneratedCOI[idx] = {
            ...entities.GeneratedCOI[idx],
            policy_analysis: {
              ...(entities.GeneratedCOI[idx].policy_analysis || {}),
              policy_comparisons: policyComparisons,
              exclusions: allExclusions,
              exclusion_conflicts: exclusionConflicts,
              analyzed_at: new Date().toISOString()
            }
          };
          
          logger.info('Policy analysis complete', { comparisons: policyComparisons.length, exclusions: allExclusions.length, conflicts: exclusionConflicts.length });
        } catch (err) {
          logger.warn('Exclusion analysis failed', { error: err?.message || err });
        }
      } else if (policyComparisons.length > 0) {
        // Store comparison results even if no exclusions found
        entities.GeneratedCOI[idx] = {
          ...entities.GeneratedCOI[idx],
          policy_analysis: {
            ...(entities.GeneratedCOI[idx].policy_analysis || {}),
            policy_comparisons: policyComparisons,
            analyzed_at: new Date().toISOString()
          }
        };
      }
    }

    debouncedSave();
    return res.json(entities.GeneratedCOI[idx]);
  } catch (err) {
    logger.error('Public coi-by-token update error', { error: err?.message || err });
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
    
    logger.info('File uploaded successfully (authenticated)', {
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
    logger.error('File upload error (authenticated)', { error: error?.message || error });
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
    
    logger.info('File uploaded successfully', {
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
    logger.error('File upload error', { error: error?.message || error });
    return sendError(res, 500, 'File upload failed', { error: error.message });
  }
});

// Authenticated: Generate a sample COI PDF and store in uploads
app.post('/integrations/generate-sample-coi', authenticateToken, async (req, res) => {
  try {
    const data = req.body || {};
    const pdfBuffer = await generateSampleCOIPDF(data);

    const rawFilename = `sample-coi-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.pdf`;
    const filename = validateAndSanitizeFilename(rawFilename);
    const filePath = path.join(UPLOADS_DIR, filename);
    verifyPathWithinDirectory(filePath, UPLOADS_DIR);

    await fsPromises.writeFile(filePath, pdfBuffer);

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    return res.json({ success: true, url: fileUrl, file_url: fileUrl, filename });
  } catch (error) {
    logger.error('Sample COI generation error', { error: error?.message || error });
    return sendError(res, 500, 'Sample COI generation failed', { error: error.message });
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

    logger.info('COI uploaded', { filename: req.file.filename, url: fileUrl, coi_token });

    // Extract COI fields using existing performExtraction helper (regex/AI)
    const schema = {
      named_insured: 'string',
      description_of_operations: 'string',
      certificate_holder_name: 'string',
      certificate_holder_address: 'string',
      additional_insureds: 'array',
      broker_name: 'string',
      broker_contact: 'string',
      broker_address: 'string',
      broker_email: 'string',
      broker_phone: 'string',
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
      gl_insurer_letter: 'string',
      insurance_carrier_umbrella: 'string',
      policy_number_umbrella: 'string',
      umbrella_each_occurrence: 'number',
      umbrella_aggregate: 'number',
      umbrella_effective_date: 'Date',
      umbrella_expiration_date: 'Date',
      umbrella_insurer_letter: 'string',
      insurance_carrier_wc: 'string',
      policy_number_wc: 'string',
      wc_each_accident: 'number',
      wc_disease_policy_limit: 'number',
      wc_disease_each_employee: 'number',
      wc_effective_date: 'Date',
      wc_expiration_date: 'Date',
      wc_insurer_letter: 'string',
      insurance_carrier_auto: 'string',
      policy_number_auto: 'string',
      auto_combined_single_limit: 'number',
      auto_bodily_injury: 'number',
      auto_effective_date: 'Date',
      auto_expiration_date: 'Date',
      auto_insurer_letter: 'string',
      all_insurers: 'object'
    };

    let extractionResult = { status: 'success', output: {} };
    try {
      extractionResult = await performExtraction({ file_url: fileUrl, json_schema: schema });
    } catch (exErr) {
      logger.warn('COI extraction failed, continuing with minimal metadata', { error: exErr?.message || exErr });
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
      certificate_holder_address: d.certificate_holder_address || '',
      
      // Store additional insureds for regeneration
      additional_insureds: Array.isArray(d.additional_insureds)
        ? d.additional_insureds
        : (typeof d.additional_insureds === 'string'
        // Optimized: Single pass instead of split→map→filter
        ? d.additional_insureds.split(/\n|,|;|\|/).reduce((acc, s) => {
            const trimmed = s.trim();
            if (trimmed) acc.push(trimmed);
            return acc;
          }, [])
        : []),
      
      // Will be used to store manually entered policies
      manually_entered_policies: [],
      manually_entered_additional_insureds: []
    };

    // Determine a conservative policy expiration date (earliest expiration across coverages)
    try {
      const expDates = [];
      const pushIfDate = v => {
        if (!v) return;
        const t = new Date(v).getTime();
        if (!isNaN(t)) expDates.push(t);
      };
      pushIfDate(d.gl_expiration_date || d.gl_effective_date);
      pushIfDate(d.auto_expiration_date || d.auto_effective_date);
      pushIfDate(d.wc_expiration_date || d.wc_effective_date);
      pushIfDate(d.umbrella_expiration_date || d.umbrella_effective_date);
      if (expDates.length > 0) {
        // Use earliest expiration to be conservative (policy no longer valid after earliest exp)
        const earliest = new Date(Math.min(...expDates)).toISOString();
        enhancedCOIData.policy_expiration_date = earliest;
      }
    } catch (_expErr) {
      // ignore and leave expiration null
    }

    // Update COI record with enhanced data for regeneration
    entities.GeneratedCOI[coiIdx] = {
      ...coi,
      first_coi_url: fileUrl,
      first_coi_uploaded: true,
      policy_expiration_date: enhancedCOIData.policy_expiration_date || coi.policy_expiration_date || null,
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
        logger.warn('Could not send admin email', { error: emailErr?.message || emailErr });
      }
    }

    debouncedSave();
    return res.json({ ok: true, coi: entities.GeneratedCOI[coiIdx], document: insuranceDoc });
  } catch (error) {
    logger.error('public upload-coi error', { error: error?.message || error });
    return sendError(res, 500, 'COI upload failed', { error: error.message });
  }
});
// Public: Upload policy or binder for renewal flows
app.post('/public/upload-policy', uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    const { coi_token, type } = req.query || req.body || {};
    if (!req.file) return sendError(res, 400, 'No file uploaded');
    if (!coi_token) return sendError(res, 400, 'coi_token is required');

    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    const coiIdx = (entities.GeneratedCOI || []).findIndex(c => timingSafeEqual(c.coi_token, String(coi_token)));
    if (coiIdx === -1) return sendError(res, 404, 'COI not found for token');

    const coi = entities.GeneratedCOI[coiIdx];
    const now = new Date().toISOString();

    const uploadType = (type || req.body.type || 'policy').toString().toLowerCase();

    if (uploadType === 'binder') {
      entities.GeneratedCOI[coiIdx] = {
        ...coi,
        binder_uploaded_at: now,
        binder_filename: req.file.filename,
        binder_url: fileUrl,
        binder_allowed_until: new Date(Date.now() + BINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        renewal_status: 'binder_uploaded',
        updatedAt: now,
        updatedBy: 'public-upload-policy'
      };

      try {
        const internalUrl = `${req.protocol}://${req.get('host')}/public/send-email`;
        const payload = {
          to: DEFAULT_ADMIN_EMAILS.join(','),
          subject: `Binder uploaded for ${coi.subcontractor_name} (${coi.id})`,
          body: `A binder has been uploaded for ${coi.subcontractor_name} on project ${coi.project_name}. Binder URL: ${fileUrl}`
        };
        await fetch(internalUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
      } catch (e) {}

      debouncedSave();
      return res.json({ ok: true, type: 'binder', file_url: fileUrl, coi: entities.GeneratedCOI[coiIdx] });
    }

    // Treat as full policy
    entities.GeneratedCOI[coiIdx] = {
      ...coi,
      policy_uploaded_at: now,
      policy_filename: req.file.filename,
      policy_url: fileUrl,
      renewal_status: 'policy_uploaded',
      updatedAt: now,
      updatedBy: 'public-upload-policy'
    };

    try {
      const binderAllowedUntil = coi.binder_allowed_until ? new Date(coi.binder_allowed_until).getTime() : null;
      const uploadedAt = new Date(entities.GeneratedCOI[coiIdx].policy_uploaded_at).getTime();
      let notifyAdmin = false;
      if (binderAllowedUntil && uploadedAt > binderAllowedUntil) notifyAdmin = true;
      if (!coi.binder_uploaded_at && coi.policy_expiration_date && new Date(coi.policy_expiration_date).getTime() <= Date.now()) notifyAdmin = true;

      if (notifyAdmin) {
        const internalUrl = `${req.protocol}://${req.get('host')}/public/send-email`;
        const payload = {
          to: DEFAULT_ADMIN_EMAILS.join(','),
          subject: `Policy uploaded for ${coi.subcontractor_name} requires admin review`,
          body: `A policy has been uploaded for ${coi.subcontractor_name} on project ${coi.project_name}. Please review: ${fileUrl}`
        };
        await fetch(internalUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
      }
    } catch (notifyErr) {
      logger.warn('Policy upload admin notify failed', { error: notifyErr?.message || notifyErr });
    }

    // If the COI has been previously uploaded and approved, trigger COI regeneration
    // This ensures the COI PDF reflects the latest formatting and data structure
    // Note: This uses existing COI data, not data extracted from the newly uploaded policy
    // A future enhancement could extract and incorporate data from the uploaded policy file
    try {
      const updatedCoi = entities.GeneratedCOI[coiIdx];
      if (updatedCoi.first_coi_uploaded && updatedCoi.admin_approved) {
        logger.info('Triggering COI regeneration after policy upload for COI', { coi_id: updatedCoi.id });
        
        // Build regeneration data using existing COI data
        const regenData = {
          broker_name: updatedCoi.broker_name || '',
          broker_email: updatedCoi.broker_email || '',
          broker_phone: updatedCoi.broker_phone || '',
          broker_address: updatedCoi.broker_address || '',
          subcontractor_name: updatedCoi.subcontractor_name || '',
          subcontractor_address: updatedCoi.subcontractor_address || '',
          named_insured: updatedCoi.named_insured || updatedCoi.subcontractor_name || '',
          
          // All policy data
          insurance_carrier_gl: updatedCoi.insurance_carrier_gl || '',
          policy_number_gl: updatedCoi.policy_number_gl || '',
          gl_each_occurrence: updatedCoi.gl_each_occurrence,
          gl_general_aggregate: updatedCoi.gl_general_aggregate,
          gl_products_completed_ops: updatedCoi.gl_products_completed_ops,
          gl_effective_date: updatedCoi.gl_effective_date,
          gl_expiration_date: updatedCoi.gl_expiration_date,
          gl_form_type: updatedCoi.gl_form_type || 'OCCUR',
          
          insurance_carrier_auto: updatedCoi.insurance_carrier_auto || '',
          policy_number_auto: updatedCoi.policy_number_auto || '',
          auto_combined_single_limit: updatedCoi.auto_combined_single_limit,
          auto_effective_date: updatedCoi.auto_effective_date,
          auto_expiration_date: updatedCoi.auto_expiration_date,
          
          insurance_carrier_wc: updatedCoi.insurance_carrier_wc || '',
          policy_number_wc: updatedCoi.policy_number_wc || '',
          wc_each_accident: updatedCoi.wc_each_accident,
          wc_disease_each_employee: updatedCoi.wc_disease_each_employee,
          wc_effective_date: updatedCoi.wc_effective_date,
          wc_expiration_date: updatedCoi.wc_expiration_date,
          
          insurance_carrier_umbrella: updatedCoi.insurance_carrier_umbrella || '',
          policy_number_umbrella: updatedCoi.policy_number_umbrella || '',
          umbrella_each_occurrence: updatedCoi.umbrella_each_occurrence,
          umbrella_aggregate: updatedCoi.umbrella_aggregate,
          umbrella_effective_date: updatedCoi.umbrella_effective_date,
          umbrella_expiration_date: updatedCoi.umbrella_expiration_date,
          
          description_of_operations: updatedCoi.description_of_operations || '',
          additional_insureds: updatedCoi.additional_insureds || [],
          certificate_holder_name: updatedCoi.certificate_holder_name || updatedCoi.gc_name || '',
          updated_project_address: updatedCoi.updated_project_address || updatedCoi.project_address || '',
          updated_project_name: updatedCoi.updated_project_name || updatedCoi.project_name || ''
        };
        
        // Generate new COI PDF
        const pdfBuffer = await generateGeneratedCOIPDF(regenData);
        const filename = `gen-coi-${updatedCoi.id}-${Date.now()}.pdf`;
        const filepath = path.join(UPLOADS_DIR, filename);
        await fsPromises.writeFile(filepath, pdfBuffer);
        
        const backendBase = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
        const generatedFileUrl = `${backendBase}/uploads/${filename}`;
        
        // Update COI with regenerated PDF
        entities.GeneratedCOI[coiIdx] = {
          ...entities.GeneratedCOI[coiIdx],
          regenerated_coi_url: generatedFileUrl,
          regenerated_coi_filename: filename,
          regenerated_at: now,
          auto_regenerated_after_policy_upload: true
        };
        
        logger.info('COI regenerated successfully after policy upload', { filename });
      }
    } catch (regenErr) {
      logger.error('COI regeneration after policy upload failed', { error: regenErr?.message || regenErr });
      // Don't fail the upload if regeneration fails, just log it
    }

    debouncedSave();
    return res.json({ ok: true, type: 'policy', file_url: fileUrl, coi: entities.GeneratedCOI[coiIdx] });
  } catch (err) {
    logger.error('upload-policy error', { error: err?.message || err });
    return sendError(res, 500, 'Policy upload failed', { error: err.message });
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
      logger.warn('Could not populate COI hold_harmless_template_url from program', { error: hhErr?.message || hhErr });
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
      await fsPromises.writeFile(filepath, pdfBuffer);
      
      const backendBase = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
      const frontendBase = process.env.FRONTEND_URL || backendBase.replace(/:3001$/, ':5175');
      const fileUrl = `${backendBase}/uploads/${filename}`;
      
      // Update COI record with regenerated PDF and updated job info
      const brokerSignLink = `${frontendBase}/broker-upload-coi?token=${coi.coi_token}&action=sign&step=3`;

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
      
      logger.info('COI regenerated successfully', { coi_token, filename, url: fileUrl });
      
      return res.json({
        ok: true,
        regenerated_coi_url: fileUrl,
        filename: filename,
        coi: entities.GeneratedCOI[coiIdx]
      });
      
    } catch (pdfErr) {
      logger.error('Failed to generate regenerated COI PDF', { error: pdfErr?.message || pdfErr });
      return sendError(res, 500, 'Failed to regenerate COI PDF', { error: pdfErr.message });
    }
    
  } catch (error) {
    logger.error('public regenerate-coi error', { error: error?.message || error });
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

    logger.info('Endorsement uploaded', { filename: req.file.filename, url: fileUrl });

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
      logger.warn('Endorsement extraction failed, continuing with minimal metadata', { error: exErr?.message || exErr });
    }

    // Find COI by token and attach endorsement metadata
    const coi = (entities.GeneratedCOI || []).find(c => c.coi_token === coi_token);
    if (!coi) {
      logger.warn('No GeneratedCOI found for token', { coi_token });
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
        const _requiresAuto = requirements.some(r => r.insurance_type === 'auto_liability');
        const _requiresWC = requirements.some(r => r.insurance_type === 'workers_compensation');

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
        logger.warn('Endorsement comparison warning', { error: cmpErr?.message || cmpErr });
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
                  logger.warn('Could not create in-system message for broker notification', { error: msgErr?.message || msgErr });
                }
              } catch (emailErr) {
                logger.error('Failed to send internal notification email to broker', { error: emailErr?.message || emailErr });
              }
            }
          } catch (notifyErr) {
            logger.error('Error notifying broker after COI regen', { error: notifyErr?.message || notifyErr });
          }
        } catch (regenErr) {
          logger.error('Failed to regenerate COI PDF', { error: regenErr?.message || regenErr });
        }
      }
    }

    // Persist (in-memory) and respond
    // In production this would save to DB
    return res.json({ ok: true, endorsement: endorsementRecord, coi: coi || null });
  } catch (error) {
    logger.error('public upload-endorsement error', { error: error?.message || error });
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
    logger.info('Attempting to read PDF file', { filePath });
    const dataBuffer = await fsPromises.readFile(filePath);
    logger.info('PDF file read successfully', { size: dataBuffer.length });
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text || '';
    logger.info('Extracted from PDF', { characters: extractedText.length });
    if (extractedText.length === 0) {
      logger.warn('PDF text extraction returned empty string - PDF may be image-based or corrupted');
    }
    return extractedText;
  } catch (pdfErr) {
    logger.error('PDF parsing error', { error: pdfErr?.message || pdfErr, filePath, stack: pdfErr?.stack });
    throw new Error(`Failed to parse PDF file: ${pdfErr?.message || 'Unknown error'}`);
  }
}

// Constants for endorsement negation checking
const NEGATION_LOOKBACK_CHARS = 50;
const NEGATION_PATTERN = /(?:NO|NOT|EXCLUDED|EXCEPT|WITHOUT|DOES\s+NOT\s+INCLUDE|EXCLUDING)/i;

// Helper function to check if any occurrence of a keyword is not negated
function hasNonNegatedKeyword(text, keywordPattern) {
  const matchIndices = [];
  let match;
  const regex = new RegExp(keywordPattern.source, 'gi');
  
  while ((match = regex.exec(text)) !== null) {
    matchIndices.push(match.index);
  }
  
  // If we find any occurrence, check if at least one is not negated
  for (const matchIndex of matchIndices) {
    const startPos = Math.max(0, matchIndex - NEGATION_LOOKBACK_CHARS);
    const precedingText = text.substring(startPos, matchIndex);
    const hasNegation = NEGATION_PATTERN.test(precedingText);
    
    // If this occurrence is not negated, we found a valid keyword
    if (!hasNegation) {
      return true;
    }
  }
  
  return false;
}

// Helper function to extract common fields using regex patterns (fallback when AI is not configured)
function extractFieldsWithRegex(text, schema) {
  logger.info('Starting AGGRESSIVE regex extraction with schema fields', { fields: Object.keys(schema) });
  const extracted = {};
  
  // Constants for extraction patterns
  const COVERAGE_SECTION_CHAR_LIMIT = 500; // Max chars to search within a coverage section
  const DATE_PROXIMITY_CHAR_LIMIT = 100; // Max chars between effective and expiration dates
  const INSURER_LETTER_PROXIMITY = 200; // Max chars from coverage keyword to insurer letter
  
  // Helper to validate policy number format
  const isValidPolicyNumber = (str) => {
    if (!str || str.length < 5) return false;
    // Must contain at least one digit
    if (!/\d/.test(str)) return false;
    // Must not be mostly just letters (like "COMMERCIAL" or "LIABILITY")
    const letterCount = (str.match(/[A-Z]/gi) || []).length;
    const digitCount = (str.match(/\d/g) || []).length;
    if (letterCount > 15 && digitCount < 3) return false; // Likely a keyword, not a policy number
    return true;
  };
  
  // FLOOD THE SYSTEM: Extract ALL dates found in document
  const allDates = [];
  const datePatterns = [
    /\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/g,  // MM/DD/YYYY or MM-DD-YYYY
    /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g,  // YYYY-MM-DD
    /\b([A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})\b/g, // January 1, 2024
    /\b(\d{1,2}[-/][A-Z][a-z]{2}[-/]\d{4})\b/gi, // 01-Jan-2024
  ];
  
  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      allDates.push(...matches.map(d => d.trim()));
    }
  }
  logger.info('Found dates in document', { count: allDates.length, sample: allDates.slice(0, 10) });
  
  // FLOOD: Extract ALL dollar amounts
  const allAmounts = [];
  const amountPatterns = [
    /\$\s?[\d,]+(?:\.\d{2})?/g,
    /[\d,]+(?:\.\d{2})?\s?(?:USD|dollars?)/gi
  ];
  
  for (const pattern of amountPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      allAmounts.push(...matches.map(a => a.replace(/[$,\s]/g, '').replace(/dollars?/i, '').trim()));
    }
  }
  logger.info('Found dollar amounts in document', { count: allAmounts.length, sample: allAmounts.slice(0, 10) });
  
  // FLOOD: Extract ALL policy numbers
  const allPolicyNumbers = [];
  const policyPatterns = [
    /(?:policy|pol)[\s#:]+([A-Z0-9-]{5,25})/gi,
    /\b([A-Z]{2,4}[-\s]?\d{4,12})\b/g,
    /(?:policy|pol)\s*(?:number|no|#)\s*[:.]?\s*([A-Z0-9-]{5,25})/gi
  ];
  
  for (const pattern of policyPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      allPolicyNumbers.push(...matches.map(p => p.replace(/^(policy|pol)[\s#:]+/i, '').trim()));
    }
  }
  logger.info('Found policy numbers in document', { count: allPolicyNumbers.length, sample: allPolicyNumbers.slice(0, 10) });
  
  // FLOOD: Extract ALL company/insured names
  const allCompanyNames = [];
  const companyPatterns = [
    /INSURED[:\s]+([A-Z][A-Za-z0-9\s&.,'-]{5,100})(?:\n|$)/gi,
    /NAMED\s+INSURED[:\s]+([A-Z][A-Za-z0-9\s&.,'-]{5,100})(?:\n|$)/gi,
    /CERTIFICATE\s+HOLDER[:\s]+([A-Z][A-Za-z0-9\s&.,'-]{5,100})(?:\n|$)/gi,
    /([A-Z][A-Za-z0-9\s&.,'-]+(?:LLC|Inc|Corp|Corporation|Company|Ltd|LTD|CO\.|L\.P\.))/g
  ];
  
  for (const pattern of companyPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      allCompanyNames.push(...matches.map(c => c.replace(/^(INSURED|NAMED INSURED|CERTIFICATE HOLDER)[:\s]+/i, '').trim()));
    }
  }
  logger.info('Found company names in document', { count: allCompanyNames.length, sample: allCompanyNames.slice(0, 10) });
  
  // Extract email addresses
  const emailPattern = /[\w.-]+@[\w.-]+\.\w+/g;
  
  // Extract phone numbers
  const phonePattern = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  
  // Map schema fields to extraction patterns
  for (const [fieldName, fieldType] of Object.entries(schema)) {
    const lowerField = fieldName.toLowerCase();
    
    // Policy number fields - SKIP HERE, will be handled by table extraction below
    // This prevents incorrect index-based assignment
    if (lowerField.includes('policy') && lowerField.includes('number')) {
      // Skip - will be extracted from coverage table with proper context
      continue;
    }
    
    // Date fields - SKIP HERE, will be handled by coverage-specific extraction below
    // This prevents incorrect index-based assignment
    else if (lowerField.includes('date') || fieldType.toLowerCase().includes('date')) {
      // Skip - will be extracted from coverage table with proper context
      continue;
    }
    
    // Dollar amount fields - AGGRESSIVE extraction
    else if (fieldType.toLowerCase().includes('number') && 
             (lowerField.includes('aggregate') || lowerField.includes('occurrence') || 
              lowerField.includes('limit') || lowerField.includes('amount'))) {
      if (allAmounts.length > 0) {
        // Try to match based on coverage type and amount size
        const amounts = allAmounts.map(a => parseFloat(a)).filter(a => !isNaN(a) && a > 0);
        if (amounts.length > 0) {
          if (lowerField.includes('aggregate')) {
            // Aggregates are usually larger
            const largeAmounts = amounts.filter(a => a >= 1000000).sort((a, b) => b - a);
            extracted[fieldName] = largeAmounts.length > 0 ? largeAmounts[0] : amounts[0];
          } else if (lowerField.includes('occurrence') || lowerField.includes('each')) {
            // Per occurrence is usually smaller than aggregate
            const mediumAmounts = amounts.filter(a => a >= 500000 && a <= 5000000).sort((a, b) => b - a);
            extracted[fieldName] = mediumAmounts.length > 0 ? mediumAmounts[0] : amounts[0];
          } else {
            extracted[fieldName] = amounts[0];
          }
          logger.debug('Extracted field', { field: fieldName, value: extracted[fieldName] });
        }
      }
    }
    
    // Email fields
    else if (lowerField.includes('email')) {
      const matches = text.match(emailPattern);
      if (matches && matches.length > 0) {
        extracted[fieldName] = matches[0];
        logger.debug('Extracted email field', { field: fieldName, value: extracted[fieldName] });
      }
    }
    
    // Phone fields
    else if (lowerField.includes('phone')) {
      const matches = text.match(phonePattern);
      if (matches && matches.length > 0) {
        extracted[fieldName] = matches[0];
        logger.debug('Extracted phone field', { field: fieldName, value: extracted[fieldName] });
      }
    }
    
    // Name fields - AGGRESSIVE extraction
    else if (lowerField.includes('name') && fieldType.toLowerCase().includes('string')) {
      if (allCompanyNames.length > 0) {
        if (lowerField.includes('insured') || lowerField.includes('subcontractor')) {
          // Use first company name for insured
          extracted[fieldName] = allCompanyNames[0];
        } else if (lowerField.includes('broker') || lowerField.includes('producer')) {
          // Use second company name if available
          extracted[fieldName] = allCompanyNames[Math.min(1, allCompanyNames.length - 1)];
        } else {
          extracted[fieldName] = allCompanyNames[0];
        }
        logger.debug('Extracted name field', { field: fieldName, value: extracted[fieldName] });
      }
    }
  }
  
  // ACORD 25 specific label-driven extraction - FLOOD with more data
  logger.info('Running ACORD 25 specific extraction');
  const getAmountAfter = (label) => {
    const re = new RegExp(label + "[\\s:]*\\$?([\\d,]+(?:\\.\\d{2})?)", 'i');
    const m = text.match(re);
    return m && m[1] ? parseFloat(m[1].replace(/[$,]/g, '')) : null;
  };

  const getValueAfter = (label) => {
    const re = new RegExp(label + "[\\s:]*([A-Za-z0-9 &.,'\\-]{2,100})", 'i');
    const m = text.match(re);
    return m && m[1] ? m[1].trim() : null;
  };

  const getBlockAfterLabel = (label, stopLabels = []) => {
    const upperText = (text || '').toUpperCase();
    const labelUpper = label.toUpperCase();
    const startIdx = upperText.indexOf(labelUpper);
    if (startIdx === -1) return null;
    let block = text.substring(startIdx + label.length);
    if (!block) return null;

    // Limit to first 10 lines (~400 chars) to avoid runaway blocks
    const lines = block.split('\n').slice(0, 10);
    block = lines.join('\n');

    // Stop at the next known label
    const stops = stopLabels.map(l => l.toUpperCase());
    let endIdx = block.length;
    for (const stop of stops) {
      const i = block.toUpperCase().indexOf(stop);
      if (i !== -1 && i < endIdx) endIdx = i;
    }
    block = block.substring(0, endIdx);

    // Clean and normalize whitespace
    return block.replace(/\s{2,}/g, ' ').replace(/\n{2,}/g, '\n').trim();
  };

  const splitList = (value) => {
    if (!value) return [];
    return value
      .split(/\n|,|;|\|/)
      .map(v => v.trim())
      .filter(Boolean);
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
  
  // WC LIMITS EXTRACTION
  if ('wc_each_accident' in schema && extracted.wc_each_accident == null) {
    const v = getAmountAfter('E\\.?L\\.?\\s+EACH\\s+ACCIDENT') || getAmountAfter('EL\\s+EACH\\s+ACCIDENT');
    if (v) {
      extracted.wc_each_accident = v;
      logger.debug('WC Each Accident', { value: v });
    }
  }
  if ('wc_disease_policy_limit' in schema && extracted.wc_disease_policy_limit == null) {
    const v = getAmountAfter('E\\.?L\\.?\\s+DISEASE\\s*-\\s*POLICY\\s+LIMIT') || getAmountAfter('DISEASE\\s*-\\s*POLICY\\s+LIMIT');
    if (v) {
      extracted.wc_disease_policy_limit = v;
      logger.debug('WC Disease Policy Limit', { value: v });
    }
  }
  if ('wc_disease_each_employee' in schema && extracted.wc_disease_each_employee == null) {
    const v = getAmountAfter('E\\.?L\\.?\\s+DISEASE\\s*-\\s*EA\\s+EMPLOYEE') || getAmountAfter('DISEASE\\s*-\\s*EACH\\s+EMPLOYEE');
    if (v) {
      extracted.wc_disease_each_employee = v;
      logger.debug('WC Disease Each Employee', { value: v });
    }
  }
  
  // AUTO LIMITS EXTRACTION
  if ('auto_combined_single_limit' in schema && extracted.auto_combined_single_limit == null) {
    const v = getAmountAfter('COMBINED\\s+SINGLE\\s+LIMIT') || getAmountAfter('CSL');
    if (v) {
      extracted.auto_combined_single_limit = v;
      logger.debug('Auto Combined Single Limit', { value: v });
    }
  }
  if ('auto_bodily_injury' in schema && extracted.auto_bodily_injury == null) {
    const v = getAmountAfter('BODILY\\s+INJURY.*?PER\\s+PERSON');
    if (v) {
      extracted.auto_bodily_injury = v;
      logger.debug('Auto Bodily Injury', { value: v });
    }
  }
  
  // UMBRELLA LIMITS EXTRACTION
  if ('umbrella_each_occurrence' in schema && extracted.umbrella_each_occurrence == null) {
    // Look for umbrella section specifically
    const umbrellaSection = text.match(/UMBRELLA[\s\S]{0,300}?EACH\s+OCCURRENCE[\s:]*\$?\s?([\d,]+)/i);
    if (umbrellaSection && umbrellaSection[1]) {
      extracted.umbrella_each_occurrence = parseFloat(umbrellaSection[1].replace(/,/g, ''));
      logger.debug('Umbrella Each Occurrence', { value: extracted.umbrella_each_occurrence });
    }
  }
  if ('umbrella_aggregate' in schema && extracted.umbrella_aggregate == null) {
    const umbrellaSection = text.match(/UMBRELLA[\s\S]{0,300}?AGGREGATE[\s:]*\$?\s?([\d,]+)/i);
    if (umbrellaSection && umbrellaSection[1]) {
      extracted.umbrella_aggregate = parseFloat(umbrellaSection[1].replace(/,/g, ''));
      logger.debug('Umbrella Aggregate', { value: extracted.umbrella_aggregate });
    }
  }

  // COMPREHENSIVE COVERAGE TABLE EXTRACTION
  // ACORD 25 has a structured table with columns: TYPE OF INSURANCE | INSR LTR | POLICY NUMBER | POLICY EFF | POLICY EXP | LIMITS
  // We need to extract each row and parse the coverage information
  
  const extractCoverageFromTable = () => {
    const coverages = {
      gl: {},
      auto: {},
      wc: {},
      umbrella: {},
      excess: {},
      property: {}
    };
    
    // Find the coverage table section
    const tableStart = text.search(/TYPE\s+OF\s+INSURANCE/i);
    if (tableStart === -1) {
      logger.warn('Coverage table not found');
      return coverages;
    }
    
    const tableText = text.substring(tableStart, tableStart + 3000);
    
    // Extract GL coverage row - improved to handle various formats
    // Look for policy number, eff date, and exp date in coverage row (within reasonable proximity)
    const glMatch = tableText.match(/COMMERCIAL\s+GENERAL\s+LIABILITY[^\n]*(?:\n[^\n]*){0,3}/i);
    if (glMatch) {
      const glSection = glMatch[0];
      // Extract policy number from GL section - require at least one digit
      const policyMatch = glSection.match(/(?:POLICY\s+(?:NUMBER|NO|#)\s*[:.]?\s*)?([A-Z]{2,4}[-\s]?\d[\dA-Z-]{3,20})/i);
      if (policyMatch && policyMatch[1] && isValidPolicyNumber(policyMatch[1])) {
        coverages.gl.policy_number = policyMatch[1].trim();
      }
      // Extract dates from GL section
      const dateMatches = glSection.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/g);
      if (dateMatches && dateMatches.length >= 1) {
        coverages.gl.effective_date = dateMatches[0];
        if (dateMatches.length >= 2) {
          coverages.gl.expiration_date = dateMatches[1];
        }
      }
      if (coverages.gl.policy_number || coverages.gl.effective_date) {
        logger.debug('GL Coverage extracted from table', { coverage: coverages.gl });
      }
    }
    
    // Extract Auto coverage row - improved to handle various formats
    const autoMatch = tableText.match(/AUTOMOBILE\s+LIABILITY[^\n]*(?:\n[^\n]*){0,3}/i);
    if (autoMatch) {
      const autoSection = autoMatch[0];
      const policyMatch = autoSection.match(/(?:POLICY\s+(?:NUMBER|NO|#)\s*[:.]?\s*)?([A-Z]{2,4}[-\s]?\d[\dA-Z-]{3,20})/i);
      if (policyMatch && policyMatch[1] && isValidPolicyNumber(policyMatch[1])) {
        coverages.auto.policy_number = policyMatch[1].trim();
      }
      const dateMatches = autoSection.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/g);
      if (dateMatches && dateMatches.length >= 1) {
        coverages.auto.effective_date = dateMatches[0];
        if (dateMatches.length >= 2) {
          coverages.auto.expiration_date = dateMatches[1];
        }
      }
      if (coverages.auto.policy_number || coverages.auto.effective_date) {
        logger.debug('Auto Coverage extracted from table', { coverage: coverages.auto });
      }
    }
    
    // Extract WC coverage row - improved to handle various formats
    const wcMatch = tableText.match(/WORKERS\s+COMPENSATION[^\n]*(?:\n[^\n]*){0,3}/i);
    if (wcMatch) {
      const wcSection = wcMatch[0];
      const policyMatch = wcSection.match(/(?:POLICY\s+(?:NUMBER|NO|#)\s*[:.]?\s*)?([A-Z]{2,4}[-\s]?\d[\dA-Z-]{3,20})/i);
      if (policyMatch && policyMatch[1] && isValidPolicyNumber(policyMatch[1])) {
        coverages.wc.policy_number = policyMatch[1].trim();
      }
      const dateMatches = wcSection.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/g);
      if (dateMatches && dateMatches.length >= 1) {
        coverages.wc.effective_date = dateMatches[0];
        if (dateMatches.length >= 2) {
          coverages.wc.expiration_date = dateMatches[1];
        }
      }
      if (coverages.wc.policy_number || coverages.wc.effective_date) {
        logger.debug('WC Coverage extracted from table', { coverage: coverages.wc });
      }
    }
    
    // Extract Umbrella coverage row - improved to handle various formats
    const umbrellaMatch = tableText.match(/UMBRELLA\s+LIAB(?:ILITY)?[^\n]*(?:\n[^\n]*){0,3}/i);
    if (umbrellaMatch) {
      const umbrellaSection = umbrellaMatch[0];
      const policyMatch = umbrellaSection.match(/(?:POLICY\s+(?:NUMBER|NO|#)\s*[:.]?\s*)?([A-Z]{2,4}[-\s]?\d[\dA-Z-]{3,20})/i);
      if (policyMatch && policyMatch[1] && isValidPolicyNumber(policyMatch[1])) {
        coverages.umbrella.policy_number = policyMatch[1].trim();
      }
      const dateMatches = umbrellaSection.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/g);
      if (dateMatches && dateMatches.length >= 1) {
        coverages.umbrella.effective_date = dateMatches[0];
        if (dateMatches.length >= 2) {
          coverages.umbrella.expiration_date = dateMatches[1];
        }
      }
      if (coverages.umbrella.policy_number || coverages.umbrella.effective_date) {
        logger.debug('Umbrella Coverage extracted from table', { coverage: coverages.umbrella });
      }
    }
    
    // Extract Excess Liability coverage row - improved to handle various formats
    const excessMatch = tableText.match(/EXCESS\s+LIAB(?:ILITY)?[^\n]*(?:\n[^\n]*){0,3}/i);
    if (excessMatch) {
      const excessSection = excessMatch[0];
      const policyMatch = excessSection.match(/(?:POLICY\s+(?:NUMBER|NO|#)\s*[:.]?\s*)?([A-Z]{2,4}[-\s]?\d[\dA-Z-]{3,20})/i);
      if (policyMatch && policyMatch[1] && isValidPolicyNumber(policyMatch[1])) {
        coverages.excess.policy_number = policyMatch[1].trim();
      }
      const dateMatches = excessSection.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/g);
      if (dateMatches && dateMatches.length >= 1) {
        coverages.excess.effective_date = dateMatches[0];
        if (dateMatches.length >= 2) {
          coverages.excess.expiration_date = dateMatches[1];
        }
      }
      if (coverages.excess.policy_number || coverages.excess.effective_date) {
        logger.debug('Excess Liability Coverage extracted from table', { coverage: coverages.excess });
      }
    }
    
    return coverages;
  };
  
  // Extract coverage information from table
  const tableCoverages = extractCoverageFromTable();
  
  // Apply table-extracted data to schema fields
  if ('policy_number_gl' in schema && !extracted.policy_number_gl && tableCoverages.gl.policy_number) {
    extracted.policy_number_gl = tableCoverages.gl.policy_number;
    logger.debug('GL Policy Number (from table)', { policyNumber: extracted.policy_number_gl });
  }
  if ('gl_effective_date' in schema && !extracted.gl_effective_date && tableCoverages.gl.effective_date) {
    extracted.gl_effective_date = tableCoverages.gl.effective_date;
    logger.debug('GL Effective Date (from table)', { date: extracted.gl_effective_date });
  }
  if ('gl_expiration_date' in schema && !extracted.gl_expiration_date && tableCoverages.gl.expiration_date) {
    extracted.gl_expiration_date = tableCoverages.gl.expiration_date;
    logger.debug('GL Expiration Date (from table)', { date: extracted.gl_expiration_date });
  }
  
  if ('policy_number_auto' in schema && !extracted.policy_number_auto && tableCoverages.auto.policy_number) {
    extracted.policy_number_auto = tableCoverages.auto.policy_number;
    logger.debug('Auto Policy Number (from table)', { policyNumber: extracted.policy_number_auto });
  }
  if ('auto_effective_date' in schema && !extracted.auto_effective_date && tableCoverages.auto.effective_date) {
    extracted.auto_effective_date = tableCoverages.auto.effective_date;
    logger.debug('Auto Effective Date (from table)', { date: extracted.auto_effective_date });
  }
  if ('auto_expiration_date' in schema && !extracted.auto_expiration_date && tableCoverages.auto.expiration_date) {
    extracted.auto_expiration_date = tableCoverages.auto.expiration_date;
    logger.debug('Auto Expiration Date (from table)', { date: extracted.auto_expiration_date });
  }
  
  if ('policy_number_wc' in schema && !extracted.policy_number_wc && tableCoverages.wc.policy_number) {
    extracted.policy_number_wc = tableCoverages.wc.policy_number;
    logger.debug('WC Policy Number (from table)', { policyNumber: extracted.policy_number_wc });
  }
  if ('wc_effective_date' in schema && !extracted.wc_effective_date && tableCoverages.wc.effective_date) {
    extracted.wc_effective_date = tableCoverages.wc.effective_date;
    logger.debug('WC Effective Date (from table)', { date: extracted.wc_effective_date });
  }
  if ('wc_expiration_date' in schema && !extracted.wc_expiration_date && tableCoverages.wc.expiration_date) {
    extracted.wc_expiration_date = tableCoverages.wc.expiration_date;
    logger.debug('WC Expiration Date (from table)', { date: extracted.wc_expiration_date });
  }
  
  if ('policy_number_umbrella' in schema && !extracted.policy_number_umbrella && tableCoverages.umbrella.policy_number) {
    extracted.policy_number_umbrella = tableCoverages.umbrella.policy_number;
    logger.debug('Umbrella Policy Number (from table)', { policyNumber: extracted.policy_number_umbrella });
  }
  if ('umbrella_effective_date' in schema && !extracted.umbrella_effective_date && tableCoverages.umbrella.effective_date) {
    extracted.umbrella_effective_date = tableCoverages.umbrella.effective_date;
    logger.debug('Umbrella Effective Date (from table)', { date: extracted.umbrella_effective_date });
  }
  if ('umbrella_expiration_date' in schema && !extracted.umbrella_expiration_date && tableCoverages.umbrella.expiration_date) {
    extracted.umbrella_expiration_date = tableCoverages.umbrella.expiration_date;
    logger.debug('Umbrella Expiration Date (from table)', { date: extracted.umbrella_expiration_date });
  }

  // CONTEXT-AWARE DATE EXTRACTION for GL coverage
  if ('gl_effective_date' in schema && !extracted.gl_effective_date) {
    // First try context-specific extraction from GL section
    const glSection = text.match(new RegExp(`COMMERCIAL\\s+GENERAL\\s+LIABILITY[\\s\\S]{0,${COVERAGE_SECTION_CHAR_LIMIT}}?(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})`, 'i'));
    const v = (glSection && glSection[1]) || getValueAfter('POLICY\\s+EFF') || getValueAfter('EFFECTIVE\\s+DATE');
    if (v) {
      extracted.gl_effective_date = v;
      logger.debug('GL Effective Date', { value: v });
    }
  }
  if ('gl_expiration_date' in schema && !extracted.gl_expiration_date) {
    // First try context-specific extraction from GL section  
    const glSection = text.match(new RegExp(`COMMERCIAL\\s+GENERAL\\s+LIABILITY[\\s\\S]{0,${COVERAGE_SECTION_CHAR_LIMIT}}?(?:\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})[\\s\\S]{0,${DATE_PROXIMITY_CHAR_LIMIT}}?(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})`, 'i'));
    const v = (glSection && glSection[1]) || getValueAfter('POLICY\\s+EXP') || getValueAfter('EXPIRATION\\s+DATE');
    if (v) {
      extracted.gl_expiration_date = v;
      logger.debug('GL Expiration Date', { value: v });
    }
  }
  
  // WC dates - Extract from WC coverage section instead of using index
  if ('wc_effective_date' in schema && !extracted.wc_effective_date) {
    // Try to find dates near Workers Compensation keyword
    const wcSection = text.match(new RegExp(`WORKERS\\s+COMPENSATION[\\s\\S]{0,${COVERAGE_SECTION_CHAR_LIMIT}}?(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})`, 'i'));
    if (wcSection && wcSection[1]) {
      extracted.wc_effective_date = wcSection[1];
      logger.debug('WC Effective Date (from WC section)', { date: extracted.wc_effective_date });
    }
  }
  if ('wc_expiration_date' in schema && !extracted.wc_expiration_date) {
    // Look for second date in WC section
    const wcSection = text.match(new RegExp(`WORKERS\\s+COMPENSATION[\\s\\S]{0,${COVERAGE_SECTION_CHAR_LIMIT}}?(?:\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})[\\s\\S]{0,${DATE_PROXIMITY_CHAR_LIMIT}}?(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})`, 'i'));
    if (wcSection && wcSection[1]) {
      extracted.wc_expiration_date = wcSection[1];
      logger.debug('WC Expiration Date (from WC section)', { date: extracted.wc_expiration_date });
    }
  }
  
  // Auto dates - Extract from Auto coverage section instead of using index
  if ('auto_effective_date' in schema && !extracted.auto_effective_date) {
    const autoSection = text.match(new RegExp(`AUTOMOBILE\\s+LIABILITY[\\s\\S]{0,${COVERAGE_SECTION_CHAR_LIMIT}}?(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})`, 'i'));
    if (autoSection && autoSection[1]) {
      extracted.auto_effective_date = autoSection[1];
      logger.debug('Auto Effective Date (from Auto section)', { date: extracted.auto_effective_date });
    }
  }
  if ('auto_expiration_date' in schema && !extracted.auto_expiration_date) {
    // Look for second date in Auto section
    const autoSection = text.match(new RegExp(`AUTOMOBILE\\s+LIABILITY[\\s\\S]{0,${COVERAGE_SECTION_CHAR_LIMIT}}?(?:\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})[\\s\\S]{0,${DATE_PROXIMITY_CHAR_LIMIT}}?(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})`, 'i'));
    if (autoSection && autoSection[1]) {
      extracted.auto_expiration_date = autoSection[1];
      logger.debug('Auto Expiration Date (from Auto section)', { date: extracted.auto_expiration_date });
    }
  }
  
  // Umbrella dates - Extract from Umbrella coverage section instead of using index
  if ('umbrella_effective_date' in schema && !extracted.umbrella_effective_date) {
    const umbrellaSection = text.match(new RegExp(`UMBRELLA\\s+LIAB(?:ILITY)?[\\s\\S]{0,${COVERAGE_SECTION_CHAR_LIMIT}}?(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})`, 'i'));
    if (umbrellaSection && umbrellaSection[1]) {
      extracted.umbrella_effective_date = umbrellaSection[1];
      logger.debug('Umbrella Effective Date (from Umbrella section)', { date: extracted.umbrella_effective_date });
    }
  }
  if ('umbrella_expiration_date' in schema && !extracted.umbrella_expiration_date) {
    // Look for second date in Umbrella section
    const umbrellaSection = text.match(new RegExp(`UMBRELLA\\s+LIAB(?:ILITY)?[\\s\\S]{0,${COVERAGE_SECTION_CHAR_LIMIT}}?(?:\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})[\\s\\S]{0,${DATE_PROXIMITY_CHAR_LIMIT}}?(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})`, 'i'));
    if (umbrellaSection && umbrellaSection[1]) {
      extracted.umbrella_expiration_date = umbrellaSection[1];
      logger.debug('Umbrella Expiration Date (from Umbrella section)', { date: extracted.umbrella_expiration_date });
    }
  }
  
  // DYNAMIC INSURER/CARRIER EXTRACTION - Extract all insurers A-F dynamically
  // Step 1: Extract all insurers into a map from "INSURER(S) AFFORDING COVERAGE" section
  const insurerMap = {};
  // More specific pattern - match line by line to avoid capturing subsequent lines
  const lines = text.split('\n');
  for (const line of lines) {
    const insurerMatch = line.match(/INSURER\s+([A-F])\s*[:\s]+(.+?)$/i);
    if (insurerMatch) {
      const letter = insurerMatch[1].toUpperCase();
      const carrier = insurerMatch[2].trim();
      if (carrier && carrier.length > 3 && !insurerMap[letter]) {
        insurerMap[letter] = carrier;
        logger.debug('Found INSURER', { letter, carrier });
      }
    }
  }
  
  // Step 2: Find which insurer letter corresponds to each coverage type
  // by looking for the "INSR LTR" value in each coverage section
  
  // Helper function to find insurer letter for a coverage type
  const findInsurerLetterForCoverage = (coverageKeywords) => {
    for (const keyword of coverageKeywords) {
      // Look for coverage type followed by insurer letter nearby
      // Pattern: COVERAGE_TYPE ... (up to COVERAGE_SECTION_CHAR_LIMIT chars) ... single letter A-F
      // More restrictive: Look for INSR LTR or letter in table structure
      const coverageRegex = new RegExp(
        keyword + '[\\s\\S]{0,' + COVERAGE_SECTION_CHAR_LIMIT + '}?(?:INSR\\s+LTR[\\s\\n:]+)([A-F])\\b',
        'i'
      );
      let match = text.match(coverageRegex);
      
      // If no match with INSR LTR, try to find single letter in coverage line (less reliable, so only if found)
      if (!match) {
        const fallbackRegex = new RegExp(
          keyword + '[^\\n]{0,' + INSURER_LETTER_PROXIMITY + '}?\\b([A-F])\\b',
          'i'
        );
        match = text.match(fallbackRegex);
        // Validate that this letter actually exists in insurerMap
        if (match && match[1] && !insurerMap[match[1].toUpperCase()]) {
          match = null; // Reject if letter not found in insurer list
        }
      }
      
      if (match && match[1]) {
        const letter = match[1].toUpperCase();
        if (insurerMap[letter]) {
          return { letter, carrier: insurerMap[letter] };
        }
      }
    }
    return null;
  };
  
  // Extract GL carrier by finding which letter is associated with GL coverage
  if ('insurance_carrier_gl' in schema && !extracted.insurance_carrier_gl) {
    const glInsurer = findInsurerLetterForCoverage([
      'COMMERCIAL\\s+GENERAL\\s+LIABILITY',
      'GENERAL\\s+LIABILITY',
      'CGL'
    ]);
    if (glInsurer) {
      extracted.insurance_carrier_gl = glInsurer.carrier;
      extracted.gl_insurer_letter = glInsurer.letter; // Store letter for PDF generation
      logger.debug('GL Carrier', { carrier: glInsurer.carrier, letter: glInsurer.letter });
    }
  }
  
  // Extract Auto carrier
  if ('insurance_carrier_auto' in schema && !extracted.insurance_carrier_auto) {
    const autoInsurer = findInsurerLetterForCoverage([
      'AUTOMOBILE\\s+LIABILITY',
      'AUTO\\s+LIABILITY',
      'BUSINESS\\s+AUTO'
    ]);
    if (autoInsurer) {
      extracted.insurance_carrier_auto = autoInsurer.carrier;
      extracted.auto_insurer_letter = autoInsurer.letter;
      logger.debug('Auto Carrier', { carrier: autoInsurer.carrier, letter: autoInsurer.letter });
    }
  }
  
  // Extract WC carrier
  if ('insurance_carrier_wc' in schema && !extracted.insurance_carrier_wc) {
    const wcInsurer = findInsurerLetterForCoverage([
      'WORKERS\\s+COMPENSATION',
      'WORKERS\\s+COMP',
      'WC'
    ]);
    if (wcInsurer) {
      extracted.insurance_carrier_wc = wcInsurer.carrier;
      extracted.wc_insurer_letter = wcInsurer.letter;
      logger.debug('WC Carrier', { carrier: wcInsurer.carrier, letter: wcInsurer.letter });
    }
  }
  
  // Extract Umbrella carrier
  if ('insurance_carrier_umbrella' in schema && !extracted.insurance_carrier_umbrella) {
    const umbrellaInsurer = findInsurerLetterForCoverage([
      'UMBRELLA\\s+LIAB',
      'UMBRELLA\\s+LIABILITY',
      'EXCESS\\s+LIAB'
    ]);
    if (umbrellaInsurer) {
      extracted.insurance_carrier_umbrella = umbrellaInsurer.carrier;
      extracted.umbrella_insurer_letter = umbrellaInsurer.letter;
      logger.debug('Umbrella Carrier', { carrier: umbrellaInsurer.carrier, letter: umbrellaInsurer.letter });
    }
  }
  
  // Store all insurers map for reference (useful for regeneration)
  if (Object.keys(insurerMap).length > 0) {
    extracted.all_insurers = insurerMap;
    logger.debug('All insurers extracted', { insurerMap });
  }

  // PRODUCER/BROKER SECTION EXTRACTION
  if ('broker_name' in schema && !extracted.broker_name) {
    const producerBlock = getBlockAfterLabel('PRODUCER', ['CONTACT', 'INSURED', 'INSURER']);
    if (producerBlock) {
      // Optimized: Single pass instead of split→map→filter
      const lines = producerBlock.split(/\n/).reduce((acc, line) => {
        const trimmed = line.trim();
        if (trimmed) acc.push(trimmed);
        return acc;
      }, []);
      // First line after PRODUCER is typically the broker name
      if (lines[0] && !lines[0].match(/^(NAME|PHONE|E-MAIL|FAX)/i)) {
        extracted.broker_name = lines[0];
        logger.debug('Broker Name (from PRODUCER)', { name: extracted.broker_name });
        
        // Extract address from remaining lines (skip contact info lines)
        const addressLines = lines.slice(1).filter(line => 
          !line.match(/^(NAME|PHONE|E-MAIL|FAX|CONTACT)[:]/i) &&
          line.length > 3
        );
        if (addressLines.length > 0 && 'broker_address' in schema && !extracted.broker_address) {
          extracted.broker_address = addressLines.join(', ');
          logger.debug('Broker Address (from PRODUCER)', { address: extracted.broker_address });
        }
      }
    }
  }
  
  // CONTACT SECTION EXTRACTION (for broker contact name)
  if ('broker_contact' in schema && !extracted.broker_contact) {
    // Look for "CONTACT" section with NAME field
    const contactMatch = text.match(/CONTACT[\s\n]+NAME[\s:]+([A-Za-z\s.'-]{3,50})/i);
    if (contactMatch && contactMatch[1]) {
      extracted.broker_contact = contactMatch[1].trim();
      logger.debug('Broker Contact Name', { contact: extracted.broker_contact });
    }
  }
  
  // Extract broker phone if not already found
  if ('broker_phone' in schema && !extracted.broker_phone) {
    const phoneMatch = text.match(/(?:PRODUCER|CONTACT)[\s\S]{0,200}?PHONE[\s:]+(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/i);
    if (phoneMatch && phoneMatch[1]) {
      extracted.broker_phone = phoneMatch[1].trim();
      logger.debug('Broker Phone (from PRODUCER/CONTACT)', { phone: extracted.broker_phone });
    }
  }
  
  // Extract broker email if not already found
  if ('broker_email' in schema && !extracted.broker_email) {
    const emailMatch = text.match(/(?:PRODUCER|CONTACT)[\s\S]{0,200}?E-MAIL[\s:]+([^\s\n]+@[^\s\n]+)/i);
    if (emailMatch && emailMatch[1]) {
      extracted.broker_email = emailMatch[1].trim();
      logger.debug('Broker Email (from PRODUCER/CONTACT)', { email: extracted.broker_email });
    }
  }

  // NAMED INSURED - Multiple attempts
  if ('named_insured' in schema && !extracted.named_insured) {
    const v = getValueAfter('INSURED') || getValueAfter('NAMED\\s+INSURED') || (allCompanyNames.length > 0 ? allCompanyNames[0] : null);
    if (v) {
      extracted.named_insured = v;
      logger.debug('Named Insured', { value: v });
    }
  }
  
  if ('subcontractor_name' in schema && !extracted.subcontractor_name) {
    extracted.subcontractor_name = extracted.named_insured || (allCompanyNames.length > 0 ? allCompanyNames[0] : null);
    if (extracted.subcontractor_name) {
      logger.debug('Subcontractor Name', { name: extracted.subcontractor_name });
    }
  }

  if ('policy_number_gl' in schema && !extracted.policy_number_gl) {
    const v = getValueAfter('POLICY\\s+NUMBER');
    if (v) extracted.policy_number_gl = v.replace(/^(POLICY\s+NUMBER\s*[:#]\s*)/i, '').trim();
  }

  // ACORD 25 - Description of Operations / Locations / Vehicles
  if ('description_of_operations' in schema && !extracted.description_of_operations) {
    const block = getBlockAfterLabel('DESCRIPTION OF OPERATIONS', [
      'CERTIFICATE HOLDER',
      'CANCELLATION',
      'AUTHORIZED REPRESENTATIVE'
    ]);
    if (block) extracted.description_of_operations = block;
  }

  // ACORD 25 - Certificate Holder
  if (('certificate_holder_name' in schema || 'certificate_holder_address' in schema) &&
      (!extracted.certificate_holder_name || !extracted.certificate_holder_address)) {
    const holderBlock = getBlockAfterLabel('CERTIFICATE HOLDER', [
      'CANCELLATION',
      'AUTHORIZED REPRESENTATIVE'
    ]);
    if (holderBlock) {
      // Optimized: Single pass instead of split→map→filter
      const lines = holderBlock.split(/\n/).reduce((acc, line) => {
        const trimmed = line.trim();
        if (trimmed) acc.push(trimmed);
        return acc;
      }, []);
      if (!extracted.certificate_holder_name && lines[0]) extracted.certificate_holder_name = lines[0];
      if (!extracted.certificate_holder_address && lines.length > 1) {
        extracted.certificate_holder_address = lines.slice(1).join(', ');
      }
    }
  }

  // Additional Insureds (often listed in description block)
  if ('additional_insureds' in schema && !extracted.additional_insureds) {
    const aiMatch = text.match(/ADDITIONAL\s+INSURED(?:S)?\s*[:-]\s*([A-Za-z0-9 &.,'\-\n]{2,300})/i);
    if (aiMatch && aiMatch[1]) {
      const list = splitList(aiMatch[1]);
      if (list.length) extracted.additional_insureds = list;
    } else if (extracted.description_of_operations) {
      const fromDesc = extracted.description_of_operations.match(/ADDITIONAL\s+INSURED(?:S)?\s*[:-]\s*([A-Za-z0-9 &.,'\-\n]{2,300})/i);
      if (fromDesc && fromDesc[1]) {
        const list = splitList(fromDesc[1]);
        if (list.length) extracted.additional_insureds = list;
      }
    }
  }
  
  // ENDORSEMENT EXTRACTION - Additional Insured and Waiver of Subrogation
  if ('gl_additional_insured' in schema && extracted.gl_additional_insured == null) {
    // Look for keywords indicating additional insured endorsement
    const addlInsuredIndicators = [
      /ADDITIONAL\s+INSURED/i,
      /ADDL\s+INSD/i,
      /blanket\s+additional\s+insured/i,
      /primary\s+and\s+non-contributory/i,
      /primary\s+&\s+non-contributory/i
    ];
    
    // Check each pattern for non-negated occurrences
    let hasAddlInsured = false;
    for (const pattern of addlInsuredIndicators) {
      if (hasNonNegatedKeyword(text, pattern)) {
        hasAddlInsured = true;
        break;
      }
    }
    
    extracted.gl_additional_insured = hasAddlInsured;
    logger.debug('GL Additional Insured', { hasAddlInsured });
  }
  
  if ('gl_waiver_of_subrogation' in schema && extracted.gl_waiver_of_subrogation == null) {
    // Look for keywords indicating waiver of subrogation
    const waiverIndicators = [
      /WAIVER\s+OF\s+SUBROGATION/i,
      /(?:WAIVER|SUBROGATION)/i,  // Check standalone keywords
      /SUBR\s+WVD/i,
      /waived\s+in\s+favor/i,
      /subrogation.*waived/i
    ];
    
    // Check each pattern for non-negated occurrences
    let hasWaiver = false;
    for (const pattern of waiverIndicators) {
      if (hasNonNegatedKeyword(text, pattern)) {
        hasWaiver = true;
        break;
      }
    }
    
    extracted.gl_waiver_of_subrogation = hasWaiver;
    logger.debug('GL Waiver of Subrogation', { hasWaiver });
  }

  logger.debug('Regex extraction results', { 
    fieldsExtracted: Object.keys(extracted).length,
    fields: Object.keys(extracted)
  });
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
  logger.info('Starting extraction', { file_url, hasSchema: !!json_schema, hasPrompt: !!prompt });
  
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
    logger.info('Extracted from PDF', { characters: extractedText.length });
  } else {
    extractedText = 'Image OCR not yet implemented. Please upload PDF files for automatic extraction.';
    logger.info('Non-PDF file, skipping text extraction');
  }

  // If we have a prompt and response schema, use AI to extract structured data
  if (prompt && response_json_schema) {
    try {
      logger.info('Using AI extraction with custom prompt');
      const fullPrompt = `${prompt}\n\nEXTRACTED TEXT FROM DOCUMENT:\n${extractedText.substring(0, 8000)}`;
      const analysis = await aiAnalysis.callAI(fullPrompt);
      const parsedResult = aiAnalysis.parseJSON(analysis);
      
      if (parsedResult && Object.keys(parsedResult).length > 0) {
        logger.info('AI extraction successful', { fields: Object.keys(parsedResult) });
        return {
          status: 'success',
          output: parsedResult,
          raw_text: extractedText.substring(0, 500),
          extraction_method: 'ai_custom_prompt'
        };
      }
    } catch (aiErr) {
      logger.error('AI extraction error', { error: aiErr?.message, stack: aiErr?.stack });
      // Fall through to schema-based extraction
    }
  }

  // If we have a json_schema, try to extract specific fields
  if (json_schema && extractedText) {
    try {
      const schema = typeof json_schema === 'string' ? JSON.parse(json_schema) : json_schema;
      logger.info('Schema fields', { fields: Object.keys(schema) });
      
      // First try AI extraction if available
      if (aiAnalysis.enabled) {
        logger.info('Attempting AI extraction with schema');
        const extractionPrompt = buildExtractionPrompt(schema, extractedText);
        
        const aiResult = await aiAnalysis.callAI(extractionPrompt);
        const extracted = aiAnalysis.parseJSON(aiResult);
        
        if (extracted && Object.keys(extracted).length > 0) {
          logger.info('AI extraction successful', { fields: Object.keys(extracted) });
          return {
            status: 'success',
            output: extracted,
            raw_text: extractedText.substring(0, 500),
            extraction_method: 'ai'
          };
        } else {
          logger.warn('AI extraction returned empty results');
        }
      } else {
        logger.warn('AI service not enabled (set AI_API_KEY environment variable)');
      }
      
      // Fallback to regex-based extraction when AI is not configured or fails
      logger.info('Attempting regex-based extraction');
      const regexExtracted = extractFieldsWithRegex(extractedText, schema);
      
      if (Object.keys(regexExtracted).length > 0) {
        logger.info('Regex extraction found', { fields: Object.keys(regexExtracted) });
        return {
          status: 'success',
          output: regexExtracted,
          raw_text: extractedText.substring(0, 500),
          extraction_method: 'regex',
          message: 'Extracted using pattern matching. Configure AI_API_KEY for better accuracy.'
        };
      } else {
        logger.warn('Regex extraction found no matching fields');
      }
    } catch (extractErr) {
      logger.error('Schema-based extraction error', { error: extractErr?.message, stack: extractErr?.stack });
    }
  }

  // Return extracted text even if structured extraction failed
  logger.warn('No structured data extracted, returning raw text');
  return {
    status: 'partial',
    output: {},
    raw_text: extractedText.substring(0, 500),
    full_text: extractedText.substring(0, 50000), // Limit to 50k chars to avoid performance issues
    message: 'Text extracted from document, but structured data extraction failed. Please review the raw text below and enter data manually if needed.',
    extraction_method: 'text_only'
  };
}

// Helper function to extract exclusions from policy or endorsement text
function extractExclusions(text) {
  logger.info('Extracting exclusions from document text');
  const exclusions = [];
  
  if (!text) return exclusions;
  
  const lines = text.split('\n');
  const exclusionPatterns = [
    // Common exclusion markers
    /(?:EXCLUSION|EXCLUDED|DOES\s+NOT\s+COVER|NOT\s+COVERED|EXCLUDED\s+(?:FROM\s+)?COVERAGE)/i,
    // Specific types of exclusions
    /(?:RESIDENTIAL|HABITATIONAL)\s+EXCLUSION/i,
    /(?:NY|NEW\s+YORK)\s+LABOR\s+LAW\s+EXCLUSION/i,
    /ASBESTOS\s+EXCLUSION/i,
    /LEAD\s+(?:PAINT\s+)?EXCLUSION/i,
    /MOLD\s+EXCLUSION/i,
    /POLLUTION\s+EXCLUSION/i,
    /UNDERGROUND\s+(?:STORAGE\s+)?TANK\s+EXCLUSION/i,
    /PROFESSIONAL\s+(?:LIABILITY\s+)?EXCLUSION/i,
    /AIRCRAFT\s+EXCLUSION/i,
    /WATERCRAFT\s+EXCLUSION/i,
    /NUCLEAR\s+EXCLUSION/i,
    /WAR\s+EXCLUSION/i,
    /CYBER\s+(?:LIABILITY\s+)?EXCLUSION/i
  ];
  
  // Search for exclusion sections and nearby text
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line contains exclusion language
    for (const pattern of exclusionPatterns) {
      if (pattern.test(line)) {
        // Extract context: 2 lines before and 3 lines after
        const startIdx = Math.max(0, i - 2);
        const endIdx = Math.min(lines.length, i + 4);
        const contextLines = lines.slice(startIdx, endIdx);
        const context = contextLines.join(' ').trim();
        
        // Determine exclusion type
        let type = 'general';
        if (/residential|habitational/i.test(line)) type = 'residential';
        else if (/labor\s+law/i.test(line)) type = 'labor_law';
        else if (/asbestos/i.test(line)) type = 'asbestos';
        else if (/lead/i.test(line)) type = 'lead';
        else if (/mold/i.test(line)) type = 'mold';
        else if (/pollution/i.test(line)) type = 'pollution';
        else if (/professional/i.test(line)) type = 'professional_liability';
        else if (/cyber/i.test(line)) type = 'cyber';
        
        exclusions.push({
          type,
          text: line.trim(),
          context: context.substring(0, 300), // Limit context to 300 chars
          line_number: i + 1
        });
        
        logger.debug('Found exclusion', { type, line: line.trim().substring(0, 100) });
        break; // Don't double-count same line
      }
    }
  }
  
  logger.info('Extracted exclusions from document', { count: exclusions.length });
  return exclusions;
}

// Helper function to compare policy data to COI data
function comparePolicyToCOI(policyData, coiData, coverageType) {
  logger.info('Comparing policy to COI data', { coverageType });
  const discrepancies = [];
  
  // Field mapping by coverage type
  const fieldMaps = {
    gl: {
      policy_number: ['policy_number_gl', 'Policy Number'],
      carrier: ['insurance_carrier_gl', 'Insurance Carrier'],
      each_occurrence: ['gl_each_occurrence', 'Each Occurrence Limit'],
      general_aggregate: ['gl_general_aggregate', 'General Aggregate'],
      products_ops: ['gl_products_completed_ops', 'Products/Completed Ops'],
      effective_date: ['gl_effective_date', 'Effective Date'],
      expiration_date: ['gl_expiration_date', 'Expiration Date']
    },
    wc: {
      policy_number: ['policy_number_wc', 'Policy Number'],
      carrier: ['insurance_carrier_wc', 'Insurance Carrier'],
      each_accident: ['wc_each_accident', 'Each Accident'],
      disease_policy_limit: ['wc_disease_policy_limit', 'Disease Policy Limit'],
      disease_each_employee: ['wc_disease_each_employee', 'Disease Each Employee'],
      effective_date: ['wc_effective_date', 'Effective Date'],
      expiration_date: ['wc_expiration_date', 'Expiration Date']
    },
    auto: {
      policy_number: ['policy_number_auto', 'Policy Number'],
      carrier: ['insurance_carrier_auto', 'Insurance Carrier'],
      combined_single_limit: ['auto_combined_single_limit', 'Combined Single Limit'],
      effective_date: ['auto_effective_date', 'Effective Date'],
      expiration_date: ['auto_expiration_date', 'Expiration Date']
    },
    umbrella: {
      policy_number: ['policy_number_umbrella', 'Policy Number'],
      carrier: ['insurance_carrier_umbrella', 'Insurance Carrier'],
      each_occurrence: ['umbrella_each_occurrence', 'Each Occurrence'],
      aggregate: ['umbrella_aggregate', 'Aggregate'],
      effective_date: ['umbrella_effective_date', 'Effective Date'],
      expiration_date: ['umbrella_expiration_date', 'Expiration Date']
    }
  };
  
  const fieldMap = fieldMaps[coverageType];
  if (!fieldMap) {
    logger.warn('Unknown coverage type', { coverageType });
    return discrepancies;
  }
  
  // Compare each field
  for (const [policyField, [coiField, displayName]] of Object.entries(fieldMap)) {
    const policyValue = policyData[policyField];
    const coiValue = coiData[coiField];
    
    // Skip if both are missing
    if (!policyValue && !coiValue) continue;
    
    // Check for mismatches
    if (policyValue && coiValue) {
      // Normalize values for comparison
      let policyNorm = String(policyValue).trim().toUpperCase();
      let coiNorm = String(coiValue).trim().toUpperCase();
      
      // For numbers, parse and compare
      if (typeof policyValue === 'number' || !isNaN(parseFloat(policyValue))) {
        const policyNum = parseFloat(String(policyValue).replace(/[$,]/g, ''));
        const coiNum = parseFloat(String(coiValue).replace(/[$,]/g, ''));
        
        if (!isNaN(policyNum) && !isNaN(coiNum) && Math.abs(policyNum - coiNum) > 0.01) {
          discrepancies.push({
            field: coiField,
            display_name: displayName,
            policy_value: policyNum,
            coi_value: coiNum,
            severity: policyNum < coiNum ? 'high' : 'medium',
            message: policyNum < coiNum 
              ? `Policy limit ($${policyNum.toLocaleString()}) is lower than COI limit ($${coiNum.toLocaleString()})`
              : `COI limit ($${coiNum.toLocaleString()}) doesn't match policy limit ($${policyNum.toLocaleString()})`
          });
        }
      } else if (policyNorm !== coiNorm) {
        // String comparison
        discrepancies.push({
          field: coiField,
          display_name: displayName,
          policy_value: policyValue,
          coi_value: coiValue,
          severity: 'medium',
          message: `Policy ${displayName} (${policyValue}) doesn't match COI (${coiValue})`
        });
      }
    } else if (policyValue && !coiValue) {
      discrepancies.push({
        field: coiField,
        display_name: displayName,
        policy_value: policyValue,
        coi_value: null,
        severity: 'low',
        message: `${displayName} found in policy but missing from COI`
      });
    } else if (!policyValue && coiValue) {
      discrepancies.push({
        field: coiField,
        display_name: displayName,
        policy_value: null,
        coi_value: coiValue,
        severity: 'high',
        message: `${displayName} on COI (${coiValue}) cannot be verified - not found in policy`
      });
    }
  }
  
  logger.info('Found discrepancies between policy and COI', { count: discrepancies.length });
  return discrepancies;
}

// Helper function to compare exclusions against requirements
function compareExclusionsToRequirements(exclusions, requirements, projectData) {
  logger.info('Comparing exclusions to requirements and project data');
  const conflicts = [];
  
  if (!exclusions || exclusions.length === 0) {
    logger.info('No exclusions to check');
    return conflicts;
  }
  
  // Check project type conflicts
  if (projectData) {
    const projectType = (projectData.project_type || '').toLowerCase();
    const projectState = (projectData.state || '').toUpperCase();
    
    // Residential project conflicts
    if (projectType.includes('residential') || projectType.includes('habitational')) {
      const residentialExclusions = exclusions.filter(e => 
        e.type === 'residential' || /residential|habitational/i.test(e.text)
      );
      
      for (const excl of residentialExclusions) {
        conflicts.push({
          severity: 'critical',
          category: 'project_conflict',
          exclusion_type: excl.type,
          exclusion_text: excl.text,
          conflict_reason: 'Residential/Habitational exclusion conflicts with residential project type',
          project_field: 'project_type',
          project_value: projectType,
          required_action: 'Remove residential exclusion or provide endorsement covering residential work'
        });
      }
    }
    
    // NY Labor Law conflicts
    if (projectState === 'NY') {
      const laborLawExclusions = exclusions.filter(e => 
        e.type === 'labor_law' || /labor\s+law/i.test(e.text)
      );
      
      for (const excl of laborLawExclusions) {
        conflicts.push({
          severity: 'high',
          category: 'project_conflict',
          exclusion_type: excl.type,
          exclusion_text: excl.text,
          conflict_reason: 'NY Labor Law exclusion may conflict with New York project requirements',
          project_field: 'state',
          project_value: projectState,
          required_action: 'Verify coverage includes NY Labor Law or provide appropriate endorsement'
        });
      }
    }
  }
  
  // Check requirement conflicts
  if (requirements && requirements.length > 0) {
    for (const req of requirements) {
      const insuranceType = req.insurance_type || '';
      
      // Check if professional liability exclusion conflicts with requirement
      if (insuranceType.includes('professional')) {
        const professionalExclusions = exclusions.filter(e => 
          e.type === 'professional_liability' || /professional.*(?:liability|services)/i.test(e.text)
        );
        
        for (const excl of professionalExclusions) {
          conflicts.push({
            severity: 'high',
            category: 'requirement_conflict',
            exclusion_type: excl.type,
            exclusion_text: excl.text,
            conflict_reason: 'Professional liability exclusion conflicts with program requirement',
            requirement_type: insuranceType,
            required_action: 'Remove professional liability exclusion or provide separate professional liability coverage'
          });
        }
      }
      
      // Check pollution exclusion if environmental work is required
      if (req.requires_pollution_coverage || /pollution|environmental/i.test(req.notes || '')) {
        const pollutionExclusions = exclusions.filter(e => 
          e.type === 'pollution' || /pollution|environmental/i.test(e.text)
        );
        
        for (const excl of pollutionExclusions) {
          conflicts.push({
            severity: 'high',
            category: 'requirement_conflict',
            exclusion_type: excl.type,
            exclusion_text: excl.text,
            conflict_reason: 'Pollution exclusion conflicts with environmental coverage requirement',
            requirement_type: insuranceType,
            required_action: 'Provide separate pollution liability coverage or endorsement'
          });
        }
      }
    }
  }
  
  logger.info('Found exclusion conflicts', { count: conflicts.length });
  return conflicts;
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
    logger.error('extract-file error', { error: err?.message || err });
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
    logger.error('extract-data error', { error: err?.message || err });
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
    logger.error('public extract-data error', { error: err?.message || err });
    return sendError(res, 500, 'Extraction failed', { error: err.message });
  }
});

function buildPolicyAnalysisFromCOI({ coi, project, requirements = [] }) {
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
      required_action: requiredValue ? `Adjust ${field} to ${requiredValue}` : `Resolve ${field}`,
      current_value: currentValue,
      required_value: requiredValue
    });
  };

  const normalizeTrades = (t) =>
    (Array.isArray(t) ? t : typeof t === 'string' ? t.split(',') : [])
      .map(v => String(v).trim().toLowerCase())
      .filter(Boolean);

  const subTrades = normalizeTrades(coi.trade_type);
  const tradeReqs = subTrades.length
    ? requirements.filter(r => {
        const tradeList = normalizeTrades(r.applicable_trades || r.trade_types || r.trades || []);
        if (tradeList.length === 0) return true;
        return tradeList.some(t => subTrades.includes(t));
      })
    : requirements;

  const tierPriority = { a: 4, b: 3, c: 2, d: 1, standard: 0 };
  let highestTier = null;
  let highestPriority = -1;
  for (const req of tradeReqs) {
    const priority = tierPriority[String(req.tier || '').toLowerCase()] ?? 0;
    if (priority > highestPriority) {
      highestPriority = priority;
      highestTier = req.tier;
    }
  }

  const tierRequirements = highestTier
    ? tradeReqs.filter(r => String(r.tier) === String(highestTier))
    : tradeReqs;

  const d = coi || {};
  const now = new Date();

  const requireMin = (field, requiredValue, title) => {
    if (requiredValue == null) return;
    const currentValue = d[field];
    if (currentValue == null) {
      pushDef('high', field, `${title} Missing`, `${title} is required but missing.`, currentValue, requiredValue);
    } else if (currentValue < requiredValue) {
      pushDef('high', field, `${title} Below Program Minimum`, `${title} is $${Number(currentValue).toLocaleString()}, requires ≥ $${Number(requiredValue).toLocaleString()}`, currentValue, requiredValue);
    }
  };

  const glReq = tierRequirements.find(r => r.insurance_type === 'general_liability');
  if (glReq) {
    requireMin('gl_general_aggregate', glReq.gl_general_aggregate, 'GL Aggregate');
    requireMin('gl_each_occurrence', glReq.gl_each_occurrence, 'GL Each Occurrence');
    requireMin('gl_products_completed_ops', glReq.gl_products_completed_ops, 'GL Products/Completed Ops');
    if (glReq.blanket_additional_insured || glReq.gl_additional_insured_required) {
      if (d.gl_additional_insured !== true) {
        pushDef('high', 'gl_additional_insured', 'Additional Insured Not Confirmed', 'Program requires Additional Insured endorsement on GL but certificate does not confirm it', d.gl_additional_insured, true);
      }
    }
    if (glReq.waiver_of_subrogation_required || glReq.gl_waiver_of_subrogation_required) {
      if (d.gl_waiver_of_subrogation !== true) {
        pushDef('medium', 'gl_waiver_of_subrogation', 'Waiver of Subrogation Not Confirmed', 'Program requires Waiver of Subrogation but certificate does not confirm it', d.gl_waiver_of_subrogation, true);
      }
    }
  }

  const autoReq = tierRequirements.find(r => r.insurance_type === 'auto_liability');
  if (autoReq) {
    requireMin('auto_combined_single_limit', autoReq.auto_combined_single_limit, 'Auto Combined Single Limit');
  }

  const wcReq = tierRequirements.find(r => r.insurance_type === 'workers_compensation');
  if (wcReq) {
    requireMin('wc_each_accident', wcReq.wc_each_accident, 'WC Each Accident');
    requireMin('wc_disease_policy_limit', wcReq.wc_disease_policy_limit, 'WC Disease Policy Limit');
    requireMin('wc_disease_each_employee', wcReq.wc_disease_each_employee, 'WC Disease Each Employee');
  }

  const umbReq = tierRequirements.find(r => r.insurance_type === 'umbrella_policy');
  if (umbReq) {
    requireMin('umbrella_each_occurrence', umbReq.umbrella_each_occurrence, 'Umbrella Each Occurrence');
    requireMin('umbrella_aggregate', umbReq.umbrella_aggregate, 'Umbrella Aggregate');
  }

  if (d.named_insured && d.subcontractor_name && String(d.named_insured).trim().toLowerCase() !== String(d.subcontractor_name).trim().toLowerCase()) {
    pushDef('critical', 'named_insured', 'Named Insured Mismatch', 'Named insured does not match subcontractor name.', d.named_insured, d.subcontractor_name);
  }

  if (project?.gc_name && d.certificate_holder_name &&
      !String(d.certificate_holder_name).toLowerCase().includes(String(project.gc_name).toLowerCase())) {
    pushDef('medium', 'certificate_holder_name', 'Certificate Holder Mismatch', 'Certificate holder should be the GC.', d.certificate_holder_name, project.gc_name);
  }

  const dateFields = [
    { field: 'gl_expiration_date', label: 'GL Expiration Date' },
    { field: 'auto_expiration_date', label: 'Auto Expiration Date' },
    { field: 'wc_expiration_date', label: 'WC Expiration Date' },
    { field: 'umbrella_expiration_date', label: 'Umbrella Expiration Date' }
  ];
  for (const { field, label } of dateFields) {
    if (d[field]) {
      const dt = new Date(d[field]);
      if (!isNaN(dt.getTime()) && dt < now) {
        pushDef('critical', field, `${label} Expired`, `${label} is expired.`, d[field], 'Future date');
      }
    }
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
    analysis_method: 'backend_requirements_comparison',
    tier: highestTier || null
  };

  return policyAnalysis;
}

// Authenticated: Analyze COI against program requirements and persist policy_analysis
app.post('/integrations/analyze-coi-compliance', authenticateToken, async (req, res) => {
  try {
    const { coi_id, coiId, project_id, projectId } = req.body || {};
    const targetId = coi_id || coiId;
    if (!targetId) return res.status(400).json({ error: 'coi_id is required' });

    const coi = (entities.GeneratedCOI || []).find(c => c.id === targetId);
    if (!coi) return res.status(404).json({ error: 'COI not found' });

    const projId = project_id || projectId || coi.project_id;
    const project = (entities.Project || []).find(p => p.id === projId) || null;
    const programId = project?.program_id || coi?.program_id || null;

    const requirements = programId
      ? (entities.SubInsuranceRequirement || []).filter(r => r.program_id === programId)
      : [];

    const policyAnalysis = buildPolicyAnalysisFromCOI({ coi, project, requirements });

    coi.policy_analysis = policyAnalysis;
    coi.updatedAt = new Date().toISOString();
    coi.updatedBy = 'backend-compliance-analysis';
    debouncedSave();

    return res.json({ success: true, policy_analysis: policyAnalysis });
  } catch (err) {
    logger.error('analyze-coi-compliance error', { error: err?.message || err });
    return res.status(500).json({ error: 'Compliance analysis failed' });
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

    // Check policy basis (occurrence vs claims-made)
    if (project_requirements.requires_occurrence_basis && coi.policy_basis === 'claims-made') {
      deficiencies.push({
        id: `def-${coi_id}-${deficiencyCounter++}`,
        severity: 'high',
        category: 'policy_basis',
        field: 'policy_basis',
        title: 'Claims-Made Policy Not Acceptable',
        description: 'Project requires Occurrence-based coverage, but policy is on Claims-Made basis',
        required_action: 'Provide Occurrence-based General Liability policy or obtain tail coverage',
        current_value: 'claims-made',
        required_value: 'occurrence'
      });
    }

    // Check for missing policy basis when required
    if (project_requirements.verify_policy_basis && !coi.policy_basis) {
      deficiencies.push({
        id: `def-${coi_id}-${deficiencyCounter++}`,
        severity: 'medium',
        category: 'policy_basis',
        field: 'policy_basis',
        title: 'Policy Basis Not Specified',
        description: 'Certificate does not indicate whether coverage is on an Occurrence or Claims-Made basis',
        required_action: 'Verify and indicate policy basis (Occurrence or Claims-Made)',
        current_value: null,
        required_value: 'occurrence or claims-made'
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

    // Persist the analysis results to the COI record
    const coiIdx = entities.GeneratedCOI.findIndex(c => c.id === coi_id);
    if (coiIdx !== -1) {
      entities.GeneratedCOI[coiIdx] = {
        ...entities.GeneratedCOI[coiIdx],
        policy_analysis: analysis,
        deficiencies: deficiencies,
        last_analyzed_at: analysis.analyzed_at,
        compliance_status: analysis.status
      };
      debouncedSave(); // Note: debounced, doesn't return promise
    }

    logger.info('Policy analysis complete', { deficiencies: deficiencies.length });
    res.json(analysis);

  } catch (err) {
    logger.error('Policy analysis error', { error: err?.message, stack: err?.stack });
    res.status(500).json({ error: 'Failed to analyze policy', details: err.message });
  }
});

// Public: Extract COI fields from a PDF (no auth)
app.post('/public/extract-coi-fields', publicApiLimiter, async (req, res) => {
  try {
    const { file_url } = req.body || {};
    if (!file_url) return res.status(400).json({ error: 'file_url is required' });

    const schema = {
      named_insured: 'string',
      description_of_operations: 'string',
      certificate_holder_name: 'string',
      certificate_holder_address: 'string',
      additional_insureds: 'array',
      broker_name: 'string',
      broker_email: 'string',
      broker_phone: 'string',
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

    const extraction = await performExtraction({ file_url, json_schema: schema });
    const output = extraction?.output || {};
    return res.json({ status: 'success', data: output, extraction });
  } catch (err) {
    logger.error('public extract-coi-fields error', { error: err?.message || err });
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
    logger.error('public pending-cois error', { error: err?.message || err });
    return res.status(500).json({ error: 'Failed to list pending COIs' });
  }
});

// Public: Return default admin emails for notifications
app.get('/public/admin-emails', (req, res) => {
  try {
    const emails = DEFAULT_ADMIN_EMAILS.length > 0 ? DEFAULT_ADMIN_EMAILS : ['admin@example.com'];
    return res.json({ emails });
  } catch (err) {
    logger.error('public admin-emails error', { error: err?.message || err });
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
    logger.error('public broker-sign-coi error', { error: err?.message || err });
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
        logger.error('broker-login hash error', { error: hashErr?.message || hashErr });
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
    logger.error('broker-login error', { error: err?.message || err });
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
      // Verify password for first match before showing selection
      // This prevents revealing that multiple accounts exist without valid credentials
      const firstMatch = matchingGCs[0];
      const passwordToCheck = (firstMatch && firstMatch.password) ? firstMatch.password : DUMMY_PASSWORD_HASH;
      const isPasswordValid = await bcrypt.compare(password, passwordToCheck);
      
      if (!firstMatch.password || !isPasswordValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

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

    logger.info('GC Login attempt', {
      emailSearched: email,
      gcFound: !!gc,
      matchingGCCount: matchingGCs.length,
      gcHasPassword: !!gc?.password,
      passwordFieldExists: 'password' in (gc || {})
    });

    // Always perform bcrypt comparison to prevent timing attacks
    const passwordToCheck = (gc && gc.password) ? gc.password : DUMMY_PASSWORD_HASH;
    const isPasswordValid = await bcrypt.compare(password, passwordToCheck);
    
    logger.info('Password comparison', {
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
    logger.error('gc-login error', { error: err?.message || err });
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
    logger.error('gc-forgot-password error', { error: err?.message || err });
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
    logger.error('broker-forgot-password error', { error: err?.message || err });
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
    
    // Create transporter
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpService = process.env.SMTP_SERVICE;
    
    let transporter;
    if (!smtpHost && !smtpService) {
      // Mock transporter for development
      transporter = {
        sendMail: async (options) => {
          logger.info('MOCK EMAIL', {
            from: options.from,
            to: options.to,
            subject: options.subject
          });
          return { messageId: `mock-${Date.now()}` };
        }
      };
    } else {
      const config = {};
      if (smtpService) {
        config.service = smtpService;
      } else if (smtpHost) {
        config.host = smtpHost;
        config.port = smtpPort;
        config.secure = smtpPort === 465;
      }
      if (smtpUser && smtpPass) {
        config.auth = { user: smtpUser, pass: smtpPass };
      }
      transporter = nodemailer.createTransport(config);
    }
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@insuretrack.com',
      to: email,
      subject: 'Password Reset Request - compliant.team',
      html: getPasswordResetEmail('User', resetLink, 'subcontractor')
    };

    try {
      await transporter.sendMail(mailOptions);
      logger.info('Subcontractor password reset email sent', { email });
    } catch (emailErr) {
      logger.error('Error sending subcontractor password reset email', { error: emailErr?.message });
    }

    return res.json({ success: true, message: 'If email exists, reset link will be sent' });
  } catch (err) {
    logger.error('subcontractor-forgot-password error', { error: err?.message || err });
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

    logger.info('Subcontractor password reset successfully', { email });
    return res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    logger.error('subcontractor-reset-password error', { error: err?.message || err });
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
    const hasSpecial = /[!@#$%^&*()_+=[\]{};':"\\|,.<>/?-]/.test(password);
    
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
    logger.error('set-broker-password error', { error: err?.message || err });
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
    const hasSpecial = /[!@#$%^&*()_+=[\]{};':"\\|,.<>/?-]/.test(password);
    
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
    logger.error('set-gc-password error', { error: err?.message || err });
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
        logger.warn('Could not parse master_insurance_data', { error: parseErr?.message });
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
    logger.error('admin generate-coi error', { error: err?.message || err });
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
    logger.error('admin generate-policy-pdf error', { error: err?.message || err });
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
      const _subcontractor = (entities.Contractor || []).find(c => c.id === coi.subcontractor_id);
      const _adminUrl = `${req.protocol}://${req.get('host')}`;
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
      logger.warn('Could not send activation notifications after admin sign', { error: notifyErr?.message || notifyErr });
    }

    debouncedSave();
    return res.json(entities.GeneratedCOI[coiIdx]);
  } catch (err) {
    logger.error('admin sign-coi error', { error: err?.message || err });
    return res.status(500).json({ error: 'Failed to sign COI' });
  }
});

// Admin: Approve COI with deficiencies (override)
// Allows admin to approve a COI even when deficiencies are found, with proper justification
app.post('/admin/approve-coi-with-deficiencies', apiLimiter, authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { coi_id, approved_by, justification, waived_deficiencies = [] } = req.body || {};
    
    if (!coi_id) {
      return res.status(400).json({ error: 'coi_id is required' });
    }
    
    // Validate justification
    if (!justification || typeof justification !== 'string') {
      return res.status(400).json({ error: 'Justification is required' });
    }
    
    const trimmedJustification = justification.trim();
    
    if (trimmedJustification.length < 10) {
      return res.status(400).json({ 
        error: 'Justification must be at least 10 characters' 
      });
    }
    
    if (trimmedJustification.length > 2000) {
      return res.status(400).json({ 
        error: 'Justification must not exceed 2000 characters' 
      });
    }

    const coiIdx = (entities.GeneratedCOI || []).findIndex(c => c.id === String(coi_id));
    if (coiIdx === -1) {
      return res.status(404).json({ error: 'COI not found' });
    }

    const coi = entities.GeneratedCOI[coiIdx];
    
    // Create approval record
    const approvalRecord = {
      approved_at: new Date().toISOString(),
      approved_by: approved_by || req.user?.email || 'admin',
      justification: trimmedJustification,
      waived_deficiencies: waived_deficiencies,
      deficiency_count: coi.deficiencies?.length || 0,
      original_status: coi.status
    };

    // Update COI with approval
    entities.GeneratedCOI[coiIdx] = {
      ...coi,
      status: 'active',
      compliance_status: 'approved_with_waivers',
      deficiency_approval: approvalRecord,
      approved_at: approvalRecord.approved_at,
      approved_by: approvalRecord.approved_by
    };

    debouncedSave(); // Note: debounced, doesn't return promise

    // Log the approval for audit trail
    logger.info('COI approved with deficiencies', { coi_id, approvedBy: approvalRecord.approved_by });
    logAuth(
      AuditEventType.ADMIN_ACTION,
      req.user?.email || 'admin',
      true,
      { 
        action: 'approve_coi_with_deficiencies',
        coi_id,
        deficiency_count: approvalRecord.deficiency_count,
        justification: trimmedJustification.substring(0, 100)
      }
    );

    // Notify stakeholders
    try {
      const project = (entities.Project || []).find(p => p.id === coi.project_id || p.project_name === coi.project_name);
      // Use environment-based URL to prevent host header injection
      const internalUrl = `${reqProtocolHost()}/public/send-email`;
      
      // Truncate justification for email display (max 500 chars)
      // Escape for XSS protection
      const emailJustification = escapeHtml(trimmedJustification.length > 500 
        ? trimmedJustification.substring(0, 500) + '...' 
        : trimmedJustification);

      // Notify subcontractor
      if (coi.contact_email) {
        await fetch(internalUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: coi.contact_email,
            subject: `✅ Your Certificate is Approved - ${escapeHtml(project?.project_name || coi.project_name)}`,
            body: `Your Certificate of Insurance for ${escapeHtml(project?.project_name || coi.project_name)} has been approved.\n\nNote: Some deficiencies were waived by the reviewing administrator.\n\nView certificate: ${escapeHtml(coi.final_coi_url || coi.first_coi_url || '(not available)')}`
          })
        }).catch(err => {
          logger.error('Failed to notify subcontractor', { error: err?.message, stack: err?.stack });
        });
      }

      // Notify GC
      if (project && project.gc_email) {
        await fetch(internalUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: project.gc_email,
            subject: `✅ Insurance Approved (With Waivers) - ${escapeHtml(coi.subcontractor_name)}`,
            body: `A Certificate of Insurance has been approved for ${escapeHtml(coi.subcontractor_name)} on ${escapeHtml(project.project_name)}.\n\nNote: ${approvalRecord.deficiency_count} deficiencies were waived. Reason: ${emailJustification}\n\nView certificate: ${escapeHtml(coi.final_coi_url || coi.first_coi_url || '(not available)')}`
          })
        }).catch(err => {
          logger.error('Failed to notify GC', { error: err?.message, stack: err?.stack });
        });
      }
    } catch (notifyErr) {
      logger.error('Notification error', { error: notifyErr?.message, stack: notifyErr?.stack });
      // Don't fail the approval if notification fails
    }

    res.json({
      success: true,
      message: 'COI approved with deficiency waivers',
      coi: entities.GeneratedCOI[coiIdx],
      approval: approvalRecord
    });

  } catch (err) {
    logger.error('admin approve-coi-with-deficiencies error', { error: err?.message || err });
    return res.status(500).json({ error: 'Failed to approve COI', details: err.message });
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
    logger.error('parse-program-pdf failed', { error: err?.message, stack: err?.stack });
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
    
    logger.info('Private file uploaded successfully', {
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
    logger.error('Private file upload error', { error: error?.message || error });
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
          const docType = originalDoc.document_type || originalDoc.insurance_type || 'Insurance Document';
          
          const mailOptions = {
            from: process.env.SMTP_FROM || 'no-reply@insuretrack.com',
            to: gcEmail,
            subject: notification.subject,
            html: getDocumentReplacementNotificationEmail(
              subcontractorName,
              authenticatedBrokerName,
              authenticatedBrokerEmail,
              docType,
              reason
            )
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
          logger.info('Document replacement notification sent to GC', { gcEmail });
        } else {
          logger.info('MOCK: Would send document replacement notification to GC', { gcEmail });
        }
      } catch (emailError) {
        logger.error('Failed to send notification', { email: gcEmail, error: emailError?.message || emailError });
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
    logger.error('Document replacement error', { error: error?.message || error });
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
    logger.error('hold-harmless-sign-link error', { error: err?.message || err });
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
        hold_harmless_status: 'signed_by_sub'
      };
    } else if (signer === 'gc' || signer === 'general_contractor') {
      // WORKFLOW REQUIREMENT: GC can only sign AFTER subcontractor has signed
      if (!coi.hold_harmless_sub_signed_url) {
        return sendError(res, 400, 'Subcontractor must sign the hold harmless agreement before GC can sign');
      }
      
      entities.GeneratedCOI[idx] = {
        ...coi,
        hold_harmless_gc_signed_url: signed_url,
        hold_harmless_gc_signed_date: now,
        hold_harmless_status: 'signed_by_gc'
      };
    } else {
      return sendError(res, 400, 'Unknown signer type');
    }

    // If both sub and gc have signed, mark hold_harmless_status as fully signed
    const updated = entities.GeneratedCOI[idx];
    if (updated.hold_harmless_sub_signed_url && updated.hold_harmless_gc_signed_url) {
      entities.GeneratedCOI[idx].hold_harmless_status = 'signed';
    }
    
    // WORKFLOW: After subcontractor signs, send hold harmless to GC for their signature
    if (signer === 'sub' || signer === 'subcontractor') {
      if (updated.hold_harmless_sub_signed_url && !updated.hold_harmless_gc_signed_url) {
        try {
          // Find project and GC contact info
          const coi = entities.GeneratedCOI[idx];
          const project = (entities.Project || []).find(p => p.id === coi.project_id || p.project_name === coi.project_name);
          const gcEmail = project?.gc_email || project?.contact_email;
          const gcName = project?.gc_name || coi.gc_name || 'General Contractor';
          
          if (gcEmail && coi.hold_harmless_template_url) {
            logger.info('Sending hold harmless to GC for signature after sub signed', { gcEmail });
            
            const gcSignUrl = `${req.protocol}://${req.get('host')}/public/sign-hold-harmless?token=${encodeURIComponent(token)}&signer=gc`;
            const internalUrl = `${req.protocol}://${req.get('host')}/public/send-email`;
            
            await fetch(internalUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: gcEmail,
                subject: `✍️ Hold Harmless Agreement - Your Signature Required - ${coi.subcontractor_name || 'Subcontractor'}`,
                html: `
                  <h3>Hold Harmless Agreement Ready for Your Signature</h3>
                  <p>Dear ${gcName},</p>
                  
                  <p>The subcontractor <strong>${coi.subcontractor_name || 'N/A'}</strong> has signed the Hold Harmless Agreement for:</p>
                  
                  <ul>
                    <li><strong>Project:</strong> ${coi.project_name || 'N/A'}</li>
                    <li><strong>Trade:</strong> ${coi.trade_type || 'N/A'}</li>
                    <li><strong>Job Location:</strong> ${coi.project_address || coi.project_location || 'N/A'}</li>
                  </ul>
                  
                  <p>The agreement is now ready for your review and signature.</p>
                  
                  <p><strong><a href="${gcSignUrl}" style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Review & Sign Agreement</a></strong></p>
                  
                  <p>Or copy this link: ${gcSignUrl}</p>
                  
                  <p>Once you sign, the agreement will be complete and all parties will receive a fully executed copy.</p>
                  
                  <p>Best regards,<br>InsureTrack Compliance System</p>
                `,
                body: `Hold Harmless Agreement - Your Signature Required\n\n` +
                  `The subcontractor ${coi.subcontractor_name || 'N/A'} has signed the Hold Harmless Agreement.\n\n` +
                  `Project: ${coi.project_name || 'N/A'}\n` +
                  `Trade: ${coi.trade_type || 'N/A'}\n\n` +
                  `Please review and sign: ${gcSignUrl}\n\n` +
                  `Best regards,\nInsureTrack System`
              })
            });
            
            logger.info('Hold harmless sent to GC for signature');
          } else {
            logger.warn('Could not send hold harmless to GC - missing email or template URL');
          }
        } catch (emailErr) {
          logger.error('Failed to send hold harmless to GC', { error: emailErr?.message || emailErr });
        }
      }
    }

    debouncedSave();
    return res.json(entities.GeneratedCOI[idx]);
  } catch (err) {
    logger.error('complete-hold-harmless-signature error', { error: err?.message || err });
    return sendError(res, 500, 'Failed to record hold harmless signature');
  }
});

// =======================
// ERROR HANDLING
// =======================

// Error logging middleware
app.use(errorLogger);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler - Enterprise-grade centralized error handling
app.use((err, req, res, next) => {
  // Handle Multer file upload errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return errorHandler(new ValidationError('File too large. Maximum size is 10MB', { maxSize: '10MB' }), req, res, next);
    }
    return errorHandler(new ValidationError(err.message, { code: err.code }), req, res, next);
  }
  
  // Use centralized error handler for all other errors
  errorHandler(err, req, res, next);
});

// Renewal processing: scan for expiring policies and notify brokers/admins
async function checkAndProcessRenewals() {
  try {
    const now = Date.now();
    const lookaheadMs = RENEWAL_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;

    const soonExpiring = (entities.GeneratedCOI || []).filter(c => {
      if (!c || !c.policy_expiration_date) return false;
      try {
        const exp = new Date(c.policy_expiration_date).getTime();
        if (isNaN(exp)) return false;
        // only consider those expiring within lookahead window and not already notified
        const willExpireSoon = exp > now && exp <= (now + lookaheadMs);
        const alreadyNotified = !!c.renewal_notified_at;
        return willExpireSoon && !alreadyNotified;
      } catch (e) {
        return false;
      }
    });

    for (const coi of soonExpiring) {
      try {
        // Create a PolicyRenewal task
        const pr = {
          id: `policy-renewal-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          coi_id: coi.id,
          subcontractor_id: coi.subcontractor_id,
          project_id: coi.project_id,
          created_at: new Date().toISOString(),
          status: 'requested',
          expires_at: new Date(Date.now() + lookaheadMs).toISOString()
        };
        if (!entities.PolicyRenewal) entities.PolicyRenewal = [];
        entities.PolicyRenewal.push(pr);

        // Mark coi as notified
        const idx = entities.GeneratedCOI.findIndex(c => c.id === coi.id);
        if (idx !== -1) {
          entities.GeneratedCOI[idx].renewal_notified_at = new Date().toISOString();
          entities.GeneratedCOI[idx].renewal_task_id = pr.id;
          entities.GeneratedCOI[idx].updatedAt = new Date().toISOString();
        }

        // Notify broker with binder window instructions
        try {
          if (coi.broker_email) {
            const frontendHost = process.env.FRONTEND_URL || `http://localhost:5175`;
            const uploadBinderLink = `${frontendHost}/broker-upload-coi?token=${coi.coi_token}&step=1&action=upload&type=binder`;
            const uploadPolicyLink = `${frontendHost}/broker-upload-coi?token=${coi.coi_token}&step=1&action=upload&type=policy`;
            const _internalUrl = `${process.env.BACKEND_URL || (process.env.BACKEND_HOST ? `http://${process.env.BACKEND_HOST}` : '')}${reqHostSuffix()}`;
            const emailPayload = {
              to: coi.broker_email,
              subject: `Policy Renewal Requested: ${coi.subcontractor_name}`,
              body: `Your policy for ${coi.subcontractor_name} is expiring on ${coi.policy_expiration_date}. You may upload a binder within the next ${BINDER_WINDOW_DAYS} days here: ${uploadBinderLink} . After binder upload you will have ${BINDER_WINDOW_DAYS} days to provide the full policy here: ${uploadPolicyLink}`
            };
            // Best-effort internal send
            try {
              const internalSend = `${reqProtocolHost()}/public/send-email`;
              await fetch(internalSend, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(emailPayload) });
            } catch (e) {
              // ignore
            }
          }
        } catch (notifyErr) {
          logger.warn('Failed to notify broker about renewal', { error: notifyErr?.message || notifyErr });
        }
      } catch (prErr) {
        logger.warn('Failed to create policy renewal task', { error: prErr?.message || prErr });
      }
    }

    // Persist any changes
    debouncedSave();
  } catch (err) {
    logger.error('Renewal scan error', { error: err?.message || err });
  }
}

function reqProtocolHost() {
  // Best-effort host URL from env; fallback to localhost
  return process.env.BACKEND_URL || `http://localhost:${process.env.PORT || PORT}`;
}

function reqHostSuffix() {
  return '';
}

function startRenewalScheduler() {
  const intervalMs = Number(process.env.RENEWAL_POLL_INTERVAL_MS || 24 * 60 * 60 * 1000);
  // Run once immediately
  checkAndProcessRenewals().catch(() => {});
  setInterval(() => { checkAndProcessRenewals().catch(() => {}); }, intervalMs);
}

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
    // Initialize JWT secret first (async file operations)
    await initializeJWTSecret();
    
    // Initialize auth middleware after JWT_SECRET is loaded
    initializeAuthMiddleware(getJWTSecret());
    
    // Initialize data before starting server
    await initializeData();
    
    // Validate environment before starting
    try {
      validateEnvironment();
    } catch (err) {
      logger.error('Environment validation failed, exiting', { error: err.message });
      process.exit(1);
    }

    // Setup graceful shutdown handlers
    setupGracefulShutdown();

    for (let i = 0; i <= MAX_PORT_TRIES; i++) {
      const p = configuredPort + i;
      try {
        const server = await tryListen(p);
        logger.info(`compliant.team Backend running on http://localhost:${p}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`CORS allowed: ${process.env.FRONTEND_URL || '*'}`);
        logger.info(`✅ Security: Helmet enabled, Rate limiting active`);

        const hasSmtpConfig = (process.env.SMTP_HOST || process.env.SMTP_SERVICE) && 
                              process.env.SMTP_USER && 
                              process.env.SMTP_PASS;
        if (hasSmtpConfig) {
          logger.info(`✅ Email service: CONFIGURED (${process.env.SMTP_SERVICE || process.env.SMTP_HOST})`);
          logger.info(`   From: ${process.env.SMTP_FROM || process.env.SMTP_USER}`);
        } else {
          logger.warn(`⚠️  Email service: TEST MODE (not configured for real emails)`);
          logger.warn(`   Configure SMTP in backend/.env to send real emails`);
          logger.warn(`   See EMAIL_QUICKSTART.md for quick setup`);
        }

        // Expose chosen port to environment for downstream processes
        process.env.PORT = String(p);

        // Start renewal scheduler to monitor expiring policies
        try {
          startRenewalScheduler();
          logger.info('🔁 Renewal scheduler started');
        } catch (schedErr) {
          logger.warn('Could not start renewal scheduler:', schedErr?.message || schedErr);
        }

        server.on('error', (err) => {
          logger.error('Server error', { error: err.message, stack: err.stack });
        });

        return;
      } catch (err) {
        if (err && err.code === 'EADDRINUSE') {
          logger.warn(`Port ${p} in use — trying next port`);
          continue;
        }
        logger.error('Failed to start server', { error: err.message, stack: err.stack });
        break;
      }
    }

    logger.error(`Unable to bind to any port in range ${configuredPort}-${configuredPort + MAX_PORT_TRIES}. Please free a port or set PORT to an available port.`);
  })();
}

// Note: Global error handlers (uncaughtException, unhandledRejection, SIGTERM, SIGINT) 
// are configured in setupGracefulShutdown() middleware


// Export for Vercel serverless
export default app;
