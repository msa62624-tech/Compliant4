/**
 * Portal Link Generator for All Notifications
 * Ensures every notification includes direct links to relevant portal sections
 */

export class NotificationLinkBuilder {
  constructor(baseUrl = window.location.origin) {
    this.baseUrl = baseUrl;
  }

  // =============================================
  // SUBCONTRACTOR PORTAL LINKS
  // =============================================

  getSubDashboardLink(subId, section = null) {
    const url = `${this.baseUrl}/subcontractor-dashboard?id=${subId}`;
    return section ? `${url}&section=${section}` : url;
  }

  getSubProjectLink(subId, projectId) {
    return `${this.baseUrl}/subcontractor-dashboard?id=${subId}&section=projects&projectId=${projectId}`;
  }

  getSubCertificatesLink(subId) {
    return `${this.baseUrl}/subcontractor-dashboard?id=${subId}&section=certificates`;
  }

  getSubInsuranceLink(subId, projectId) {
    return `${this.baseUrl}/subcontractor-dashboard?id=${subId}&section=insurance&projectId=${projectId}`;
  }

  getSubIssuesLink(subId) {
    return `${this.baseUrl}/subcontractor-dashboard?id=${subId}&section=issues`;
  }

  getSubUploadLink(subId) {
    return `${this.baseUrl}/UploadDocuments?sub=${encodeURIComponent(subId)}`;
  }

  getSubMessagesLink(subId) {
    return `${this.baseUrl}/subcontractor-dashboard?id=${subId}&section=messages`;
  }

  // =============================================
  // BROKER PORTAL LINKS
  // =============================================

  getBrokerDashboardLink(brokerName, section = null) {
    const url = `${this.baseUrl}/broker-dashboard?name=${encodeURIComponent(brokerName)}`;
    return section ? `${url}&section=${section}` : url;
  }

  getBrokerClientsLink(brokerName) {
    return `${this.baseUrl}/broker-dashboard?name=${encodeURIComponent(brokerName)}&section=clients`;
  }

  getBrokerCertificatesLink(brokerName) {
    return `${this.baseUrl}/broker-dashboard?name=${encodeURIComponent(brokerName)}&section=certificates`;
  }

  getBrokerRequestsLink(brokerName) {
    return `${this.baseUrl}/broker-dashboard?name=${encodeURIComponent(brokerName)}&section=requests`;
  }

  getBrokerUploadLink(subId, coiId = null) {
    let url = `${this.baseUrl}/broker-upload?subId=${subId}`;
    if (coiId) url += `&coiId=${coiId}`;
    return url;
  }

  getBrokerCOILink(brokerName, coiId) {
    return `${this.baseUrl}/broker-dashboard?name=${encodeURIComponent(brokerName)}&section=certificates&coiId=${coiId}`;
  }

  getBrokerMessagesLink(brokerName) {
    return `${this.baseUrl}/broker-dashboard?name=${encodeURIComponent(brokerName)}&section=messages`;
  }

  // =============================================
  // GC PORTAL LINKS
  // =============================================

  getGCDashboardLink(gcId, section = null) {
    const url = `${this.baseUrl}/gc-dashboard?id=${gcId}`;
    return section ? `${url}&section=${section}` : url;
  }

  // Admin-only route for managing GC information (not for GC portal access)
  getGCDetailsLink(gcId) {
    return `${this.baseUrl}/gc-details?id=${gcId}`;
  }

  getGCProjectsLink(gcId) {
    return `${this.baseUrl}/gc-projects?id=${gcId}`;
  }

  getGCProjectLink(projectId, gcId) {
    return `${this.baseUrl}/gc-project?project=${projectId}&id=${gcId}`;
  }

  // =============================================
  // ADMIN PORTAL LINKS
  // =============================================

  getAdminDashboardLink(section = null) {
    const url = `${this.baseUrl}/admin-dashboard`;
    return section ? `${url}?section=${section}` : url;
  }

  getAdminPendingReviewsLink() {
    return `${this.baseUrl}/admin-dashboard?section=PendingReviews`;
  }

  getAdminCOIReviewLink(coiId) {
    return `${this.baseUrl}/COIReview?id=${coiId}`;
  }

  getAdminProjectsLink() {
    return `${this.baseUrl}/admin-dashboard?section=ProjectsSetup`;
  }

  getAdminProjectLink(projectId) {
    return `${this.baseUrl}/ProjectDetails?id=${projectId}`;
  }

  getAdminSubcontractorsLink() {
    return `${this.baseUrl}/admin-dashboard?section=SubcontractorsManagement`;
  }

  getAdminComplianceLink() {
    return `${this.baseUrl}/admin-dashboard?section=ComplianceReview`;
  }

  getAdminMessagesLink() {
    return `${this.baseUrl}/admin-dashboard?section=Messages`;
  }

  getAdminExpiringLink() {
    return `${this.baseUrl}/admin-dashboard?section=ExpiringPolicies`;
  }

  // =============================================
  // PROJECT PORTAL LINKS
  // =============================================

  getProjectDashboardLink(projectId) {
    return `${this.baseUrl}/ProjectDetails?id=${projectId}`;
  }

  getProjectSubcontractorsLink(projectId) {
    return `${this.baseUrl}/ProjectDetails?id=${projectId}&section=subcontractors`;
  }

  getProjectRequirementsLink(projectId) {
    return `${this.baseUrl}/ProjectDetails?id=${projectId}&section=requirements`;
  }

  getProjectComplianceLink(projectId) {
    return `${this.baseUrl}/ProjectDetails?id=${projectId}&section=compliance`;
  }

  // =============================================
  // COI & COMPLIANCE LINKS
  // =============================================

  getCOIReviewLink(coiId) {
    return `${this.baseUrl}/COIReview?id=${coiId}`;
  }

  getCOIApprovalLink(coiId) {
    return `${this.baseUrl}/COIReview?id=${coiId}&action=approve`;
  }

  getComplianceReviewLink(projectId) {
    return `${this.baseUrl}/ComplianceReview?projectId=${projectId}`;
  }

  // =============================================
  // BUILD COMPLETE NOTIFICATION BODY WITH LINKS
  // =============================================

  buildBrokerAssignmentEmailWithLinks(subcontractor, brokerEmail, isFirstTime) {
    const links = {
      dashboard: this.getBrokerDashboardLink(brokerEmail),
      clients: this.getBrokerClientsLink(brokerEmail),
      upload: this.getBrokerUploadLink(subcontractor.id),
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

  buildCOIUploadEmailWithLinks(coi, subcontractor, project) {
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

  buildCOIApprovedEmailWithLinks(coi, subcontractor, project, recipient = 'sub') {
    let links = {};

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

  buildRequirementsReferralEmailWithLinks(project, subcontractor, trade) {
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

  buildPolicyRenewalEmailWithLinks(subcontractor, project, policyType) {
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
export function enhanceEmailWithLinks(emailBody, links) {
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
