import { apiClient } from "@/api/apiClient";
import { sendEmail } from "@/emailHelper";
import { generateSecureToken } from "@/utils/tokenGenerator";
import { sendEmailWithErrorHandling } from "@/utils/notificationUtils";
import { getFrontendBaseUrl, createBrokerDashboardLink, createSubcontractorDashboardLink } from "@/urlConfig";
import { EMAIL_SIGNATURE, formatInsuranceType, createEmailGreeting } from "@/utils/emailTemplates";



/**
 * Handle policy renewal workflow
 * When a policy is renewed/updated, trigger new COI generation and broker approval flow
 */
export async function handlePolicyRenewal(subcontractor, oldPolicy, newPolicy) {
  try {
    // Get all projects this subcontractor is assigned to
    const projectSubs = await apiClient.entities.ProjectSubcontractor.filter({
      subcontractor_id: subcontractor.id
    });

    if (!projectSubs || projectSubs.length === 0) {
      return;
    }

    // For each project, trigger new COI generation
    for (const projectSub of projectSubs) {
      try {
        const project = await apiClient.entities.Project.read(projectSub.project_id);
        
        // Generate new COI from renewed policy
        await generateRenewalCOI(subcontractor, newPolicy, project, projectSub);
        
        // Notify broker of policy renewal
        await notifyBrokerPolicyRenewal(subcontractor, oldPolicy, newPolicy, project);
        
        // Notify GC of policy renewal
        await notifyGCPolicyRenewal(project, subcontractor, newPolicy);
      } catch (err) {
        console.error('Error processing renewal for project:', projectSub.project_id, err);
      }
    }
  } catch (error) {
    console.error('Error handling policy renewal:', error);
  }
}

/**
 * Generate new COI for renewed policy
 */
async function generateRenewalCOI(subcontractor, renewedPolicy, project, projectSub) {
  try {
    // Generate secure random token using crypto
    const coiToken = generateSecureToken();
    
    // Create new COI record marking it as renewal
    const newCOI = await apiClient.entities.GeneratedCOI.create({
      subcontractor_id: subcontractor.id,
      subcontractor_name: subcontractor.company_name,
      project_id: project.id,
      project_name: project.project_name,
      project_sub_id: projectSub.id,
      coi_token: coiToken,
      status: 'pending_broker',
      compliance_status: 'awaiting_broker_approval',
      broker_email: subcontractor.broker_email,
      broker_name: subcontractor.broker_name,
      is_renewal: true,
      renewal_date: new Date().toISOString(),
      previous_policy_number: renewedPolicy.old_policy_number,
      current_policy_number: renewedPolicy.policy_number,
      current_policy_expiration: renewedPolicy.policy_expiration_date,
      // ... copy other insurance details from renewed policy
    });

    return newCOI;
  } catch (error) {
    console.error('Error generating renewal COI:', error);
  }
}

/**
 * Notify broker that a subcontractor's policy has been renewed
 */
export async function notifyBrokerPolicyRenewal(subcontractor, oldPolicy, newPolicy, project) {
  if (!subcontractor.broker_email) return;

  const brokerDashboardLink = createBrokerDashboardLink(subcontractor.broker_name, subcontractor.broker_email);
  
  await sendEmailWithErrorHandling({
    to: subcontractor.broker_email,
    includeSampleCOI: true,
    sampleCOIData: {
      project_name: project?.project_name,
      gc_name: project?.gc_name,
      trade: newPolicy.insurance_type,
      program: project?.program_name || project?.program_id
    },
    subject: `Policy Renewal - Action Required: ${formatInsuranceType(newPolicy.insurance_type)} for ${subcontractor.company_name}`,
    body: `${createEmailGreeting('broker', subcontractor.broker_name)}

A policy has been renewed for your client ${subcontractor.company_name} and requires COI approval.

📋 Policy Renewal Details:
• Policy Type: ${formatInsuranceType(newPolicy.insurance_type)}
• Insurance Carrier: ${newPolicy.insurance_carrier || 'N/A'}
• Old Policy Number: ${oldPolicy?.policy_number || 'N/A'}
• New Policy Number: ${newPolicy.policy_number}
• New Effective Date: ${new Date(newPolicy.policy_effective_date).toLocaleDateString()}
• New Expiration Date: ${new Date(newPolicy.policy_expiration_date).toLocaleDateString()}
• Subcontractor: ${subcontractor.company_name}
• Project: ${project?.project_name || 'Multiple Projects'}

🔗 Review & Approve COI:
${brokerDashboardLink}

📌 Action Required:
1. Review the new ${formatInsuranceType(newPolicy.insurance_type)} policy
2. Sign and approve the auto-generated Certificate of Insurance
3. Submit to activate for all projects

Once approved, the Certificate of Insurance will be updated across all projects where this subcontractor is assigned.

Note: If you need to make edits or corrections to the certificate, you can do so before approval.

${EMAIL_SIGNATURE}`
  }, 'broker policy renewal notification', sendEmail);
}

/**
 * Notify subcontractor that their policy has been renewed
 */
export async function notifySubPolicyRenewal(subcontractor, oldPolicy, newPolicy, project) {
  if (!subcontractor.email) return;

  const subDashboardLink = createSubcontractorDashboardLink(subcontractor.id);
  
  await sendEmailWithErrorHandling({
    to: subcontractor.email,
    subject: `Policy Renewed - ${formatInsuranceType(newPolicy.insurance_type)}`,
    body: `Dear ${subcontractor.contact_person || subcontractor.company_name},

Great news! Your insurance policy has been renewed.

📋 Policy Renewal Details:
• Policy Type: ${formatInsuranceType(newPolicy.insurance_type)}
• Insurance Carrier: ${newPolicy.insurance_carrier || 'N/A'}
• New Policy Number: ${newPolicy.policy_number}
• Old Expiration: ${new Date(oldPolicy?.policy_expiration_date).toLocaleDateString()}
• New Expiration: ${new Date(newPolicy.policy_expiration_date).toLocaleDateString()}

🔗 View Your Dashboard:
${subDashboardLink}

📌 Next Steps:
Your insurance broker will review and approve a new Certificate of Insurance based on your renewed policy.

${project ? `This renewal affects your work on: ${project.project_name}` : 'This renewal affects your work on multiple projects.'}

You will receive notification once your Certificate of Insurance is approved and ready.

Keep your broker updated if there are any changes to your coverage or policy details.

${EMAIL_SIGNATURE}`
  }, 'subcontractor policy renewal notification', sendEmail);
}

/**
 * Notify GC that a subcontractor's policy has been renewed
 */
export async function notifyGCPolicyRenewal(project, subcontractor, newPolicy) {
  if (!project.gc_email) return;

  const baseUrl = getFrontendBaseUrl();
  const projectDetailsLink = `${baseUrl}/ProjectDetails?id=${project.id}`;
  
  await sendEmailWithErrorHandling({
    to: project.gc_email,
    subject: `Policy Renewed - ${subcontractor.company_name} (${formatInsuranceType(newPolicy.insurance_type)})`,
    body: `Dear ${project.gc_name},

A subcontractor's insurance policy has been renewed. A new Certificate of Insurance is being generated and will be sent for approval.

📋 Policy Renewal Details:
• Subcontractor: ${subcontractor.company_name}
• Project: ${project.project_name}
• Policy Type: ${formatInsuranceType(newPolicy.insurance_type)}
• Insurance Carrier: ${newPolicy.insurance_carrier || 'N/A'}
• New Policy Number: ${newPolicy.policy_number}
• New Expiration Date: ${new Date(newPolicy.policy_expiration_date).toLocaleDateString()}

🔗 View Project:
${projectDetailsLink}

📌 Status:
The broker is reviewing and approving the new Certificate of Insurance.
Work will continue once the certificate is approved.

You will receive notification once all approvals are complete.

${EMAIL_SIGNATURE}`
  }, 'GC policy renewal notification', sendEmail);
}

/**
 * Notify all stakeholders that renewal COI has been approved
 */
export async function notifyRenewalCOIApproved(subcontractor, project, newCOI) {
  try {
    // Notify subcontractor
    if (subcontractor.email) {
      const subDashboardLink = createSubcontractorDashboardLink(subcontractor.id);
      
      await sendEmail({
        to: subcontractor.email,
        subject: `Renewed Certificate Approved - ${project.project_name}`,
        body: `Dear ${subcontractor.contact_person || subcontractor.company_name},

Your renewed Certificate of Insurance has been approved and is now active.

📋 Certificate Details:
• Project: ${project.project_name}
• Effective Date: ${new Date(newCOI.created_date).toLocaleDateString()}
• GL Coverage: $${newCOI.gl_coverage_amount?.toLocaleString() || 'N/A'}

🔗 View Dashboard:
${subDashboardLink}

You are cleared to continue work on this project with your renewed coverage.

${EMAIL_SIGNATURE}`
      });
    }

    // Notify GC
    if (project.gc_email) {
      await sendEmail({
        to: project.gc_email,
        subject: `✅ Renewed Certificate Approved - ${subcontractor.company_name}`,
        body: `Dear ${project.gc_name},

The renewed Certificate of Insurance for ${subcontractor.company_name} has been approved.

📋 Certificate Details:
• Subcontractor: ${subcontractor.company_name}
• Project: ${project.project_name}
• Status: APPROVED
• Effective Date: ${new Date(newCOI.created_date).toLocaleDateString()}

The subcontractor is cleared to continue work with their renewed coverage.

${EMAIL_SIGNATURE}`
      });
    }
  } catch (error) {
    console.error('Error notifying renewal COI approval:', error);
  }
}
