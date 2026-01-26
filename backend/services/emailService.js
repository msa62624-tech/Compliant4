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
    subject: 'Password Reset Request - CompliantTeam',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello ${userName},</p>
        <p>We received a request to reset your password for your CompliantTeam account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${safeResetLink}" 
             style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="color: #4F46E5; word-break: break-all; font-size: 12px;">${safeResetLink}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 11px;">
          This is an automated message from CompliantTeam. Please do not reply to this email.
        </p>
      </div>
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
