/**
 * Shared type definitions for notification system
 */

// ============================================================================
// CORE NOTIFICATION TYPES
// ============================================================================

export interface Subcontractor {
  id: string;
  company_name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  broker_email?: string;
  broker_name?: string;
  broker_phone?: string;
  broker_company?: string;
  broker_type?: 'global' | 'per-policy';
  broker_gl_email?: string;
  broker_gl_name?: string;
  broker_auto_email?: string;
  broker_auto_name?: string;
  broker_wc_email?: string;
  broker_wc_name?: string;
  broker_umbrella_email?: string;
  broker_umbrella_name?: string;
  trade_types?: string[];
  program_name?: string;
  program_id?: string;
  master_insurance_data?: unknown;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  project_name: string;
  project_address?: string;
  gc_name?: string;
  gc_owner?: string;
  gc_owner_name?: string;
  owner_entity?: string;
  additional_insured_entities?: string[] | string;
  program_name?: string;
  program_id?: string;
  address?: string;
  [key: string]: unknown;
}

export interface GeneratedCOI {
  id: string;
  coi_token?: string;
  status?: string;
  subcontractor_id?: string;
  subcontractor_name?: string;
  project_id?: string;
  project_name?: string;
  broker_email?: string;
  broker_name?: string;
  broker_company?: string;
  gl_coverage_amount?: number;
  pdf_url?: string;
  trade_type?: string;
  trade_types?: string[];
  deficiency_sent_date?: string;
  deficiency_message?: string;
  first_coi_uploaded?: boolean;
  first_coi_url?: string;
  gl_policy_url?: string;
  wc_policy_url?: string;
  auto_policy_url?: string;
  umbrella_policy_url?: string;
  [key: string]: unknown;
}

export interface Broker {
  broker_email: string;
  broker_name?: string;
  broker_company?: string;
}

export interface GeneralContractor {
  id: string;
  email?: string;
  company_name?: string;
  contact_person?: string;
  license_number?: string;
  phone?: string;
  gcLogin?: {
    username?: string;
    password?: string;
  };
  tempPassword?: string;
  loginUsername?: string;
  [key: string]: unknown;
}

export interface InsuranceDocument {
  id: string;
  insurance_type?: string;
  policy_number?: string;
  policy_expiration_date?: string;
  contractor_id?: string;
  old_policy_number?: string;
  [key: string]: unknown;
}

export interface Policy {
  policy_number?: string;
  policy_expiration_date?: string;
  insurance_type?: string;
  old_policy_number?: string;
  [key: string]: unknown;
}

export interface EmailAttachment {
  filename: string;
  content?: string;
  path?: string;
  contentType?: string;
}

export interface SampleCOIData {
  project_name?: string;
  gc_name?: string;
  trade?: string;
  program?: string;
  additional_insureds?: string[];
  [key: string]: unknown;
}

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  includeSampleCOI?: boolean;
  recipientIsBroker?: boolean;
  sampleCOIData?: SampleCOIData;
  attachments?: EmailAttachment[];
}

// ============================================================================
// HELPER TYPE GUARDS
// ============================================================================

export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && email.includes('@');
}

export function hasRequiredSubcontractorFields(obj: unknown): obj is Subcontractor {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'company_name' in obj
  );
}

export function hasRequiredProjectFields(obj: unknown): obj is Project {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'project_name' in obj
  );
}
