import { apiClient } from "@/api/apiClient";
import { sendEmail } from "@/emailHelper";
import { calculateDaysUntilExpiry } from "@/utils/dateCalculations";
import { calculateUrgency, formatTimeframe, sendEmailWithErrorHandling } from "@/utils/notificationUtils";
import { EMAIL_SIGNATURE, formatInsuranceType, createEmailGreeting, buildEmailSubject } from "@/utils/emailTemplates";
import type { InsuranceDocument, Subcontractor } from '@/notification-types';

/**
 * Send expiring policy notifications to broker and subcontractor
 * Called on a schedule (e.g., daily) to check for expiring policies
 */
export async function checkAndNotifyExpiringPolicies(): Promise<void> {
  try {
    const documents = await apiClient.entities.InsuranceDocument.list();
    
    // Define notification thresholds (days before expiry)
    const notificationThresholds = [30, 14, 7, 0]; // Day-of-expiry is also included
    
    for (const doc of documents) {
      if (!doc.policy_expiration_date) continue;
      
      const daysUntilExpiry = calculateDaysUntilExpiry(doc.policy_expiration_date);
      
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
async function notifyBrokerPolicyExpiring(
  document: InsuranceDocument,
  subcontractor: Subcontractor,
  daysUntilExpiry: number
): Promise<void> {
  const urgency = calculateUrgency(daysUntilExpiry);
  const timeframe = formatTimeframe(daysUntilExpiry);
  const subject = buildEmailSubject(`Policy Expiring ${timeframe} - ${subcontractor.company_name}`, urgency);
  
  await sendEmailWithErrorHandling({
    to: subcontractor.broker_email,
    subject,
    body: `${createEmailGreeting('broker', subcontractor.broker_name)}

A policy for your client ${subcontractor.company_name} is expiring ${timeframe}.

📋 Policy Details:
• Policy Type: ${formatInsuranceType(document.insurance_type)}
• Policy Number: ${document.policy_number}
• Expiration Date: ${new Date(document.policy_expiration_date).toLocaleDateString()}
• Subcontractor: ${subcontractor.company_name}

⚠️ ${urgency} ACTION REQUIRED:
Please contact your client to renew this policy before the expiration date to avoid coverage gaps.

${subcontractor.email ? `📧 Subcontractor Email: ${subcontractor.email}` : ''}
${subcontractor.phone ? `📞 Subcontractor Phone: ${subcontractor.phone}` : ''}

Once renewed, please upload the updated policy document to keep coverage current.

${EMAIL_SIGNATURE}`
  }, 'broker policy expiry notification', sendEmail);
}

/**
 * Notify subcontractor about expiring policy
 */
async function notifySubPolicyExpiring(
  document: InsuranceDocument,
  subcontractor: Subcontractor,
  daysUntilExpiry: number
): Promise<void> {
  const urgency = calculateUrgency(daysUntilExpiry);
  const timeframe = formatTimeframe(daysUntilExpiry);
  const subject = buildEmailSubject(`Insurance Policy Expiring ${timeframe}`, urgency);
  
  await sendEmailWithErrorHandling({
    to: subcontractor.email,
    subject,
    body: `${createEmailGreeting('subcontractor', subcontractor.contact_person || subcontractor.company_name)}

Your ${formatInsuranceType(document.insurance_type)} policy is expiring ${timeframe}.

📋 Policy Details:
• Policy Type: ${formatInsuranceType(document.insurance_type)}
• Policy Number: ${document.policy_number}
• Expiration Date: ${new Date(document.policy_expiration_date).toLocaleDateString()}

⚠️ ${urgency} ACTION REQUIRED:
Contact your insurance broker to renew this policy immediately to avoid any coverage gaps that could impact your projects.

📞 Your Broker:
${subcontractor.broker_name ? `Name: ${subcontractor.broker_name}` : ''}
${subcontractor.broker_email ? `Email: ${subcontractor.broker_email}` : ''}
${subcontractor.broker_phone ? `Phone: ${subcontractor.broker_phone}` : ''}

Once your policy is renewed, your broker will upload the new policy document to keep you compliant with all project requirements.

${EMAIL_SIGNATURE}`
  }, 'subcontractor policy expiry notification', sendEmail);
}

/**
 * Get summary of expiring policies for dashboard display
 */
export async function getExpiringPoliciesSummary() {
  try {
    const documents = await apiClient.entities.InsuranceDocument.list();
    
    const upcoming = {
      expiringToday: [],
      expiringWeek: [],
      expiringMonth: [],
    };
    
    for (const doc of documents) {
      if (!doc.policy_expiration_date) continue;
      
      const daysUntilExpiry = calculateDaysUntilExpiry(doc.policy_expiration_date);
      
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
