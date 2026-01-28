import { sendEmail } from "@/emailHelper";
import { getFrontendBaseUrl } from "@/urlConfig";
import { apiClient } from "@/api/apiClient";
import { createEmailTemplate } from "@/emailTemplates";
import { escapeHtml } from "@/utils/htmlEscaping";
import { fetchAdminEmails } from "@/utils/adminEmails";

/**
 * COI Upload & Approval Notification System
 * Handles notifications when COI is uploaded or approved
 */

/**
 * Prepare COI and Hold Harmless Agreement attachments for email
 * @param {Object} coi - COI record
 * @param {Object} subcontractor - Subcontractor record
 * @param {Object} project - Project record
 * @returns {Array} Array of attachment objects
 */
function prepareAttachments(coi, subcontractor, project) {
  const attachments = [];
  
  // Sanitize company and project names for filename, with fallbacks
  const sanitizeName = (name) => {
    if (!name || typeof name !== 'string') return 'Unknown';
    // Replace filesystem-unsafe characters but preserve readability
    return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
  };
  
  const companyName = sanitizeName(subcontractor?.company_name);
  const projectName = sanitizeName(project?.project_name);
  
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
 * Generate sample COI data from program requirements
 * Shows brokers what the actual program requires
 */
async function generateSampleCOIFromProgram(project, coi) {
  const sampleData = {
    subcontractor_name: coi?.subcontractor_name || 'Your Company',
    project_name: project?.project_name,
    project_address: project?.project_address || project?.address,
    gc_name: project?.gc_name,
    gc_owner: project?.gc_owner || project?.gc_owner_name,
    trade: coi?.trade_type || coi?.trade_types?.join(', '),
    program: project?.program_name || project?.program_id,
    additional_insureds: project?.additional_insureds || [project?.gc_name],
    // Include program requirements so broker knows what's needed
    program_id: project?.program_id,
    program_requirements: []
  };

  // Fetch program requirements if available
  if (project?.program_id) {
    try {
      const reqs = await apiClient.entities.SubInsuranceRequirement.filter({
        program_id: project.program_id
      });
      
      // Group by tier and insurance type to show summary
      const tierMap = {};
      for (const req of reqs) {
        const tier = req.tier || 'standard';
        if (!tierMap[tier]) tierMap[tier] = [];
        tierMap[tier].push(req);
      }

      // Build summary of what's required
      sampleData.tiers = Object.entries(tierMap).map(([tierName, tierReqs]) => ({
        tier: tierName,
        requirements: tierReqs.map(r => ({
          insurance_type: r.insurance_type,
          gl_each_occurrence: r.gl_each_occurrence,
          gl_general_aggregate: r.gl_general_aggregate,
          gl_products_completed_ops: r.gl_products_completed_ops,
          umbrella_each_occurrence: r.umbrella_each_occurrence,
          umbrella_aggregate: r.umbrella_aggregate,
          auto_combined_single_limit: r.auto_combined_single_limit,
          wc_each_accident: r.wc_each_accident,
          wc_disease_policy_limit: r.wc_disease_policy_limit,
          scope: r.scope,
          applicable_trades: r.applicable_trades
        }))
      }));
      
      sampleData.program_requirements = sampleData.tiers;
    } catch (error) {
      console.warn('Could not fetch program requirements for sample COI:', error?.message);
    }
  }

  return sampleData;
}

/**
 * Notify when subcontractor uploads a COI to the system
 * Triggers admin notification and creates approval task
 */
export async function notifyAdminCOIUploaded(coi, subcontractor, project) {
  if (!coi || !subcontractor || !project) return;

  const baseUrl = getFrontendBaseUrl();
  const adminPortalLink = `${baseUrl}/admin-dashboard?section=PendingReviews&coiId=${coi.id}`;
  const coiReviewLink = `${baseUrl}/COIReview?id=${coi.id}`;

  try {
    // Fetch admin emails from backend
    const adminEmails = await fetchAdminEmails(baseUrl);
    
    // Prepare attachments using shared helper
    const attachments = prepareAttachments(coi, subcontractor, project);
    
    // Send email to all admin emails
    for (const adminEmail of adminEmails) {
      await sendEmail({
        to: adminEmail,
        attachments: attachments.length > 0 ? attachments : undefined,
        subject: `📋 COI Uploaded - Review Required: ${subcontractor.company_name} on ${project.project_name}`,
        body: `A Certificate of Insurance has been uploaded and is awaiting your review.

SUBCONTRACTOR DETAILS:
• Company: ${subcontractor.company_name}
• Contact: ${subcontractor.contact_person || 'N/A'}
• Email: ${subcontractor.email}
• Phone: ${subcontractor.phone || 'N/A'}
• Assigned Broker: ${subcontractor.broker_name || 'N/A'}

PROJECT DETAILS:
• Project: ${project.project_name}
• Location: ${project.project_address}
• General Contractor: ${project.gc_name}

CERTIFICATE DETAILS:
• COI ID: ${coi.id}
• Trade Type(s): ${coi.trade_types?.join(', ') || 'N/A'}
• Upload Date: ${new Date(coi.created_at).toLocaleDateString()}
• Status: Pending Review
${attachments.length > 0 ? `\n📎 ATTACHED DOCUMENTS:\n${attachments.map(a => `• ${a.filename}`).join('\n')}\n` : ''}
🔍 REVIEW & APPROVE:
${coiReviewLink}

Your Dashboard:
${adminPortalLink}

This COI has been automatically validated against project requirements.
Check the dashboard for compliance details and any issues to address.

Best regards,
InsureTrack System`,
      });
    }

    // Create an admin notification record/task
    try {
      await apiClient.entities.Message.create({
        message_type: 'coi_uploaded_admin',
        sender_id: subcontractor.id,
        recipient_id: 'admin',
        subject: `COI Uploaded: ${subcontractor.company_name}`,
        body: `Certificate uploaded for review`,
        related_entity: 'GeneratedCOI',
        related_entity_id: coi.id,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error creating admin message:', error);
    }
  } catch (error) {
    console.error('Error sending admin COI upload notification:', error);
  }
}

/**
 * Notify subcontractor when their COI is approved
 */
export async function notifySubCOIApproved(coi, subcontractor, project, complianceDetails = null) {
  if (!coi || !subcontractor || !project) return;

  const baseUrl = getFrontendBaseUrl();
  const subDashboardLink = `${baseUrl}/subcontractor-dashboard?id=${subcontractor.id}&section=certificates&projectId=${project.id}`;
  const projectDetailsLink = `${baseUrl}/subcontractor-dashboard?id=${subcontractor.id}&section=projects&projectId=${project.id}`;

  try {
    // Prepare attachments using shared helper
    const attachments = prepareAttachments(coi, subcontractor, project);

    await sendEmail({
      to: subcontractor.email,
      attachments: attachments.length > 0 ? attachments : undefined,
      subject: `✅ Certificate Approved - ${project.project_name}`,
      body: `Great news! Your Certificate of Insurance has been approved for the project.

PROJECT DETAILS:
• Project: ${project.project_name}
• Location: ${project.project_address}
• General Contractor: ${project.gc_name}

CERTIFICATE STATUS:
• Status: ✅ APPROVED
• Trade(s): ${coi.trade_types?.join(', ') || 'N/A'}
• Approved Date: ${new Date().toLocaleDateString()}

${complianceDetails ? `
COVERAGE SUMMARY:
${complianceDetails}
` : ''}
${attachments.length > 0 ? `\n📎 ATTACHED DOCUMENTS:\n${attachments.map(a => `• ${a.filename}`).join('\n')}\n` : ''}
You are now cleared to proceed with work on this project.

📊 View Your Dashboard:
${subDashboardLink}

Project Details:
${projectDetailsLink}

If you have any questions or need to update your coverage, please contact your broker or reply to this email.

Best regards,
InsureTrack System`,
    });

    // Also send reply/upload links (public upload-endorsement endpoint) so broker can attach endorsements
    try {
      const backendBase = baseUrl.replace(':5175', ':3001').replace(':5176', ':3001');
      const replyLink = `mailto:${subcontractor.broker_email}`;
      const uploadEndorsementLink = `${backendBase}/public/upload-endorsement?coi_token=${coi.coi_token}`;
      const uploadEndorsementRegenLink = `${uploadEndorsementLink}&regen_coi=true`;

      await sendEmail({
        to: subcontractor.broker_email,
        attachments: attachments.length > 0 ? attachments : undefined,
        subject: `⚠️ Action Required: Upload Endorsement or Reply - ${subcontractor.company_name}`,
        body: `Dear ${subcontractor.broker_name || 'Insurance Broker'},

You can reply to this message or upload endorsement documents using the links below.

Reply by email: ${replyLink}
Upload endorsement (no auth): ${uploadEndorsementLink}
Upload & regenerate COI: ${uploadEndorsementRegenLink}
${attachments.length > 0 ? `\n📎 ATTACHED DOCUMENTS:\n${attachments.map(a => `• ${a.filename}`).join('\n')}\n` : ''}
When you upload the endorsement, the system will attempt to read the endorsement, save the extracted fields, and (optionally) regenerate the COI PDF for the project.

If you prefer to attach files directly to your reply, please send them to the email above or use the upload link to include attachments and trigger regeneration.

Thank you,
InsureTrack System`
      });
    } catch (err) {
      console.warn('Error sending broker reply/upload links email:', err?.message || err);
    }

    // Create notification record for sub
    try {
      await apiClient.entities.Message.create({
        message_type: 'coi_approved',
        sender_id: 'admin',
        recipient_id: subcontractor.id,
        subject: `Certificate Approved - ${project.project_name}`,
        body: `Your COI has been approved for ${project.project_name}`,
        related_entity: 'GeneratedCOI',
        related_entity_id: coi.id,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error creating sub message:', error);
    }
  } catch (error) {
    console.error('Error sending sub COI approved notification:', error);
  }
}

/**
 * Notify GC when COI is approved and ready
 */
export async function notifyGCCOIApprovedReady(coi, subcontractor, project) {
  if (!coi || !subcontractor || !project) return;

  const baseUrl = getFrontendBaseUrl();
  const gcProjectLink = `${baseUrl}/ProjectDetails?id=${project.id}&section=subcontractors`;

  try {
    // Prepare attachments using shared helper
    const attachments = prepareAttachments(coi, subcontractor, project);

    await sendEmail({
      to: project.gc_email || 'gc@project.com',
      attachments: attachments.length > 0 ? attachments : undefined,
      subject: `✅ Insurance Approved - ${subcontractor.company_name} Ready for ${project.project_name}`,
      body: `The Certificate of Insurance for your subcontractor has been approved and is ready.

SUBCONTRACTOR:
• Company: ${subcontractor.company_name}
• Contact: ${subcontractor.contact_person}
• Trade(s): ${coi.trade_types?.join(', ') || 'N/A'}

PROJECT:
• Project: ${project.project_name}
• Location: ${project.project_address}

STATUS:
✅ Insurance Certificate: APPROVED
✅ Compliance: VERIFIED
✅ Ready to Work
${attachments.length > 0 ? `\n📎 ATTACHED DOCUMENTS:\n${attachments.map(a => `• ${a.filename}`).join('\n')}\n` : ''}
The subcontractor is now authorized to proceed with work on your project.

🔗 View Project Details:
${gcProjectLink}

If you need to review the certificate or have any questions, please contact us or reply to this email.

Best regards,
InsureTrack System`,
    });
  } catch (error) {
    console.error('Error sending GC COI approved notification:', error);
  }
}

/**
 * Notify when COI requires corrections/deficiencies
 */
export async function notifyCOIDeficiencies(coi, subcontractor, project, deficiencies) {
  if (!coi || !subcontractor || !deficiencies || deficiencies.length === 0) return;

  const baseUrl = getFrontendBaseUrl();
  const brokerPortalLink = `${baseUrl}/broker-dashboard?name=${encodeURIComponent(subcontractor.broker_name)}&coiId=${coi.id}`;
  // Direct brokers to step 2 (upload endorsement) to fix deficiencies
  const brokerUploadLink = `${baseUrl}/broker-upload-coi?token=${coi.coi_token}&step=2&action=upload`;

  try {
    const deficienciesList = deficiencies
      .map((def, idx) => {
        // Escape all deficiency data
        const safeField = escapeHtml(def.field || 'Issue');
        const safeMessage = escapeHtml(def.message);
        const safeRequired = escapeHtml(def.required || 'N/A');
        const safeProvided = escapeHtml(def.provided || 'N/A');
        
        return `<div style="margin: 10px 0; padding: 10px; background: #fef2f2; border-left: 3px solid #dc2626; border-radius: 4px;">
          <strong style="color: #991b1b;">${idx + 1}. ${safeField}</strong>
          <ul style="margin: 5px 0 0 0; padding-left: 20px; color: #333;">
            <li><strong>Issue:</strong> ${safeMessage}</li>
            <li><strong>Required:</strong> ${safeRequired}</li>
            <li><strong>Provided:</strong> ${safeProvided}</li>
          </ul>
        </div>`;
      })
      .join('');

    // Escape all user-provided data in email content
    const safeCompanyName = escapeHtml(subcontractor.company_name);
    const safeProjectName = escapeHtml(project.project_name);
    const safeProjectAddress = escapeHtml(project.project_address);
    const safeGcName = escapeHtml(project.gc_name);
    const safeTradeType = escapeHtml(coi.trade_type);

    const emailContent = `
      <div class="section">
        <div class="section-title">Subcontractor</div>
        <p><strong>Company:</strong> ${safeCompanyName}</p>
      </div>

      <div class="section">
        <div class="section-title">Project Information</div>
        <p><strong>Project:</strong> ${safeProjectName}</p>
        <p><strong>Location:</strong> ${safeProjectAddress}</p>
        <p><strong>General Contractor:</strong> ${safeGcName}</p>
        <p><strong>Trade:</strong> ${safeTradeType}</p>
      </div>

      <div class="section" style="background-color: #fef2f2; border-left-color: #dc2626;">
        <div class="section-title" style="color: #991b1b;">⚠️ Deficiencies Found</div>
        ${deficienciesList}
      </div>

      <div class="section">
        <div class="section-title">Action Required</div>
        <p>You have two options to correct this:</p>
        
        <div style="margin: 15px 0;">
          <p style="font-weight: 600; color: #dc2626;">OPTION 1: Upload Updated Supporting Documents</p>
          <p>If policy declarations or endorsements need updating:</p>
          <p style="text-align: center; margin: 15px 0;">
            <a href="${brokerUploadLink}" class="button">Upload Endorsement/Policy Documents</a>
          </p>
          <ul>
            <li>Step 2: Policy Documents (attach updated GL, Umbrella, Auto, or WC policies)</li>
            <li>Step 3: Broker signature</li>
            <li>Resubmit for re-review</li>
          </ul>
        </div>

        <div style="margin: 15px 0;">
          <p style="font-weight: 600; color: #dc2626;">OPTION 2: Submit a New Certificate</p>
          <p>If the certificate needs to be regenerated:</p>
          <ul>
            <li>Complete all three steps (new ACORD 25, policies, signature)</li>
            <li>System will re-review and approve</li>
          </ul>
        </div>
      </div>

      <div class="alert">
        <p><strong>⏱️ Timeline:</strong> Please submit corrections within 5 business days.</p>
        <p>After this period, the subcontractor may be marked non-compliant.</p>
      </div>

      <p style="text-align: center; margin: 20px 0;">
        <a href="${brokerPortalLink}" class="button" style="background: linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%);">View Broker Dashboard</a>
      </p>
    `;

    // Generate sample COI data from actual program requirements
    const sampleCOIData = await generateSampleCOIFromProgram(project, coi);

    // Notify broker of deficiencies with upload options
    await sendEmail({
      to: subcontractor.broker_email,
      includeSampleCOI: true,
      sampleCOIData,
      subject: `⚠️ COI Corrections Needed - ${subcontractor.company_name} (${project.project_name})`,
      html: createEmailTemplate(
        '⚠️ COI Corrections Needed',
        `Certificate requires updates before approval`,
        emailContent
      ),
    });

    // Notify subcontractor
    const subDashboardLink = `${baseUrl}/subcontractor-dashboard?id=${subcontractor.id}`;
    
    const subEmailContent = `
      <p>Your Certificate of Insurance needs updates before approval for <strong>${safeProjectName}</strong>.</p>

      <div class="section">
        <p>Your insurance broker has been notified of the required corrections. Please contact them to:</p>
        <ul>
          <li>Discuss the specific issues identified</li>
          <li>Provide supporting documents if needed</li>
          <li>Resubmit a corrected or new certificate</li>
        </ul>
      </div>

      <div class="section">
        <p><strong>Project:</strong> ${safeProjectName}</p>
        <p><strong>General Contractor:</strong> ${safeGcName}</p>
      </div>

      <div class="alert">
        <p><strong>⏱️ Timeline:</strong> Corrections needed within 5 business days</p>
      </div>

      <p style="text-align: center; margin: 20px 0;">
        <a href="${subDashboardLink}" class="button">View Your Dashboard</a>
      </p>
    `;

    await sendEmail({
      to: subcontractor.email,
      subject: `⚠️ Certificate Update Needed - ${project.project_name}`,
      html: createEmailTemplate(
        '⚠️ Certificate Update Needed',
        `Your insurance needs attention`,
        subEmailContent
      ),
    });

    // Create notification messages
    try {
      await apiClient.entities.Message.create({
        message_type: 'coi_deficiencies',
        sender_id: 'admin',
        recipient_id: subcontractor.id,
        subject: `COI Requires Correction - ${project.project_name}`,
        body: `Your certificate needs updates: ${deficiencies.length} issue(s) found`,
        related_entity: 'GeneratedCOI',
        related_entity_id: coi.id,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error creating deficiency message:', error);
    }
  } catch (error) {
    console.error('Error sending COI deficiencies notification:', error);
  }
}

/**
 * Notify broker when COI is submitted for their review/signature
 */
export async function notifyBrokerCOIReview(coi, subcontractor, project) {
  if (!coi || !subcontractor || !project) return;

  const baseUrl = getFrontendBaseUrl();
  const brokerPortalLink = `${baseUrl}/broker-dashboard?name=${encodeURIComponent(subcontractor.broker_name)}&coiId=${coi.id}`;
  // Deep-link directly to Signatures step for broker
  const signLink = `${baseUrl}/broker-upload-coi?token=${coi.coi_token}&action=sign&step=3`;

  try {
    // Generate sample COI data from actual program requirements
    const sampleCOIData = await generateSampleCOIFromProgram(project, coi);

    // Prepare attachments using shared helper
    const attachments = prepareAttachments(coi, subcontractor, project);

    await sendEmail({
      to: subcontractor.broker_email,
      includeSampleCOI: true,
      sampleCOIData,
      attachments: attachments.length > 0 ? attachments : undefined,
      subject: `📋 Certificate Ready for Review & Signature: ${subcontractor.company_name}`,
      body: `A Certificate of Insurance is ready for your review and signature.

CLIENT:
• Company: ${subcontractor.company_name}

PROJECT:
• Project: ${project.project_name}
• Location: ${project.project_address}
• General Contractor: ${project.gc_name}

CERTIFICATE STATUS:
• Trade(s): ${coi.trade_types?.join(', ') || 'N/A'}
• Status: Awaiting Your Signature
• Created: ${new Date(coi.created_at).toLocaleDateString()}
${attachments.length > 0 ? `\n📎 ATTACHED DOCUMENTS:\n${attachments.map(a => `• ${a.filename}`).join('\n')}\n` : ''}
ACTION REQUIRED:
Please review the certificate details and approve/sign the Certificate of Insurance.

✍️ Sign Certificate:
${signLink}

📊 Broker Dashboard:
${brokerPortalLink}

Once you approve, the certificate will be submitted to the General Contractor.

Questions? Reply to this email.

Best regards,
InsureTrack System`,
    });
  } catch (error) {
    console.error('Error sending broker COI review notification:', error);
  }
}

/**
 * Notify when subcontractor approves/signs the COI
 */
export async function notifySubcontractorCOIApproved(coi, subcontractor, project) {
  if (!coi || !subcontractor || !project) return;
  const baseUrl = getFrontendBaseUrl();
  const subDashboardLink = `${baseUrl}/subcontractor-dashboard?id=${subcontractor.id}&section=active_projects`;

  try {
    // Prepare attachments using shared helper
    const attachments = prepareAttachments(coi, subcontractor, project);

    await sendEmail({
      to: subcontractor.email,
      attachments: attachments.length > 0 ? attachments : undefined,
      subject: `✅ Your Certificate is Approved - ${project.project_name}`,
      body: `Your Certificate of Insurance has been approved and submitted.

PROJECT:
• Project: ${project.project_name}
• Location: ${project.project_address}
• General Contractor: ${project.gc_name}

CERTIFICATE STATUS:
✅ Your Signature: APPROVED
✅ Broker Approval: COMPLETE
✅ Admin Review: APPROVED
✅ Ready for Work
${attachments.length > 0 ? `\n📎 ATTACHED DOCUMENTS:\n${attachments.map(a => `• ${a.filename}`).join('\n')}\n` : ''}
You are now authorized to proceed with work on this project.

📊 View Your Active Projects:
${subDashboardLink}

Contact your broker or the GC if you have any questions.

Best regards,
InsureTrack System`,
    });

    // Create notification
    try {
      await apiClient.entities.Message.create({
        message_type: 'coi_approved_sub',
        sender_id: 'admin',
        recipient_id: subcontractor.id,
        subject: `Certificate Approved - Ready to Work`,
        body: `Your certificate for ${project.project_name} is approved`,
        related_entity: 'GeneratedCOI',
        related_entity_id: coi.id,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error creating sub approval message:', error);
    }
  } catch (error) {
    console.error('Error sending subcontractor COI approved notification:', error);
  }
}

/**
 * Send all stakeholder update on COI approval
 */
export async function notifyAllStakeholdersCOIApproved(coi, subcontractor, project) {
  // Notify each stakeholder
  await notifySubCOIApproved(coi, subcontractor, project);
  await notifyGCCOIApprovedReady(coi, subcontractor, project);
  await notifyBrokerCOIReview(coi, subcontractor, project);

  // Log approval in system
  try {
    await apiClient.entities.Message.create({
      message_type: 'coi_approved_all',
      sender_id: 'admin',
      recipient_id: project.gc_id,
      subject: `Insurance Approved: ${subcontractor.company_name}`,
      body: `Certificate approved and all stakeholders notified`,
      related_entity: 'GeneratedCOI',
      related_entity_id: coi.id,
      is_read: false,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error logging approval:', error);
  }
}
/**
 * Notify admin when a subcontractor changes their brokers
 * Generate new COI and policy requests for the changed brokers
 */
export async function notifyAdminBrokerChanged(subcontractor, newBrokers, oldBrokers, projects) {
  if (!subcontractor || !newBrokers || !Array.isArray(projects)) return;

  const baseUrl = getFrontendBaseUrl();
  
  try {
    // Fetch admin emails from backend
    const adminEmails = await fetchAdminEmails(baseUrl);

    // Build notification details
    const oldBrokersList = (oldBrokers || []).map(b => `${b.name} (${b.email})`).join(', ') || 'None';
    
    // Optimized: Single pass instead of nested filter→map→join
    const newBrokersList = newBrokers.map(b => {
      const policies = Object.entries(b.policies)
        .reduce((acc, [k, v]) => {
          if (v) acc.push(k.toUpperCase());
          return acc;
        }, [])
        .join(', ');
      return `${b.name} (${b.email}) - ${policies}`;
    }).join(', ');
    
    const affectedProjectsList = projects.map(p => `• ${p.project_name}`).join('\n');

    // Send notification to admins
    for (const adminEmail of adminEmails) {
      await sendEmail({
        to: adminEmail,
        subject: `🔔 Broker Change Notification - ${subcontractor.company_name}`,
        body: `Subcontractor has changed their broker assignments.

SUBCONTRACTOR DETAILS:
• Company: ${subcontractor.company_name}
• Contact: ${subcontractor.contact_person || 'N/A'}
• Email: ${subcontractor.email}

PREVIOUS BROKERS:
${oldBrokersList}

NEW BROKERS:
${newBrokersList}

AFFECTED PROJECTS:
${affectedProjectsList}

ACTION REQUIRED:
Please review the attached broker information and generate new COI upload requests and policy requirements for the updated brokers through the admin dashboard.`
      });
    }

  } catch (error) {
    console.error('Error notifying admin of broker change:', error);
  }
}