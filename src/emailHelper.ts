import { getAuthHeader } from '@/auth';
import { createEmailTemplate } from '@/emailTemplates';
import { escapeHtml } from '@/utils/htmlEscaping';

/**
 * RFC 2606 Reserved Domains - These should never be sent to in production
 * but are safe to skip in development environments
 */
const RFC_2606_RESERVED_DOMAINS = [
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'test.net',
  'test.org',
  'invalid',
  'localhost',
  '127.0.0.1'
];

export interface EmailPayload {
  to: string;
  subject: string;
  body?: string;
  html?: string;
  [key: string]: unknown;
}

export interface EmailResponse {
  success: boolean;
  skipped?: boolean;
  reason?: string;
}

/**
 * Check if an email address uses a reserved/test domain
 */
export const isReservedEmailDomain = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return RFC_2606_RESERVED_DOMAINS.includes(domain);
};

/**
 * Check if we're in a development-like environment
 */
const isDevEnvironment = (): boolean => {
  return (
    (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') ||
    (typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.app.github.dev')
    ))
  );
};

/**
 * Direct email sending helper - uses backend API directly
 */
export const sendEmail = async (payload: EmailPayload): Promise<EmailResponse> => {
  const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin.replace(':5173', ':3001').replace(':5175', ':3001');

  const formatBodyAsHtml = (body: string, subject: string): string => {
    const safeBody = escapeHtml(body || '').replace(/\r\n/g, '\n');
    const paragraphs = safeBody
      .split(/\n\s*\n/)
      .map(p => p.replace(/\n/g, '<br>'))
      .map(p => `<p>${p}</p>`)
      .join('');
    return createEmailTemplate(subject || 'Notification', '', paragraphs);
  };

  const finalPayload: EmailPayload = { ...payload };
  if (!finalPayload.html && finalPayload.body) {
    finalPayload.html = formatBodyAsHtml(finalPayload.body, finalPayload.subject);
  }
  
  // Check if recipient uses a reserved domain in development
  if (isReservedEmailDomain(finalPayload.to) && isDevEnvironment()) {
    console.warn('⚠️ Email to reserved domain skipped in development:', {
      to: finalPayload.to,
      subject: finalPayload.subject,
      reason: 'RFC 2606 reserved domain cannot be sent to in development. Use a real email address to test email sending.'
    });
    // Return success response to prevent error handling downstream
    return { success: true, skipped: true, reason: 'Reserved domain in development' };
  }
  
  // First try the authenticated endpoint (preferred in normal usage)
  const res = await fetch(`${apiBase}/integrations/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    credentials: 'include',
    body: JSON.stringify(finalPayload)
  });
  if (res.ok) {
    return await res.json();
  }

  // If unauthorized in development-like environments, fall back to public endpoint
  const isAuthError = res.status === 401 || res.status === 403;
  const isDevLike = isDevEnvironment();

  if (isAuthError && isDevLike) {
    try {
      const fallback = await fetch(`${apiBase}/public/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(finalPayload)
      });
      if (fallback.ok) {
        return await fallback.json();
      }
      const fallbackErr = await fallback.text().catch(() => '');
      throw new Error(`Public email fallback failed: ${fallback.status} ${fallbackErr}`);
    } catch (e) {
      const originalErr = await res.text().catch(() => '');
      const errorMessage = e instanceof Error ? e.message : String(e);
      throw new Error(`Email send failed (auth) and public fallback failed. Original: ${res.status} ${originalErr}. Fallback error: ${errorMessage}`);
    }
  } else {
    const error = await res.text().catch(() => '');
    throw new Error(`Email send failed: ${res.status} ${error}`);
  }
};
