/**
 * Standardized email templates that match InsureTrack system UI
 * Color scheme: #dc2626 (destructive red), #991b1b (dark red)
 */

export const EMAIL_STYLES = `
  <style>
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      background-color: #f9fafb;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 0; 
      background-color: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header { 
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      color: white; 
      padding: 30px 20px; 
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 24px;
      font-weight: 600;
    }
    .header p {
      margin: 0;
      font-size: 14px;
      opacity: 0.95;
    }
    .content { 
      padding: 30px 20px; 
    }
    .section { 
      margin: 20px 0; 
      padding: 15px; 
      background-color: #f5f5f5; 
      border-left: 4px solid #dc2626;
      border-radius: 4px;
    }
    .section-title { 
      font-weight: 600; 
      font-size: 15px; 
      margin: 0 0 12px 0;
      color: #dc2626; 
    }
    .field { 
      margin: 8px 0; 
      font-size: 14px;
    }
    .label { 
      font-weight: 600; 
      color: #dc2626; 
      display: inline-block;
      min-width: 120px;
    }
    .credentials { 
      background-color: #fef2f2; 
      padding: 15px; 
      border-radius: 6px; 
      border-left: 4px solid #dc2626;
      margin: 15px 0;
    }
    .alert {
      background-color: #fee2e2;
      border-left: 4px solid #dc2626;
      padding: 15px;
      border-radius: 4px;
      margin: 15px 0;
    }
    .alert-title {
      font-weight: 600;
      color: #991b1b;
      margin: 0 0 8px 0;
    }
    .button { 
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      color: white; 
      padding: 12px 28px; 
      text-decoration: none; 
      border-radius: 6px; 
      display: inline-block; 
      margin-top: 15px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .button:hover {
      opacity: 0.9;
      text-decoration: none;
    }
    .button-secondary {
      background-color: #f3f4f6;
      color: #dc2626;
      padding: 12px 28px;
      text-decoration: none;
      border-radius: 6px;
      display: inline-block;
      margin-top: 15px;
      font-weight: 600;
      border: 1px solid #d1d5db;
      cursor: pointer;
    }
    .footer { 
      font-size: 12px; 
      color: #666; 
      margin-top: 30px; 
      padding-top: 20px; 
      border-top: 1px solid #e5e7eb;
      text-align: center;
    }
    .list-item {
      margin: 10px 0;
      padding-left: 20px;
    }
    .list-item:before {
      content: "✓ ";
      color: #dc2626;
      font-weight: bold;
      margin-left: -20px;
      margin-right: 8px;
    }
    h2 { 
      color: #dc2626; 
      margin: 20px 0 15px 0;
      font-size: 18px;
      font-weight: 600;
    }
    h3 {
      color: #dc2626;
      margin: 15px 0 10px 0;
      font-size: 15px;
      font-weight: 600;
    }
    p {
      margin: 10px 0;
      color: #333;
    }
    ol, ul {
      margin: 15px 0;
      padding-left: 20px;
    }
    li {
      margin: 8px 0;
    }
  </style>
`;

/**
 * Create a formatted email template
 */
export function createEmailTemplate(title, subtitle, content, footer = null) {
  const defaultFooter = `
    <div class="footer">
      <p><strong>InsureTrack</strong> - Insurance Compliance Management</p>
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${EMAIL_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ''}
    </div>
    
    <div class="content">
      ${content}
    </div>
    
    ${footer || defaultFooter}
  </div>
</body>
</html>
  `;
}

/**
 * Password reset email template
 */
export function getPasswordResetEmail(name, resetLink, type = 'general') {
  const userType = type === 'gc' ? 'GC Account' : type === 'broker' ? 'Broker Account' : type === 'subcontractor' ? 'Subcontractor Account' : 'Account';
  
  const content = `
    <p>Hello ${name || 'User'},</p>
    
    <p>We received a request to reset your password for your <strong>${userType}</strong> on InsureTrack.</p>
    
    <p>Click the button below to reset your password:</p>
    
    <div style="text-align: center;">
      <a href="${resetLink}" class="button">Reset Password</a>
    </div>
    
    <p style="color: #666; font-size: 13px; text-align: center;">
      Or copy and paste this link into your browser:<br>
      <span style="word-break: break-all; color: #1e40af;">${resetLink}</span>
    </p>
    
    <div class="alert">
      <p style="margin: 0; font-size: 13px; color: #dc2626;">
        ⏱️ <strong>Link expires in 1 hour</strong>
      </p>
    </div>
    
    <p style="color: #666; font-size: 13px;">
      If you didn't request a password reset, you can safely ignore this email.
    </p>
  `;
  
  return createEmailTemplate(
    '🔐 Password Reset Request',
    'Reset your InsureTrack account password',
    content
  );
}

/**
 * Broker COI submission confirmation
 */
export function getBrokerCOIConfirmationEmail(subcontractorName, projectName, tradeType) {
  const content = `
    <p>Thank you for submitting your Certificate of Insurance!</p>
    
    <div class="section">
      <div class="section-title">📋 SUBMISSION DETAILS</div>
      <div class="field"><span class="label">Subcontractor:</span> ${subcontractorName}</div>
      <div class="field"><span class="label">Project:</span> ${projectName}</div>
      <div class="field"><span class="label">Trade:</span> ${tradeType}</div>
      <div class="field"><span class="label">Submitted:</span> ${new Date().toLocaleDateString()}</div>
    </div>
    
    <div class="section">
      <div class="section-title">⏳ NEXT STEPS</div>
      <p>Your certificate is currently <strong>under admin review</strong>. We will notify you once it has been reviewed and approved.</p>
      <ol>
        <li>Admins will review your submission</li>
        <li>You'll receive an approval or request for changes</li>
        <li>Work can begin once approved</li>
      </ol>
    </div>
    
    <p style="color: #666; font-size: 13px;">
      Questions? Contact your General Contractor or the InsureTrack support team.
    </p>
  `;
  
  return createEmailTemplate(
    '✅ Certificate Submitted Successfully',
    'Your COI is under review',
    content
  );
}

/**
 * Document replacement notification for GC
 */
export function getDocumentReplacementNotificationEmail(subcontractorName, brokerName, brokerEmail, docType, reason = null) {
  const content = `
    <p>A broker has replaced a previously approved insurance document for one of your subcontractors.</p>
    
    <div class="alert">
      <div class="alert-title">⚠️ Action Required: Document Re-Review</div>
      <p>The subcontractor status has been updated to <strong>Pending Review</strong>.</p>
    </div>
    
    <div class="section">
      <div class="section-title">📄 REPLACEMENT DETAILS</div>
      <div class="field"><span class="label">Subcontractor:</span> ${subcontractorName}</div>
      <div class="field"><span class="label">Broker:</span> ${brokerName} (${brokerEmail})</div>
      <div class="field"><span class="label">Document Type:</span> ${docType || 'Insurance Document'}</div>
      ${reason ? `<div class="field"><span class="label">Reason:</span> ${reason}</div>` : ''}
    </div>
    
    <div class="section">
      <div class="section-title">✓ WHAT TO DO</div>
      <ol>
        <li>Review the new document in your dashboard</li>
        <li>Verify compliance requirements are still met</li>
        <li>Update the compliance status accordingly</li>
      </ol>
    </div>
  `;
  
  return createEmailTemplate(
    '📋 Document Re-Review Required',
    'A broker replaced an insurance document',
    content
  );
}

/**
 * New subcontractor onboarding email (for GC portal)
 */
export function getSubcontractorOnboardingEmail(subcontractorName, projectName, address, tradeType, username, password, portalUrl) {
  const content = `
    <p>Dear ${subcontractorName},</p>
    
    <p>You have been added to a new project in InsureTrack!</p>
    
    <div class="section">
      <div class="section-title">📋 PROJECT DETAILS</div>
      <div class="field"><span class="label">Project:</span> ${projectName}</div>
      <div class="field"><span class="label">Trade:</span> ${tradeType}</div>
      <div class="field"><span class="label">Location:</span> ${address || 'Address not provided'}</div>
    </div>
    
    <div class="section">
      <div class="section-title">🔐 PORTAL LOGIN INFORMATION</div>
      <div class="credentials">
        <div class="field"><span class="label">Username:</span> ${username}</div>
        <div class="field"><span class="label">Password:</span> <strong>${password}</strong></div>
        <p style="color: #dc2626; font-size: 13px; margin-top: 10px;">
          ⚠️ <strong>Save your password</strong> - You'll need it to log in
        </p>
        <div style="text-align: center; margin-top: 15px;">
          <a href="${portalUrl}" class="button">Login to Portal →</a>
        </div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">📝 GETTING STARTED</div>
      <ol>
        <li>Click the button above to access the portal</li>
        <li>Log in with your credentials</li>
        <li>Update your broker information in settings</li>
        <li>Submit your Certificate of Insurance (COI)</li>
        <li>Once approved, you're ready to start work!</li>
      </ol>
    </div>
    
    <p style="color: #666; font-size: 13px; margin-top: 20px;">
      <strong>Questions?</strong> Contact your General Contractor or the InsureTrack support team.
    </p>
  `;
  
  return createEmailTemplate(
    '👋 Welcome to InsureTrack',
    `You've been added to ${projectName}`,
    content
  );
}
