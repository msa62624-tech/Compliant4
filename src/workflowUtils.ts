import { compliant } from "@/api/compliantClient";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FirstTimeStatusResult {
  isFirstTime: boolean;
  previousSubmissions: number;
  hasActiveInsurance: boolean;
  allSubmissions: number;
}

export interface WorkflowInstructions {
  title: string;
  brokerInstructions: string;
  subInstructions: string;
  emailSubject: string;
  requiresPolicyUpload: boolean;
}

export type COIStatus = 'active' | 'approved' | 'pending' | 'rejected' | 'expired';

export interface GeneratedCOI {
  id?: string;
  subcontractor_id?: string;
  contractor_id?: string;
  project_id?: string;
  first_coi_uploaded?: boolean;
  first_coi_url?: string;
  status?: COIStatus;
  broker_signature_url?: string;
  [key: string]: unknown;
}

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Determines if a subcontractor is submitting for the first time
 */
export async function isFirstTimeSubcontractor(
  subcontractorId: string,
  projectId: string | null = null
): Promise<FirstTimeStatusResult> {
  try {
    // Get all COIs for this subcontractor
    const allCOIs = await compliant.entities.GeneratedCOI.list() as GeneratedCOI[];
    
    // Note: Some records use subcontractor_id, others use contractor_id
    // This handles both field names for backward compatibility
    const subCOIs = allCOIs.filter((coi: GeneratedCOI) => 
      coi.subcontractor_id === subcontractorId || 
      coi.contractor_id === subcontractorId
    );

    // Filter for project if specified
    const relevantCOIs = projectId 
      ? subCOIs.filter((coi: GeneratedCOI) => coi.project_id === projectId)
      : subCOIs;

    // Check if any COIs have been uploaded before
    const uploadedCOIs = relevantCOIs.filter((coi: GeneratedCOI) => 
      coi.first_coi_uploaded || 
      coi.first_coi_url || 
      coi.status === 'active' ||
      coi.status === 'approved' ||
      coi.broker_signature_url
    );

    // Check if any active insurance exists
    const activeCOIs = relevantCOIs.filter((coi: GeneratedCOI) => 
      coi.status === 'active' || coi.status === 'approved'
    );

    const isFirstTime = uploadedCOIs.length === 0;
    
    return {
      isFirstTime,
      previousSubmissions: uploadedCOIs.length,
      hasActiveInsurance: activeCOIs.length > 0,
      allSubmissions: relevantCOIs.length
    };
  } catch (error) {
    console.error('Error checking first-time status:', error);
    // Default to first-time if there's an error
    return {
      isFirstTime: true,
      previousSubmissions: 0,
      hasActiveInsurance: false,
      allSubmissions: 0
    };
  }
}

/**
 * Get appropriate workflow message based on first-time status
 */
export function getWorkflowInstructions(isFirstTime: boolean): WorkflowInstructions {
  if (isFirstTime) {
    return {
      title: "First Time Setup Required",
      brokerInstructions: `FIRST TIME SETUP:
Please upload the initial insurance documents for this subcontractor:
✅ ACORD 25 Certificate Form
✅ General Liability (GL) Policy
✅ Workers' Compensation (WC) Policy
✅ Auto Liability Policy
✅ Excess/Umbrella Policy (if required)

After uploading, Certificates of Insurance (COIs) will be automatically generated for each project.`,
      subInstructions: `Welcome! This is your first project submission.

Your broker will need to upload your insurance documents. Once approved, you'll be cleared to work on this project.

Steps:
1. Your broker uploads insurance policies
2. Admin reviews and approves
3. You receive approval notification
4. Work can begin!`,
      emailSubject: "New Subcontractor - Initial Insurance Setup Required",
      requiresPolicyUpload: true
    };
  } else {
    return {
      title: "Returning Subcontractor - Sign Certificate",
      brokerInstructions: `RETURNING SUBCONTRACTOR:
This subcontractor has previously submitted insurance documents.
You can now review, sign, and approve COIs based on their existing policies.

No need to request new documents unless coverage needs to be updated.`,
      subInstructions: `Welcome back! Your insurance is on file.

Your broker will review and sign the certificate for this new project. This is typically faster than initial setup.

Steps:
1. Broker signs certificate
2. Admin reviews
3. You receive approval
4. Work can begin!`,
      emailSubject: "Returning Subcontractor - Certificate Signature Required",
      requiresPolicyUpload: false
    };
  }
}
