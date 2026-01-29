/**
 * Calculate urgency level based on days until expiry
 * @param daysUntilExpiry - Number of days until expiry
 * @returns Urgency level: 'URGENT', 'HIGH', or 'STANDARD'
 */
export function calculateUrgency(daysUntilExpiry: number): 'URGENT' | 'HIGH' | 'STANDARD' {
  if (daysUntilExpiry <= 0) return 'URGENT';
  if (daysUntilExpiry <= 7) return 'HIGH';
  return 'STANDARD';
}

/**
 * Format timeframe description based on days until expiry
 * @param daysUntilExpiry - Number of days until expiry
 * @returns Timeframe description (e.g., 'TODAY', 'in 5 days', 'EXPIRED')
 */
export function formatTimeframe(daysUntilExpiry: number): string {
  if (daysUntilExpiry < 0) {
    return 'EXPIRED';
  }
  if (daysUntilExpiry === 0) {
    return 'TODAY';
  }
  return `in ${daysUntilExpiry} days`;
}

/**
 * Sanitize filename by replacing unsafe characters
 * @param name - The filename or name to sanitize
 * @returns Sanitized filename
 */
export function sanitizeFilename(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return 'Unknown';
  // Replace filesystem-unsafe characters but preserve readability
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
}

interface COI {
  pdf_url?: string;
  regenerated_coi_url?: string;
  first_coi_url?: string;
  hold_harmless_sub_signed_url?: string;
  hold_harmless_template_url?: string;
}

interface Subcontractor {
  company_name?: string;
}

interface Project {
  project_name?: string;
}

interface Attachment {
  filename: string;
  path: string;
}

/**
 * Prepare COI and Hold Harmless Agreement attachments for email
 * @param coi - COI record
 * @param subcontractor - Subcontractor record
 * @param project - Project record
 * @returns Array of attachment objects
 */
export function prepareAttachments(
  coi: COI | null | undefined,
  subcontractor: Subcontractor | null | undefined,
  project: Project | null | undefined
): Attachment[] {
  const attachments: Attachment[] = [];
  
  const companyName = sanitizeFilename(subcontractor?.company_name);
  const projectName = sanitizeFilename(project?.project_name);
  
  // Attach the actual issued COI PDF if it exists
  const coiPdfUrl = coi?.pdf_url || coi?.regenerated_coi_url || coi?.first_coi_url;
  if (coiPdfUrl) {
    attachments.push({
      filename: `COI_${companyName}_${projectName}.pdf`,
      path: coiPdfUrl
    });
  }
  
  // Attach the Hold Harmless Agreement if it exists and is signed
  const holdHarmlessUrl = coi?.hold_harmless_sub_signed_url || coi?.hold_harmless_template_url;
  if (holdHarmlessUrl) {
    attachments.push({
      filename: `HoldHarmless_${companyName}_${projectName}.pdf`,
      path: holdHarmlessUrl
    });
  }
  
  return attachments;
}

interface EmailParams {
  [key: string]: any;
}

type SendEmailFn = (_params: EmailParams) => Promise<any>;

/**
 * Wrapper function to send email with standardized error handling
 * @param emailParams - Parameters to pass to sendEmail
 * @param logContext - Context string for error logging (e.g., 'broker notification')
 * @param sendEmailFn - The sendEmail function to use
 * @returns True if email sent successfully, false otherwise
 */
export async function sendEmailWithErrorHandling(
  emailParams: EmailParams,
  logContext: string,
  sendEmailFn: SendEmailFn
): Promise<boolean> {
  try {
    await sendEmailFn(emailParams);
    return true;
  } catch (error) {
    console.error(`Error sending ${logContext}:`, error);
    return false;
  }
}
