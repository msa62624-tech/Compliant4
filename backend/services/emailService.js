import nodemailer from 'nodemailer';

/**
 * Create an email transporter based on environment configuration
 * @returns {Object} Nodemailer transporter instance
 */
export function createEmailTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpService = process.env.SMTP_SERVICE;
  
  if (!smtpHost && !smtpService) {
    // Mock transporter for development
    return {
      sendMail: async (options) => {
        console.log('📧 MOCK EMAIL:', {
          from: options.from,
          to: options.to,
          subject: options.subject
        });
        return { messageId: `mock-${Date.now()}` };
      }
    };
  }
  
  const config = {};
  if (smtpService) {
    config.service = smtpService;
  } else if (smtpHost) {
    config.host = smtpHost;
    config.port = smtpPort;
    config.secure = smtpPort === 465;
  }
  if (smtpUser && smtpPass) {
    config.auth = { user: smtpUser, pass: smtpPass };
  }
  
  return nodemailer.createTransport(config);
}

/**
 * Simple HTML escape function to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} HTML-safe text
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} resetLink - Password reset URL
 * @param {Object} user - User object with name
 */
export async function sendPasswordResetEmail(email, resetLink, user = {}) {
  const transporter = createEmailTransporter();
  const userName = escapeHtml(user.name || 'User');
  const safeResetLink = escapeHtml(resetLink);
  
  const mailOptions = {
    from: process.env.SMTP_USER || process.env.SMTP_FROM || 'noreply@insuretrack.com',
    to: email,
    subject: 'Password Reset Request - compliant.team',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background-color: #f9fafb;
            margin: 0;
            padding: 0;
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
            color: #333;
            background-color: #fff;
          }
          .alert {
            background-color: #fee2e2;
            border-left: 4px solid #dc2626;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
            color: #333;
          }
          .button { 
            background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
            color: white !important; 
            padding: 12px 28px; 
            text-decoration: none; 
            border-radius: 6px; 
            display: inline-block; 
            margin-top: 15px;
            font-weight: 600;
          }
          .footer { 
            font-size: 12px; 
            color: #666; 
            margin-top: 30px; 
            padding: 20px; 
            border-top: 1px solid #e5e7eb;
            text-align: center;
          }
          p {
            margin: 10px 0;
            color: #333;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
            <p>Reset your compliant.team account password</p>
          </div>
          
          <div class="content">
            <p>Hello ${userName},</p>
            
            <p>We received a request to reset your password for your account on compliant.team.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${safeResetLink}" class="button">Reset Password</a>
            </div>
            
            <p style="color: #666; font-size: 13px; text-align: center;">
              Or copy and paste this link into your browser:<br>
              <span style="word-break: break-all; color: #dc2626;">${safeResetLink}</span>
            </p>
            
            <div class="alert">
              <p style="margin: 0; font-size: 13px; color: #dc2626;">
                ⏱️ <strong>Link expires in 1 hour</strong>
              </p>
            </div>
            
            <p style="color: #666; font-size: 13px;">
              If you didn't request a password reset, you can safely ignore this email.
            </p>
          </div>
          
          <div class="footer">
            <p><strong>compliant.team</strong> - Insurance Compliance Management</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
  
  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to: ${email}`);
    return true;
  } catch (emailErr) {
    console.error('Failed to send password reset email:', emailErr?.message);
    return false;
  }
}

/**
 * Get default email from address
 */
export function getDefaultEmailFrom() {
  return process.env.SMTP_USER || process.env.SMTP_FROM || 'noreply@insuretrack.com';
}
