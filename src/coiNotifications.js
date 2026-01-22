import { sendEmail } from "@/emailHelper";
import { getFrontendBaseUrl } from "@/urlConfig";
import { apiClient } from "@/api/apiClient";

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
  // Direct brokers to Policies step to fix deficiencies
  const brokerUploadLink = `${baseUrl}/broker-upload-coi?token=${coi.coi_token}&step=2&action=upload`;

  try {
    // Notify broker of deficiencies with upload options
    await sendEmail({
      to: subcontractor.broker_email,
      subject: `⚠️ COI Corrections Needed - ${subcontractor.company_name} (${project.project_name})`,
      body: `The Certificate of Insurance you submitted for ${subcontractor.company_name} requires corrections before approval.

SUBCONTRACTOR:
• Company: ${subcontractor.company_name}

PROJECT:
• Project: ${project.project_name}
• Location: ${project.project_address}
• General Contractor: ${project.gc_name}
• Trade: ${coi.trade_type}

DEFICIENCIES FOUND:
${deficiencies
  .map((def, idx) => {
    return `${idx + 1}. ${def.field || 'Issue'}
   • Issue: ${def.message}
   • Required: ${def.required || 'N/A'}
   • Provided: ${def.provided || 'N/A'}`;
  })
  .join('\n\n')}

ACTION REQUIRED:
You have two options to correct this:

OPTION 1: Upload Updated Supporting Documents
If policy declarations or endorsements need updating:
✓ Upload corrected documents: ${brokerUploadLink}
✓ Step 2: Policy Documents (attach updated GL, Umbrella, Auto, or WC policies)
✓ Step 3: Broker signature
✓ Resubmit for re-review

OPTION 2: Submit a New Certificate
If the certificate needs to be regenerated:
✓ Access upload portal: ${brokerUploadLink}
✓ Complete all three steps (new ACORD 25, policies, signature)
✓ System will re-review and approve

TIMELINE:
Please submit corrections within 5 business days.
After this period, the subcontractor may be marked non-compliant.

BROKER DASHBOARD:
${brokerPortalLink}

Questions? Reply to this email.

Best regards,
InsureTrack System`,
    });

    // Notify subcontractor
    const baseUrl = getFrontendBaseUrl();
    const subDashboardLink = `${baseUrl}/subcontractor-dashboard?id=${subcontractor.id}`;
    await sendEmail({
      to: subcontractor.email,
      subject: `⚠️ Certificate Update Needed - ${project.project_name}`,
      body: `Your Certificate of Insurance needs updates before approval for ${project.project_name}.

Your insurance broker has been notified of the required corrections. Please contact them to:
• Discuss the specific issues identified
• Provide supporting documents if needed
• Resubmit a corrected or new certificate

PROJECT: ${project.project_name}
GENERAL CONTRACTOR: ${project.gc_name}

Timeline: Corrections needed within 5 business days

Dashboard: ${subDashboardLink}

Best regards,
InsureTrack System`,
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
