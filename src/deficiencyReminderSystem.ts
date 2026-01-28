/**
 * Deficiency Reminder System
 * Sends automated reminders to brokers every 2 days for pending deficiencies
 * Runs checks periodically and tracks last reminder sent
 */

import { compliant } from "@/api/compliantClient";
import { sendEmail } from "@/emailHelper";
import { getToken } from "@/auth";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface GeneratedCOI {
  id: string;
  coi_token?: string;
  status?: string;
  subcontractor_name?: string;
  broker_email?: string;
  broker_name?: string;
  broker_company?: string;
  project_id?: string;
  deficiency_sent_date?: string;
  deficiency_message?: string;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  project_name?: string;
  project_address?: string;
  gc_name?: string;
  [key: string]: unknown;
}

export interface Broker {
  broker_email?: string;
  broker_name?: string;
  broker_company?: string;
}

export interface ReminderTracker {
  [coiId: string]: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REMINDER_INTERVAL_HOURS = 48; // 2 days
const STORAGE_KEY = 'deficiency_reminders_tracker';

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Track when a reminder was last sent for a specific COI
 */
function getLastReminderDate(coiId: string): Date | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const tracker: ReminderTracker = JSON.parse(stored);
    return tracker[coiId] ? new Date(tracker[coiId]) : null;
  } catch (err) {
    console.error('Failed to get last reminder date', err);
    return null;
  }
}

/**
 * Update when a reminder was last sent
 */
function updateLastReminderDate(coiId: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || '{}';
    const tracker: ReminderTracker = JSON.parse(stored);
    tracker[coiId] = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracker));
  } catch (err) {
    console.error('Failed to update last reminder date', err);
  }
}

/**
 * Check if a reminder should be sent for a COI
 */
function shouldSendReminder(coiId: string): boolean {
  const lastReminder = getLastReminderDate(coiId);
  if (!lastReminder) return true; // First time, send reminder

  const hoursSinceLastReminder = (new Date().getTime() - lastReminder.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastReminder >= REMINDER_INTERVAL_HOURS;
}

/**
 * Send a reminder email for a pending deficiency
 */
async function sendDeficiencyReminder(
  coi: GeneratedCOI,
  project: Project,
  broker: Broker
): Promise<void> {
  try {
    if (!shouldSendReminder(coi.id)) {
      return;
    }

    const brokerUploadLink = `${window.location.origin}/broker-upload-coi?token=${coi.coi_token}&step=2&action=upload`;
    const brokerDashboardLink = `${window.location.origin}/broker-dashboard?email=${encodeURIComponent(broker.broker_email || '')}&coiId=${coi.id}`;
    const daysOverdue = coi.deficiency_sent_date 
      ? Math.floor((new Date().getTime() - new Date(coi.deficiency_sent_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    await sendEmail({
      to: broker.broker_email!,
      subject: `⏰ REMINDER: COI Corrections Needed - ${coi.subcontractor_name} (${project.project_name})`,
      body: `REMINDER: Your corrected Certificate of Insurance is still needed.

This is a reminder that corrections were requested ${daysOverdue} day(s) ago.

SUBCONTRACTOR:
• Company: ${coi.subcontractor_name}

PROJECT:
• Project: ${project.project_name}
• Location: ${project.project_address}
• General Contractor: ${project.gc_name}

DEFICIENCIES IDENTIFIED:
${coi.deficiency_message || 'See details below'}

ACTION REQUIRED:
Please submit corrections using one of these options:

OPTION 1: Upload Updated Supporting Documents
${brokerUploadLink}

OPTION 2: Access Your Broker Dashboard
${brokerDashboardLink}

TIMELINE:
Corrections are needed as soon as possible. Without these corrections, the subcontractor will be marked non-compliant for this project.

ESCALATION:
If you have questions or need clarification on the required corrections, please reply to this email immediately.

Best regards,
InsureTrack System`,
    });

    updateLastReminderDate(coi.id);
  } catch (err) {
    console.error('Failed to send deficiency reminder', err);
  }
}

/**
 * Scan all pending deficiency COIs and send reminders as needed
 */
export async function checkAndSendDeficiencyReminders(): Promise<void> {
  try {
    // Check if user is authenticated before making API calls
    const token = getToken();
    if (!token) {
      // User is not authenticated, skip check silently
      return;
    }

    // Fetch all COIs with deficiency_pending status
    const allCOIs = await compliant.entities.GeneratedCOI.list() as GeneratedCOI[];
    const pendingDeficiencies = allCOIs.filter((c: GeneratedCOI) => c.status === 'deficiency_pending');

    if (pendingDeficiencies.length === 0) {
      return;
    }


    // Process each pending deficiency
    for (const coi of pendingDeficiencies) {
      try {
        // Fetch projects and find the matching one
        const projects = await compliant.entities.Project.list() as Project[];
        const project = projects.find((p: Project) => p.id === coi.project_id);
        if (!project) continue;

        // Get broker info
        const broker = {
          broker_email: coi.broker_email,
          broker_name: coi.broker_name,
          broker_company: coi.broker_company,
        };

        if (broker.broker_email) {
          await sendDeficiencyReminder(coi, project, broker);
        }
      } catch (err) {
        console.error(`Failed to process deficiency reminder for COI ${coi.id}`, err);
      }
    }

  } catch (err: any) {
    // Handle authentication errors gracefully
    if (err.status === 401 || err.status === 403 || err.message?.includes('Unauthorized') || err.message?.includes('expired token')) {
      // Authentication error - skip check silently
      // This is expected when token expires or user is not logged in
      return;
    }
    // Log other errors
    console.error('Error in deficiency reminder check', err);
  }
}

/**
 * Initialize periodic reminders
 * Call this once when the app starts (e.g., in main.jsx or AdminDashboard)
 */
export function initDeficiencyReminderSystem(): ReturnType<typeof setInterval> | undefined {
  if (typeof window === 'undefined') return;

  // Check immediately
  checkAndSendDeficiencyReminders();

  // Then check every 6 hours (can catch missed 2-day windows)
  const intervalId = setInterval(() => {
    checkAndSendDeficiencyReminders();
  }, 6 * 60 * 60 * 1000); // 6 hours in milliseconds

  // Cleanup on unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      clearInterval(intervalId);
    });
  }

  return intervalId;
}

export default {
  checkAndSendDeficiencyReminders,
  initDeficiencyReminderSystem,
  shouldSendReminder,
  getLastReminderDate,
};
