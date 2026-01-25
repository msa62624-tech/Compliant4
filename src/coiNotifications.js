import { sendEmail } from "@/emailHelper";
import { getFrontendBaseUrl } from "@/urlConfig";
import { apiClient } from "@/api/apiClient";
import { createEmailTemplate } from "@/emailTemplates";

/**
 * COI Upload & Approval Notification System
 * Handles notifications when COI is uploaded or approved
 */

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
    let adminEmails = ['admin@insuretrack.com']; // Default fallback
    try {
      const response = await fetch(`${baseUrl.replace(':5175', ':3001').replace(':5176', ':3001')}/public/admin-emails`);
      if (response.ok) {
        const data = await response.json();
        adminEmails = data.emails || adminEmails;
      }
    } catch (fetchError) {
      console.warn('Could not fetch admin emails, using default:', fetchError.message);
    }
    
    // Send email to all admin emails
    for (const adminEmail of adminEmails) {
      await sendEmail({
        to: adminEmail,
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
    await sendEmail({
      to: subcontractor.email,
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
        subject: `⚠️ Action Required: Upload Endorsement or Reply - ${subcontractor.company_name}`,
        body: `Dear ${subcontractor.broker_name || 'Insurance Broker'},

You can reply to this message or upload endorsement documents using the links below.

Reply by email: ${replyLink}
Upload endorsement (no auth): ${uploadEndorsementLink}
Upload & regenerate COI: ${uploadEndorsementRegenLink}

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
    await sendEmail({
      to: project.gc_email || 'gc@project.com',
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
        return `<div style="margin: 10px 0; padding: 10px; background: #fef2f2; border-left: 3px solid #dc2626; border-radius: 4px;">
          <strong style="color: #991b1b;">${idx + 1}. ${def.field || 'Issue'}</strong>
          <ul style="margin: 5px 0 0 0; padding-left: 20px; color: #333;">
            <li><strong>Issue:</strong> ${def.message}</li>
            <li><strong>Required:</strong> ${def.required || 'N/A'}</li>
            <li><strong>Provided:</strong> ${def.provided || 'N/A'}</li>
          </ul>
        </div>`;
      })
      .join('');

    const emailContent = `
      <div class="section">
        <div class="section-title">Subcontractor</div>
        <p><strong>Company:</strong> ${subcontractor.company_name}</p>
      </div>

      <div class="section">
        <div class="section-title">Project Information</div>
        <p><strong>Project:</strong> ${project.project_name}</p>
        <p><strong>Location:</strong> ${project.project_address}</p>
        <p><strong>General Contractor:</strong> ${project.gc_name}</p>
        <p><strong>Trade:</strong> ${coi.trade_type}</p>
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

    // Notify broker of deficiencies with upload options
    await sendEmail({
      to: subcontractor.broker_email,
      includeSampleCOI: true,
      sampleCOIData: {
        project_name: project?.project_name,
        gc_name: project?.gc_name,
        gc_owner: project?.gc_owner || project?.gc_owner_name,
        trade: coi?.trade_types?.join(', ') || coi?.trade_type || subcontractor.trade_types?.join(', '),
        program: project?.program_name || project?.program_id,
        additional_insureds: project?.additional_insureds || [project?.gc_name]
      },
      subject: `⚠️ COI Corrections Needed - ${subcontractor.company_name} (${project.project_name})`,
      html: createEmailTemplate(
        '⚠️ COI Corrections Needed',
        `Certificate requires updates before approval`,
        emailContent
      ),
    });

    // Notify subcontractor
    const baseUrl = getFrontendBaseUrl();
    const subDashboardLink = `${baseUrl}/subcontractor-dashboard?id=${subcontractor.id}`;
    
    const subEmailContent = `
      <p>Your Certificate of Insurance needs updates before approval for <strong>${project.project_name}</strong>.</p>

      <div class="section">
        <p>Your insurance broker has been notified of the required corrections. Please contact them to:</p>
        <ul>
          <li>Discuss the specific issues identified</li>
          <li>Provide supporting documents if needed</li>
          <li>Resubmit a corrected or new certificate</li>
        </ul>
      </div>

      <div class="section">
        <p><strong>Project:</strong> ${project.project_name}</p>
        <p><strong>General Contractor:</strong> ${project.gc_name}</p>
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
    await sendEmail({
      to: subcontractor.broker_email,
      includeSampleCOI: true,
      sampleCOIData: {
        project_name: project?.project_name,
        gc_name: project?.gc_name,
        gc_owner: project?.gc_owner || project?.gc_owner_name,
        trade: coi?.trade_types?.join(', ') || coi?.trade_type || subcontractor.trade_types?.join(', '),
        program: project?.program_name || project?.program_id,
        additional_insureds: project?.additional_insureds || [project?.gc_name]
      },
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
    await sendEmail({
      to: subcontractor.email,
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
    let adminEmails = ['admin@insuretrack.com']; // Default fallback
    try {
      const response = await fetch(`${baseUrl.replace(':5175', ':3001').replace(':5176', ':3001')}/public/admin-emails`);
      if (response.ok) {
        const data = await response.json();
        adminEmails = data.emails || adminEmails;
      }
    } catch (fetchError) {
      console.warn('Could not fetch admin emails, using default:', fetchError.message);
    }

    // Build notification details
    const oldBrokersList = (oldBrokers || []).map(b => `${b.name} (${b.email})`).join(', ') || 'None';
    const newBrokersList = newBrokers.map(b => `${b.name} (${b.email}) - ${Object.entries(b.policies).filter(([_, v]) => v).map(([k]) => k.toUpperCase()).join(', ')}`).join(', ');
    
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