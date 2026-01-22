import { apiClient } from "@/api/apiClient";
import { generateSecurePassword, formatLoginCredentialsForEmail, createUserCredentials } from "@/passwordUtils";
import { sendEmail } from "@/emailHelper";
import { getFrontendBaseUrl } from "@/urlConfig";

/**
 * Send welcome email when GC first joins the system
 */
export async function sendGCWelcomeEmail(gc) {
  if (!gc.email) {
    console.warn('No GC email provided for welcome notification');
    return false;
  }

  const baseUrl = getFrontendBaseUrl();
  const gcDashboardLink = `${baseUrl}/gc-dashboard?id=${gc.id}`;
  
  // Always generate credentials if not provided
  const username = gc?.gcLogin?.username || gc?.email || gc?.loginUsername || gc.email;
  const tempPassword = gc?.gcLogin?.password || gc?.tempPassword || generateSecurePassword();
  const loginInfo = formatLoginCredentialsForEmail(
    username,
    tempPassword,
    baseUrl,
    '/login'
  );
  
  try {
    await sendEmail({
      to: gc.email,
      subject: `Welcome to InsureTrack - Your GC Portal is Ready`,
      body: `Dear ${gc.contact_person || gc.company_name},

Welcome to InsureTrack! Your General Contractor portal account has been created.

🏢 Your Company Profile:
• Company: ${gc.company_name}
• License: ${gc.license_number || 'N/A'}
• Contact: ${gc.contact_person || 'N/A'}
• Phone: ${gc.phone || 'N/A'}
• Email: ${gc.email}

� YOUR LOGIN CREDENTIALS:
${loginInfo}

🔗 ACCESS YOUR PORTAL (Click to Open):
${gcDashboardLink}

📊 What You Can Do in Your Portal:
• Create and manage construction projects
• Add subcontractors to your projects
• Track insurance compliance in real-time
• Monitor Certificates of Insurance (COIs)
• Receive alerts for policy expirations
• Review subcontractor compliance status
• Manage project requirements

🚀 Getting Started:
1. Click the portal link above (no login needed!)
2. Complete your company profile
3. Create your first project
4. Add subcontractors to your project
5. Track their insurance compliance automatically

📌 Key Features:
✅ Real-time COI tracking and approvals
✅ Automated expiration alerts
✅ Compliance monitoring dashboard
✅ Direct communication with subcontractors and brokers
✅ Document management and storage
✅ Custom insurance requirements per project

📌 Important: Bookmark the portal link above for easy access!

Need help getting started? Reply to this email and our team will assist you.

Best regards,
The InsureTrack Team

---
InsureTrack - Simplifying Construction Insurance Management
Support: support@insuretrack.com`
    });
    
    // Create GC user account with the credentials sent in email
    try {
      const userCredentials = createUserCredentials(
        username,
        gc.contact_person || gc.company_name,
        'gc',
        { gc_id: gc.id }
      );
      userCredentials.password = tempPassword;
      await apiClient.entities.User.create(userCredentials);
    } catch (_userError) {
      // User may already exist
    }
    
    return true;
  } catch (error) {
    console.error('Error sending GC welcome email:', error);
    return false;
  }
}

/**
 * Send notification when a new project is created
 */
export async function notifyGCProjectCreated(project) {
  if (!project.gc_email) {
    console.warn('No GC email provided for project notification');
    return;
  }

  const baseUrl = getFrontendBaseUrl();
  const gcProjectLink = `${baseUrl}/gc-project?project=${project.id}&id=${project.gc_id}`;
  
  try {
    await sendEmail({
      to: project.gc_email,
      subject: `New Project Created - ${project.project_name}`,
      body: `Dear ${project.gc_name},

A new project has been created in the InsureTrack system.

📋 Project Details:
• Project Name: ${project.project_name}
• Project Address: ${[project.address, project.city, project.state].filter(Boolean).join(', ')}
• Owner Entity: ${project.owner_entity || 'N/A'}
• State: ${project.state}
• Status: ${project.status || 'Active'}
• Project ID: ${project.id}

🔗 Open Your Project (GC Portal):
${gcProjectLink}

📌 Next Steps:
1. Add subcontractors to the project
2. Review and manage insurance requirements
3. Track compliance status for all subcontractors
4. Monitor Certificates of Insurance

Dashboard Features:
• View all your projects
• Manage subcontractor assignments
• Track insurance approval status
• Monitor policy expirations

You will receive notifications as subcontractors are added and insurance approvals are processed.

Best regards,
InsureTrack System`
    });
  } catch (error) {
    console.error('Error sending GC project creation notification:', error);
  }
}

/**
 * Notify GC when subcontractor is added to their project
 */
export async function notifyGCSubcontractorAdded(project, subcontractor) {
  if (!project.gc_email) return;

  const baseUrl = getFrontendBaseUrl();
  const gcProjectLink = `${baseUrl}/gc-project?project=${project.id}&id=${project.gc_id}`;
  
  try {
    await sendEmail({
      to: project.gc_email,
      subject: `Subcontractor Added - ${subcontractor.company_name} on ${project.project_name}`,
      body: `Dear ${project.gc_name},

A new subcontractor has been added to your project.

📋 Subcontractor Details:
• Company: ${subcontractor.company_name}
• Contact: ${subcontractor.contact_person || 'N/A'}
• Email: ${subcontractor.email}
• Phone: ${subcontractor.phone || 'N/A'}
• Trade(s): ${subcontractor.trade_types?.join(', ') || 'N/A'}
• Assigned Broker: ${subcontractor.broker_name || subcontractor.broker_email || 'Not assigned'}

📋 Project:
• Project: ${project.project_name}
• Address: ${project.project_address}

🔗 Open Project (GC Portal):
${gcProjectLink}

📌 Status Update:
Insurance approval process has been initiated. You will receive notifications as:
• Broker documents are uploaded
• Certificate of Insurance is generated
• Insurance is approved
• Compliance issues are identified

Best regards,
InsureTrack System`
    });
  } catch (error) {
    console.error('Error sending GC subcontractor notification:', error);
  }
}

/**
 * Notify GC when COI is approved for a project subcontractor
 */
export async function notifyGCCOIApproved(project, subcontractor, coi) {
  if (!project.gc_email) return;

  const baseUrl = getFrontendBaseUrl();
  const gcProjectLink = `${baseUrl}/gc-project?project=${project.id}&id=${project.gc_id}`;
  
  try {
    await sendEmail({
      to: project.gc_email,
      subject: `✅ Insurance Approved - ${subcontractor.company_name} on ${project.project_name}`,
      body: `Dear ${project.gc_name},

Good news! Insurance has been approved for ${subcontractor.company_name}.

📋 Approval Details:
• Subcontractor: ${subcontractor.company_name}
• Project: ${project.project_name}
• Trade: ${coi.trade_type || 'N/A'}
• Status: APPROVED
• Approval Date: ${new Date().toLocaleDateString()}

🔗 Open Project (GC Portal):
${gcProjectLink}

📌 What's Next:
${coi.hold_harmless_status === 'pending_signature' ? `HOLD HARMLESS AGREEMENT:
A Hold Harmless Agreement is required before work can proceed.
This provides protection for all parties involved in the project.

Timeline: Agreement should be obtained and signed before work begins.` : `The subcontractor is cleared to work on this project.
Continue to monitor for any compliance issues or policy expirations.`}

Best regards,
InsureTrack System`
    });
  } catch (error) {
    console.error('Error sending GC COI approval notification:', error);
  }
}

/**
 * Notify GC when there's an issue with subcontractor compliance
 */
export async function notifyGCComplianceIssue(project, subcontractor, issueType, details) {
  if (!project.gc_email) return;

  const baseUrl = getFrontendBaseUrl();
  const gcProjectLink = `${baseUrl}/gc-project?project=${project.id}&id=${project.gc_id}`;
  const urgency = issueType === 'policy_expired' ? 'URGENT' : 'ATTENTION REQUIRED';
  
  try {
    let issueMessage = '';
    
    switch(issueType) {
      case 'policy_expired':
        issueMessage = `Insurance Policy EXPIRED\n\n${details}`;
        break;
      case 'policy_expiring_soon':
        issueMessage = `Insurance Policy EXPIRING SOON\n\nPolicy will expire on: ${details}`;
        break;
      case 'coi_pending_approval':
        issueMessage = `Certificate of Insurance PENDING APPROVAL\n\nCOI is awaiting admin review.`;
        break;
      case 'missing_documents':
        issueMessage = `Missing Insurance Documents\n\n${details}`;
        break;
      default:
        issueMessage = details;
    }

    await sendEmail({
      to: project.gc_email,
      subject: `${urgency}: ${subcontractor.company_name} - ${project.project_name}`,
      body: `Dear ${project.gc_name},

⚠️ ${urgency}

There is a compliance issue that needs your attention:

📋 Issue Details:
• Subcontractor: ${subcontractor.company_name}
• Project: ${project.project_name}
• Issue Type: ${issueType.replace(/_/g, ' ').toUpperCase()}
• Details: ${issueMessage}

🔗 Open Project (GC Portal):
${gcProjectLink}

📌 Required Action:
Please contact the subcontractor and/or their broker to resolve this issue before work continues.

Contact Information:
• Subcontractor: ${subcontractor.email}
• Broker: ${subcontractor.broker_email || 'N/A'}

Best regards,
InsureTrack System`
    });
  } catch (error) {
    console.error('Error sending GC compliance issue notification:', error);
  }
}

/**
 * Notify GC when a broker replaces an already-approved document
 * This changes the subcontractor status from compliant to pending review
 */
export async function notifyGCDocumentReplaced(project, subcontractor, documentInfo, broker, reason) {
  if (!project.gc_email) {
    console.warn('No GC email provided for document replacement notification');
    return;
  }

  const baseUrl = getFrontendBaseUrl();
  const gcProjectLink = `${baseUrl}/gc-project?project=${project.id}&id=${project.gc_id}`;
  
  try {
    await sendEmail({
      to: project.gc_email,
      subject: `⚠️ Document Re-Review Required - ${subcontractor.company_name} - ${project.project_name}`,
      body: `Dear ${project.gc_name || 'General Contractor'},

⚠️ ACTION REQUIRED: Document Replacement Alert

A broker has replaced a previously approved insurance document. The subcontractor's status has been changed from COMPLIANT to PENDING REVIEW.

📋 Details:
• Subcontractor: ${subcontractor.company_name}
• Project: ${project.project_name}
• Document Type: ${documentInfo.document_type || documentInfo.insurance_type || 'Insurance Document'}
• Broker: ${broker?.name || broker?.email || 'N/A'}
${reason ? `• Reason for Replacement: ${reason}` : ''}
• Date: ${new Date().toLocaleDateString()}

🔄 Status Change:
• Previous Status: COMPLIANT ✅
• Current Status: PENDING REVIEW ⏳

📌 Required Action:
The new document must be reviewed and approved before the subcontractor can return to compliant status. Please review the updated documentation at your earliest convenience.

🔗 Review Document (GC Portal):
${gcProjectLink}

Contact Information:
• Subcontractor: ${subcontractor.email}
• Broker: ${broker?.email || subcontractor.broker_email || 'N/A'}

Best regards,
InsureTrack System`
    });
  } catch (error) {
    console.error('Error sending GC document replacement notification:', error);
  }
}
