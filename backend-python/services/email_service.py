"""
Email service for sending emails via SMTP
Equivalent to nodemailer in Node.js backend
"""
import os
from typing import Dict, List, Optional, Any
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config.env import settings
from config.logger_config import setup_logger

logger = setup_logger(__name__)

# Try to import SMTP library
try:
    import aiosmtplib
    SMTP_AVAILABLE = True
except ImportError:
    logger.warning("aiosmtplib not available - emails will be logged only")
    SMTP_AVAILABLE = False


class EmailService:
    """Email service for sending emails"""
    
    def __init__(self):
        self.smtp_configured = all([
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            settings.SMTP_USER,
            settings.SMTP_PASS
        ])
        
        if not self.smtp_configured:
            logger.warning("SMTP not configured - emails will be logged to console")
    
    async def send_email(
        self,
        to: str | List[str],
        subject: str,
        body: str,
        html: Optional[str] = None,
        from_email: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Send email via SMTP
        
        Args:
            to: Recipient email(s)
            subject: Email subject
            body: Plain text body
            html: HTML body (optional)
            from_email: Sender email (optional, uses default)
            cc: CC recipients (optional)
            bcc: BCC recipients (optional)
        
        Returns:
            dict with success status and message ID
        """
        try:
            # Convert single recipient to list
            if isinstance(to, str):
                to = [to]
            
            # Log email in development or if SMTP not configured
            if not self.smtp_configured or not SMTP_AVAILABLE:
                logger.info(f"""
=== EMAIL (Mock Mode) ===
To: {', '.join(to)}
Subject: {subject}
Body: {body[:200]}...
========================
                """)
                return {
                    "success": True,
                    "message": "Email logged (SMTP not configured)",
                    "messageId": "mock-" + str(os.urandom(8).hex())
                }
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = from_email or settings.SMTP_FROM or settings.SMTP_USER
            msg['To'] = ', '.join(to)
            
            if cc:
                msg['Cc'] = ', '.join(cc)
            
            # Attach plain text
            msg.attach(MIMEText(body, 'plain'))
            
            # Attach HTML if provided
            if html:
                msg.attach(MIMEText(html, 'html'))
            
            # Send via SMTP
            await aiosmtplib.send(
                msg,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASS,
                use_tls=settings.SMTP_SECURE
            )
            
            logger.info(f"Email sent successfully to {', '.join(to)}")
            
            return {
                "success": True,
                "message": "Email sent successfully",
                "messageId": msg['Message-ID'] if 'Message-ID' in msg else "sent-" + str(os.urandom(8).hex())
            }
            
        except Exception as e:
            logger.error(f"Email sending error: {e}")
            raise


# Singleton instance
email_service = EmailService()


# Email templates
def get_password_reset_email(reset_link: str, user_name: str) -> tuple[str, str]:
    """Get password reset email content"""
    subject = "Reset Your Password - Compliant4"
    
    plain_text = f"""
Hello {user_name},

You requested to reset your password for your Compliant4 account.

Click the link below to reset your password:
{reset_link}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
The Compliant4 Team
    """
    
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>Reset Your Password</h2>
        <p>Hello {user_name},</p>
        <p>You requested to reset your password for your Compliant4 account.</p>
        <p>
            <a href="{reset_link}" 
               style="background-color: #3b82f6; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; display: inline-block;">
                Reset Password
            </a>
        </p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
            This is an automated email from Compliant4. Please do not reply.
        </p>
    </body>
    </html>
    """
    
    return subject, plain_text, html


def get_broker_notification_email(broker_name: str, coi_link: str, gc_name: str, project_name: str) -> tuple[str, str, str]:
    """Get broker notification email content"""
    subject = f"Action Required: COI Request for {project_name}"
    
    plain_text = f"""
Hello {broker_name},

{gc_name} has requested a Certificate of Insurance for the following project:

Project: {project_name}

Please review and submit the COI using the link below:
{coi_link}

This request was sent via Compliant4.

Best regards,
The Compliant4 Team
    """
    
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>Action Required: COI Request</h2>
        <p>Hello {broker_name},</p>
        <p><strong>{gc_name}</strong> has requested a Certificate of Insurance for:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 4px; margin: 15px 0;">
            <p style="margin: 5px 0;"><strong>Project:</strong> {project_name}</p>
        </div>
        <p>
            <a href="{coi_link}" 
               style="background-color: #10b981; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; display: inline-block;">
                Review and Submit COI
            </a>
        </p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
            This request was sent via Compliant4.
        </p>
    </body>
    </html>
    """
    
    return subject, plain_text, html
