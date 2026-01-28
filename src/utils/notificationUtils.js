/**
 * Calculate urgency level based on days until expiry
 * @param {number} daysUntilExpiry - Number of days until expiry
 * @returns {string} - Urgency level: 'URGENT', 'HIGH', or 'STANDARD'
 */
export function calculateUrgency(daysUntilExpiry) {
  if (daysUntilExpiry <= 0) return 'URGENT';
  if (daysUntilExpiry <= 7) return 'HIGH';
  return 'STANDARD';
}

/**
 * Format timeframe description based on days until expiry
 * @param {number} daysUntilExpiry - Number of days until expiry
 * @returns {string} - Timeframe description (e.g., 'TODAY', 'in 5 days', 'EXPIRED')
 */
export function formatTimeframe(daysUntilExpiry) {
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
 * @param {string} name - The filename or name to sanitize
 * @returns {string} - Sanitized filename
 */
export function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return 'Unknown';
  // Replace filesystem-unsafe characters but preserve readability
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
}

/**
 * Prepare COI and Hold Harmless Agreement attachments for email
 * @param {Object} coi - COI record
 * @param {Object} subcontractor - Subcontractor record
 * @param {Object} project - Project record
 * @returns {Array} Array of attachment objects
 */
export function prepareAttachments(coi, subcontractor, project) {
  const attachments = [];
  
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

/**
 * Wrapper function to send email with standardized error handling
 * @param {Object} emailParams - Parameters to pass to sendEmail
 * @param {string} logContext - Context string for error logging (e.g., 'broker notification')
 * @param {Function} sendEmailFn - The sendEmail function to use
 * @returns {Promise<boolean>} - True if email sent successfully, false otherwise
 */
export async function sendEmailWithErrorHandling(emailParams, logContext, sendEmailFn) {
  try {
    await sendEmailFn(emailParams);
    return true;
  } catch (error) {
    console.error(`Error sending ${logContext}:`, error);
    return false;
  }
}
