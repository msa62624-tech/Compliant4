/**
 * Comprehensive API Type Definitions for Compliant4
 * This file contains all entity types returned from API endpoints
 */

// ============================================================================
// SUBSCRIPTION TYPES
// ============================================================================

export interface Subscription {
  id: string;
  gc_id?: string;
  gc_name?: string;
  transaction_id?: string;
  plan_name?: string;
  plan_type?: 'per_project' | 'monthly' | 'annual';
  status?: 'active' | 'inactive' | 'cancelled' | 'pending';
  payment_status?: 'paid' | 'pending' | 'failed' | 'overdue';
  amount_paid?: number;
  payment_date?: string;
  start_date?: string;
  end_date?: string;
  created_date?: string;
  per_project?: number;
  monthly?: number;
  annual?: number;
  [key: string]: unknown;
}

// ============================================================================
// CONTRACTOR TYPES
// ============================================================================

export interface Contractor {
  id: string;
  company_name: string;
  email?: string;
  contact_person?: string;
  phone?: string;
  contractor_type?: 'general_contractor' | 'subcontractor';
  status?: 'active' | 'inactive' | 'pending';
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
  license_number?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  created_date?: string;
  updated_date?: string;
  gcLogin?: {
    username?: string;
    password?: string;
  };
  tempPassword?: string;
  loginUsername?: string;
  [key: string]: unknown;
}

// ============================================================================
// PROJECT TYPES
// ============================================================================

export interface Project {
  id: string;
  project_name: string;
  gc_id?: string;
  gc_name?: string;
  gc_owner?: string;
  gc_owner_name?: string;
  gc_email?: string;
  owner_entity?: string;
  additional_insured_entities?: string[] | string;
  program_name?: string;
  program_id?: string;
  address?: string;
  project_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  status?: 'active' | 'completed' | 'on_hold' | 'inactive';
  project_type?: string;
  project_price?: number;
  start_date?: string;
  end_date?: string;
  created_date?: string;
  updated_date?: string;
  unit_count?: number;
  height_stories?: number;
  custom_pricing?: boolean;
  [key: string]: unknown;
}

// ============================================================================
// PROJECT SUBCONTRACTOR TYPES
// ============================================================================

export interface ProjectSubcontractor {
  id: string;
  project_id: string;
  subcontractor_id: string;
  project_name?: string;
  subcontractor_name?: string;
  trade_type?: string;
  status?: string;
  created_date?: string;
  [key: string]: unknown;
}

// ============================================================================
// GENERATED COI TYPES
// ============================================================================

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
  gc_name?: string;
  gl_coverage_amount?: number;
  gl_expiration_date?: string;
  wc_expiration_date?: string;
  auto_expiration_date?: string;
  umbrella_expiration_date?: string;
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
  gl_each_occurrence?: number;
  auto_each_occurrence?: number;
  wc_each_occurrence?: number;
  umbrella_each_occurrence?: number;
  created_date?: string;
  updated_date?: string;
  needs_admin_setup?: boolean;
  [key: string]: unknown;
}

// ============================================================================
// INSURANCE PROGRAM TYPES
// ============================================================================

export interface InsuranceProgram {
  id: string;
  program_name?: string;
  name?: string;
  state?: string;
  trade_types?: string[];
  custom_pricing?: boolean;
  created_date?: string;
  [key: string]: unknown;
}

// ============================================================================
// INSURANCE REQUIREMENT TYPES
// ============================================================================

export interface SubInsuranceRequirement {
  id: string;
  program_id?: string;
  insurance_type?: string;
  trade_type?: string;
  required_coverage?: number;
  required?: boolean;
  [key: string]: unknown;
}

export interface StateRequirement {
  id: string;
  state?: string;
  insurance_type?: string;
  minimum_coverage?: number;
  required?: boolean;
  [key: string]: unknown;
}

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

export interface InsuranceDocument {
  id: string;
  insurance_type?: string;
  policy_number?: string;
  expiration_date?: string;
  file_url?: string;
  status?: string;
  subcontractor_id?: string;
  project_id?: string;
  created_date?: string;
  [key: string]: unknown;
}

export interface PolicyDocument {
  id: string;
  policy_number?: string;
  insurance_type?: string;
  expiration_date?: string;
  file_url?: string;
  broker_email?: string;
  subcontractor_id?: string;
  status?: string;
  created_date?: string;
  policy_analysis?: unknown;
  [key: string]: unknown;
}

export interface COIDocument {
  id: string;
  coi_token?: string;
  pdf_url?: string;
  status?: string;
  project_id?: string;
  subcontractor_id?: string;
  created_date?: string;
  [key: string]: unknown;
}

// ============================================================================
// BROKER TYPES
// ============================================================================

export interface Broker {
  id?: string;
  broker_email: string;
  broker_name?: string;
  broker_company?: string;
  broker_phone?: string;
  [key: string]: unknown;
}

export interface BrokerUploadRequest {
  id: string;
  request_type?: string;
  status?: string;
  broker_email?: string;
  subcontractor_id?: string;
  project_id?: string;
  insurance_type?: string;
  created_date?: string;
  [key: string]: unknown;
}

// ============================================================================
// COMPLIANCE CHECK TYPES
// ============================================================================

export interface ComplianceCheck {
  id: string;
  check_status?: string;
  check_type?: string;
  project_id?: string;
  subcontractor_id?: string;
  created_date?: string;
  updated_date?: string;
  [key: string]: unknown;
}

// ============================================================================
// PORTAL TYPES
// ============================================================================

export interface Portal {
  id: string;
  user_email?: string;
  user_type?: 'broker' | 'subcontractor' | 'gc';
  project_id?: string;
  subcontractor_id?: string;
  created_date?: string;
  [key: string]: unknown;
}

// ============================================================================
// USER TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  username?: string;
  role?: 'super_admin' | 'admin' | 'gc_user' | 'contractor' | 'broker';
  name?: string;
  contact_email?: string;
  company_id?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface Message {
  id: string;
  recipient_email?: string;
  message?: string;
  status?: string;
  created_date?: string;
  [key: string]: unknown;
}

// ============================================================================
// PROGRAM TEMPLATE TYPES
// ============================================================================

export interface ProgramTemplate {
  id: string;
  template_name?: string;
  state?: string;
  project_type?: string;
  created_date?: string;
  [key: string]: unknown;
}

// ============================================================================
// TRADE TYPES
// ============================================================================

export interface Trade {
  id: string;
  trade_name?: string;
  trade_type?: string;
  [key: string]: unknown;
}

// ============================================================================
// NYC PROPERTY TYPES
// ============================================================================

export interface NYCProperty {
  id?: string;
  address?: string;
  borough?: string;
  bin?: string;
  bbl?: string;
  owner_name?: string;
  owner_address?: string;
  [key: string]: unknown;
}

// ============================================================================
// HELPER/UTILITY TYPES
// ============================================================================

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

export type QueryParams = Record<string, string | number | boolean>;

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error';
}

export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return error.stack;
  }
  if (error && typeof error === 'object' && 'stack' in error) {
    return String(error.stack);
  }
  return undefined;
}
