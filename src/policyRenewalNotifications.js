import { apiClient } from "@/api/apiClient";
import { sendEmail } from "@/emailHelper";



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
    const tokenBytes = new Uint8Array(24);
    crypto.getRandomValues(tokenBytes);
    const coiToken = Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    
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

  const brokerDashboardLink = `${window.location.origin}/broker-dashboard?name=${encodeURIComponent(subcontractor.broker_name)}`;
  
  try {
    await sendEmail({
      to: subcontractor.broker_email,
      subject: `Policy Renewal - Action Required: ${newPolicy.insurance_type.replace(/_/g, ' ')} for ${subcontractor.company_name}`,
      body: `Dear ${subcontractor.broker_name || 'Insurance Broker'},

A policy has been renewed for your client ${subcontractor.company_name} and requires COI approval.

📋 Policy Renewal Details:
• Policy Type: ${newPolicy.insurance_type.replace(/_/g, ' ')}
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
1. Review the new ${newPolicy.insurance_type.replace(/_/g, ' ')} policy
2. Sign and approve the auto-generated Certificate of Insurance
3. Submit to activate for all projects

Once approved, the Certificate of Insurance will be updated across all projects where this subcontractor is assigned.

Note: If you need to make edits or corrections to the certificate, you can do so before approval.

Best regards,
InsureTrack System`
    });
  } catch (error) {
    console.error('Error sending broker policy renewal notification:', error);
  }
}

/**
 * Notify subcontractor that their policy has been renewed
 */
export async function notifySubPolicyRenewal(subcontractor, oldPolicy, newPolicy, project) {
  if (!subcontractor.email) return;

  const subDashboardLink = `${window.location.origin}/subcontractor-dashboard?id=${subcontractor.id}`;
  
  try {
    await sendEmail({
      to: subcontractor.email,
      subject: `Policy Renewed - ${newPolicy.insurance_type.replace(/_/g, ' ')}`,
      body: `Dear ${subcontractor.contact_person || subcontractor.company_name},

Great news! Your insurance policy has been renewed.

📋 Policy Renewal Details:
• Policy Type: ${newPolicy.insurance_type.replace(/_/g, ' ')}
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

Best regards,
InsureTrack System`
    });
  } catch (error) {
    console.error('Error sending subcontractor policy renewal notification:', error);
  }
}

/**
 * Notify GC that a subcontractor's policy has been renewed
 */
export async function notifyGCPolicyRenewal(project, subcontractor, newPolicy) {
  if (!project.gc_email) return;

  const projectDetailsLink = `${window.location.origin}/ProjectDetails?id=${project.id}`;
  
  try {
    await sendEmail({
      to: project.gc_email,
      subject: `Policy Renewed - ${subcontractor.company_name} (${newPolicy.insurance_type.replace(/_/g, ' ')})`,
      body: `Dear ${project.gc_name},

A subcontractor's insurance policy has been renewed. A new Certificate of Insurance is being generated and will be sent for approval.

📋 Policy Renewal Details:
• Subcontractor: ${subcontractor.company_name}
• Project: ${project.project_name}
• Policy Type: ${newPolicy.insurance_type.replace(/_/g, ' ')}
• Insurance Carrier: ${newPolicy.insurance_carrier || 'N/A'}
• New Policy Number: ${newPolicy.policy_number}
• New Expiration Date: ${new Date(newPolicy.policy_expiration_date).toLocaleDateString()}

🔗 View Project:
${projectDetailsLink}

📌 Status:
The broker is reviewing and approving the new Certificate of Insurance.
Work will continue once the certificate is approved.

You will receive notification once all approvals are complete.

Best regards,
InsureTrack System`
    });
  } catch (error) {
    console.error('Error sending GC policy renewal notification:', error);
  }
}

/**
 * Notify all stakeholders that renewal COI has been approved
 */
export async function notifyRenewalCOIApproved(subcontractor, project, newCOI) {
  try {
    // Notify subcontractor
    if (subcontractor.email) {
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
${window.location.origin}/subcontractor-dashboard?id=${subcontractor.id}

You are cleared to continue work on this project with your renewed coverage.

Best regards,
InsureTrack System`
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

Best regards,
InsureTrack System`
      });
    }
  } catch (error) {
    console.error('Error notifying renewal COI approval:', error);
  }
}
