# Password Reset and Recovery Flow

This document describes the password reset and recovery functionality in INsuretrack.

## Overview

The password reset flow allows users to securely reset their passwords through email verification, without requiring admin intervention. This self-service feature enhances security by enabling users to quickly recover access to their accounts.

## Features

- **Self-Service**: Users can reset passwords independently
- **Email Verification**: Secure token sent to registered email
- **Time-Limited**: Reset tokens expire after 1 hour
- **Single-Use**: Tokens are invalidated after successful use
- **Strong Password Policy**: Enforces 12-character minimum with complexity requirements
- **All User Types**: Works for Admin, GC, Broker, and Subcontractor accounts

## How It Works

### Step 1: Request Password Reset

1. User clicks "Forgot password?" on the login page
2. User enters their email address
3. System generates a secure reset token
4. System sends email with reset link
5. User receives confirmation (regardless of email existence to prevent enumeration)

**Endpoint**: `POST /auth/request-password-reset`

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response** (always success to prevent email enumeration):
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

### Step 2: Reset Password

1. User clicks the link in the email
2. User is directed to reset password page with token in URL
3. User enters new password (must meet requirements)
4. User confirms new password
5. System validates token and updates password
6. User is redirected to login page

**Endpoint**: `POST /auth/reset-password`

**Request Body**:
```json
{
  "email": "user@example.com",
  "token": "secure-token-from-email",
  "newPassword": "NewSecurePassword123!"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password has been reset successfully. You can now log in with your new password."
}
```

## Password Requirements

All passwords must meet the following requirements:

- **Minimum Length**: 12 characters
- **Uppercase**: At least one uppercase letter (A-Z)
- **Lowercase**: At least one lowercase letter (a-z)
- **Number**: At least one digit (0-9)
- **Special Character**: At least one special character (!@#$%^&*)

Examples of valid passwords:
- `SecurePass123!`
- `MyNewP@ssw0rd2024`
- `Insure7Track!23`

## Security Features

### Token Generation
- Uses `crypto.randomBytes(32)` for cryptographically secure random tokens
- 256 bits of entropy (extremely difficult to guess)
- Tokens are stored server-side with expiration

### Token Expiration
- Tokens expire after 1 hour
- Expired tokens are automatically rejected
- Expired tokens are cleaned up from storage

### Single-Use Tokens
- Tokens can only be used once
- After successful password reset, token is marked as used
- Used tokens cannot be reused

### Email Enumeration Prevention
- System always returns success message
- Response doesn't reveal if email exists in system
- Actual email only sent if account exists

### Rate Limiting
- Password reset requests are rate-limited
- Prevents abuse and brute force attempts
- Uses existing auth limiter (5 attempts per 15 minutes)

## Email Template

The password reset email includes:

- Clear subject line: "Password Reset Request - INsuretrack"
- Personalized greeting with user's name
- Clear explanation of the request
- Prominent "Reset Password" button
- Plain text link as fallback
- Expiration notice (1 hour)
- Security advice (ignore if not requested)

Example email content:
```
Password Reset Request

Hello [User Name],

We received a request to reset your password for your INsuretrack account.

Click the button below to reset your password:

[Reset Password Button]

Or copy and paste this link into your browser:
https://yourapp.com/reset-password?token=xxx&email=user@example.com

This link will expire in 1 hour. If you didn't request a password reset, 
please ignore this email.
```

## User Experience

### Login Page
- Prominent "Forgot password?" link below password field
- Link opens password reset request form

### Forgot Password Page
- Simple form with email input
- Clear instructions
- Success message after submission
- "Back to Login" button
- Note about checking spam folder

### Reset Password Page
- Displays email address (read-only)
- New password field with visibility toggle
- Confirm password field
- Real-time password validation feedback
- Shows password requirements
- Passwords match indicator
- "Reset Password" button (disabled until valid)
- Auto-redirect to login after successful reset

## Error Handling

### Common Errors

**Invalid or Expired Token**:
```
Invalid or expired reset token. Please request a new password reset link.
```

**Token Already Used**:
```
Reset token has already been used. Please request a new password reset link.
```

**Password Validation Failed**:
```
Password must be at least 12 characters and contain uppercase, lowercase, 
number, and special character (!@#$%^&*)
```

**Passwords Don't Match**:
```
Passwords do not match
```

## Technical Implementation

### Backend Components

**Token Storage**:
- In-memory Map (for development)
- Production: Should use database with TTL
- Structure: `{ email: { token, expiresAt, used, userType } }`

**User Types Supported**:
- `user`: Regular admin users in users array
- `gc`: General contractor users in Contractor entities
- `broker`: Broker users in COI records

**Password Hashing**:
- Uses bcrypt with 10 salt rounds
- Async operations to prevent event loop blocking
- Same hashing method as regular password changes

### Frontend Components

**ForgotPassword.jsx**:
- Request password reset form
- Email input validation
- Success/error message display
- Back to login navigation

**ResetPassword.jsx**:
- Reset password form with token verification
- Password strength validation
- Confirm password matching
- Auto-redirect after success

**Login.jsx** (updated):
- Added "Forgot password?" link
- Toggle between login and forgot password views

### Routing

Reset password route available in all portals:
- `/reset-password` (admin portal)
- `/reset-password` (GC portal)
- `/reset-password` (broker portal)
- `/reset-password` (subcontractor portal)

## Production Considerations

### Email Delivery

- Requires properly configured SMTP settings
- Test email delivery before production deployment
- Monitor email bounce rates
- Consider using dedicated email service (SendGrid, Mailgun, etc.)

### Token Storage

- Current implementation uses in-memory storage
- Production should use:
  - Database with TTL/expiration indexes
  - Redis for fast token lookups
  - Automatic cleanup of expired tokens

### Monitoring

Recommended monitoring:
- Password reset request rate
- Successful vs failed reset attempts
- Token expiration rates
- Email delivery failures

### Rate Limiting

- Current: 5 attempts per 15 minutes per IP
- Adjust based on user behavior analysis
- Consider per-email rate limiting

## Testing

### Manual Testing Checklist

- [ ] Request password reset with valid email
- [ ] Request password reset with non-existent email
- [ ] Click reset link from email
- [ ] Enter new password meeting requirements
- [ ] Enter new password not meeting requirements
- [ ] Verify passwords must match
- [ ] Verify token expires after 1 hour
- [ ] Verify token cannot be reused
- [ ] Verify can login with new password
- [ ] Verify old password no longer works
- [ ] Test for all user types (admin, GC, broker)

### Security Testing

- [ ] Verify tokens are cryptographically secure
- [ ] Verify rate limiting is enforced
- [ ] Verify email enumeration is prevented
- [ ] Verify expired tokens are rejected
- [ ] Verify used tokens cannot be reused
- [ ] Verify HTTPS is used for reset links
- [ ] Verify passwords are hashed with bcrypt

## Troubleshooting

### Email Not Received

1. Check spam/junk folder
2. Verify SMTP configuration
3. Check email service logs
4. Verify email address is correct
5. Request new reset link

### Token Invalid or Expired

1. Request new password reset
2. Complete reset within 1 hour
3. Don't refresh reset page (may lose token)
4. Use link from most recent email

### Password Requirements Not Clear

- Show requirements before submission
- Real-time validation feedback
- Clear error messages
- Examples of valid passwords

## Future Enhancements

Potential improvements:

- [ ] Add password reset history/audit log
- [ ] Add email verification step for new accounts
- [ ] Add account lockout after multiple failed attempts
- [ ] Add password reset via SMS (2FA)
- [ ] Add password strength meter
- [ ] Add common password blacklist
- [ ] Add password history (prevent reuse)
- [ ] Add multi-language support for emails
- [ ] Add custom email templates per organization

## Support

For issues or questions:
- Check application logs for errors
- Review SMTP configuration
- Contact system administrator
- Refer to Security Hardening documentation
