import { compliant } from "@/api/compliantClient";
import { generateSecurePassword, formatLoginCredentialsForEmail, createUserCredentials } from "@/passwordUtils";
import { sendEmail } from "@/emailHelper";
import { getFrontendBaseUrl, createBrokerDashboardLink, createBrokerUploadLink, createSubcontractorDashboardLink } from "@/urlConfig";

/**
 * Send notification emails when broker is assigned or changed for a subcontractor
 */
export async function notifyBrokerAssignment(subcontractor, oldBrokerEmail = null, isFirstTime = true, assignedPolicies = null) {
  const dashboardLink = createBrokerDashboardLink(subcontractor.broker_name, subcontractor.broker_email);
  const subDashboardLink = createSubcontractorDashboardLink(subcontractor.id);

  // Notify new broker
  if (subcontractor.broker_email) {
    try {
      // Generate login credentials using centralized utility
      const password = generateSecurePassword();
      const frontendBase = getFrontendBaseUrl();
      const loginInfo = formatLoginCredentialsForEmail(
        subcontractor.broker_email, 
        password, 
        frontendBase
      );
      
      await sendEmail({
        to: subcontractor.broker_email,
        subject: `New Subcontractor Assignment - ${subcontractor.company_name}`,
        body: `Dear ${subcontractor.broker_name || 'Insurance Broker'},

You have been assigned as the insurance broker for ${subcontractor.company_name}.

📋 Subcontractor Details:
• Company: ${subcontractor.company_name}
• Contact: ${subcontractor.contact_person || 'N/A'}
• Email: ${subcontractor.email}
• Phone: ${subcontractor.phone || 'N/A'}
• Trade(s): ${subcontractor.trade_types?.join(', ') || 'N/A'}

${loginInfo}

🔗 Access Your Dashboard:
${dashboardLink}

${assignedPolicies && assignedPolicies.length > 0 ? `PER-POLICY ASSIGNMENT:
You have been assigned to manage the following insurance policies for this subcontractor:
${assignedPolicies.map(p => `• ${p}`).join('\n')}

Please log in to your dashboard to view pending COI requests.
You are only responsible for the policies listed above. Other policies may be managed by different brokers.` : isFirstTime ? `FIRST TIME SETUP:
Please log in to your dashboard to view pending Certificate of Insurance (COI) requests.
You will be able to upload the required insurance documents:
✅ ACORD 25 Certificate Form
✅ General Liability (GL) Policy
✅ Workers' Compensation (WC) Policy
✅ Auto Liability Policy
✅ Excess/Umbrella Policy (if required)

After uploading, Certificates of Insurance (COIs) will be automatically generated for each project.` : `RETURNING BROKER:
This subcontractor has previously submitted insurance documents.
You can now review, sign, and approve COIs based on their existing policies through your dashboard.
No need to request new documents unless they need to update coverage.`}

Dashboard Features:
• View all assigned subcontractors
• Approve COIs and upload certificates
• Monitor policy expirations and renewals

The subcontractor has been notified of your assignment.

Best regards,
InsureTrack System`
      });
      
      // Create broker user account using centralized utility
      try {
        const userCredentials = createUserCredentials(
          subcontractor.broker_email,
          subcontractor.broker_name || 'Broker',
          'broker'
        );
        userCredentials.password = password; // Use the same password from email
        await compliant.entities.User.create(userCredentials);
      } catch (_userError) {
        // User may already exist
      }
      
    } catch (error) {
      console.error('❌ Error sending broker notification email:', error);
      throw error; // Re-throw so caller knows it failed
    }
  }

  // Notify old broker if broker was changed
  if (oldBrokerEmail && oldBrokerEmail !== subcontractor.broker_email) {
    try {
      await sendEmail({
        to: oldBrokerEmail,
        subject: `Broker Reassignment - ${subcontractor.company_name}`,
        body: `Dear Insurance Broker,

You have been removed as the insurance broker for ${subcontractor.company_name}.

The subcontractor has been reassigned to a new broker:
• New Broker: ${subcontractor.broker_name || 'N/A'}
• New Broker Email: ${subcontractor.broker_email}

All future COI approvals and policy management will be handled by the new broker.

Best regards,
InsureTrack System`
      });
    } catch (error) {
      console.error('Error sending old broker notification:', error);
    }
  }

  // Notify subcontractor
  if (subcontractor.email) {
    const isChange = !!oldBrokerEmail;
    
    // Generate login credentials for subcontractor
    const baseUrl = getFrontendBaseUrl();
    const password = generateSecurePassword();
    const loginInfo = formatLoginCredentialsForEmail(
      subcontractor.email,
      password,
      baseUrl
    );
    
    try {
      await sendEmail({
        to: subcontractor.email,
        subject: isChange 
          ? `Insurance Broker Updated - ${subcontractor.company_name}`
          : `Insurance Broker Assigned - ${subcontractor.company_name}`,
        body: `Dear ${subcontractor.contact_person || subcontractor.company_name},

${isChange ? 'Your insurance broker has been updated.' : 'An insurance broker has been assigned to your account.'}

📋 Your Broker Information:
• Broker: ${subcontractor.broker_name || 'Insurance Broker'}
• Email: ${subcontractor.broker_email}
• Phone: ${subcontractor.broker_phone || 'N/A'}

${loginInfo}

🔗 Your Dashboard: ${subDashboardLink}

If you have questions about your insurance, please contact your broker directly at ${subcontractor.broker_email}.

Best regards,
InsureTrack System`
      });
      
      // Create subcontractor user account
      try {
        const userCredentials = createUserCredentials(
          subcontractor.email,
          subcontractor.contact_person || subcontractor.company_name,
          'subcontractor',
          { subcontractor_id: subcontractor.id }
        );
        userCredentials.password = password;
        await compliant.entities.User.create(userCredentials);
      } catch (_userError) {
        // User may already exist
      }
      
    } catch (error) {
      console.error('Error sending subcontractor notification:', error);
    }
  }

  // Create portal entries if they don't exist
  try {
    // Check if broker portal exists
    const existingBrokerPortals = await compliant.entities.Portal.filter({ 
      user_email: subcontractor.broker_email,
      user_type: 'broker'
    });

    if (existingBrokerPortals.length === 0) {
      // Generate secure random token using crypto
      const brokerTokenBytes = new Uint8Array(24);
      crypto.getRandomValues(brokerTokenBytes);
      const brokerAccessToken = Array.from(brokerTokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
      
      await compliant.entities.Portal.create({
        user_type: 'broker',
        user_email: subcontractor.broker_email,
        user_name: subcontractor.broker_name || 'Insurance Broker',
        dashboard_url: dashboardLink,
        status: 'active',
        access_token: brokerAccessToken,
      });
    }

    // Check if subcontractor portal exists
    const existingSubPortals = await compliant.entities.Portal.filter({ 
      user_id: subcontractor.id,
      user_type: 'subcontractor'
    });

    if (existingSubPortals.length === 0) {
      // Generate secure random token using crypto
      const subTokenBytes = new Uint8Array(24);
      crypto.getRandomValues(subTokenBytes);
      const subAccessToken = Array.from(subTokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
      
      await compliant.entities.Portal.create({
        user_type: 'subcontractor',
        user_id: subcontractor.id,
        user_email: subcontractor.email,
        user_name: subcontractor.company_name,
        dashboard_url: subDashboardLink,
        status: 'active',
        access_token: subAccessToken,
      });
    }
  } catch (error) {
    console.error('Error creating portal entries:', error);
  }
}

/**
 * Send notification when subcontractor is added to a project
 */
export async function notifySubAddedToProject(subcontractor, project) {
  const brokerGlobalLink = createBrokerUploadLink(subcontractor.id, 'global');
  const brokerPerPolicyLink = createBrokerUploadLink(subcontractor.id, 'per-policy');
  const subEmail = subcontractor.email || subcontractor.contact_email;

  // Notify subcontractor
  if (subEmail) {
    try {
      const hasBroker = !!subcontractor.broker_email;
      const subDashboardLink = createSubcontractorDashboardLink(subcontractor.id);
      
      // Generate login credentials using centralized utility
      const baseUrl = getFrontendBaseUrl();
      const password = generateSecurePassword();
      const loginInfo = formatLoginCredentialsForEmail(
        subEmail, 
        password, 
        baseUrl
      );
      
      const bodyWithLinks = `Dear ${subcontractor.contact_person || subcontractor.company_name},

You have been added to a new construction project!

📋 Project Details:
• Project: ${project.project_name}
• General Contractor: ${project.gc_name}
• Location: ${project.project_address}
• Project ID: ${project.id}

${loginInfo}

Dashboard: ${subDashboardLink}

📌 Next Step (Required):
Add your insurance broker so we can generate your certificates:
• One Broker for All Policies: ${brokerGlobalLink}
• Different Brokers per Policy: ${brokerPerPolicyLink}

After submitting, you'll be redirected to your dashboard.

Best regards,
InsureTrack System`;

      const bodyWithExistingBroker = `Dear ${subcontractor.contact_person || subcontractor.company_name},

You have been added to a new construction project!

    📋 Project Details:
    • Project: ${project.project_name}
    • General Contractor: ${project.gc_name}
    • Location: ${project.project_address}
    • Project ID: ${project.id}

    ✅ Your insurance broker (${subcontractor.broker_email}) is already on file and will handle the certificate for this project. No action is needed from you right now.

    We will notify you when the certificate is approved.

    Best regards,
    InsureTrack System`;

      await sendEmail({
        to: subEmail,
        subject: `Added to Project - ${project.project_name}`,
        body: hasBroker ? bodyWithExistingBroker : bodyWithLinks
      });
      
      // Create subcontractor user account using centralized utility
      try {
        const userCredentials = createUserCredentials(
          subEmail,
          subcontractor.contact_person || subcontractor.company_name,
          'subcontractor',
          { subcontractor_id: subcontractor.id }
        );
        userCredentials.password = password; // Use the same password from email
        await compliant.entities.User.create(userCredentials);
      } catch (_userError) {
        // User may already exist
      }
      
    } catch (error) {
      console.error('Error sending subcontractor project notification:', error);
    }
  }

  // Notify broker(s) - Check for per-policy or global broker setup
  const brokerEmails = [];
  
  // Check if this is a per-policy setup
  if (subcontractor.broker_type === 'per-policy') {
    // Collect all unique broker emails from per-policy assignments
    if (subcontractor.broker_gl_email) brokerEmails.push({ email: subcontractor.broker_gl_email, name: subcontractor.broker_gl_name, policies: ['General Liability (GL)'] });
    if (subcontractor.broker_auto_email && !brokerEmails.find(b => b.email === subcontractor.broker_auto_email)) {
      brokerEmails.push({ email: subcontractor.broker_auto_email, name: subcontractor.broker_auto_name, policies: ['Auto Liability'] });
    } else if (subcontractor.broker_auto_email) {
      brokerEmails.find(b => b.email === subcontractor.broker_auto_email).policies.push('Auto Liability');
    }
    if (subcontractor.broker_wc_email && !brokerEmails.find(b => b.email === subcontractor.broker_wc_email)) {
      brokerEmails.push({ email: subcontractor.broker_wc_email, name: subcontractor.broker_wc_name, policies: ['Workers Compensation (WC)'] });
    } else if (subcontractor.broker_wc_email) {
      brokerEmails.find(b => b.email === subcontractor.broker_wc_email).policies.push('Workers Compensation (WC)');
    }
    if (subcontractor.broker_umbrella_email && !brokerEmails.find(b => b.email === subcontractor.broker_umbrella_email)) {
      brokerEmails.push({ email: subcontractor.broker_umbrella_email, name: subcontractor.broker_umbrella_name, policies: ['Excess/Umbrella'] });
    } else if (subcontractor.broker_umbrella_email) {
      brokerEmails.find(b => b.email === subcontractor.broker_umbrella_email).policies.push('Excess/Umbrella');
    }
  } else if (subcontractor.broker_email) {
    // Global broker setup
    brokerEmails.push({ email: subcontractor.broker_email, name: subcontractor.broker_name, policies: null });
  }
  
  // Notify each broker
  for (const brokerInfo of brokerEmails) {
    const { email: brokerEmail, name: brokerName, policies: assignedPolicies } = brokerInfo;
    try {
      const allProjectSubs = await compliant.entities.ProjectSubcontractor.list();
      const subProjectSubs = allProjectSubs.filter(ps => ps.subcontractor_id === subcontractor.id);
      const isFirstProject = subProjectSubs.length <= 1; // First project (just added, so length is 1)
      // Consider multiple sources for uploaded docs: subcontractor master data OR any GeneratedCOI with files
      let hasUploadedDocs = !!subcontractor.master_insurance_data;
      try {
        const coiForSub = await compliant.entities.GeneratedCOI.filter({ subcontractor_id: subcontractor.id });
        if (Array.isArray(coiForSub) && coiForSub.length > 0) {
          hasUploadedDocs = hasUploadedDocs || coiForSub.some(c => (
            c.first_coi_uploaded || c.first_coi_url || c.gl_policy_url || c.wc_policy_url || c.auto_policy_url || c.umbrella_policy_url
          ));
        }
      } catch (coiCheckError) {
        console.warn('⚠️ Could not check existing COI uploads for subcontractor:', subcontractor.id, coiCheckError?.message || coiCheckError);
      }

      const additionalInsuredList = [];
      if (project.gc_name) {
        additionalInsuredList.push(`Certificate Holder & Additional Insured: ${project.gc_name}${project.project_address ? ` (${project.project_address})` : ''}`);
      }
      if (project.owner_entity) {
        additionalInsuredList.push(`Additional Insured: ${project.owner_entity} (Project Owner)`);
      }
      const extraAIs = Array.isArray(project.additional_insured_entities)
        ? project.additional_insured_entities
        : (typeof project.additional_insured_entities === 'string'
          ? project.additional_insured_entities.split(',').map(s => s.trim()).filter(Boolean)
          : []);
      extraAIs.forEach(ai => additionalInsuredList.push(`Additional Insured: ${ai}`));

      const additionalInsuredText = additionalInsuredList.length > 0
        ? additionalInsuredList.map(ai => `• ${ai}`).join('\n')
        : '• General Contractor (certificate holder & AI)\n• Project Owner (AI, if provided)\n• Any additional insured entities listed in the portal';
      
      const brokerDashboardLink = createBrokerDashboardLink(brokerName, brokerEmail);

      // Compute direct links into broker upload flow for this project
      let directUploadLink = null;
      let directSignLink = null;
      try {
        const coisForProject = await compliant.entities.GeneratedCOI.filter({ project_id: project.id, subcontractor_id: subcontractor.id });
        const activeCoi = Array.isArray(coisForProject) && coisForProject.length > 0 ? coisForProject[0] : null;
        if (activeCoi?.coi_token) {
          const baseUrl = getFrontendBaseUrl();
          directUploadLink = `${baseUrl}/broker-upload-coi?token=${activeCoi.coi_token}&action=upload&step=${(!hasUploadedDocs ? 1 : 2)}`;
          directSignLink = `${baseUrl}/broker-upload-coi?token=${activeCoi.coi_token}&action=sign&step=3`;
        }
      } catch (err) {
        console.error('❌ Error fetching COI for direct links:', err?.message || err);
      }
      
      // Policy-specific messaging for per-policy brokers
      const policySpecificText = assignedPolicies ? `
You are assigned to the following policies for this subcontractor:
${assignedPolicies.map(p => `• ${p}`).join('\n')}

Please upload ONLY the policy documents listed above.` : '';

      await sendEmail({
        to: brokerEmail,
        subject: `Action Required: ${isFirstProject && !hasUploadedDocs ? 'Document Upload & COI for' : 'COI for'} ${subcontractor.company_name} - ${project.project_name}`,
        body: `Dear ${brokerName || 'Insurance Broker'},

Your client ${subcontractor.company_name} has been added to a new project and requires a Certificate of Insurance.

📋 Project Details:
• Project: ${project.project_name}
• General Contractor: ${project.gc_name}
• Location: ${project.project_address}
• Trade(s): ${subcontractor.trade_types?.join(', ') || 'NA'}
• Project ID: ${project.id}
${policySpecificText}

📄 COI Details (Pre-Populated by System):
• Certificate Holder: ${additionalInsuredList[0] || 'N/A'}
• Certificate Holder Location: ${project.project_address}
• Additional Insureds: ${additionalInsuredText}
• Project Location: ${project.project_address}

The system has already updated the ACORD 25 with the project details above. Please review for accuracy and sign to activate.

🔗 Access Your Dashboard:
${brokerDashboardLink}

${isFirstProject && !hasUploadedDocs ? `FIRST TIME - DOCUMENT UPLOAD REQUIRED:
✅ Step 1: Upload Initial Insurance Documents
${assignedPolicies ? `Please upload your assigned policy documents:
${assignedPolicies.map(p => `• ${p} Policy Document`).join('\n')}` : `Please upload your client's insurance policies:
• ACORD 25 Certificate Form
• General Liability (GL) Policy
• Workers' Compensation (WC) Policy
• Auto Liability Policy
• Excess/Umbrella Policy (if required)`}

Direct upload for this project:
${directUploadLink || brokerDashboardLink}

✅ Step 2: Review Auto-Generated COI
Once uploaded, we'll automatically generate a Certificate of Insurance based on the policies.

✅ Step 3: Approve and Submit
Review the generated COI and approve it to activate for this project.` : `RETURNING BROKER - COI GENERATION:
Your client's insurance documents are already on file.
Please review and approve the auto-generated COI for this project.

Review & Sign directly for this project:
${directSignLink || brokerDashboardLink}

You can view the draft certificate in your dashboard.`}

Questions? Reply to this email.

Best regards,
InsureTrack System`
      });
      
    } catch (error) {
      console.error('❌ Error sending broker project notification:', error);
      console.error('   Error details:', error.message, error.stack);
      // Don't throw - continue to notify other brokers
    }
  }
  
  if (brokerEmails.length === 0) {
    console.warn('⚠️ No broker email found for subcontractor:', subcontractor.company_name);
  }
}

/**
 * Send notification when COI is generated and needs broker approval
 */
export async function notifyBrokerCOIPending(coi, subcontractor, project) {
  const brokerDashboardLink = createBrokerDashboardLink(subcontractor.broker_name, subcontractor.broker_email);

  if (subcontractor.broker_email) {
    try {
      const baseUrl = getFrontendBaseUrl();
      const signLink = coi?.coi_token ? `${baseUrl}/broker-upload-coi?token=${coi.coi_token}&action=sign&step=3` : brokerDashboardLink;
      await sendEmail({
        to: subcontractor.broker_email,
        subject: `COI Approval Required - ${subcontractor.company_name}`,
        body: `Dear ${subcontractor.broker_name || 'Insurance Broker'},

A Certificate of Insurance has been auto-generated and requires your review and approval.

📋 Details:
• Subcontractor: ${subcontractor.company_name}
• Project: ${project.project_name}
• General Contractor: ${project.gc_name}

✍️ Review & Sign:
${signLink}

The COI was generated from the insurance policies on file. Please review for accuracy and approve to activate.

Best regards,
InsureTrack System`
      });
    } catch (error) {
      console.error('Error sending COI pending notification:', error);
    }
  }
}

/**
 * Send notification when broker approves COI
 */
export async function notifySubCOIApproved(coi, subcontractor, project) {
  const baseUrl = getFrontendBaseUrl();
  const subDashboardLink = `${baseUrl}/subcontractor-dashboard?id=${subcontractor.id}`;

  if (subcontractor.email) {
    try {
      await sendEmail({
        to: subcontractor.email,
        subject: `COI Approved - ${project.project_name}`,
        body: `Dear ${subcontractor.contact_person || subcontractor.company_name},

Your Certificate of Insurance for ${project.project_name} has been approved by your broker!

📋 Certificate Details:
• Project: ${project.project_name}
• General Contractor: ${project.gc_name}
• GL Coverage: $${coi.gl_coverage_amount?.toLocaleString() || 'N/A'}
• Approved by: ${subcontractor.broker_name || subcontractor.broker_email}

🔗 View Certificate:
${coi.pdf_url || subDashboardLink}

You are now cleared to work on this project.

Best regards,
InsureTrack System`
      });
    } catch (error) {
      console.error('Error sending COI approved notification:', error);
    }
  }
}
