/**
 * Portal Link Generator for All Notifications
 * Ensures every notification includes direct links to relevant portal sections
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface EmailSection {
  title: string;
  content: string;
  actionLink?: string;
  actionText?: string;
}

export interface EmailWithLinks {
  subject: string;
  links: Record<string, string>;
  sections: EmailSection[];
}

export interface Subcontractor {
  id?: string;
  company_name?: string;
  contact_person?: string;
  email?: string;
  broker_email?: string;
  coi_token?: string;
  coiToken?: string;
  coi_id?: string;
  coiId?: string;
  [key: string]: unknown;
}

export interface COI {
  id: string;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  project_name?: string;
  project_address?: string;
  [key: string]: unknown;
}

// ============================================================================
// CLASS
// ============================================================================

export class NotificationLinkBuilder {
  private baseUrl: string;

  constructor(baseUrl: string = typeof window !== 'undefined' ? window.location.origin : '') {
    this.baseUrl = baseUrl;
  }

  // =============================================
  // SUBCONTRACTOR PORTAL LINKS
  // =============================================

  getSubDashboardLink(subId: string, section: string | null = null): string {
    const url = `${this.baseUrl}/subcontractor-dashboard?id=${subId}`;
    return section ? `${url}&section=${section}` : url;
  }

  getSubProjectLink(subId: string, projectId: string): string {
    return `${this.baseUrl}/subcontractor-dashboard?id=${subId}&section=projects&projectId=${projectId}`;
  }

  getSubCertificatesLink(subId: string): string {
    return `${this.baseUrl}/subcontractor-dashboard?id=${subId}&section=certificates`;
  }

  getSubInsuranceLink(subId: string, projectId: string): string {
    return `${this.baseUrl}/subcontractor-dashboard?id=${subId}&section=insurance&projectId=${projectId}`;
  }

  getSubIssuesLink(subId: string): string {
    return `${this.baseUrl}/subcontractor-dashboard?id=${subId}&section=issues`;
  }

  getSubUploadLink(subId: string): string {
    return `${this.baseUrl}/UploadDocuments?sub=${encodeURIComponent(subId)}`;
  }

  getSubMessagesLink(subId: string): string {
    return `${this.baseUrl}/subcontractor-dashboard?id=${subId}&section=messages`;
  }

  // =============================================
  // BROKER PORTAL LINKS
  // =============================================

  getBrokerDashboardLink(brokerName: string, section: string | null = null): string {
    const url = `${this.baseUrl}/broker-dashboard?name=${encodeURIComponent(brokerName)}`;
    return section ? `${url}&section=${section}` : url;
  }

  getBrokerClientsLink(brokerName: string): string {
    return `${this.baseUrl}/broker-dashboard?name=${encodeURIComponent(brokerName)}&section=clients`;
  }

  getBrokerCertificatesLink(brokerName: string): string {
    return `${this.baseUrl}/broker-dashboard?name=${encodeURIComponent(brokerName)}&section=certificates`;
  }

  getBrokerRequestsLink(brokerName: string): string {
    return `${this.baseUrl}/broker-dashboard?name=${encodeURIComponent(brokerName)}&section=requests`;
  }

  getBrokerUploadLink(coiToken: string | null | undefined, step: number = 1): string {
    // For COI uploads, use the broker-upload-coi page with token and step
    if (coiToken) {
      return `${this.baseUrl}/broker-upload-coi?token=${coiToken}&step=${step}&action=upload`;
    }
    // Fallback for older subId-based requests
    console.warn('getBrokerUploadLink called without coiToken');
    return `${this.baseUrl}/broker-upload`;
  }

  getBrokerCOILink(brokerName: string, coiId: string): string {
    return `${this.baseUrl}/broker-dashboard?name=${encodeURIComponent(brokerName)}&section=certificates&coiId=${coiId}`;
  }

  getBrokerMessagesLink(brokerName: string): string {
    return `${this.baseUrl}/broker-dashboard?name=${encodeURIComponent(brokerName)}&section=messages`;
  }

  // =============================================
  // GC PORTAL LINKS
  // =============================================

  getGCDashboardLink(gcId: string, section: string | null = null): string {
    const url = `${this.baseUrl}/gc-dashboard?id=${gcId}`;
    return section ? `${url}&section=${section}` : url;
  }

  // Admin-only route for managing GC information (not for GC portal access)
  getGCDetailsLink(gcId: string): string {
    return `${this.baseUrl}/gc-details?id=${gcId}`;
  }

  getGCProjectsLink(gcId: string): string {
    return `${this.baseUrl}/gc-projects?id=${gcId}`;
  }

  getGCProjectLink(projectId: string, gcId: string): string {
    return `${this.baseUrl}/gc-project?project=${projectId}&id=${gcId}`;
  }

  // =============================================
  // ADMIN PORTAL LINKS
  // =============================================

  getAdminDashboardLink(section: string | null = null): string {
    const url = `${this.baseUrl}/admin-dashboard`;
    return section ? `${url}?section=${section}` : url;
  }

  getAdminPendingReviewsLink(): string {
    return `${this.baseUrl}/admin-dashboard?section=PendingReviews`;
  }

  getAdminCOIReviewLink(coiId: string): string {
    return `${this.baseUrl}/COIReview?id=${coiId}`;
  }

  getAdminProjectsLink(): string {
    return `${this.baseUrl}/admin-dashboard?section=ProjectsSetup`;
  }

  getAdminProjectLink(projectId: string): string {
    return `${this.baseUrl}/ProjectDetails?id=${projectId}`;
  }

  getAdminSubcontractorsLink(): string {
    return `${this.baseUrl}/admin-dashboard?section=SubcontractorsManagement`;
  }

  getAdminComplianceLink(): string {
    return `${this.baseUrl}/admin-dashboard?section=ComplianceReview`;
  }

  getAdminMessagesLink(): string {
    return `${this.baseUrl}/admin-dashboard?section=Messages`;
  }

  getAdminExpiringLink(): string {
    return `${this.baseUrl}/admin-dashboard?section=ExpiringPolicies`;
  }

  // =============================================
  // PROJECT PORTAL LINKS
  // =============================================

  getProjectDashboardLink(projectId: string): string {
    return `${this.baseUrl}/ProjectDetails?id=${projectId}`;
  }

  getProjectSubcontractorsLink(projectId: string): string {
    return `${this.baseUrl}/ProjectDetails?id=${projectId}&section=subcontractors`;
  }

  getProjectRequirementsLink(projectId: string): string {
    return `${this.baseUrl}/ProjectDetails?id=${projectId}&section=requirements`;
  }

  getProjectComplianceLink(projectId: string): string {
    return `${this.baseUrl}/ProjectDetails?id=${projectId}&section=compliance`;
  }

  // =============================================
  // COI & COMPLIANCE LINKS
  // =============================================

  getCOIReviewLink(coiId: string): string {
    return `${this.baseUrl}/COIReview?id=${coiId}`;
  }

  getCOIApprovalLink(coiId: string): string {
    return `${this.baseUrl}/COIReview?id=${coiId}&action=approve`;
  }

  getComplianceReviewLink(projectId: string): string {
    return `${this.baseUrl}/ComplianceReview?projectId=${projectId}`;
  }

  // =============================================
  // BUILD COMPLETE NOTIFICATION BODY WITH LINKS
  // =============================================

  buildBrokerAssignmentEmailWithLinks(
    subcontractor: Subcontractor,
    brokerEmail: string,
    isFirstTime: boolean
  ): EmailWithLinks {
    const links = {
      dashboard: this.getBrokerDashboardLink(brokerEmail),
      clients: this.getBrokerClientsLink(brokerEmail),
      upload: this.getBrokerUploadLink(subcontractor.coi_token || subcontractor.coiToken || subcontractor.coi_id || subcontractor.coiId),
      messages: this.getBrokerMessagesLink(brokerEmail),
    };

    return {
      subject: `New Subcontractor Assignment - ${subcontractor.company_name}`,
      links,
      sections: [
        {
          title: 'Subcontractor Details',
          content: `• Company: ${subcontractor.company_name}
• Contact: ${subcontractor.contact_person || 'N/A'}
• Email: ${subcontractor.email}
• Phone: ${subcontractor.phone || 'N/A'}`,
        },
        {
          title: isFirstTime ? 'First Time Setup' : 'Returning Broker',
          content: isFirstTime
            ? 'Please upload insurance documents for this subcontractor'
            : 'Review and approve COIs based on existing policies',
          actionLink: isFirstTime ? links.upload : links.dashboard,
          actionText: isFirstTime ? 'Upload Documents' : 'View Dashboard',
        },
      ],
    };
  }

  buildCOIUploadEmailWithLinks(
    coi: COI,
    subcontractor: Subcontractor,
    project: Project
  ): EmailWithLinks {
    const links = {
      review: this.getAdminCOIReviewLink(coi.id),
      project: this.getAdminProjectLink(project.id),
      dashboard: this.getAdminDashboardLink('PendingReviews'),
    };

    return {
      subject: `📋 COI Uploaded - Review Required: ${subcontractor.company_name}`,
      links,
      sections: [
        {
          title: 'Subcontractor',
          content: `• Company: ${subcontractor.company_name}
• Contact: ${subcontractor.contact_person}`,
        },
        {
          title: 'Project',
          content: `• Project: ${project.project_name}
• Location: ${project.project_address}`,
        },
        {
          title: 'Review Certificate',
          actionLink: links.review,
          actionText: 'Review & Approve',
        },
      ],
    };
  }

  buildCOIApprovedEmailWithLinks(
    coi: COI,
    subcontractor: Subcontractor,
    project: Project,
    recipient: 'sub' | 'broker' | 'admin' = 'sub'
  ): EmailWithLinks {
    let links: Record<string, string> = {};

    if (recipient === 'sub') {
      links = {
        dashboard: this.getSubDashboardLink(subcontractor.id),
        project: this.getSubProjectLink(subcontractor.id, project.id),
        insurance: this.getSubInsuranceLink(subcontractor.id, project.id),
      };
    } else if (recipient === 'broker') {
      links = {
        dashboard: this.getBrokerDashboardLink(subcontractor.broker_email),
        certificate: this.getBrokerCertificatesLink(subcontractor.broker_email),
      };
    } else if (recipient === 'admin') {
      links = {
        dashboard: this.getAdminDashboardLink(),
        project: this.getAdminProjectLink(project.id),
      };
    }

    return {
      subject: `✅ Certificate Approved - ${project.project_name}`,
      links,
      sections: [
        {
          title: 'Project Status',
          content: `• Project: ${project.project_name}
• Subcontractor: ${subcontractor.company_name}
• Status: ✅ APPROVED`,
        },
        {
          title: 'View Details',
          actionLink: links.dashboard,
          actionText: 'Go to Dashboard',
        },
      ],
    };
  }

  buildRequirementsReferralEmailWithLinks(
    project: Project,
    subcontractor: Subcontractor,
    trade: string
  ): EmailWithLinks {
    const links = {
      requirements: this.getProjectRequirementsLink(project.id),
      subDashboard: this.getSubDashboardLink(subcontractor.id),
      broker: this.getBrokerDashboardLink(subcontractor.broker_email),
    };

    return {
      subject: `Project Requirements - ${project.project_name}`,
      links,
      sections: [
        {
          title: 'Review Project Requirements',
          content: `Your trade (${trade}) has specific insurance requirements for this project.`,
          actionLink: links.requirements,
          actionText: 'View Requirements',
        },
        {
          title: 'Share with Your Broker',
          content: 'Forward these requirements to your insurance broker so they can ensure your coverage meets project specifications.',
          actionLink: links.broker,
          actionText: 'Broker Portal',
        },
      ],
    };
  }

  buildPolicyRenewalEmailWithLinks(
    subcontractor: Subcontractor,
    project: Project,
    policyType: string
  ): EmailWithLinks {
    const links = {
      subDashboard: this.getSubDashboardLink(subcontractor.id),
      project: this.getSubProjectLink(subcontractor.id, project.id),
      broker: this.getBrokerDashboardLink(subcontractor.broker_email),
    };

    return {
      subject: `Policy Renewal Required - ${policyType}`,
      links,
      sections: [
        {
          title: 'Policy Update Required',
          content: `Your ${policyType} policy is expiring soon and needs renewal for ${project.project_name}`,
        },
        {
          title: 'Action Items',
          content: 'Contact your broker to renew the policy and submit an updated Certificate of Insurance',
          actionLink: links.broker,
          actionText: 'Contact Broker',
        },
      ],
    };
  }
}

// Export singleton instance
export const notificationLinks = new NotificationLinkBuilder();

// Export helper function to add links to any email
export function enhanceEmailWithLinks(emailBody: string, links: Record<string, string>): string {
  if (!links || Object.keys(links).length === 0) return emailBody;

  let enhancedBody = emailBody;

  // Add links section at the end of email
  enhancedBody += '\n\n═══════════════════════════════════════\n';
  enhancedBody += 'QUICK LINKS:\n';
  enhancedBody += '═══════════════════════════════════════\n\n';

  for (const [name, url] of Object.entries(links)) {
    const displayName = name
      .replace(/_/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    enhancedBody += `• ${displayName}:\n  ${url}\n\n`;
  }

  return enhancedBody;
}
