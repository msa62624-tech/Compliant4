/**
 * @fileoverview Type definitions for Compliant4 application
 * @description TypeScript type definitions for type safety throughout the application
 */

import type * as React from 'react';

// ============================================================================
// CORE TYPES
// ============================================================================

export type UserRole = 'super_admin' | 'admin' | 'gc_user' | 'contractor' | 'broker';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  company_id?: string;
  active: boolean;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

export type ContractorType = 'general_contractor' | 'subcontractor';
export type ContractorStatus = 'active' | 'inactive' | 'pending';

export interface Contractor {
  id: string;
  company_name: string;
  contractor_type: ContractorType;
  email: string;
  phone?: string;
  status: ContractorStatus;
  created_at: string; // ISO 8601 timestamp
}

export type ProjectStatus = 'active' | 'completed' | 'on_hold';

export interface Project {
  id: string;
  name: string;
  gc_id: string;
  location?: string;
  budget?: number;
  start_date?: string; // ISO 8601 date
  end_date?: string; // ISO 8601 date
  status: ProjectStatus;
}

export type DocumentType = 'coi' | 'policy' | 'endorsement' | 'other';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface InsuranceDocument {
  id: string;
  subcontractor_id: string;
  project_id: string;
  document_type: DocumentType;
  file_url: string;
  expiration_date: string; // ISO 8601 date
  approval_status: ApprovalStatus;
  uploaded_at: string; // ISO 8601 timestamp
}

// ============================================================================
// API TYPES
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Token expiration in seconds
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  // Inherits all HTML div attributes
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface FormFieldProps<T = unknown> {
  name: string;
  control: T;
  render: (_props: unknown) => React.ReactNode;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

// ============================================================================
// HEALTH CHECK TYPES
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string; // ISO 8601 timestamp
  responseTime?: number; // Response time in ms
  system?: Record<string, unknown>;
  process?: Record<string, unknown>;
  checks?: Record<string, unknown>;
}

// ============================================================================
// MONITORING TYPES
// ============================================================================

export interface PerformanceMetrics {
  operation: string;
  duration: number; // Duration in ms
  metadata?: Record<string, unknown>;
  timestamp: string; // ISO 8601 timestamp
  warning?: string; // Warning message if threshold exceeded
}

export interface ErrorRecord {
  id: string;
  message: string;
  stack: string;
  name: string;
  code?: string;
  context: Record<string, unknown>;
  timestamp: string; // ISO 8601 timestamp
  environment: string; // Environment (development/production)
}

export interface RequestLog {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number; // Request duration in ms
  ip: string;
  userAgent: string;
  timestamp: string; // ISO 8601 timestamp
}

// ============================================================================
// SECURITY TYPES
// ============================================================================

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  message: string; // Error message when limit exceeded
  standardHeaders?: boolean; // Use standard rate limit headers
  legacyHeaders?: boolean; // Use legacy rate limit headers
  skipSuccessfulRequests?: boolean; // Don't count successful requests
}

export interface SecurityAuditLog {
  id: string;
  event: string; // Event type (e.g., 'user.login')
  userId: string;
  details: Record<string, unknown>;
  ip: string;
  timestamp: string; // ISO 8601 timestamp
}

// ============================================================================
// QUERY & MUTATION TYPES
// ============================================================================

export interface UseQueryResult<T = unknown> {
  data?: T;
  error?: Error;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => void;
}

export interface UseMutationResult<T = unknown, V = unknown> {
  mutate: (_variables: V) => void;
  mutateAsync: (_variables: V) => Promise<T>;
  data?: T;
  error?: Error;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  reset: () => void;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Maybe<T> = T | null | undefined;

export type AsyncResult<T> = Promise<T>;

export interface KeyValuePair<T = unknown> {
  key: string;
  value: T;
}
