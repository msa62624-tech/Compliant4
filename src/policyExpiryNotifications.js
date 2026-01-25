import { apiClient } from "@/api/apiClient";
import { sendEmail } from "@/emailHelper";



/**
 * Send expiring policy notifications to broker and subcontractor
 * Called on a schedule (e.g., daily) to check for expiring policies
 */
export async function checkAndNotifyExpiringPolicies() {
  try {
    const today = new Date();
    const documents = await apiClient.entities.InsuranceDocument.list();
    
    // Define notification thresholds (days before expiry)
    const notificationThresholds = [30, 14, 7, 0]; // Day-of-expiry is also included
    
    for (const doc of documents) {
      if (!doc.policy_expiration_date) continue;
      
      const expiryDate = new Date(doc.policy_expiration_date);
      const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
      
      // Check if this policy should be notified
      if (notificationThresholds.includes(daysUntilExpiry)) {
        // Get subcontractor info
        const subcontractor = await apiClient.entities.Contractor.read(doc.contractor_id);
        
        if (subcontractor?.broker_email) {
          await notifyBrokerPolicyExpiring(doc, subcontractor, daysUntilExpiry);
        }
        
        if (subcontractor?.email) {
          await notifySubPolicyExpiring(doc, subcontractor, daysUntilExpiry);
        }
        
        // Mark notification as sent (add to notification history if tracking needed)
        // This prevents duplicate notifications for same policy/day combo
      }
    }
  } catch (error) {
    console.error('Error checking expiring policies:', error);
  }
}

/**
 * Notify broker about expiring policy
 */
async function notifyBrokerPolicyExpiring(document, subcontractor, daysUntilExpiry) {
  const urgency = daysUntilExpiry <= 0 ? 'URGENT' : daysUntilExpiry <= 7 ? 'HIGH' : 'STANDARD';
  const timeframe = daysUntilExpiry === 0 ? 'TODAY' : `in ${daysUntilExpiry} days`;
  
  try {
    await sendEmail({
      to: subcontractor.broker_email,
      subject: `${urgency}: Policy Expiring ${timeframe} - ${subcontractor.company_name}`,
      body: `Dear ${subcontractor.broker_name || 'Insurance Broker'},

A policy for your client ${subcontractor.company_name} is expiring ${timeframe}.

📋 Policy Details:
• Policy Type: ${document.insurance_type}
• Policy Number: ${document.policy_number}
• Expiration Date: ${new Date(document.policy_expiration_date).toLocaleDateString()}
• Subcontractor: ${subcontractor.company_name}

⚠️ ${urgency} ACTION REQUIRED:
Please contact your client to renew this policy before the expiration date to avoid coverage gaps.

${subcontractor.email ? `📧 Subcontractor Email: ${subcontractor.email}` : ''}
${subcontractor.phone ? `📞 Subcontractor Phone: ${subcontractor.phone}` : ''}

Once renewed, please upload the updated policy document to keep coverage current.

Best regards,
InsureTrack System`
    });
  } catch (error) {
    console.error('Error sending broker policy expiry notification:', error);
  }
}

/**
 * Notify subcontractor about expiring policy
 */
async function notifySubPolicyExpiring(document, subcontractor, daysUntilExpiry) {
  const urgency = daysUntilExpiry <= 0 ? 'URGENT' : daysUntilExpiry <= 7 ? 'HIGH' : 'STANDARD';
  const timeframe = daysUntilExpiry === 0 ? 'TODAY' : `in ${daysUntilExpiry} days`;
  
  try {
    await sendEmail({
      to: subcontractor.email,
      subject: `${urgency}: Insurance Policy Expiring ${timeframe}`,
      body: `Dear ${subcontractor.contact_person || subcontractor.company_name},

Your ${document.insurance_type.replace(/_/g, ' ')} policy is expiring ${timeframe}.

📋 Policy Details:
• Policy Type: ${document.insurance_type.replace(/_/g, ' ')}
• Policy Number: ${document.policy_number}
• Expiration Date: ${new Date(document.policy_expiration_date).toLocaleDateString()}

⚠️ ${urgency} ACTION REQUIRED:
Contact your insurance broker to renew this policy immediately to avoid any coverage gaps that could impact your projects.

📞 Your Broker:
${subcontractor.broker_name ? `Name: ${subcontractor.broker_name}` : ''}
${subcontractor.broker_email ? `Email: ${subcontractor.broker_email}` : ''}
${subcontractor.broker_phone ? `Phone: ${subcontractor.broker_phone}` : ''}

Once your policy is renewed, your broker will upload the new policy document to keep you compliant with all project requirements.

Best regards,
InsureTrack System`
    });
  } catch (error) {
    console.error('Error sending subcontractor policy expiry notification:', error);
  }
}

/**
 * Get summary of expiring policies for dashboard display
 */
export async function getExpiringPoliciesSummary() {
  try {
    const today = new Date();
    const documents = await apiClient.entities.InsuranceDocument.list();
    
    const upcoming = {
      expiringToday: [],
      expiringWeek: [],
      expiringMonth: [],
    };
    
    for (const doc of documents) {
      if (!doc.policy_expiration_date) continue;
      
      const expiryDate = new Date(doc.policy_expiration_date);
      const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry < 0) {
        // Policy already expired
        continue;
      } else if (daysUntilExpiry === 0) {
        upcoming.expiringToday.push(doc);
      } else if (daysUntilExpiry <= 7) {
        upcoming.expiringWeek.push(doc);
      } else if (daysUntilExpiry <= 30) {
        upcoming.expiringMonth.push(doc);
      }
    }
    
    return upcoming;
  } catch (error) {
    console.error('Error getting expiring policies summary:', error);
    return { expiringToday: [], expiringWeek: [], expiringMonth: [] };
  }
}
