import { useState, useMemo } from "react";
import { apiClient } from "@/api/apiClient";
import { sendEmail } from "@/emailHelper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, AlertTriangle, Mail, CheckCircle2, XCircle, Clock, Bell, TrendingUp, Activity, BarChart3, Eye } from "lucide-react";
import { differenceInDays, addDays, format, startOfMonth, subMonths, eachMonthOfInterval, isWithinInterval, endOfMonth } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function PolicyRenewalSystem() {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLog, setProcessingLog] = useState([]);

  const { data: allCOIs = [] } = useQuery({
    queryKey: ['all-active-cois'],
    queryFn: async () => {
      const cois = await apiClient.entities.GeneratedCOI.list();
      return cois.filter(c => c.first_coi_uploaded || c.status === 'awaiting_broker_info' || c.status === 'awaiting_broker_upload');
    },
  });

  const { data: allProjectSubs = [] } = useQuery({
    queryKey: ['all-project-subs-for-renewal'],
    queryFn: () => apiClient.entities.ProjectSubcontractor.list(),
  });

  const updateCOIMutation = useMutation({
    mutationFn: ({ id, data }) => apiClient.entities.GeneratedCOI.update(id, data),
  });

  const updateProjectSubMutation = useMutation({
    mutationFn: ({ id, data }) => apiClient.entities.ProjectSubcontractor.update(id, data),
  });

  const addLog = (message, type = 'info') => {
    setProcessingLog(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
  };

  const processExpiringPolicies = async () => {
    addLog('Processing expiring policies...', 'info');
    const today = new Date();
    let count30Day = 0, count14Day = 0, count5Day = 0, countExpired = 0, countGraceExpired = 0;

    for (const coi of allCOIs) {
      if (!coi.first_coi_uploaded) continue;

      try {
        const expirationDates = [
          coi.gl_expiration_date,
          coi.umbrella_expiration_date,
          coi.wc_expiration_date,
          coi.auto_expiration_date
        ].filter(Boolean).map(d => new Date(d));

        if (expirationDates.length === 0) continue;

        const nearestExpiration = new Date(Math.min(...expirationDates));
        const daysUntilExpiry = differenceInDays(nearestExpiration, today);

        const activeProjects = allProjectSubs.filter(
          ps => ps.subcontractor_name === coi.subcontractor_name &&
          ps.compliance_status !== 'non_compliant'
        );

        if (activeProjects.length === 0) continue;

        // 30-DAY REMINDER
        if (daysUntilExpiry === 30 && !coi.renewal_30day_sent) {
          addLog(`📧 30-day reminder: ${coi.subcontractor_name}`, 'info');

          if (coi.broker_email) {
            await sendEmail({
              to: coi.broker_email,
              subject: `Insurance Renewal Reminder (30 Days) - ${coi.subcontractor_name}`,
              body: `Dear ${coi.broker_name || 'Insurance Professional'},

This is a friendly reminder that insurance policies for ${coi.subcontractor_name} will expire in 30 DAYS.

📅 EXPIRATION DATE: ${format(nearestExpiration, 'MMMM d, yyyy')}

Active Projects (${activeProjects.length}):
${activeProjects.map(p => `• ${p.project_name} - ${p.gc_name}`).join('\n')}

ACTION REQUIRED:
Please begin the renewal process and upload updated certificates once available.

Upload Portal: ${window.location.origin}/broker-portal?email=${encodeURIComponent(coi.broker_email)}

You will receive additional reminders at 14 days and 5 days before expiration.

Thank you,
InsureTrack Renewal System`
            });
          }

          if (coi.contact_email) {
            const verificationLink = `${window.location.origin}/broker-verification?coiId=${coi.id}`;
            await sendEmail({
              to: coi.contact_email,
              subject: `Insurance Renewal Reminder - 30 Days Until Expiration`,
              body: `Dear ${coi.subcontractor_name},

This is a reminder that your insurance policies will expire in 30 days (${format(nearestExpiration, 'MMMM d, yyyy')}).

You are currently working on ${activeProjects.length} active project(s):
${activeProjects.map(p => `• ${p.project_name}`).join('\n')}

ACTION REQUIRED:
1. Verify your broker information: ${verificationLink}
2. Contact your insurance broker to begin the renewal process:
   📞 ${coi.broker_company || 'Your Broker'}
   📧 ${coi.broker_email || 'Contact your broker'}

Your broker will upload the renewed policies directly to our system.

Best regards,
InsureTrack Team`
            });
          }

          await updateCOIMutation.mutateAsync({
            id: coi.id,
            data: { 
              renewal_30day_sent: true,
              renewal_30day_sent_date: new Date().toISOString(),
              broker_verified_at_renewal: false  // Reset verification flag for new renewal cycle
            }
          });
          count30Day++;
        }

        // 14-DAY REMINDER
        if (daysUntilExpiry === 14 && !coi.renewal_14day_sent) {
          addLog(`📧 14-day reminder: ${coi.subcontractor_name}`, 'warning');

          if (coi.broker_email) {
            await sendEmail({
              to: coi.broker_email,
              subject: `⚠️ IMPORTANT: Insurance Renewal Due in 14 Days - ${coi.subcontractor_name}`,
              body: `IMPORTANT RENEWAL NOTICE

Insurance policies for ${coi.subcontractor_name} will expire in 14 DAYS.

📅 EXPIRATION DATE: ${format(nearestExpiration, 'MMMM d, yyyy')}

Active Projects (${activeProjects.length}):
${activeProjects.map(p => `• ${p.project_name} - ${p.gc_name}`).join('\n')}

⏰ URGENT ACTION REQUIRED:
Please expedite the renewal process and upload renewed certificates as soon as possible.

Upload Portal: ${window.location.origin}/broker-portal?email=${encodeURIComponent(coi.broker_email)}

⚠️ If policies are not renewed by the expiration date, a 7-day grace period will begin, after which the subcontractor will be marked NON-COMPLIANT and prohibited from working.

Thank you for your prompt attention,
InsureTrack Renewal System`
            });
          }

          if (coi.contact_email) {
            const verificationLink = `${window.location.origin}/broker-verification?coiId=${coi.id}`;
            await sendEmail({
              to: coi.contact_email,
              subject: `⚠️ URGENT: Insurance Expires in 14 Days - Action Required`,
              body: `⚠️ URGENT RENEWAL NOTICE

Your insurance policies will expire in 14 DAYS (${format(nearestExpiration, 'MMMM d, yyyy')}).

Active Projects (${activeProjects.length}):
${activeProjects.map(p => `• ${p.project_name}`).join('\n')}

⏰ IMMEDIATE ACTION:
1. Verify your broker information: ${verificationLink}
2. Contact your broker IMMEDIATELY: ${coi.broker_company || 'Your Broker'} (${coi.broker_email})

⚠️ WARNING: If your policies are not renewed by the expiration date, you will enter a 7-day grace period. After that, you will be marked NON-COMPLIANT and unable to work on any projects.

Please ensure your broker uploads the renewed policies promptly.

InsureTrack Team`
            });
          }

          await updateCOIMutation.mutateAsync({
            id: coi.id,
            data: { 
              renewal_14day_sent: true,
              renewal_14day_sent_date: new Date().toISOString()
            }
          });
          count14Day++;
        }

        // 5-DAY CRITICAL REMINDER
        if (daysUntilExpiry === 5 && !coi.renewal_notification_sent && coi.status === 'active') {
          addLog(`🚨 5-day CRITICAL reminder: ${coi.subcontractor_name}`, 'error');

          if (coi.broker_email) {
            await sendEmail({
              to: coi.broker_email,
              subject: `🚨 CRITICAL: Policy Expires in 5 DAYS - ${coi.subcontractor_name}`,
              body: `🚨 CRITICAL RENEWAL NOTICE 🚨

Insurance policies for ${coi.subcontractor_name} will expire in 5 DAYS.

📅 EXPIRATION DATE: ${format(nearestExpiration, 'MMMM d, yyyy')}

Active Projects (${activeProjects.length}):
${activeProjects.map(p => `• ${p.project_name} - ${p.gc_name}`).join('\n')}

🚨 CRITICAL ACTION REQUIRED:
Upload renewed policies IMMEDIATELY: ${window.location.origin}/broker-portal?email=${encodeURIComponent(coi.broker_email)}

⚠️ CONSEQUENCES IF NOT RENEWED:
• Day of Expiration: 7-day grace period begins
• 7 days after expiration: Marked NON-COMPLIANT
• Work prohibited on ALL projects
• Cannot be added to new projects

This is your FINAL reminder before expiration.

URGENT ATTENTION REQUIRED
InsureTrack Compliance System`
            });
          }

          if (coi.contact_email) {
            const verificationLink = `${window.location.origin}/broker-verification?coiId=${coi.id}`;
            await sendEmail({
              to: coi.contact_email,
              subject: `🚨 CRITICAL: Insurance Expires in 5 Days - Immediate Action Required`,
              body: `🚨 FINAL RENEWAL WARNING 🚨

Your insurance policies will expire in 5 DAYS (${format(nearestExpiration, 'MMMM d, yyyy')}).

Active Projects (${activeProjects.length}):
${activeProjects.map(p => `• ${p.project_name}`).join('\n')}

⏰ CRITICAL ACTION:
1. Verify your broker information: ${verificationLink}
2. Contact your broker IMMEDIATELY:
   📞 ${coi.broker_company || 'Your Broker'}
   📧 ${coi.broker_email}

⚠️ FINAL WARNING:
If your policies expire without renewal:
• 7-day grace period begins
• After grace period: WORK STOPPAGE on all projects
• Marked NON-COMPLIANT

This is your LAST reminder before expiration.

InsureTrack Team`
            });
          }

          await updateCOIMutation.mutateAsync({
            id: coi.id,
            data: {
              renewal_notification_sent: true,
              renewal_notification_date: new Date().toISOString(),
              status: 'expiring_soon'
            }
          });
          count5Day++;
        }

        // EXPIRED - GRACE PERIOD
        if (daysUntilExpiry < 0 && daysUntilExpiry >= -1 && coi.status !== 'expired' && coi.status !== 'pending_renewal') {
          addLog(`⛔ Policy EXPIRED: ${coi.subcontractor_name} - Grace period activated`, 'error');

          const gracePeriodExpiry = addDays(nearestExpiration, 7);

          await updateCOIMutation.mutateAsync({
            id: coi.id,
            data: {
              status: 'expired',
              grace_period_expiry: gracePeriodExpiry.toISOString().split('T')[0]
            }
          });

          for (const ps of activeProjects) {
            await updateProjectSubMutation.mutateAsync({
              id: ps.id,
              data: { compliance_status: 'pending_renewal' }
            });
          }

          if (coi.broker_email) {
            await sendEmail({
              to: coi.broker_email,
              subject: `⛔ POLICY EXPIRED - 7-Day Grace Period - ${coi.subcontractor_name}`,
              body: `⛔ CRITICAL NOTICE - POLICY EXPIRED ⛔

The insurance policies for ${coi.subcontractor_name} have EXPIRED as of ${format(nearestExpiration, 'MMMM d, yyyy')}.

🕐 GRACE PERIOD: 7 days (until ${format(gracePeriodExpiry, 'MMMM d, yyyy')})

Affected Projects (${activeProjects.length}):
${activeProjects.map(p => `• ${p.project_name} - ${p.gc_name}`).join('\n')}

⚠️ IMMEDIATE ACTION REQUIRED:
Upload renewed policies NOW: ${window.location.origin}/broker-portal?email=${encodeURIComponent(coi.broker_email)}

⛔ IF NOT RENEWED WITHIN 7 DAYS:
✗ ${coi.subcontractor_name} will be marked NON-COMPLIANT
✗ Work prohibited on all projects
✗ Immediate work stoppage
✗ Cannot be added to new projects

Upload renewed policies immediately to avoid compliance issues.

CRITICAL - IMMEDIATE ACTION REQUIRED
InsureTrack Compliance System`
            });
          }

          if (coi.contact_email) {
            await sendEmail({
              to: coi.contact_email,
              subject: `⛔ YOUR INSURANCE HAS EXPIRED - 7-Day Grace Period`,
              body: `⛔ POLICY EXPIRED - GRACE PERIOD ACTIVE ⛔

Your insurance policies EXPIRED on ${format(nearestExpiration, 'MMMM d, yyyy')}.

🕐 YOU HAVE 7 DAYS TO RENEW (until ${format(gracePeriodExpiry, 'MMMM d, yyyy')})

Affected Projects (${activeProjects.length}):
${activeProjects.map(p => `• ${p.project_name}`).join('\n')}

⚠️ CRITICAL ACTION:
Contact your broker IMMEDIATELY:
📞 ${coi.broker_company}
📧 ${coi.broker_email}

⛔ IF NOT RENEWED WITHIN 7 DAYS:
✗ WORK STOPPAGE on all projects
✗ Marked NON-COMPLIANT
✗ Unable to work until policies are renewed

Contact your broker NOW to upload renewed policies.

CRITICAL - IMMEDIATE ACTION REQUIRED
InsureTrack Team`
            });
          }

          countExpired++;
        }

        // GRACE PERIOD EXPIRED - NON-COMPLIANT
        if (coi.grace_period_expiry) {
          const gracePeriodDate = new Date(coi.grace_period_expiry);
          const graceDaysLeft = differenceInDays(gracePeriodDate, today);

          if (graceDaysLeft < 0 && coi.status !== 'pending_renewal' && !coi.marked_non_compliant_date) {
            addLog(`⛔ Grace period expired: ${coi.subcontractor_name} - MARKING NON-COMPLIANT`, 'error');

            await updateCOIMutation.mutateAsync({
              id: coi.id,
              data: {
                status: 'pending_renewal',
                marked_non_compliant_date: new Date().toISOString(),
                is_sub_deactivated: true
              }
            });

            for (const ps of activeProjects) {
              await updateProjectSubMutation.mutateAsync({
                id: ps.id,
                data: { compliance_status: 'non_compliant' }
              });
            }

            if (coi.broker_email) {
              await sendEmail({
                to: coi.broker_email,
                subject: `⛔ FINAL NOTICE: ${coi.subcontractor_name} - MARKED NON-COMPLIANT`,
                body: `⛔ NON-COMPLIANT STATUS - WORK PROHIBITED ⛔

${coi.subcontractor_name} has been marked NON-COMPLIANT due to expired insurance.

Grace period expired: ${format(gracePeriodDate, 'MMMM d, yyyy')}

CONSEQUENCES IN EFFECT:
✗ Work prohibited on ALL projects
✗ Access to job sites suspended
✗ Cannot be added to new projects

Affected Projects (${activeProjects.length}):
${activeProjects.map(p => `• ${p.project_name} - ${p.gc_name}`).join('\n')}

TO RESTORE COMPLIANCE:
Upload renewed policies immediately: ${window.location.origin}/broker-portal?email=${encodeURIComponent(coi.broker_email)}

Once renewed policies are uploaded and approved, compliance will be restored and work can resume.

FINAL NOTICE
InsureTrack Compliance System`
              });
            }

            if (coi.contact_email) {
              await sendEmail({
                to: coi.contact_email,
                subject: `⛔ WORK STOPPAGE: NON-COMPLIANT - Insurance Expired`,
                body: `⛔ WORK STOPPAGE NOTICE ⛔

${coi.subcontractor_name} has been marked NON-COMPLIANT due to expired insurance policies.

EFFECTIVE IMMEDIATELY:
✗ WORK PROHIBITED on all projects
✗ No access to job sites
✗ Cannot be added to new projects

Affected Projects (${activeProjects.length}):
${activeProjects.map(p => `• ${p.project_name}`).join('\n')}

TO RESUME WORK:
Contact your broker IMMEDIATELY to renew policies:
📞 ${coi.broker_company}
📧 ${coi.broker_email}

Your broker must upload the renewed policies to restore your compliance status.

WORK STOPPAGE IN EFFECT
InsureTrack Team`
              });
            }

            countGraceExpired++;
          }
        }

      } catch (error) {
        addLog(`Error processing ${coi.subcontractor_name}: ${error.message}`, 'error');
      }
    }

    return { count30Day, count14Day, count5Day, countExpired, countGraceExpired };
  };

  const processMissingCOIs = async () => {
    addLog('Checking for missing COIs...', 'info');
    const today = new Date();
    let remindersSent = 0;

    // Find subs on active projects without uploaded COIs
    const missingCOIs = allCOIs.filter(coi => 
      !coi.first_coi_uploaded &&
      (coi.status === 'awaiting_broker_info' || coi.status === 'awaiting_broker_upload')
    );

    for (const coi of missingCOIs) {
      try {
        const activeProjects = allProjectSubs.filter(
          ps => ps.subcontractor_name === coi.subcontractor_name &&
          ps.compliance_status !== 'non_compliant'
        );

        if (activeProjects.length === 0) continue;

        // Calculate days since initial notification
        let daysSinceNotification = 0;
        if (coi.sub_notified_date) {
          daysSinceNotification = differenceInDays(today, new Date(coi.sub_notified_date));
        } else if (coi.broker_notified_date) {
          daysSinceNotification = differenceInDays(today, new Date(coi.broker_notified_date));
        }

        // Send reminders at 7, 14, and 21 days
        const shouldSend7Day = daysSinceNotification >= 7 && !coi.missing_coi_7day_sent;
        const shouldSend14Day = daysSinceNotification >= 14 && !coi.missing_coi_14day_sent;
        const shouldSend21Day = daysSinceNotification >= 21 && !coi.missing_coi_21day_sent;

        if (shouldSend7Day) {
          addLog(`📋 Missing COI reminder (7 days): ${coi.subcontractor_name}`, 'warning');

          if (coi.status === 'awaiting_broker_upload' && coi.broker_email) {
            await sendEmail({
              to: coi.broker_email,
              subject: `Reminder: Missing Insurance Certificate - ${coi.subcontractor_name}`,
              body: `Dear ${coi.broker_name || 'Insurance Professional'},

This is a reminder that we are still awaiting the insurance certificate for ${coi.subcontractor_name}.

Initial request sent: ${format(new Date(coi.broker_notified_date || coi.created_date), 'MMMM d, yyyy')}

Active Projects (${activeProjects.length}):
${activeProjects.map(p => `• ${p.project_name} - ${p.gc_name}`).join('\n')}

📋 ACTION REQUIRED:
Please review the sample certificate and upload the matching ACORD 25:

Sample COI: ${coi.sample_coi_pdf_url || 'Available in upload portal'}
Upload Portal: ${window.location.origin}/broker-upload-coi?token=${coi.coi_token}

The subcontractor cannot begin work until the certificate is on file.

Thank you,
InsureTrack Team`
            });
          }

          if (coi.status === 'awaiting_broker_info' && coi.contact_email) {
            await sendEmail({
              to: coi.contact_email,
              subject: `Reminder: Broker Information Needed - ${coi.project_name}`,
              body: `Dear ${coi.subcontractor_name},

This is a reminder that we need your insurance broker's information to proceed with your onboarding for the project "${coi.project_name}".

📋 NEXT STEP:
Please provide your broker's contact information here:
${window.location.origin}/SubEnterBrokerInfo?token=${coi.coi_token}

Once we have your broker's information, we will request the insurance certificate directly from them.

You cannot begin work on the project until your insurance is verified.

Questions? Contact ${coi.gc_name}.

Best regards,
InsureTrack Team`
            });
          }

          await updateCOIMutation.mutateAsync({
            id: coi.id,
            data: { 
              missing_coi_7day_sent: true,
              missing_coi_7day_sent_date: new Date().toISOString()
            }
          });
          remindersSent++;
        }

        if (shouldSend14Day) {
          addLog(`📋 Missing COI reminder (14 days): ${coi.subcontractor_name}`, 'warning');

          if (coi.broker_email) {
            await sendEmail({
              to: coi.broker_email,
              subject: `⚠️ URGENT: Insurance Certificate Still Missing - ${coi.subcontractor_name}`,
              body: `⚠️ URGENT REMINDER

We are still awaiting the insurance certificate for ${coi.subcontractor_name}.

Request outstanding for: ${daysSinceNotification} days

Active Projects (${activeProjects.length}):
${activeProjects.map(p => `• ${p.project_name} - ${p.gc_name}`).join('\n')}

⚠️ URGENT ACTION REQUIRED:
Upload the certificate NOW: ${window.location.origin}/broker-upload-coi?token=${coi.coi_token}

The subcontractor is unable to begin work and project timelines are being impacted.

Please upload the certificate immediately.

URGENT ATTENTION REQUIRED
InsureTrack Team`
            });
          }

          if (coi.contact_email && coi.status === 'awaiting_broker_info') {
            await sendEmail({
              to: coi.contact_email,
              subject: `⚠️ URGENT: Broker Information Still Needed`,
              body: `⚠️ URGENT REMINDER

We still need your insurance broker's information to proceed with your onboarding.

Request outstanding for: ${daysSinceNotification} days

⚠️ ACTION REQUIRED:
Provide broker information NOW: ${window.location.origin}/SubEnterBrokerInfo?token=${coi.coi_token}

You cannot begin work until your insurance is verified. Please respond immediately to avoid project delays.

URGENT ATTENTION REQUIRED
InsureTrack Team`
            });
          }

          await updateCOIMutation.mutateAsync({
            id: coi.id,
            data: { 
              missing_coi_14day_sent: true,
              missing_coi_14day_sent_date: new Date().toISOString()
            }
          });
          remindersSent++;
        }

        if (shouldSend21Day) {
          addLog(`📋 Missing COI final reminder (21 days): ${coi.subcontractor_name}`, 'error');

          if (coi.broker_email) {
            await sendEmail({
              to: coi.broker_email,
              subject: `🚨 FINAL NOTICE: Insurance Certificate Missing 21+ Days - ${coi.subcontractor_name}`,
              body: `🚨 FINAL NOTICE 🚨

The insurance certificate for ${coi.subcontractor_name} has been outstanding for ${daysSinceNotification} days.

This is unacceptable and is causing significant project delays.

Affected Projects (${activeProjects.length}):
${activeProjects.map(p => `• ${p.project_name} - ${p.gc_name}`).join('\n')}

🚨 IMMEDIATE ACTION REQUIRED:
Upload certificate IMMEDIATELY: ${window.location.origin}/broker-upload-coi?token=${coi.coi_token}

If the certificate is not uploaded within 48 hours, the subcontractor will be removed from all projects and we will seek alternative insurance arrangements.

FINAL NOTICE - IMMEDIATE ACTION REQUIRED
InsureTrack Compliance Team`
            });
          }

          if (coi.contact_email) {
            await sendEmail({
              to: coi.contact_email,
              subject: `🚨 FINAL NOTICE: Insurance Certificate Required - Project Assignment at Risk`,
              body: `🚨 FINAL NOTICE 🚨

Your insurance certificate has been outstanding for ${daysSinceNotification} days.

🚨 CRITICAL STATUS:
Your project assignment is at risk due to missing insurance documentation.

IMMEDIATE ACTION:
${coi.status === 'awaiting_broker_info' ? 
  `Provide broker info NOW: ${window.location.origin}/SubEnterBrokerInfo?token=${coi.coi_token}` :
  `Contact your broker IMMEDIATELY: ${coi.broker_company} (${coi.broker_email})`
}

⚠️ WARNING:
If insurance is not verified within 48 hours, you will be removed from the project.

FINAL NOTICE - RESPOND IMMEDIATELY
InsureTrack Team`
            });
          }

          await updateCOIMutation.mutateAsync({
            id: coi.id,
            data: { 
              missing_coi_21day_sent: true,
              missing_coi_21day_sent_date: new Date().toISOString()
            }
          });
          remindersSent++;
        }

      } catch (error) {
        addLog(`Error processing missing COI for ${coi.subcontractor_name}: ${error.message}`, 'error');
      }
    }

    return remindersSent;
  };

  const runAutomatedSystem = async () => {
    setIsProcessing(true);
    setProcessingLog([]);
    addLog('🤖 Starting automated reminder system...', 'info');
    addLog(`Processing ${allCOIs.length} COI records...`, 'info');
    addLog('─────────────────────────────────────', 'info');

    // Process expiring policies
    const expiringResults = await processExpiringPolicies();
    
    addLog('─────────────────────────────────────', 'info');
    
    // Process missing COIs
    const missingResults = await processMissingCOIs();

    addLog('─────────────────────────────────────', 'success');
    addLog('✅ Automated reminder system complete!', 'success');
    addLog(`📧 Expiring Policy Reminders:`, 'info');
    addLog(`   • 30-day reminders: ${expiringResults.count30Day}`, 'info');
    addLog(`   • 14-day reminders: ${expiringResults.count14Day}`, 'info');
    addLog(`   • 5-day critical reminders: ${expiringResults.count5Day}`, 'info');
    addLog(`   • Expired (grace period): ${expiringResults.countExpired}`, 'info');
    addLog(`   • Marked non-compliant: ${expiringResults.countGraceExpired}`, 'info');
    addLog(`📋 Missing COI Reminders: ${missingResults}`, 'info');

    setIsProcessing(false);
    queryClient.invalidateQueries();
  };

  const getStats = () => {
    const today = new Date();
    let expiring30 = 0, expiring14 = 0, expiringSoon = 0;
    let expired = 0, inGracePeriod = 0;
    let missingCOIs = 0, overdueCOIs = 0;

    allCOIs.forEach(coi => {
      // Check missing COIs
      if (!coi.first_coi_uploaded) {
        missingCOIs++;
        if (coi.sub_notified_date || coi.broker_notified_date) {
          const notifDate = new Date(coi.sub_notified_date || coi.broker_notified_date);
          const daysSince = differenceInDays(today, notifDate);
          if (daysSince > 7) overdueCOIs++;
        }
        return;
      }

      // Check expiring policies
      const expirationDates = [
        coi.gl_expiration_date,
        coi.umbrella_expiration_date,
        coi.wc_expiration_date,
        coi.auto_expiration_date
      ].filter(Boolean).map(d => new Date(d));

      if (expirationDates.length === 0) return;

      const nearestExpiration = new Date(Math.min(...expirationDates));
      const daysUntilExpiry = differenceInDays(nearestExpiration, today);

      if (daysUntilExpiry > 14 && daysUntilExpiry <= 30) expiring30++;
      else if (daysUntilExpiry > 5 && daysUntilExpiry <= 14) expiring14++;
      else if (daysUntilExpiry > 0 && daysUntilExpiry <= 5) expiringSoon++;
      
      if (daysUntilExpiry < 0 && coi.grace_period_expiry) {
        const graceDaysLeft = differenceInDays(new Date(coi.grace_period_expiry), today);
        if (graceDaysLeft >= 0) {
          inGracePeriod++;
        }
      }
      if (coi.status === 'expired') expired++;
    });

    return { expiring30, expiring14, expiringSoon, expired, inGracePeriod, missingCOIs, overdueCOIs };
  };

  const stats = getStats();

  // Advanced analytics
  const analytics = useMemo(() => {
    const now = new Date();
    const last6Months = eachMonthOfInterval({
      start: subMonths(now, 5),
      end: now
    });

    // Monthly renewal activity
    const monthlyActivity = last6Months.map(month => {
      const renewed = allCOIs.filter(c => 
        c.broker_signature_date &&
        isWithinInterval(new Date(c.broker_signature_date), {
          start: startOfMonth(month),
          end: endOfMonth(month)
        })
      ).length;

      const expired = allCOIs.filter(c =>
        c.marked_non_compliant_date &&
        isWithinInterval(new Date(c.marked_non_compliant_date), {
          start: startOfMonth(month),
          end: endOfMonth(month)
        })
      ).length;

      return {
        month: format(month, 'MMM yy'),
        renewed,
        expired
      };
    });

    // Renewal success rate
    const totalRenewals = allCOIs.filter(c => c.renewal_30day_sent).length;
    const successfulRenewals = allCOIs.filter(c => 
      c.renewal_30day_sent && c.broker_signature_date && c.status === 'active'
    ).length;
    const renewalSuccessRate = totalRenewals > 0 ? (successfulRenewals / totalRenewals * 100) : 0;

    // Average renewal time
    const renewalTimes = allCOIs
      .filter(c => c.renewal_30day_sent_date && c.broker_signature_date)
      .map(c => differenceInDays(new Date(c.broker_signature_date), new Date(c.renewal_30day_sent_date)));
    
    const avgRenewalTime = renewalTimes.length > 0
      ? renewalTimes.reduce((a, b) => a + b, 0) / renewalTimes.length
      : 0;

    return {
      monthlyActivity,
      renewalSuccessRate,
      avgRenewalTime,
      totalRenewals,
      successfulRenewals
    };
  }, [allCOIs]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              Policy Renewal & Compliance
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">2.0</Badge>
            </h1>
            <p className="text-slate-600">Automated renewal tracking & analytics</p>
          </div>
          <Button
            onClick={runAutomatedSystem}
            disabled={isProcessing}
            className="bg-red-600 hover:bg-red-700"
            size="lg"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Bell className="w-5 h-5 mr-2" />
                Run Reminder System
              </>
            )}
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white border">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="expiring">Expiring</TabsTrigger>
            <TabsTrigger value="missing">Missing</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-6">
              <Card className="border-amber-200 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">30-Day Window</p>
                      <p className="text-2xl font-bold text-slate-900">{stats.expiring30}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-orange-200 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">14-Day Window</p>
                      <p className="text-2xl font-bold text-slate-900">{stats.expiring14}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-200 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                      <XCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Critical (≤5d)</p>
                      <p className="text-2xl font-bold text-slate-900">{stats.expiringSoon}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-purple-200 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                      <Mail className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Missing COIs</p>
                      <p className="text-2xl font-bold text-slate-900">{stats.missingCOIs}</p>
                      <p className="text-xs text-purple-600">{stats.overdueCOIs} overdue</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Alert className="bg-red-50 border-red-200">
              <AlertDescription className="text-red-900">
                <p className="font-semibold mb-3">📧 Automated Email Reminder Schedule:</p>
                
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-sm mb-1">🔄 Expiring Policies:</p>
                    <ul className="text-sm space-y-1 ml-6 list-disc">
                      <li><strong>30 days before:</strong> Friendly renewal reminder to broker & sub</li>
                      <li><strong>14 days before:</strong> Important reminder with urgency</li>
                      <li><strong>5 days before:</strong> Critical final warning</li>
                      <li><strong>On expiration:</strong> Expired notice - 7-day grace period begins</li>
                      <li><strong>After grace period:</strong> Marked NON-COMPLIANT - work prohibited</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-sm mb-1">📋 Missing COIs:</p>
                    <ul className="text-sm space-y-1 ml-6 list-disc">
                      <li><strong>7 days after request:</strong> Reminder to broker/sub</li>
                      <li><strong>14 days after request:</strong> Urgent follow-up</li>
                      <li><strong>21 days after request:</strong> Final notice - project assignment at risk</li>
                    </ul>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            {processingLog.length > 0 && (
              <Card className="border-slate-200 shadow-lg">
                <CardHeader className="border-b">
                  <CardTitle className="text-lg">Processing Log</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
                    {processingLog.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-slate-500">[{log.time}]</span>
                        {log.type === 'error' && <XCircle className="w-3 h-3 text-red-400 mt-0.5" />}
                        {log.type === 'warning' && <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5" />}
                        {log.type === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5" />}
                        {log.type === 'info' && <Mail className="w-3 h-3 text-red-400 mt-0.5" />}
                        <span className={
                          log.type === 'error' ? 'text-red-400' :
                          log.type === 'warning' ? 'text-amber-400' :
                          log.type === 'success' ? 'text-emerald-400' :
                          'text-slate-300'
                        }>
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Activity className="w-5 h-5 text-red-600" />
                    <h3 className="text-sm font-semibold text-slate-700">Renewal Success Rate</h3>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">{analytics.renewalSuccessRate.toFixed(1)}%</p>
                  <p className="text-xs text-slate-600 mt-1">{analytics.successfulRenewals} of {analytics.totalRenewals} renewed on time</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-slate-700">Avg Renewal Time</h3>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">{analytics.avgRenewalTime.toFixed(1)}</p>
                  <p className="text-xs text-slate-600 mt-1">days from reminder to upload</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    <h3 className="text-sm font-semibold text-slate-700">Active Policies</h3>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">{allCOIs.filter(c => c.status === 'active').length}</p>
                  <p className="text-xs text-slate-600 mt-1">currently compliant</p>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Activity Chart */}
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Renewal Activity (6 Months)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.monthlyActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="renewed" fill="#10b981" name="Renewed" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="expired" fill="#ef4444" name="Expired" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Detailed Policy List */}
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="text-lg font-bold">All Policies Status</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold">Subcontractor</TableHead>
                        <TableHead className="font-semibold">GL Expiration</TableHead>
                        <TableHead className="font-semibold">Days Until</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allCOIs
                        .filter(c => c.first_coi_uploaded && c.gl_expiration_date)
                        .sort((a, b) => {
                          const daysA = differenceInDays(new Date(a.gl_expiration_date), new Date());
                          const daysB = differenceInDays(new Date(b.gl_expiration_date), new Date());
                          return daysA - daysB;
                        })
                        .slice(0, 20)
                        .map(coi => {
                          const daysUntil = differenceInDays(new Date(coi.gl_expiration_date), new Date());
                          let statusColor = 'bg-emerald-50 text-emerald-700';
                          let statusText = 'Active';
                          
                          if (daysUntil < 0) {
                            statusColor = 'bg-red-50 text-red-700';
                            statusText = 'Expired';
                          } else if (daysUntil <= 5) {
                            statusColor = 'bg-red-50 text-red-700';
                            statusText = 'Critical';
                          } else if (daysUntil <= 14) {
                            statusColor = 'bg-orange-50 text-orange-700';
                            statusText = 'Urgent';
                          } else if (daysUntil <= 30) {
                            statusColor = 'bg-amber-50 text-amber-700';
                            statusText = 'Soon';
                          }

                          return (
                            <TableRow key={coi.id} className="hover:bg-slate-50">
                              <TableCell className="font-medium">{coi.subcontractor_name}</TableCell>
                              <TableCell>{format(new Date(coi.gl_expiration_date), 'MMM d, yyyy')}</TableCell>
                              <TableCell>
                                <span className={`font-semibold ${daysUntil < 0 ? 'text-red-600' : daysUntil <= 5 ? 'text-red-600' : daysUntil <= 14 ? 'text-orange-600' : 'text-slate-900'}`}>
                                  {daysUntil < 0 ? `${Math.abs(daysUntil)}d ago` : `${daysUntil}d`}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={statusColor}>
                                  {statusText}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {coi.sample_coi_pdf_url && (
                                  <Button size="sm" variant="outline" onClick={() => window.open(coi.sample_coi_pdf_url, '_blank')}>
                                    <Eye className="w-3 h-3 mr-1" />
                                    View
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      }
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expiring">
            <Card className="border-slate-200 shadow-lg">
              <CardHeader className="border-b">
                <CardTitle>Expiring Policy Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {stats.expiring30 > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-amber-600" />
                        <h3 className="font-bold text-amber-900">30-Day Window ({stats.expiring30})</h3>
                      </div>
                      <p className="text-sm text-amber-800">
                        Policies expiring in 15-30 days. Initial renewal reminders sent.
                      </p>
                    </div>
                  )}

                  {stats.expiring14 > 0 && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        <h3 className="font-bold text-orange-900">14-Day Window ({stats.expiring14})</h3>
                      </div>
                      <p className="text-sm text-orange-800">
                        Policies expiring in 6-14 days. Important reminders sent to expedite renewal.
                      </p>
                    </div>
                  )}

                  {stats.expiringSoon > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <h3 className="font-bold text-red-900">Critical Window ({stats.expiringSoon})</h3>
                      </div>
                      <p className="text-sm text-red-800">
                        Policies expiring in 1-5 days. Critical final warnings sent.
                      </p>
                    </div>
                  )}

                  {stats.inGracePeriod > 0 && (
                    <div className="p-4 bg-red-100 border-2 border-red-400 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-red-700" />
                        <h3 className="font-bold text-red-900">In Grace Period ({stats.inGracePeriod})</h3>
                      </div>
                      <p className="text-sm text-red-800">
                        Policies expired - 7-day grace period active. Urgent notices sent.
                      </p>
                    </div>
                  )}

                  {stats.expiring30 === 0 && stats.expiring14 === 0 && stats.expiringSoon === 0 && stats.inGracePeriod === 0 && (
                    <div className="p-8 text-center">
                      <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
                      <p className="text-slate-600">No policies currently requiring renewal reminders</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="missing">
            <Card className="border-slate-200 shadow-lg">
              <CardHeader className="border-b">
                <CardTitle>Missing COI Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {stats.missingCOIs > 0 ? (
                    <>
                      <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="w-5 h-5 text-purple-600" />
                          <h3 className="font-bold text-purple-900">Total Missing COIs: {stats.missingCOIs}</h3>
                        </div>
                        <p className="text-sm text-purple-800 mb-3">
                          Subcontractors on active projects without uploaded insurance certificates.
                        </p>
                        {stats.overdueCOIs > 0 && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded">
                            <p className="text-sm font-semibold text-amber-900">
                              ⚠️ {stats.overdueCOIs} Overdue (7+ days)
                            </p>
                            <p className="text-xs text-amber-800 mt-1">
                              These COIs are significantly overdue and receiving escalated reminders.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <h4 className="font-semibold text-slate-900 mb-2">Reminder Schedule:</h4>
                        <ul className="text-sm text-slate-700 space-y-1 ml-4 list-disc">
                          <li><strong>7 days:</strong> Friendly reminder sent</li>
                          <li><strong>14 days:</strong> Urgent follow-up sent</li>
                          <li><strong>21 days:</strong> Final notice - project assignment at risk</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center">
                      <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
                      <p className="text-slate-600">All active subcontractors have insurance certificates on file</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {processingLog.length === 0 && (
          <Alert className="bg-red-50 border-red-200">
            <Bell className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-900">
              <p className="font-semibold mb-2">🤖 Automated Reminder System</p>
              <p className="text-sm">
                Click &quot;Run Reminder System&quot; to check all policies and send automated email reminders. In production, this runs automatically daily at 6:00 AM.
              </p>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}