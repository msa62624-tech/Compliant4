/**
 * Application-wide status constants
 * CODE QUALITY IMPROVEMENT: Centralized constants to replace magic strings
 */

// Entity Status Values
export const EntityStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
  PENDING: 'pending'
};

// Insurance Document Status
export const DocumentStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  UNDER_REVIEW: 'under_review'
};

// COI Request Status
export const COIRequestStatus = {
  PENDING: 'pending',
  AWAITING_BROKER_UPLOAD: 'awaiting_broker_upload',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Broker Upload Request Status
export const BrokerUploadStatus = {
  PENDING: 'pending',
  UPLOADED: 'uploaded',
  CANCELLED: 'cancelled'
};

// Project Status
export const ProjectStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
  CANCELLED: 'cancelled'
};

// Contractor Types
export const ContractorType = {
  GENERAL_CONTRACTOR: 'general_contractor',
  SUBCONTRACTOR: 'subcontractor'
};

// User Roles
export const UserRole = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  CONTRACTOR: 'contractor',
  SUBCONTRACTOR: 'subcontractor',
  BROKER: 'broker'
};

// Compliance Status
export const ComplianceStatus = {
  COMPLIANT: 'compliant',
  NON_COMPLIANT: 'non_compliant',
  PENDING_REVIEW: 'pending_review',
  EXPIRING_SOON: 'expiring_soon'
};
